ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_sourceAccountId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_destinationAccountId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_categoryId_fkey";

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_id_userId_key" UNIQUE ("id", "userId");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_id_userId_key" UNIQUE ("id", "userId");

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_sourceAccountId_userId_fkey"
  FOREIGN KEY ("sourceAccountId", "userId")
  REFERENCES "Account"("id", "userId")
  ON DELETE NO ACTION
  ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_destinationAccountId_userId_fkey"
  FOREIGN KEY ("destinationAccountId", "userId")
  REFERENCES "Account"("id", "userId")
  ON DELETE NO ACTION
  ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_categoryId_userId_fkey"
  FOREIGN KEY ("categoryId", "userId")
  REFERENCES "Category"("id", "userId")
  ON DELETE NO ACTION
  ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_amountMinor_positive_check"
  CHECK ("amountMinor" > 0);

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_account_shape_check"
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
