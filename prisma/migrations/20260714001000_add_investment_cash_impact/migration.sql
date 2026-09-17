ALTER TABLE "InvestmentTransaction" ADD COLUMN "cashAccountId" TEXT;
ALTER TABLE "InvestmentTransaction" ADD COLUMN "cashAmountMinor" INTEGER;

UPDATE "InvestmentTransaction" SET "cashAmountMinor" = "amountMinor" WHERE "cashAmountMinor" IS NULL;

ALTER TABLE "InvestmentTransaction" ALTER COLUMN "cashAmountMinor" SET NOT NULL;

CREATE INDEX "InvestmentTransaction_cashAccountId_idx" ON "InvestmentTransaction"("cashAccountId");

ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
