import type { FastifyInstance } from "fastify";
import { listAccountsWithBalances } from "../../services/accounts.js";
import { listCategories, listTags } from "../../services/taxonomy.js";
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
      error: null,
    });
  });

  app.post("/transactions", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createTransaction({
        userId: user.id,
        ...validateTransactionInput(body)
      });

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

    await deleteTransaction(user.id, transactionId);
    return reply.redirect("/transactions");
  });
}
