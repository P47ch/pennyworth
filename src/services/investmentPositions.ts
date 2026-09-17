import type { Prisma } from "@prisma/client";
import {
  calculateInvestmentPositionsExact,
  safeMoneyBigIntToNumber
} from "../finance/investments.js";
import { prisma } from "../lib/db.js";

export const investmentProjectionVersion = 2;

function calculationInput(transaction: {
  id: string;
  accountId: string;
  assetId: string;
  type: "buy" | "sell" | "dividend" | "interest" | "fee";
  date: Date;
  createdAt: Date;
  quantity: { toString(): string } | null;
  amountMinor: number;
}) {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    assetId: transaction.assetId,
    type: transaction.type,
    date: transaction.date,
    createdAt: transaction.createdAt,
    quantity: transaction.quantity,
    amountMinor: transaction.amountMinor
  };
}

function projectionData(userId: string, position: ReturnType<typeof calculateInvestmentPositionsExact>["positions"][number]) {
  return {
    userId,
    accountId: position.accountId,
    assetId: position.assetId,
    quantity: position.quantity,
    costBasisMinor: safeMoneyBigIntToNumber(position.costBasisMinor, "Investment position cost basis"),
    averageCostMinor: safeMoneyBigIntToNumber(position.averageCostMinor, "Investment position average cost"),
    realizedGainMinor: safeMoneyBigIntToNumber(position.realizedGainMinor, "Investment position realized gain"),
    dividendMinor: safeMoneyBigIntToNumber(position.dividendMinor, "Investment position dividends"),
    interestMinor: safeMoneyBigIntToNumber(position.interestMinor, "Investment position interest"),
    feeMinor: safeMoneyBigIntToNumber(position.feeMinor, "Investment position fees")
  };
}

function transactionResultData(
  userId: string,
  result: ReturnType<typeof calculateInvestmentPositionsExact>["transactionResults"][number]
) {
  return {
    transactionId: result.id,
    userId,
    realizedGainMinor:
      result.realizedGainMinor === null
        ? null
        : safeMoneyBigIntToNumber(result.realizedGainMinor, `${result.id} realized gain`)
  };
}

export async function lockInvestmentProjectionForUser(tx: Prisma.TransactionClient, userId: string) {
  const users = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;

  if (users.length !== 1) {
    throw new Error("User not found.");
  }
}

export async function ensureInvestmentPositionProjection(userId: string) {
  await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<Array<{ investmentProjectionVersion: number }>>`
      SELECT "investmentProjectionVersion"
      FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `;
    const user = users[0];

    if (!user) {
      throw new Error("User not found.");
    }

    if (user.investmentProjectionVersion >= investmentProjectionVersion) {
      return;
    }

    const transactions = await tx.investmentTransaction.findMany({
      where: { userId }
    });
    const { positions, transactionResults } = calculateInvestmentPositionsExact(transactions.map(calculationInput));

    await tx.investmentTransactionResult.deleteMany({ where: { userId } });
    await tx.investmentPosition.deleteMany({ where: { userId } });

    if (positions.length > 0) {
      await tx.investmentPosition.createMany({
        data: positions.map((position) => projectionData(userId, position))
      });
    }

    if (transactionResults.length > 0) {
      await tx.investmentTransactionResult.createMany({
        data: transactionResults.map((result) => transactionResultData(userId, result))
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { investmentProjectionVersion }
    });
  });
}

export async function rebuildInvestmentPositionPair(
  tx: Prisma.TransactionClient,
  userId: string,
  accountId: string,
  assetId: string
) {
  const transactions = await tx.investmentTransaction.findMany({
    where: { userId, accountId, assetId }
  });
  const { positions, transactionResults } = calculateInvestmentPositionsExact(transactions.map(calculationInput));
  const position = positions[0];
  const where = { userId_accountId_assetId: { userId, accountId, assetId } };

  await tx.investmentTransactionResult.deleteMany({
    where: {
      userId,
      transaction: { accountId, assetId }
    }
  });

  if (transactionResults.length > 0) {
    await tx.investmentTransactionResult.createMany({
      data: transactionResults.map((result) => transactionResultData(userId, result))
    });
  }

  if (!position) {
    await tx.investmentPosition.deleteMany({ where: { userId, accountId, assetId } });
    return;
  }

  const data = projectionData(userId, position);

  await tx.investmentPosition.upsert({
    where,
    create: data,
    update: data
  });
}
