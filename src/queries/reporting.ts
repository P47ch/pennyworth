import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { safeBigIntToNumber } from "./resultValues.js";

type QueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export type CashflowTotalRow = {
  monthKey: string;
  incomeMinor: bigint;
  expensesMinor: bigint;
};

export type CashflowTotal = {
  monthKey: string;
  incomeMinor: number;
  expensesMinor: number;
  netCashflowMinor: number;
};

export type ExpenseTotalRow = {
  id: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  amountMinor: bigint;
};

export type ExpenseTotal = {
  id: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  amountMinor: number;
};

export type MonthlyCategoryExpenseRow = {
  monthKey: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon?: string | null;
  amountMinor: bigint;
};

export type MonthlyCategoryExpense = Omit<MonthlyCategoryExpenseRow, "amountMinor"> & {
  amountMinor: number;
};

export function cashflowRowsToTotals(rows: readonly CashflowTotalRow[]): CashflowTotal[] {
  return rows.map((row) => {
    const incomeMinor = safeBigIntToNumber(row.incomeMinor, `Income for ${row.monthKey}`);
    const expensesMinor = safeBigIntToNumber(row.expensesMinor, `Expenses for ${row.monthKey}`);
    const netCashflowMinor = incomeMinor - expensesMinor;

    if (!Number.isSafeInteger(netCashflowMinor)) {
      throw new Error(`Net cashflow for ${row.monthKey} exceeds the safe integer range.`);
    }

    return {
      monthKey: row.monthKey,
      incomeMinor,
      expensesMinor,
      netCashflowMinor
    };
  });
}

export function expenseRowsToTotals(rows: readonly ExpenseTotalRow[]): ExpenseTotal[] {
  return rows.map((row) => {
    const identity = "color" in row || "icon" in row
      ? { color: row.color ?? null, icon: row.icon ?? null }
      : {};

    return {
      id: row.id,
      name: row.name,
      ...identity,
      amountMinor: safeBigIntToNumber(row.amountMinor, `Expense total for ${row.name}`)
    };
  });
}

export function monthlyCategoryExpenseRowsToTotals(
  rows: readonly MonthlyCategoryExpenseRow[]
): MonthlyCategoryExpense[] {
  return rows.map((row) => ({
    ...row,
    amountMinor: safeBigIntToNumber(
      row.amountMinor,
      `Category expense for ${row.categoryName} in ${row.monthKey}`
    )
  }));
}

export async function getMonthlyCashflowTotals(
  userId: string,
  from: Date,
  to: Date,
  db: QueryClient | typeof prisma = prisma
): Promise<CashflowTotal[]> {
  const rows = await db.$queryRaw<CashflowTotalRow[]>`
    SELECT
      to_char("date", 'YYYY-MM') AS "monthKey",
      COALESCE(SUM("amountMinor") FILTER (WHERE "type" = 'income'), 0)::bigint AS "incomeMinor",
      COALESCE(SUM("amountMinor") FILTER (WHERE "type" = 'expense'), 0)::bigint AS "expensesMinor"
    FROM "Transaction"
    WHERE "userId" = ${userId}
      AND "date" >= ${from}
      AND "date" < ${to}
      AND "type" IN ('income', 'expense')
    GROUP BY to_char("date", 'YYYY-MM')
    ORDER BY "monthKey" ASC
  `;

  return cashflowRowsToTotals(rows);
}

export async function getExpenseTotalsByCategory(
  userId: string,
  from: Date,
  to: Date,
  db: QueryClient | typeof prisma = prisma
): Promise<ExpenseTotal[]> {
  const rows = await db.$queryRaw<ExpenseTotalRow[]>`
    SELECT
      category."id" AS "id",
      COALESCE(category."name", 'Uncategorized') AS "name",
      category."color" AS "color",
      category."icon" AS "icon",
      SUM(transaction."amountMinor")::bigint AS "amountMinor"
    FROM "Transaction" AS transaction
    LEFT JOIN "Category" AS category ON category."id" = transaction."categoryId"
    WHERE transaction."userId" = ${userId}
      AND transaction."type" = 'expense'
      AND transaction."date" >= ${from}
      AND transaction."date" < ${to}
    GROUP BY category."id", category."name", category."color", category."icon"
    ORDER BY "amountMinor" DESC, "name" ASC
  `;

  return expenseRowsToTotals(rows);
}

export async function getMonthlyExpenseTotalsByCategory(
  userId: string,
  from: Date,
  to: Date,
  db: QueryClient | typeof prisma = prisma
): Promise<MonthlyCategoryExpense[]> {
  const rows = await db.$queryRaw<MonthlyCategoryExpenseRow[]>`
    SELECT
      to_char(ledger_transaction."date", 'YYYY-MM') AS "monthKey",
      category."id" AS "categoryId",
      COALESCE(category."name", 'Uncategorized') AS "categoryName",
      category."color" AS "categoryColor",
      category."icon" AS "categoryIcon",
      SUM(ledger_transaction."amountMinor")::bigint AS "amountMinor"
    FROM "Transaction" AS ledger_transaction
    LEFT JOIN "Category" AS category ON category."id" = ledger_transaction."categoryId"
    WHERE ledger_transaction."userId" = ${userId}
      AND ledger_transaction."type" = 'expense'
      AND ledger_transaction."date" >= ${from}
      AND ledger_transaction."date" < ${to}
    GROUP BY
      to_char(ledger_transaction."date", 'YYYY-MM'),
      category."id",
      category."name",
      category."color",
      category."icon"
    ORDER BY "monthKey" ASC, "categoryName" ASC
  `;

  return monthlyCategoryExpenseRowsToTotals(rows);
}

export async function getExpenseTotalsByTag(
  userId: string,
  from: Date,
  to: Date,
  db: QueryClient | typeof prisma = prisma
): Promise<ExpenseTotal[]> {
  const rows = await db.$queryRaw<ExpenseTotalRow[]>`
    WITH expense_transactions AS (
      SELECT transaction."id", transaction."amountMinor"
      FROM "Transaction" AS transaction
      WHERE transaction."userId" = ${userId}
        AND transaction."type" = 'expense'
        AND transaction."date" >= ${from}
        AND transaction."date" < ${to}
    ), tagged_totals AS (
      SELECT
        tag."id" AS "id",
        tag."name" AS "name",
        SUM(expense_transactions."amountMinor")::bigint AS "amountMinor"
      FROM expense_transactions
      INNER JOIN "TransactionTag" AS transaction_tag
        ON transaction_tag."transactionId" = expense_transactions."id"
      INNER JOIN "Tag" AS tag ON tag."id" = transaction_tag."tagId"
      GROUP BY tag."id", tag."name"
    ), untagged_total AS (
      SELECT
        NULL::text AS "id",
        'Untagged'::text AS "name",
        SUM(expense_transactions."amountMinor")::bigint AS "amountMinor"
      FROM expense_transactions
      WHERE NOT EXISTS (
        SELECT 1
        FROM "TransactionTag" AS transaction_tag
        WHERE transaction_tag."transactionId" = expense_transactions."id"
      )
    )
    SELECT "id", "name", "amountMinor"
    FROM tagged_totals
    UNION ALL
    SELECT "id", "name", "amountMinor"
    FROM untagged_total
    WHERE "amountMinor" IS NOT NULL
    ORDER BY "amountMinor" DESC, "name" ASC
  `;

  return expenseRowsToTotals(rows);
}
