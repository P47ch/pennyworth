DROP INDEX "Transaction_userId_idx";
DROP INDEX "Transaction_date_idx";
DROP INDEX "Transaction_sourceAccountId_idx";
DROP INDEX "Transaction_destinationAccountId_idx";
DROP INDEX "Transaction_categoryId_idx";
DROP INDEX "Transaction_type_idx";

CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");
CREATE INDEX "Transaction_userId_type_date_idx" ON "Transaction"("userId", "type", "date");
CREATE INDEX "Transaction_userId_sourceAccountId_date_idx" ON "Transaction"("userId", "sourceAccountId", "date");
CREATE INDEX "Transaction_userId_destinationAccountId_date_idx" ON "Transaction"("userId", "destinationAccountId", "date");
CREATE INDEX "Transaction_userId_categoryId_date_idx" ON "Transaction"("userId", "categoryId", "date");
