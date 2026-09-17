-- Backfill tenant identity onto junction rows before replacing single-column
-- foreign keys with same-user composite foreign keys.
ALTER TABLE "TransactionTag" ADD COLUMN "userId" TEXT;
ALTER TABLE "RuleTag" ADD COLUMN "userId" TEXT;

UPDATE "TransactionTag" AS transaction_tag
SET "userId" = transaction."userId"
FROM "Transaction" AS transaction
WHERE transaction."id" = transaction_tag."transactionId";

UPDATE "RuleTag" AS rule_tag
SET "userId" = rule."userId"
FROM "Rule" AS rule
WHERE rule."id" = rule_tag."ruleId";

ALTER TABLE "TransactionTag" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "RuleTag" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "Transaction_id_userId_key" ON "Transaction"("id", "userId");
CREATE UNIQUE INDEX "Rule_id_userId_key" ON "Rule"("id", "userId");
CREATE UNIQUE INDEX "Tag_id_userId_key" ON "Tag"("id", "userId");
CREATE INDEX "TransactionTag_userId_idx" ON "TransactionTag"("userId");
CREATE INDEX "RuleTag_userId_idx" ON "RuleTag"("userId");

ALTER TABLE "Budget" DROP CONSTRAINT "Budget_categoryId_fkey";
ALTER TABLE "Rule" DROP CONSTRAINT "Rule_categoryId_fkey";
ALTER TABLE "RecurringTransaction" DROP CONSTRAINT "RecurringTransaction_sourceAccountId_fkey";
ALTER TABLE "RecurringTransaction" DROP CONSTRAINT "RecurringTransaction_destinationAccountId_fkey";
ALTER TABLE "RecurringTransaction" DROP CONSTRAINT "RecurringTransaction_categoryId_fkey";
ALTER TABLE "TransactionTag" DROP CONSTRAINT "TransactionTag_transactionId_fkey";
ALTER TABLE "TransactionTag" DROP CONSTRAINT "TransactionTag_tagId_fkey";
ALTER TABLE "RuleTag" DROP CONSTRAINT "RuleTag_ruleId_fkey";
ALTER TABLE "RuleTag" DROP CONSTRAINT "RuleTag_tagId_fkey";

ALTER TABLE "Budget"
ADD CONSTRAINT "Budget_categoryId_userId_fkey"
FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Rule"
ADD CONSTRAINT "Rule_categoryId_userId_fkey"
FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_sourceAccountId_userId_fkey"
FOREIGN KEY ("sourceAccountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_destinationAccountId_userId_fkey"
FOREIGN KEY ("destinationAccountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_categoryId_userId_fkey"
FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "TransactionTag"
ADD CONSTRAINT "TransactionTag_transactionId_userId_fkey"
FOREIGN KEY ("transactionId", "userId") REFERENCES "Transaction"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionTag"
ADD CONSTRAINT "TransactionTag_tagId_userId_fkey"
FOREIGN KEY ("tagId", "userId") REFERENCES "Tag"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RuleTag"
ADD CONSTRAINT "RuleTag_ruleId_userId_fkey"
FOREIGN KEY ("ruleId", "userId") REFERENCES "Rule"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RuleTag"
ADD CONSTRAINT "RuleTag_tagId_userId_fkey"
FOREIGN KEY ("tagId", "userId") REFERENCES "Tag"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Budget"
ADD CONSTRAINT "Budget_amountMinor_positive_check"
CHECK ("amountMinor" > 0);

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_amountMinor_positive_check"
CHECK ("amountMinor" > 0);

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_account_shape_check"
CHECK (
  (
    "type" IN ('income', 'expense')
    AND "sourceAccountId" IS NOT NULL
    AND "destinationAccountId" IS NULL
  )
  OR
  (
    "type" = 'transfer'
    AND "sourceAccountId" IS NOT NULL
    AND "destinationAccountId" IS NOT NULL
    AND "sourceAccountId" <> "destinationAccountId"
    AND "categoryId" IS NULL
  )
);
