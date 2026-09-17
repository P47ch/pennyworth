-- Ownership is enforced with composite foreign keys so direct database writes
-- cannot connect one user's investment records to another user's data.
ALTER TABLE "InvestmentTransaction" DROP CONSTRAINT "InvestmentTransaction_accountId_fkey";
ALTER TABLE "InvestmentTransaction" DROP CONSTRAINT "InvestmentTransaction_cashAccountId_fkey";
ALTER TABLE "InvestmentTransaction" DROP CONSTRAINT "InvestmentTransaction_assetId_fkey";
ALTER TABLE "Holding" DROP CONSTRAINT "Holding_accountId_fkey";
ALTER TABLE "Holding" DROP CONSTRAINT "Holding_assetId_fkey";
ALTER TABLE "AssetPrice" DROP CONSTRAINT "AssetPrice_assetId_fkey";

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_accountId_userId_fkey"
FOREIGN KEY ("accountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_cashAccountId_userId_fkey"
FOREIGN KEY ("cashAccountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_assetId_userId_fkey"
FOREIGN KEY ("assetId", "userId") REFERENCES "Asset"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Holding"
ADD CONSTRAINT "Holding_accountId_userId_fkey"
FOREIGN KEY ("accountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Holding"
ADD CONSTRAINT "Holding_assetId_userId_fkey"
FOREIGN KEY ("assetId", "userId") REFERENCES "Asset"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "AssetPrice"
ADD CONSTRAINT "AssetPrice_assetId_userId_fkey"
FOREIGN KEY ("assetId", "userId") REFERENCES "Asset"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_amountMinor_positive_check"
CHECK ("amountMinor" > 0);

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_cashAmountMinor_positive_check"
CHECK ("cashAmountMinor" > 0);

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_trade_shape_check"
CHECK (
  (
    "type" IN ('buy', 'sell')
    AND "quantity" IS NOT NULL
    AND "quantity" > 0
    AND "priceMinor" IS NOT NULL
    AND "priceMinor" > 0
  )
  OR
  (
    "type" IN ('dividend', 'interest', 'fee')
    AND "quantity" IS NULL
    AND "priceMinor" IS NULL
  )
);

ALTER TABLE "Holding"
ADD CONSTRAINT "Holding_quantity_positive_check"
CHECK ("quantity" > 0);

ALTER TABLE "Holding"
ADD CONSTRAINT "Holding_averageCostMinor_nonnegative_check"
CHECK ("averageCostMinor" >= 0);

ALTER TABLE "AssetPrice"
ADD CONSTRAINT "AssetPrice_priceMinor_positive_check"
CHECK ("priceMinor" > 0);

ALTER TABLE "InvestmentPosition"
ADD CONSTRAINT "InvestmentPosition_nonnegative_values_check"
CHECK (
  "quantity" >= 0
  AND "costBasisMinor" >= 0
  AND "averageCostMinor" >= 0
  AND "dividendMinor" >= 0
  AND "interestMinor" >= 0
  AND "feeMinor" >= 0
);
