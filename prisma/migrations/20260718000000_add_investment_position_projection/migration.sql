-- Transaction history remains authoritative. These rows are a rebuildable read projection.
ALTER TABLE "User"
ADD COLUMN "investmentProjectionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Asset_id_userId_key" ON "Asset"("id", "userId");
CREATE INDEX "InvestmentTransaction_userId_accountId_assetId_date_idx"
ON "InvestmentTransaction"("userId", "accountId", "assetId", "date");

CREATE TABLE "InvestmentPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "costBasisMinor" INTEGER NOT NULL,
    "averageCostMinor" INTEGER NOT NULL,
    "realizedGainMinor" INTEGER NOT NULL,
    "dividendMinor" INTEGER NOT NULL,
    "interestMinor" INTEGER NOT NULL,
    "feeMinor" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentPosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestmentPosition_userId_accountId_assetId_key"
ON "InvestmentPosition"("userId", "accountId", "assetId");
CREATE INDEX "InvestmentPosition_userId_idx" ON "InvestmentPosition"("userId");
CREATE INDEX "InvestmentPosition_accountId_idx" ON "InvestmentPosition"("accountId");
CREATE INDEX "InvestmentPosition_assetId_idx" ON "InvestmentPosition"("assetId");

ALTER TABLE "InvestmentPosition"
ADD CONSTRAINT "InvestmentPosition_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentPosition"
ADD CONSTRAINT "InvestmentPosition_accountId_userId_fkey"
FOREIGN KEY ("accountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "InvestmentPosition"
ADD CONSTRAINT "InvestmentPosition_assetId_userId_fkey"
FOREIGN KEY ("assetId", "userId") REFERENCES "Asset"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
