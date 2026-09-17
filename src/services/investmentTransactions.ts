import type { InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { holdingAccountTypes } from "./holdings.js";
import {
  ensureInvestmentPositionProjection,
  lockInvestmentProjectionForUser,
  rebuildInvestmentPositionPair
} from "./investmentPositions.js";
import {
  assertAccountSupportsInvestmentActivity,
  lockAccountForInvestmentUse,
  lockAccountsForInvestmentUse,
  type LockedAccount
} from "./relationshipValidation.js";

export const investmentTransactionTypes: InvestmentTransactionType[] = ["buy", "sell", "dividend", "interest", "fee"];

export async function listInvestmentTransactionFormOptions(userId: string) {
  const [accounts, cashAccounts, assets] = await Promise.all([
    prisma.account.findMany({
      where: { userId, type: { in: [...holdingAccountTypes] } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.account.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.asset.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { symbol: "asc" }]
    })
  ]);

  return { accounts, cashAccounts, assets };
}

const investmentTransactionInclude = {
  account: true,
  cashAccount: true,
  asset: true,
  result: true
} satisfies Prisma.InvestmentTransactionInclude;

export async function listInvestmentTransactionPage(userId: string, page = 1, pageSize = 50) {
  await ensureInvestmentPositionProjection(userId);

  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const where = { userId };
  const [records, totalCount] = await prisma.$transaction([
    prisma.investmentTransaction.findMany({
      where,
      include: investmentTransactionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize
    }),
    prisma.investmentTransaction.count({ where })
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const transactions = records.map(({ result, ...transaction }) => ({
    ...transaction,
    realizedGainMinor: result?.realizedGainMinor ?? null
  }));

  return {
    transactions,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages
  };
}

export async function getInvestmentTransactionForUser(userId: string, investmentTransactionId: string) {
  return prisma.investmentTransaction.findFirst({
    where: { id: investmentTransactionId, userId },
    include: investmentTransactionInclude
  });
}

async function validateReferences(
  userId: string,
  accountId: string,
  assetId: string,
  db: typeof prisma | Prisma.TransactionClient = prisma,
  lockedAccount?: LockedAccount
) {
  const account = lockedAccount ?? (await lockAccountForInvestmentUse(userId, accountId, db));
  const asset = await db.asset.findFirst({ where: { id: assetId, userId } });

  if (!account) {
    throw new Error("Choose a valid investment or crypto account.");
  }

  assertAccountSupportsInvestmentActivity(account.type);

  if (!asset) {
    throw new Error("Choose a valid asset.");
  }
}

async function validateCashAccount(
  userId: string,
  cashAccountId: string | null,
  db: typeof prisma | Prisma.TransactionClient = prisma
) {
  if (!cashAccountId) {
    return;
  }

  const account = await db.account.findFirst({
    where: { id: cashAccountId, userId }
  });

  if (!account) {
    throw new Error("Choose a valid cash-impact account.");
  }
}

export async function createInvestmentTransaction(input: {
  userId: string;
  accountId: string;
  cashAccountId: string | null;
  assetId: string;
  type: InvestmentTransactionType;
  date: Date;
  quantity: string | null;
  priceMinor: number | null;
  amountMinor: number;
  cashAmountMinor: number;
  notes?: string;
}) {
  const cashAccountId = input.cashAccountId ?? input.accountId;
  await ensureInvestmentPositionProjection(input.userId);

  return prisma.$transaction(async (tx) => {
    await lockInvestmentProjectionForUser(tx, input.userId);
    await validateReferences(input.userId, input.accountId, input.assetId, tx);
    await validateCashAccount(input.userId, cashAccountId, tx);
    const created = await tx.investmentTransaction.create({
      data: {
        userId: input.userId,
        accountId: input.accountId,
        cashAccountId,
        assetId: input.assetId,
        type: input.type,
        date: input.date,
        quantity: input.quantity,
        priceMinor: input.priceMinor,
        amountMinor: input.amountMinor,
        cashAmountMinor: input.cashAmountMinor,
        notes: input.notes || null
      }
    });

    await rebuildInvestmentPositionPair(tx, input.userId, input.accountId, input.assetId);
    return created;
  });
}

export async function updateInvestmentTransaction(input: {
  userId: string;
  investmentTransactionId: string;
  accountId: string;
  cashAccountId: string | null;
  assetId: string;
  type: InvestmentTransactionType;
  date: Date;
  quantity: string | null;
  priceMinor: number | null;
  amountMinor: number;
  cashAmountMinor: number;
  notes?: string;
}) {
  const cashAccountId = input.cashAccountId ?? input.accountId;
  await ensureInvestmentPositionProjection(input.userId);

  return prisma.$transaction(async (tx) => {
    await lockInvestmentProjectionForUser(tx, input.userId);
    const investmentTransaction = await tx.investmentTransaction.findFirst({
      where: { id: input.investmentTransactionId, userId: input.userId }
    });

    if (!investmentTransaction) {
      throw new Error("Investment transaction not found.");
    }

    const lockedAccounts = await lockAccountsForInvestmentUse(
      input.userId,
      [investmentTransaction.accountId, input.accountId],
      tx
    );
    await validateReferences(
      input.userId,
      input.accountId,
      input.assetId,
      tx,
      lockedAccounts.get(input.accountId)
    );
    await validateCashAccount(input.userId, cashAccountId, tx);

    const updated = await tx.investmentTransaction.update({
      where: {
        id_userId: { id: input.investmentTransactionId, userId: input.userId }
      },
      data: {
        accountId: input.accountId,
        cashAccountId,
        assetId: input.assetId,
        type: input.type,
        date: input.date,
        quantity: input.quantity,
        priceMinor: input.priceMinor,
        amountMinor: input.amountMinor,
        cashAmountMinor: input.cashAmountMinor,
        notes: input.notes || null
      }
    });

    const affectedPairs = new Set([
      `${investmentTransaction.accountId}\u0000${investmentTransaction.assetId}`,
      `${input.accountId}\u0000${input.assetId}`
    ]);

    for (const pair of affectedPairs) {
      const [accountId, assetId] = pair.split("\u0000");
      await rebuildInvestmentPositionPair(tx, input.userId, accountId, assetId);
    }

    return updated;
  });
}

export async function deleteInvestmentTransaction(userId: string, investmentTransactionId: string) {
  await ensureInvestmentPositionProjection(userId);

  await prisma.$transaction(async (tx) => {
    await lockInvestmentProjectionForUser(tx, userId);
    const investmentTransaction = await tx.investmentTransaction.findFirst({
      where: { id: investmentTransactionId, userId }
    });

    if (!investmentTransaction) {
      throw new Error("Investment transaction not found.");
    }

    await lockAccountForInvestmentUse(userId, investmentTransaction.accountId, tx);

    await tx.investmentTransaction.delete({
      where: { id_userId: { id: investmentTransactionId, userId } }
    });
    await rebuildInvestmentPositionPair(tx, userId, investmentTransaction.accountId, investmentTransaction.assetId);
  });
}
