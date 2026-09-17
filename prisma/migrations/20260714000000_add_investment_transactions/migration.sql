CREATE TYPE "InvestmentTransactionType" AS ENUM ('buy', 'sell', 'dividend', 'interest', 'fee');

CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "InvestmentTransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(24,8),
    "priceMinor" INTEGER,
    "amountMinor" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvestmentTransaction_userId_idx" ON "InvestmentTransaction"("userId");
CREATE INDEX "InvestmentTransaction_accountId_idx" ON "InvestmentTransaction"("accountId");
CREATE INDEX "InvestmentTransaction_assetId_idx" ON "InvestmentTransaction"("assetId");
CREATE INDEX "InvestmentTransaction_date_idx" ON "InvestmentTransaction"("date");
CREATE INDEX "InvestmentTransaction_type_idx" ON "InvestmentTransaction"("type");

ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
