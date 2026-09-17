import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { safeBigIntToNumber } from "./resultValues.js";

export type AccountBalanceRow = {
  accountId: string;
  balanceMinor: bigint;
};

export function balanceRowsToMap(rows: readonly AccountBalanceRow[]): Map<string, number> {
  const balances = new Map<string, number>();

  for (const row of rows) {
    balances.set(row.accountId, safeBigIntToNumber(row.balanceMinor, `Account ${row.accountId} balance`));
  }

  return balances;
}

export async function getAccountBalanceMap(
  userId: string,
  db: Pick<Prisma.TransactionClient, "$queryRaw"> | typeof prisma = prisma
): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<AccountBalanceRow[]>`
    WITH account_effects AS (
      SELECT
        "sourceAccountId" AS "accountId",
        CASE
          WHEN "type" = 'income' THEN "amountMinor"::bigint
          WHEN "type" IN ('expense', 'transfer') THEN -"amountMinor"::bigint
          ELSE 0::bigint
        END AS "deltaMinor"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "sourceAccountId" IS NOT NULL

      UNION ALL

      SELECT
        "destinationAccountId" AS "accountId",
        "amountMinor"::bigint AS "deltaMinor"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "type" = 'transfer'
        AND "destinationAccountId" IS NOT NULL

      UNION ALL

      SELECT
        COALESCE("cashAccountId", "accountId") AS "accountId",
        CASE
          WHEN "type" IN ('buy', 'fee') THEN -"cashAmountMinor"::bigint
          ELSE "cashAmountMinor"::bigint
        END AS "deltaMinor"
      FROM "InvestmentTransaction"
      WHERE "userId" = ${userId}
    )
    SELECT
      account."id" AS "accountId",
      (account."openingBalanceMinor"::bigint + COALESCE(SUM(account_effects."deltaMinor"), 0::bigint))::bigint AS "balanceMinor"
    FROM "Account" AS account
    LEFT JOIN account_effects ON account_effects."accountId" = account."id"
    WHERE account."userId" = ${userId}
    GROUP BY account."id", account."openingBalanceMinor"
  `;

  return balanceRowsToMap(rows);
}
