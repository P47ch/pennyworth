import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { createTranslator } from "../lib/i18n.js";
import { normalizeUserPreferences } from "../lib/preferences.js";
import { setTransactionNotice } from "../lib/transactionNotice.js";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import { recurringFrequencyLabels, type RecurringFeeAccount } from "../finance/recurring.js";
import { loadConfig } from "../lib/config.js";
import { listAccountsWithBalances } from "../services/accounts.js";
import { createRecurringTransaction, deleteRecurringTransaction, generateRecurringTransaction, getRecurringForUser,
  listRecurringTransactions, previewRecurringTransaction, recurringFrequencies, skipRecurringOccurrence,
  updateRecurringTransaction, RecurringPreviewChangedError, type RecurringConfirmation } from "../services/recurring.js";
import { listCategories } from "../services/taxonomy.js";
import { transactionTypes } from "../services/transactions.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";
import { parseRecurringConfirmationDate, recurringFormValues, validateRecurringInput } from "./recurringInput.js";

const timeZone = loadConfig().timeZone;
function errorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A recurring template with that name already exists.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError
    || error instanceof Prisma.PrismaClientValidationError) return "Could not save recurring transaction.";
  return error instanceof Error ? error.message : "Could not save recurring transaction.";
}
async function pageData(userId: string) {
  const [recurringTransactions, accounts, categories] = await Promise.all([
    listRecurringTransactions(userId), listAccountsWithBalances(userId), listCategories(userId)
  ]);
  return { recurringTransactions, accounts, categories, transactionTypes, recurringFrequencies, recurringFrequencyLabels };
}
function feeOverride(body: ReturnType<typeof formBody>) {
  return { feeAmountMinor: parseMoneyToMinorUnits(field(body, "feeAmount") || "0"),
    feeAccount: (field(body, "feeAccount") || "source") as RecurringFeeAccount };
}
function confirmation(body: ReturnType<typeof formBody>): RecurringConfirmation {
  return { ...feeOverride(body), expectedDate: parseRecurringConfirmationDate(field(body, "expectedDate")),
    expectedRevision: field(body, "expectedRevision"), signature: field(body, "signature") };
}
export async function recurringRoutes(app: FastifyInstance) {
  app.get("/recurring", async (request, reply) => {
    const user = await requireCurrentUser(request);
    return reply.view("recurring/index.ejs", { title: "Recurring", ...(await pageData(user.id)),
      form: recurringFormValues(timeZone), error: null });
  });
  app.post("/recurring", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    try {
      await createRecurringTransaction({ userId: user.id, ...validateRecurringInput(body) });
      return reply.redirect("/recurring");
    } catch (error) {
      return reply.code(400).view("recurring/index.ejs", { title: "Recurring", ...(await pageData(user.id)),
        form: recurringFormValues(timeZone, body), error: errorMessage(error) });
    }
  });
  app.get("/recurring/:recurringId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };
    const recurring = await getRecurringForUser(user.id, recurringId);
    if (!recurring) return reply.redirect("/recurring");
    return reply.view("recurring/edit.ejs", { title: "Edit recurring", recurring, ...(await pageData(user.id)),
      nameMaxLength: Math.max(100, recurring.name.length),
      form: { ...recurring, amount: recurring.amountMinor === null ? "" : (recurring.amountMinor / 100).toFixed(2),
        targetBalance: recurring.targetBalanceMinor === null ? "" : (recurring.targetBalanceMinor / 100).toFixed(2),
        feeAmount: (recurring.feeAmountMinor / 100).toFixed(2), nextDate: recurring.nextDate.toISOString().slice(0, 10) }, error: null });
  });
  app.post("/recurring/:recurringId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };
    const body = formBody(request.body);
    try {
      await updateRecurringTransaction({ userId: user.id, recurringId, ...validateRecurringInput(body) });
      return reply.redirect("/recurring");
    } catch (error) {
      const recurring = await getRecurringForUser(user.id, recurringId);
      if (!recurring) return reply.redirect("/recurring");
      return reply.code(400).view("recurring/edit.ejs", { title: "Edit recurring", recurring, ...(await pageData(user.id)),
        nameMaxLength: Math.max(100, recurring.name.length),
        form: recurringFormValues(timeZone, body), error: errorMessage(error) });
    }
  });
  app.get("/recurring/:recurringId/preview", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };
    try {
      return reply.view("recurring/preview.ejs", { title: "Preview recurring transaction",
        preview: await previewRecurringTransaction(user.id, recurringId), error: null });
    } catch (error) {
      return reply.code(400).view("recurring/index.ejs", { title: "Recurring", ...(await pageData(user.id)),
        form: recurringFormValues(timeZone), error: errorMessage(error) });
    }
  });
  app.post("/recurring/:recurringId/preview", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };
    try {
      return reply.view("recurring/preview.ejs", { title: "Preview recurring transaction",
        preview: await previewRecurringTransaction(user.id, recurringId, feeOverride(formBody(request.body))), error: null });
    } catch (error) {
      try {
        return reply.code(400).view("recurring/preview.ejs", { title: "Preview recurring transaction",
          preview: await previewRecurringTransaction(user.id, recurringId), error: errorMessage(error) });
      } catch {
        return reply.code(400).view("recurring/index.ejs", { title: "Recurring", ...(await pageData(user.id)),
          form: recurringFormValues(timeZone), error: errorMessage(error) });
      }
    }
  });
  for (const action of ["generate", "skip"] as const) {
    app.post(`/recurring/:recurringId/${action}`, async (request, reply) => {
      const user = await requireCurrentUser(request);
      const { recurringId } = request.params as { recurringId: string };
      try {
        const confirmed = confirmation(formBody(request.body));
        if (action === "skip") await skipRecurringOccurrence(user.id, recurringId, confirmed);
        else {
          const transaction = await generateRecurringTransaction(user.id, recurringId, confirmed);
          setTransactionNotice(reply, user.id, transaction.appliedRule,
            createTranslator(normalizeUserPreferences(user).language), loadConfig().secureCookies);
        }
        return reply.redirect(action === "skip" ? "/recurring" : "/transactions");
      } catch (error) {
        try {
          return reply.code(error instanceof RecurringPreviewChangedError ? 409 : 400).view("recurring/preview.ejs", {
            title: "Preview recurring transaction", preview: await previewRecurringTransaction(user.id, recurringId), error: errorMessage(error) });
        } catch {
          return reply.code(400).view("recurring/index.ejs", { title: "Recurring", ...(await pageData(user.id)),
            form: recurringFormValues(timeZone), error: errorMessage(error) });
        }
      }
    });
  }
  app.post("/recurring/:recurringId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };
    await deleteRecurringTransaction(user.id, recurringId);
    return reply.redirect("/recurring");
  });
}
