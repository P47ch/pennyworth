-- Existing null cash-account values represented the UI's "Same as account"
-- option. Make that intent explicit for existing ledgers.
UPDATE "InvestmentTransaction"
SET "cashAccountId" = "accountId"
WHERE "cashAccountId" IS NULL;

-- Category parents must belong to the same user. Application validation also
-- rejects cycles, while this composite key protects direct database writes.
ALTER TABLE "Category" DROP CONSTRAINT "Category_parentId_fkey";

ALTER TABLE "Category"
ADD CONSTRAINT "Category_parentId_userId_fkey"
FOREIGN KEY ("parentId", "userId")
REFERENCES "Category"("id", "userId")
ON DELETE NO ACTION
ON UPDATE CASCADE;
