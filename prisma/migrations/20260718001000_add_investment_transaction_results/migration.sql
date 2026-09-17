-- Per-entry results are rebuildable read data; investment transactions remain authoritative.
CREATE UNIQUE INDEX "InvestmentTransaction_id_userId_key"
ON "InvestmentTransaction"("id", "userId");

CREATE TABLE "InvestmentTransactionResult" (
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realizedGainMinor" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentTransactionResult_pkey" PRIMARY KEY ("transactionId")
);

CREATE INDEX "InvestmentTransactionResult_userId_idx"
ON "InvestmentTransactionResult"("userId");

CREATE UNIQUE INDEX "InvestmentTransactionResult_transactionId_userId_key"
ON "InvestmentTransactionResult"("transactionId", "userId");

ALTER TABLE "InvestmentTransactionResult"
ADD CONSTRAINT "InvestmentTransactionResult_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentTransactionResult"
ADD CONSTRAINT "InvestmentTransactionResult_transactionId_userId_fkey"
FOREIGN KEY ("transactionId", "userId") REFERENCES "InvestmentTransaction"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
