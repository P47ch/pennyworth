ALTER TYPE "RecurringFrequency" ADD VALUE 'weekly';
CREATE TYPE "RecurringAmountMode" AS ENUM ('fixed', 'target_balance');
CREATE TYPE "RecurringFeeAccount" AS ENUM ('source', 'destination');

ALTER TABLE "RecurringTransaction"
  ALTER COLUMN "amountMinor" DROP NOT NULL,
  ADD COLUMN "amountMode" "RecurringAmountMode" NOT NULL DEFAULT 'fixed',
  ADD COLUMN "targetBalanceMinor" INTEGER,
  ADD COLUMN "feeAmountMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "feeAccount" "RecurringFeeAccount" NOT NULL DEFAULT 'source',
  ADD COLUMN "feeCategoryId" TEXT,
  DROP CONSTRAINT "RecurringTransaction_amountMinor_positive_check";

ALTER TABLE "RecurringTransaction"
  ADD CONSTRAINT "RecurringTransaction_amount_mode_check" CHECK (
    ("amountMode" = 'fixed' AND "amountMinor" IS NOT NULL AND "amountMinor" > 0 AND "targetBalanceMinor" IS NULL)
    OR ("amountMode" = 'target_balance' AND "type" = 'transfer' AND "amountMinor" IS NULL
      AND "targetBalanceMinor" IS NOT NULL AND "targetBalanceMinor" >= 0)
  ),
  ADD CONSTRAINT "RecurringTransaction_fee_check" CHECK (
    "feeAmountMinor" >= 0 AND ("type" = 'transfer' OR ("feeAmountMinor" = 0 AND "feeCategoryId" IS NULL AND "feeAccount" = 'source'))
  ),
  ADD CONSTRAINT "RecurringTransaction_feeCategoryId_userId_fkey"
    FOREIGN KEY ("feeCategoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE INDEX "RecurringTransaction_feeCategoryId_idx" ON "RecurringTransaction"("feeCategoryId");

ALTER TABLE "Transaction" ADD COLUMN "feeForTransactionId" TEXT;
CREATE UNIQUE INDEX "Transaction_feeForTransactionId_userId_key" ON "Transaction"("feeForTransactionId", "userId");
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_feeForTransactionId_userId_fkey"
    FOREIGN KEY ("feeForTransactionId", "userId") REFERENCES "Transaction"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Transaction_fee_shape_check" CHECK (
    "feeForTransactionId" IS NULL OR ("type" = 'expense' AND "id" <> "feeForTransactionId")
  );

-- Deferred validation permits inserting/restoring both records before checking the pair.
CREATE FUNCTION pennyworth_check_transfer_fee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Transaction" fee
    JOIN "Transaction" principal ON principal."id" = fee."feeForTransactionId" AND principal."userId" = fee."userId"
    WHERE (fee."id" = NEW."id" OR principal."id" = NEW."id") AND (
      principal."type" <> 'transfer' OR fee."date" <> principal."date"
      OR fee."sourceAccountId" NOT IN (principal."sourceAccountId", principal."destinationAccountId")
    )
  ) THEN
    RAISE EXCEPTION 'Transfer fees must reference a transfer on the same date and debit its source or destination' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Transaction_transfer_fee_check"
  AFTER INSERT OR UPDATE ON "Transaction" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION pennyworth_check_transfer_fee();
