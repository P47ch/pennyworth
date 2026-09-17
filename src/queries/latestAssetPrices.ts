import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";

export type LatestAssetPrice = {
  assetId: string;
  date: Date;
  priceMinor: number;
};

export async function getLatestAssetPrices(userId: string, assetIds: string[]) {
  if (assetIds.length === 0) {
    return new Map<string, LatestAssetPrice>();
  }

  const rows = await prisma.$queryRaw<LatestAssetPrice[]>(Prisma.sql`
    SELECT DISTINCT ON ("assetId")
      "assetId",
      "date",
      "priceMinor"
    FROM "AssetPrice"
    WHERE "userId" = ${userId}
      AND "assetId" IN (${Prisma.join(assetIds)})
    ORDER BY "assetId" ASC, "date" DESC, "createdAt" DESC
  `);

  return new Map(rows.map((row) => [row.assetId, row]));
}
