import type { RecurringFrequency, TransactionType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import { loadConfig } from "../lib/config.js";
import { parseDateOnly, todayDateInput } from "../lib/dates.js";
import { listAccountsWithBalances } from "../services/accounts.js";
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  generateRecurringTransaction,
  getRecurringForUser,
  listRecurringTransactions,
  recurringFrequencies,
  updateRecurringTransaction
} from "../services/recurring.js";
import { listCategories } from "../services/taxonomy.js";
import { transactionTypes } from "../services/transactions.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

const timeZone = loadConfig().timeZone;

function formValues(body?: ReturnType<typeof formBody>) {
  return {
    name: body ? field(body, "name") : "",
    type: body ? field(body, "type") : "expense",
    amount: body ? field(body, "amount") : "",
    sourceAccountId: body ? field(body, "sourceAccountId") : "",
    destinationAccountId: body ? field(body, "destinationAccountId") : "",
    categoryId: body ? field(body, "categoryId") : "",
    description: body ? field(body, "description") : "",
    notes: body ? field(body, "notes") : "",
    frequency: body ? field(body, "frequency") : "monthly",
    nextDate: body ? field(body, "nextDate") : todayDateInput(timeZone),
    isActive: body ? field(body, "isActive") === "on" : true
  };
}

function validateRecurringInput(body: ReturnType<typeof formBody>) {
  const name = field(body, "name").trim();
  const type = field(body, "type") as TransactionType;
  const frequency = field(body, "frequency") as RecurringFrequency;
  const amountMinor = parseMoneyToMinorUnits(field(body, "amount"));

  if (!name) {
    throw new Error("Name is required.");
  }

  if (!transactionTypes.includes(type)) {
    throw new Error("Choose a valid transaction type.");
  }

  if (!recurringFrequencies.includes(frequency)) {
    throw new Error("Choose a valid frequency.");
  }

  if (amountMinor <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return {
    name,
    type,
    amountMinor,
    sourceAccountId: field(body, "sourceAccountId"),
    destinationAccountId: field(body, "destinationAccountId"),
    categoryId: field(body, "categoryId"),
    description: field(body, "description").trim(),
    notes: field(body, "notes").trim(),
    frequency,
    nextDate: parseDateOnly(field(body, "nextDate"), "Choose a valid next date."),
    isActive: field(body, "isActive") === "on"
  };
}

async function pageData(userId: string) {
  const [recurringTransactions, accounts, categories] = await Promise.all([
    listRecurringTransactions(userId),
    listAccountsWithBalances(userId),
    listCategories(userId)
  ]);

  return {
    recurringTransactions,
    accounts,
    categories,
    transactionTypes,
    recurringFrequencies
  };
}

export async function recurringRoutes(app: FastifyInstance) {
  app.get("/recurring", async (request, reply) => {
    const user = await requireCurrentUser(request);

    return reply.view("recurring/index.ejs", {
      title: "Recurring",
      ...(await pageData(user.id)),
      form: formValues(),
      error: null,
    });
  });

  app.post("/recurring", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createRecurringTransaction({ userId: user.id, ...validateRecurringInput(body) });
      return reply.redirect("/recurring");
    } catch (error) {
      return reply.code(400).view("recurring/index.ejs", {
        title: "Recurring",
        ...(await pageData(user.id)),
        form: formValues(body),
        error: error instanceof Error ? error.message : "Could not create recurring transaction.",
      });
    }
  });

  app.get("/recurring/:recurringId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };
    const recurring = await getRecurringForUser(user.id, recurringId);

    if (!recurring) {
      return reply.redirect("/recurring");
    }

    return reply.view("recurring/edit.ejs", {
      title: "Edit recurring",
      recurring,
      ...(await pageData(user.id)),
      error: null,
    });
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

      if (!recurring) {
        return reply.redirect("/recurring");
      }

      return reply.code(400).view("recurring/edit.ejs", {
        title: "Edit recurring",
        recurring,
        ...(await pageData(user.id)),
        error: error instanceof Error ? error.message : "Could not update recurring transaction.",
      });
    }
  });

  app.post("/recurring/:recurringId/generate", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };

    await generateRecurringTransaction(user.id, recurringId);
    return reply.redirect("/transactions");
  });

  app.post("/recurring/:recurringId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { recurringId } = request.params as { recurringId: string };

    await deleteRecurringTransaction(user.id, recurringId);
    return reply.redirect("/recurring");
  });
}
