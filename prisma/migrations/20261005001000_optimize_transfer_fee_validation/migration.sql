-- Separate lookups let PostgreSQL use the fee primary key and parent-link index.
-- Replace the function so installations that applied the original migration get the fix.
CREATE OR REPLACE FUNCTION pennyworth_check_transfer_fee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Transaction" fee
    JOIN "Transaction" principal ON principal."id" = fee."feeForTransactionId" AND principal."userId" = fee."userId"
    WHERE fee."id" = NEW."id" AND (
      principal."type" <> 'transfer' OR fee."date" <> principal."date"
      OR fee."sourceAccountId" NOT IN (principal."sourceAccountId", principal."destinationAccountId")
    )
  ) OR EXISTS (
    SELECT 1 FROM "Transaction" fee
    JOIN "Transaction" principal ON principal."id" = fee."feeForTransactionId" AND principal."userId" = fee."userId"
    WHERE fee."feeForTransactionId" = NEW."id" AND (
      principal."type" <> 'transfer' OR fee."date" <> principal."date"
      OR fee."sourceAccountId" NOT IN (principal."sourceAccountId", principal."destinationAccountId")
    )
  ) THEN
    RAISE EXCEPTION 'Transfer fees must reference a transfer on the same date and debit its source or destination' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
