import type { AccountType } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { loadConfig } from "../lib/config.js";
import { getAccountBalanceMap } from "../queries/accountBalances.js";
import { assertPrimaryCurrency } from "../finance/currency.js";
import { assertAccountTypeChangeCompatible } from "./relationshipValidation.js";

export const accountTypes: AccountType[] = ["bank", "cash", "credit_card", "savings", "investment", "crypto_wallet", "other"];
const primaryCurrency = loadConfig().primaryCurrency;

export async function listAccountsWithBalances(userId: string) {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    getAccountBalanceMap(userId)
  ]);

  return accounts.map((account) => ({
    ...account,
    currentBalanceMinor: balances.get(account.id) ?? account.openingBalanceMinor
  }));
}

export async function getAccountForUser(userId: string, accountId: string) {
  return prisma.account.findFirst({
    where: {
      id: accountId,
      userId
    }
  });
}

export async function createAccount(input: {
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  institution?: string;
}) {
  assertPrimaryCurrency(input.currency, primaryCurrency, "accounts");

  return prisma.account.create({
    data: {
      userId: input.userId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalanceMinor: input.openingBalanceMinor,
      institution: input.institution || null
    }
  });
}

export async function updateAccount(input: {
  userId: string;
  accountId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  institution?: string;
}) {
  assertPrimaryCurrency(input.currency, primaryCurrency, "accounts");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${input.accountId} AND "userId" = ${input.userId} FOR UPDATE`;
    const account = await tx.account.findFirst({
      where: { id: input.accountId, userId: input.userId }
    });

    if (!account) {
      throw new Error("Account not found.");
    }

    await assertAccountTypeChangeCompatible(input.userId, input.accountId, input.type, tx);

    return tx.account.update({
      where: { id_userId: { id: input.accountId, userId: input.userId } },
      data: {
        name: input.name,
        type: input.type,
        currency: input.currency,
        openingBalanceMinor: input.openingBalanceMinor,
        institution: input.institution || null
      }
    });
  });
}

export async function setAccountActiveState(userId: string, accountId: string, isActive: boolean) {
  const account = await getAccountForUser(userId, accountId);

  if (!account) {
    throw new Error("Account not found.");
  }

  return prisma.account.update({
    where: { id_userId: { id: accountId, userId } },
    data: { isActive }
  });
}

export async function deleteAccountIfUnused(userId: string, accountId: string) {
  const account = await getAccountForUser(userId, accountId);

  if (!account) {
    throw new Error("Account not found.");
  }

  const transactionCount = await prisma.transaction.count({
    where: {
      userId,
      OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
    }
  });
  const holdingCount = await prisma.holding.count({
    where: {
      userId,
      accountId
    }
  });
  const investmentTransactionCount = await prisma.investmentTransaction.count({
    where: {
      userId,
      OR: [{ accountId }, { cashAccountId: accountId }]
    }
  });
  const recurringTransactionCount = await prisma.recurringTransaction.count({
    where: {
      userId,
      OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
    }
  });

  if (transactionCount > 0 || holdingCount > 0 || investmentTransactionCount > 0 || recurringTransactionCount > 0) {
    await setAccountActiveState(userId, accountId, false);
    return { deleted: false as const, inactivated: true as const };
  }

  await prisma.account.delete({ where: { id_userId: { id: accountId, userId } } });
  return { deleted: true as const, inactivated: false as const };
}
