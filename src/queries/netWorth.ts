import type { AccountType, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { safeBigIntToNumber } from "./resultValues.js";

export type CashBalanceHistoryRow = {
  monthKey: string;
  cashBalanceMinor: bigint;
};

export type CashBalanceHistoryPoint = {
  monthKey: string;
  cashBalanceMinor: number;
};

export type AccountBalanceHistoryRow = {
  monthKey: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  currency: string;
  balanceMinor: bigint;
};

export type AccountBalanceHistoryPoint = Omit<AccountBalanceHistoryRow, "balanceMinor"> & {
  balanceMinor: number;
};

export function cashBalanceHistoryRowsToPoints(
  rows: readonly CashBalanceHistoryRow[]
): CashBalanceHistoryPoint[] {
  return rows.map((row) => ({
    monthKey: row.monthKey,
    cashBalanceMinor: safeBigIntToNumber(row.cashBalanceMinor, `Cash balance for ${row.monthKey}`)
  }));
}

export function accountBalanceHistoryRowsToPoints(
  rows: readonly AccountBalanceHistoryRow[]
): AccountBalanceHistoryPoint[] {
  return rows.map((row) => ({
    ...row,
    balanceMinor: safeBigIntToNumber(
      row.balanceMinor,
      `Balance for account ${row.accountId} in ${row.monthKey}`
    )
  }));
}

export async function getMonthlyAccountBalanceHistory(
  userId: string,
  from: Date,
  to: Date,
  db: Pick<Prisma.TransactionClient, "$queryRaw"> | typeof prisma = prisma
): Promise<AccountBalanceHistoryPoint[]> {
  const rows = await db.$queryRaw<AccountBalanceHistoryRow[]>`
    WITH month_boundaries AS (
      SELECT
        month_start,
        month_start + INTERVAL '1 month' AS month_end
      FROM generate_series(
        ${from}::timestamp,
        ${to}::timestamp - INTERVAL '1 month',
        INTERVAL '1 month'
      ) AS boundaries(month_start)
    ),
    active_accounts AS (
      SELECT "id", "name", "type", "currency", "openingBalanceMinor"
      FROM "Account"
      WHERE "userId" = ${userId}
        AND "isActive" = true
    ),
    account_effects AS (
      SELECT
        ledger_transaction."date",
        ledger_transaction."sourceAccountId" AS "accountId",
        CASE
          WHEN ledger_transaction."type" = 'income' THEN ledger_transaction."amountMinor"::bigint
          WHEN ledger_transaction."type" IN ('expense', 'transfer') THEN -ledger_transaction."amountMinor"::bigint
          ELSE 0::bigint
        END AS "deltaMinor"
      FROM "Transaction" AS ledger_transaction
      INNER JOIN active_accounts AS account ON account."id" = ledger_transaction."sourceAccountId"
      WHERE ledger_transaction."userId" = ${userId}

      UNION ALL

      SELECT
        ledger_transaction."date",
        ledger_transaction."destinationAccountId" AS "accountId",
        ledger_transaction."amountMinor"::bigint AS "deltaMinor"
      FROM "Transaction" AS ledger_transaction
      INNER JOIN active_accounts AS account ON account."id" = ledger_transaction."destinationAccountId"
      WHERE ledger_transaction."userId" = ${userId}
        AND ledger_transaction."type" = 'transfer'

      UNION ALL

      SELECT
        investment_transaction."date",
        COALESCE(investment_transaction."cashAccountId", investment_transaction."accountId") AS "accountId",
        CASE
          WHEN investment_transaction."type" IN ('buy', 'fee') THEN -investment_transaction."cashAmountMinor"::bigint
          ELSE investment_transaction."cashAmountMinor"::bigint
        END AS "deltaMinor"
      FROM "InvestmentTransaction" AS investment_transaction
      INNER JOIN active_accounts AS account
        ON account."id" = COALESCE(investment_transaction."cashAccountId", investment_transaction."accountId")
      WHERE investment_transaction."userId" = ${userId}
    )
    SELECT
      to_char(month_boundaries.month_start, 'YYYY-MM') AS "monthKey",
      account."id" AS "accountId",
      account."name" AS "accountName",
      account."type" AS "accountType",
      account."currency",
      (
        account."openingBalanceMinor"::bigint +
        COALESCE(SUM(account_effects."deltaMinor") FILTER (
          WHERE account_effects."date" < month_boundaries.month_end
        ), 0::bigint)
      )::bigint AS "balanceMinor"
    FROM month_boundaries
    CROSS JOIN active_accounts AS account
    LEFT JOIN account_effects
      ON account_effects."accountId" = account."id"
      AND account_effects."date" < month_boundaries.month_end
    GROUP BY
      month_boundaries.month_start,
      account."id",
      account."name",
      account."type",
      account."currency",
      account."openingBalanceMinor"
    ORDER BY month_boundaries.month_start ASC, account."name" ASC
  `;

  return accountBalanceHistoryRowsToPoints(rows);
}

export async function getMonthlyCashBalanceHistory(
  userId: string,
  from: Date,
  to: Date,
  db: Pick<Prisma.TransactionClient, "$queryRaw"> | typeof prisma = prisma
): Promise<CashBalanceHistoryPoint[]> {
  const rows = await db.$queryRaw<CashBalanceHistoryRow[]>`
    WITH month_boundaries AS (
      SELECT
        month_start,
        month_start + INTERVAL '1 month' AS month_end
      FROM generate_series(
        ${from}::timestamp,
        ${to}::timestamp - INTERVAL '1 month',
        INTERVAL '1 month'
      ) AS boundaries(month_start)
    ),
    active_accounts AS (
      SELECT "id", "openingBalanceMinor"
      FROM "Account"
      WHERE "userId" = ${userId}
        AND "isActive" = true
    ),
    account_effects AS (
      SELECT
        ledger_transaction."date",
        CASE
          WHEN ledger_transaction."type" = 'income' THEN ledger_transaction."amountMinor"::bigint
          WHEN ledger_transaction."type" IN ('expense', 'transfer') THEN -ledger_transaction."amountMinor"::bigint
          ELSE 0::bigint
        END AS "deltaMinor"
      FROM "Transaction" AS ledger_transaction
      INNER JOIN active_accounts AS account ON account."id" = ledger_transaction."sourceAccountId"
      WHERE ledger_transaction."userId" = ${userId}

      UNION ALL

      SELECT
        ledger_transaction."date",
        ledger_transaction."amountMinor"::bigint AS "deltaMinor"
      FROM "Transaction" AS ledger_transaction
      INNER JOIN active_accounts AS account ON account."id" = ledger_transaction."destinationAccountId"
      WHERE ledger_transaction."userId" = ${userId}
        AND ledger_transaction."type" = 'transfer'

      UNION ALL

      SELECT
        investment_transaction."date",
        CASE
          WHEN investment_transaction."type" IN ('buy', 'fee') THEN -investment_transaction."cashAmountMinor"::bigint
          ELSE investment_transaction."cashAmountMinor"::bigint
        END AS "deltaMinor"
      FROM "InvestmentTransaction" AS investment_transaction
      INNER JOIN active_accounts AS account
        ON account."id" = COALESCE(investment_transaction."cashAccountId", investment_transaction."accountId")
      WHERE investment_transaction."userId" = ${userId}
    ),
    opening_balance AS (
      SELECT COALESCE(SUM("openingBalanceMinor"::bigint), 0::bigint) AS "amountMinor"
      FROM active_accounts
    )
    SELECT
      to_char(month_boundaries.month_start, 'YYYY-MM') AS "monthKey",
      (
        opening_balance."amountMinor" +
        COALESCE(SUM(account_effects."deltaMinor") FILTER (
          WHERE account_effects."date" < month_boundaries.month_end
        ), 0::bigint)
      )::bigint AS "cashBalanceMinor"
    FROM month_boundaries
    CROSS JOIN opening_balance
    LEFT JOIN account_effects ON account_effects."date" < month_boundaries.month_end
    GROUP BY month_boundaries.month_start, opening_balance."amountMinor"
    ORDER BY month_boundaries.month_start ASC
  `;

  return cashBalanceHistoryRowsToPoints(rows);
}
