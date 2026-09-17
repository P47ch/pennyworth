-- AlterTable
ALTER TABLE "Rule" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rule priorities in stable name order per user.
WITH ordered_rules AS (
    SELECT
        "id",
        (ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "name" ASC) - 1) * 10 AS "nextPriority"
    FROM "Rule"
)
UPDATE "Rule"
SET "priority" = ordered_rules."nextPriority"
FROM ordered_rules
WHERE "Rule"."id" = ordered_rules."id";

-- CreateIndex
CREATE INDEX "Rule_priority_idx" ON "Rule"("priority");
