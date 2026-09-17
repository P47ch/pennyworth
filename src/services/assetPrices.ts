import { prisma } from "../lib/db.js";

export async function listAssetPriceFormOptions(userId: string) {
  return prisma.asset.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { symbol: "asc" }]
  });
}

export async function listAssetPrices(userId: string) {
  return prisma.assetPrice.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: [{ date: "desc" }, { asset: { symbol: "asc" } }]
  });
}

export async function getAssetPriceForUser(userId: string, assetPriceId: string) {
  return prisma.assetPrice.findFirst({
    where: { id: assetPriceId, userId },
    include: { asset: true }
  });
}

async function validateAssetForUser(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, userId }
  });

  if (!asset) {
    throw new Error("Choose a valid asset.");
  }
}

async function assertUniqueAssetPriceDate(userId: string, assetId: string, date: Date, currentId?: string) {
  const existing = await prisma.assetPrice.findFirst({
    where: {
      userId,
      assetId,
      date,
      ...(currentId ? { id: { not: currentId } } : {})
    }
  });

  if (existing) {
    throw new Error("This asset already has a price for that date.");
  }
}

export async function createAssetPrice(input: { userId: string; assetId: string; date: Date; priceMinor: number }) {
  await validateAssetForUser(input.userId, input.assetId);
  await assertUniqueAssetPriceDate(input.userId, input.assetId, input.date);

  return prisma.assetPrice.create({
    data: {
      userId: input.userId,
      assetId: input.assetId,
      date: input.date,
      priceMinor: input.priceMinor
    }
  });
}

export async function updateAssetPrice(input: {
  userId: string;
  assetPriceId: string;
  assetId: string;
  date: Date;
  priceMinor: number;
}) {
  const assetPrice = await getAssetPriceForUser(input.userId, input.assetPriceId);

  if (!assetPrice) {
    throw new Error("Asset price not found.");
  }

  await validateAssetForUser(input.userId, input.assetId);
  await assertUniqueAssetPriceDate(input.userId, input.assetId, input.date, input.assetPriceId);

  return prisma.assetPrice.update({
    where: { id: input.assetPriceId, userId: input.userId },
    data: {
      assetId: input.assetId,
      date: input.date,
      priceMinor: input.priceMinor
    }
  });
}

export async function deleteAssetPrice(userId: string, assetPriceId: string) {
  const assetPrice = await getAssetPriceForUser(userId, assetPriceId);

  if (!assetPrice) {
    throw new Error("Asset price not found.");
  }

  await prisma.assetPrice.delete({ where: { id: assetPriceId, userId } });
}
