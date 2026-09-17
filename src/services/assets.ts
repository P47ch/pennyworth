import type { AssetType } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { loadConfig } from "../lib/config.js";
import { assertPrimaryCurrency } from "../finance/currency.js";

export const assetTypes: AssetType[] = ["stock", "etf", "fund", "bond", "crypto", "other"];
const primaryCurrency = loadConfig().primaryCurrency;

export async function listAssets(userId: string) {
  return prisma.asset.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { symbol: "asc" }]
  });
}

export async function getAssetForUser(userId: string, assetId: string) {
  return prisma.asset.findFirst({
    where: { id: assetId, userId }
  });
}

export async function createAsset(input: {
  userId: string;
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  isActive: boolean;
}) {
  assertPrimaryCurrency(input.currency, primaryCurrency, "assets");

  return prisma.asset.create({
    data: {
      userId: input.userId,
      symbol: input.symbol,
      name: input.name,
      type: input.type,
      currency: input.currency,
      isActive: input.isActive
    }
  });
}

export async function updateAsset(input: {
  userId: string;
  assetId: string;
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  isActive: boolean;
}) {
  const asset = await getAssetForUser(input.userId, input.assetId);

  if (!asset) {
    throw new Error("Asset not found.");
  }

  assertPrimaryCurrency(input.currency, primaryCurrency, "assets");

  return prisma.asset.update({
    where: { id_userId: { id: input.assetId, userId: input.userId } },
    data: {
      symbol: input.symbol,
      name: input.name,
      type: input.type,
      currency: input.currency,
      isActive: input.isActive
    }
  });
}

export async function deleteAsset(userId: string, assetId: string) {
  const asset = await getAssetForUser(userId, assetId);

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const holdingCount = await prisma.holding.count({
    where: { userId, assetId }
  });
  const investmentTransactionCount = await prisma.investmentTransaction.count({
    where: { userId, assetId }
  });

  if (holdingCount > 0 || investmentTransactionCount > 0) {
    await prisma.asset.update({
      where: { id_userId: { id: assetId, userId } },
      data: { isActive: false }
    });
    return { deleted: false as const, inactivated: true as const };
  }

  await prisma.asset.delete({ where: { id_userId: { id: assetId, userId } } });
  return { deleted: true as const, inactivated: false as const };
}
