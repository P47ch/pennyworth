import type { FastifyInstance } from "fastify";
import { loadConfig } from "../../lib/config.js";
import { createTranslator } from "../../lib/i18n.js";
import { categoryIconOptions } from "../../lib/icons.js";
import { normalizeUserPreferences } from "../../lib/preferences.js";
import { consumeTransactionNotice, setTransactionNotice } from "../../lib/transactionNotice.js";
import { listAccountsWithBalances } from "../../services/accounts.js";
import { categoryTypes, listCategories, listTags } from "../../services/taxonomy.js";
import {
  createTransaction,
  deleteTransaction,
  getTransactionForUser,
  listTransactionPage,
  transactionTypes,
  updateTransaction
} from "../../services/transactions.js";
import { requireCurrentUser } from "../../services/users.js";
import { formBody } from "../form.js";
import { isDeleteConfirmed, showDeleteConfirmation } from "../deleteConfirmation.js";
import {
  parseTransactionFilters,
  parseTransactionPage,
  transactionFormValues,
  validateTransactionInput
} from "./shared.js";

export async function transactionCrudRoutes(app: FastifyInstance) {
  app.get("/transactions", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const filters = parseTransactionFilters(request.query);
    const [transactionPage, accounts, categories, tags] = await Promise.all([
      listTransactionPage(user.id, filters, parseTransactionPage(request.query)),
      listAccountsWithBalances(user.id),
      listCategories(user.id),
      listTags(user.id)
    ]);

    return reply.view("transactions/index.ejs", {
      title: "Transactions",
      transactions: transactionPage.transactions,
      pagination: transactionPage,
      accounts,
      categories,
      tags,
      transactionTypes,
      filters,
      form: transactionFormValues(),
      categoryTypes,
      categoryIconOptions,
      notice: consumeTransactionNotice(request, reply, user.id),
      error: null,
    });
  });

  app.post("/transactions", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      const transaction = await createTransaction({
        userId: user.id,
        ...validateTransactionInput(body)
      });

      setTransactionNotice(reply, user.id, transaction.appliedRule, createTranslator(normalizeUserPreferences(user).language), loadConfig().secureCookies);
      return reply.redirect("/transactions");
    } catch (error) {
      const [transactionPage, accounts, categories, tags] = await Promise.all([
        listTransactionPage(user.id),
        listAccountsWithBalances(user.id),
        listCategories(user.id),
        listTags(user.id)
      ]);

      return reply.code(400).view("transactions/index.ejs", {
        title: "Transactions",
        transactions: transactionPage.transactions,
        pagination: transactionPage,
        accounts,
        categories,
        tags,
        transactionTypes,
        filters: parseTransactionFilters({}),
        form: transactionFormValues(body),
        categoryTypes,
        categoryIconOptions,
        notice: null,
        error: error instanceof Error ? error.message : "Could not create transaction.",
      });
    }
  });

  app.get("/transactions/:transactionId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { transactionId } = request.params as { transactionId: string };
    const [transaction, accounts, categories, tags] = await Promise.all([
      getTransactionForUser(user.id, transactionId),
      listAccountsWithBalances(user.id),
      listCategories(user.id),
      listTags(user.id)
    ]);

    if (!transaction) {
      return reply.redirect("/transactions");
    }

    return reply.view("transactions/edit.ejs", {
      title: "Edit transaction",
      transaction,
      accounts,
      categories,
      tags,
      transactionTypes,
      error: null
    });
  });

  app.post("/transactions/:transactionId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { transactionId } = request.params as { transactionId: string };
    const body = formBody(request.body);

    try {
      await updateTransaction({
        userId: user.id,
        transactionId,
        ...validateTransactionInput(body)
      });

      return reply.redirect("/transactions");
    } catch (error) {
      const [transaction, accounts, categories, tags] = await Promise.all([
        getTransactionForUser(user.id, transactionId),
        listAccountsWithBalances(user.id),
        listCategories(user.id),
        listTags(user.id)
      ]);

      if (!transaction) {
        return reply.redirect("/transactions");
      }

      return reply.code(400).view("transactions/edit.ejs", {
        title: "Edit transaction",
        transaction,
        accounts,
        categories,
        tags,
        transactionTypes,
        error: error instanceof Error ? error.message : "Could not update transaction."
      });
    }
  });

  app.post("/transactions/:transactionId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { transactionId } = request.params as { transactionId: string };

    const transaction = await getTransactionForUser(user.id, transactionId);
    if (!transaction) return reply.redirect("/transactions");
    if (!isDeleteConfirmed(request.body)) {
      return showDeleteConfirmation(reply, {
        title: "Delete transaction", recordName: transaction.description || "—",
        deleteAction: `/transactions/${transaction.id}/delete`, cancelHref: "/transactions",
        details: [{ label: "Type", type: transaction.type }, { label: "Date", value: transaction.date.toISOString().slice(0, 10) },
          { label: "Account", value: transaction.sourceAccount?.name || "—" },
          ...(transaction.destinationAccount ? [{ label: "Destination account", value: transaction.destinationAccount.name }] : []),
          { label: "Amount", amountMinor: transaction.amountMinor, currency: transaction.sourceAccount?.currency || loadConfig().primaryCurrency }],
        warnings: ["This transaction will be permanently deleted.",
          ...(transaction.feeTransaction ? ["Deleting this transfer also deletes its linked fee expense."] : []),
          ...(transaction.feeForTransactionId ? ["Deleting this fee keeps the linked transfer."] : [])]
      });
    }
    await deleteTransaction(user.id, transactionId);
    return reply.redirect("/transactions");
  });
}
