import { calculatePositionAmountMinorExact, safeMoneyBigIntToNumber } from "../finance/investments.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { getLatestAssetPrices } from "../queries/latestAssetPrices.js";
import { ensureInvestmentPositionProjection } from "./investmentPositions.js";
import {
  assertAccountSupportsInvestmentActivity,
  lockAccountForInvestmentUse,
  lockAccountsForInvestmentUse,
  type LockedAccount
} from "./relationshipValidation.js";

export const holdingAccountTypes = ["investment", "crypto_wallet"] as const;

export async function listHoldingFormOptions(userId: string) {
  const [accounts, assets] = await Promise.all([
    prisma.account.findMany({
      where: { userId, type: { in: [...holdingAccountTypes] } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.asset.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { symbol: "asc" }]
    })
  ]);

  return { accounts, assets };
}

export async function listHoldings(userId: string) {
  await ensureInvestmentPositionProjection(userId);

  const [manualHoldings, projectedPositions] = await Promise.all([
    prisma.holding.findMany({
      where: { userId },
      include: {
        account: true,
        asset: true
      },
      orderBy: [{ account: { name: "asc" } }, { asset: { symbol: "asc" } }]
    }),
    prisma.investmentPosition.findMany({
      where: { userId },
      include: {
        account: true,
        asset: true
      },
      orderBy: [{ account: { name: "asc" } }, { asset: { symbol: "asc" } }]
    })
  ]);
  const assetIds = Array.from(
    new Set([...manualHoldings.map((holding) => holding.assetId), ...projectedPositions.map((position) => position.assetId)])
  );
  const latestPrices = await getLatestAssetPrices(userId, assetIds);

  const calculatedHoldings = projectedPositions.map((position) => {
    const latestPrice = latestPrices.get(position.assetId) ?? null;
    const quantity = position.quantity.toString();
    const estimatedValueMinor = latestPrice
      ? safeMoneyBigIntToNumber(
          calculatePositionAmountMinorExact(quantity, latestPrice.priceMinor),
          `${position.asset.symbol} estimated value`
        )
      : null;

    return {
      id: `calculated-${position.accountId}-${position.assetId}`,
      source: "calculated" as const,
      account: position.account,
      asset: position.asset,
      quantity,
      averageCostMinor: position.averageCostMinor,
      costBasisMinor: position.costBasisMinor,
      latestPrice,
      estimatedValueMinor,
      unrealizedGainMinor: estimatedValueMinor === null ? null : estimatedValueMinor - position.costBasisMinor,
      realizedGainMinor: position.realizedGainMinor,
      dividendMinor: position.dividendMinor,
      interestMinor: position.interestMinor,
      feeMinor: position.feeMinor,
      notes: null
    };
  });
  const manualAdjustmentHoldings = manualHoldings.map((holding) => {
    const latestPrice = latestPrices.get(holding.assetId) ?? null;
    const costBasisMinor = safeMoneyBigIntToNumber(
      calculatePositionAmountMinorExact(holding.quantity, holding.averageCostMinor),
      `${holding.asset.symbol} cost basis`
    );
    const estimatedValueMinor = latestPrice
      ? safeMoneyBigIntToNumber(
          calculatePositionAmountMinorExact(holding.quantity, latestPrice.priceMinor),
          `${holding.asset.symbol} estimated value`
        )
      : null;

    return {
      ...holding,
      id: holding.id,
      source: "manual" as const,
      account: holding.account,
      asset: holding.asset,
      quantity: holding.quantity.toString(),
      averageCostMinor: holding.averageCostMinor,
      latestPrice,
      costBasisMinor,
      estimatedValueMinor,
      unrealizedGainMinor: estimatedValueMinor === null ? null : estimatedValueMinor - costBasisMinor,
      realizedGainMinor: null,
      dividendMinor: null,
      interestMinor: null,
      feeMinor: null
    };
  });

  return [...calculatedHoldings, ...manualAdjustmentHoldings].sort(
    (a, b) => a.account.name.localeCompare(b.account.name) || a.asset.symbol.localeCompare(b.asset.symbol) || a.source.localeCompare(b.source)
  );
}

export async function getHoldingForUser(userId: string, holdingId: string) {
  return prisma.holding.findFirst({
    where: { id: holdingId, userId },
    include: {
      account: true,
      asset: true
    }
  });
}

async function validateHoldingReferences(
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

export async function createHolding(input: {
  userId: string;
  accountId: string;
  assetId: string;
  quantity: string;
  averageCostMinor: number;
  notes?: string;
}, db: typeof prisma | Prisma.TransactionClient = prisma): Promise<Prisma.HoldingGetPayload<{}>> {
  if (db === prisma) {
    return prisma.$transaction((tx) => createHolding(input, tx));
  }

  await validateHoldingReferences(input.userId, input.accountId, input.assetId, db);
  const existing = await db.holding.findFirst({
      where: {
        userId: input.userId,
        accountId: input.accountId,
        assetId: input.assetId
      }
  });

  if (existing) {
    throw new Error("This account already has a holding for that asset.");
  }

  return db.holding.create({
    data: {
      userId: input.userId,
      accountId: input.accountId,
      assetId: input.assetId,
      quantity: input.quantity,
      averageCostMinor: input.averageCostMinor,
      notes: input.notes || null
    }
  });
}

export async function updateHolding(input: {
  userId: string;
  holdingId: string;
  accountId: string;
  assetId: string;
  quantity: string;
  averageCostMinor: number;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const holding = await tx.holding.findFirst({
      where: { id: input.holdingId, userId: input.userId },
      select: { accountId: true }
    });

    if (!holding) {
      throw new Error("Holding not found.");
    }

    const lockedAccounts = await lockAccountsForInvestmentUse(
      input.userId,
      [holding.accountId, input.accountId],
      tx
    );
    await validateHoldingReferences(
      input.userId,
      input.accountId,
      input.assetId,
      tx,
      lockedAccounts.get(input.accountId)
    );
    const duplicate = await tx.holding.findFirst({
      where: {
        userId: input.userId,
        accountId: input.accountId,
        assetId: input.assetId,
        id: { not: input.holdingId }
      }
    });

    if (duplicate) {
      throw new Error("This account already has a holding for that asset.");
    }

    return tx.holding.update({
      where: { id: input.holdingId, userId: input.userId },
      data: {
        accountId: input.accountId,
        assetId: input.assetId,
        quantity: input.quantity,
        averageCostMinor: input.averageCostMinor,
        notes: input.notes || null
      }
    });
  });
}

export async function deleteHolding(userId: string, holdingId: string) {
  await prisma.$transaction(async (tx) => {
    const holding = await tx.holding.findFirst({
      where: { id: holdingId, userId },
      select: { accountId: true }
    });

    if (!holding) {
      throw new Error("Holding not found.");
    }

    await lockAccountForInvestmentUse(userId, holding.accountId, tx);
    await tx.holding.delete({ where: { id: holdingId, userId } });
  });
}
