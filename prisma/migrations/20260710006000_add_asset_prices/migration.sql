CREATE TABLE "AssetPrice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetPrice_userId_assetId_date_key" ON "AssetPrice"("userId", "assetId", "date");
CREATE INDEX "AssetPrice_userId_idx" ON "AssetPrice"("userId");
CREATE INDEX "AssetPrice_assetId_idx" ON "AssetPrice"("assetId");
CREATE INDEX "AssetPrice_date_idx" ON "AssetPrice"("date");

ALTER TABLE "AssetPrice" ADD CONSTRAINT "AssetPrice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetPrice" ADD CONSTRAINT "AssetPrice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
