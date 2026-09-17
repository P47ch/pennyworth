import type { InvestmentTransactionType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { parseMoneyToMinorUnits } from "../finance/money.js";
import { formatDateOnly, parseDateOnly } from "../lib/dates.js";
import {
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  getInvestmentTransactionForUser,
  investmentTransactionTypes,
  listInvestmentTransactionFormOptions,
  listInvestmentTransactionPage,
  updateInvestmentTransaction
} from "../services/investmentTransactions.js";
import { requireCurrentUser } from "../services/users.js";
import { field, formBody } from "./form.js";

function parseOptionalQuantity(input: string) {
  const normalized = input.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  if (!/^\d+(\.\d{1,8})?$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error("Quantity must be a positive number with up to 8 decimal places.");
  }

  return normalized;
}

function formatQuantity(value: { toString(): string } | null) {
  return value ? value.toString().replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : "";
}

function parsePage(query: unknown) {
  if (!query || typeof query !== "object") {
    return 1;
  }

  const rawValue = (query as Record<string, unknown>).page;
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return 1;
  }

  return Math.max(1, Number.parseInt(value, 10));
}

function validateInvestmentTransactionInput(body: ReturnType<typeof formBody>) {
  const accountId = field(body, "accountId");
  const cashAccountId = field(body, "cashAccountId") || null;
  const assetId = field(body, "assetId");
  const type = field(body, "type") as InvestmentTransactionType;
  const date = parseDateOnly(field(body, "date"), "Date must be valid.");
  const quantity = parseOptionalQuantity(field(body, "quantity"));
  const priceInput = field(body, "price").trim();
  const amountMinor = parseMoneyToMinorUnits(field(body, "amount"));
  const cashAmountInput = field(body, "cashAmount").trim();
  const cashAmountMinor = cashAmountInput ? parseMoneyToMinorUnits(cashAmountInput) : amountMinor;
  const notes = field(body, "notes").trim();

  if (!accountId) {
    throw new Error("Choose an account.");
  }

  if (!assetId) {
    throw new Error("Choose an asset.");
  }

  if (!investmentTransactionTypes.includes(type)) {
    throw new Error("Choose a valid investment transaction type.");
  }

  if (amountMinor <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  if (cashAmountMinor <= 0) {
    throw new Error("Cash amount must be greater than zero.");
  }

  const requiresQuantityAndPrice = type === "buy" || type === "sell";
  const priceMinor = priceInput ? parseMoneyToMinorUnits(priceInput) : null;

  if (requiresQuantityAndPrice && !quantity) {
    throw new Error("Buy and sell transactions require a quantity.");
  }

  if (requiresQuantityAndPrice && (!priceMinor || priceMinor <= 0)) {
    throw new Error("Buy and sell transactions require a unit price greater than zero.");
  }

  if (priceMinor !== null && priceMinor <= 0) {
    throw new Error("Unit price must be greater than zero.");
  }

  return {
    accountId,
    cashAccountId,
    assetId,
    type,
    date,
    quantity,
    priceMinor,
    amountMinor,
    cashAmountMinor,
    notes
  };
}

export async function investmentTransactionRoutes(app: FastifyInstance) {
  app.get("/investment-transactions", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const [transactionPage, options] = await Promise.all([
      listInvestmentTransactionPage(user.id, parsePage(request.query)),
      listInvestmentTransactionFormOptions(user.id)
    ]);

    return reply.view("investment-transactions/index.ejs", {
      title: "Investment transactions",
      investmentTransactions: transactionPage.transactions,
      pagination: transactionPage,
      accounts: options.accounts,
      cashAccounts: options.cashAccounts,
      assets: options.assets,
      investmentTransactionTypes,
      error: null,
      formatDateInput: formatDateOnly,
      formatQuantity
    });
  });

  app.post("/investment-transactions", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      await createInvestmentTransaction({
        userId: user.id,
        ...validateInvestmentTransactionInput(body)
      });

      return reply.redirect("/investment-transactions");
    } catch (error) {
      const [transactionPage, options] = await Promise.all([
        listInvestmentTransactionPage(user.id),
        listInvestmentTransactionFormOptions(user.id)
      ]);

      return reply.code(400).view("investment-transactions/index.ejs", {
        title: "Investment transactions",
        investmentTransactions: transactionPage.transactions,
        pagination: transactionPage,
        accounts: options.accounts,
        cashAccounts: options.cashAccounts,
        assets: options.assets,
        investmentTransactionTypes,
        error: error instanceof Error ? error.message : "Could not create investment transaction.",
        formatDateInput: formatDateOnly,
        formatQuantity
      });
    }
  });

  app.get("/investment-transactions/:investmentTransactionId/edit", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { investmentTransactionId } = request.params as { investmentTransactionId: string };
    const [investmentTransaction, options] = await Promise.all([
      getInvestmentTransactionForUser(user.id, investmentTransactionId),
      listInvestmentTransactionFormOptions(user.id)
    ]);

    if (!investmentTransaction) {
      return reply.redirect("/investment-transactions");
    }

    return reply.view("investment-transactions/edit.ejs", {
      title: "Edit investment transaction",
      investmentTransaction,
      accounts: options.accounts,
      cashAccounts: options.cashAccounts,
      assets: options.assets,
      investmentTransactionTypes,
      error: null,
      formatDateInput: formatDateOnly,
      formatQuantity
    });
  });

  app.post("/investment-transactions/:investmentTransactionId", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { investmentTransactionId } = request.params as { investmentTransactionId: string };
    const body = formBody(request.body);

    try {
      await updateInvestmentTransaction({
        userId: user.id,
        investmentTransactionId,
        ...validateInvestmentTransactionInput(body)
      });

      return reply.redirect("/investment-transactions");
    } catch (error) {
      const [investmentTransaction, options] = await Promise.all([
        getInvestmentTransactionForUser(user.id, investmentTransactionId),
        listInvestmentTransactionFormOptions(user.id)
      ]);

      if (!investmentTransaction) {
        return reply.redirect("/investment-transactions");
      }

      return reply.code(400).view("investment-transactions/edit.ejs", {
        title: "Edit investment transaction",
        investmentTransaction,
        accounts: options.accounts,
        cashAccounts: options.cashAccounts,
        assets: options.assets,
        investmentTransactionTypes,
        error: error instanceof Error ? error.message : "Could not update investment transaction.",
        formatDateInput: formatDateOnly,
        formatQuantity
      });
    }
  });

  app.post("/investment-transactions/:investmentTransactionId/delete", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const { investmentTransactionId } = request.params as { investmentTransactionId: string };

    await deleteInvestmentTransaction(user.id, investmentTransactionId);
    return reply.redirect("/investment-transactions");
  });
}
