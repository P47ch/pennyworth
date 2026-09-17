CREATE TABLE "TransactionImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "importedCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TransactionImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionImportBatch_id_userId_key"
ON "TransactionImportBatch"("id", "userId");

CREATE INDEX "TransactionImportBatch_userId_createdAt_idx"
ON "TransactionImportBatch"("userId", "createdAt");

ALTER TABLE "TransactionImportBatch"
ADD CONSTRAINT "TransactionImportBatch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionImportBatch"
ADD CONSTRAINT "TransactionImportBatch_status_check"
CHECK ("status" IN ('pending', 'completed'));
