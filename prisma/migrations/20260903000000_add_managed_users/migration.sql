CREATE TYPE "UserRole" AS ENUM ('admin', 'member');

ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'member',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Existing installations only had a configured owner. Preserve access by
-- promoting the oldest account; ensureInitialAdmin also promotes the account
-- identified by INITIAL_ADMIN_EMAIL on every deployment.
UPDATE "User"
SET "role" = 'admin'
WHERE "id" = (
  SELECT "id"
  FROM "User"
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
);

-- Application-created addresses are normalized before storage. Normalize old
-- data and enforce the same invariant for direct database writes.
UPDATE "User" SET "email" = lower(btrim("email"));

CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

ALTER TABLE "User"
ADD CONSTRAINT "User_email_normalized_check"
CHECK ("email" = lower(btrim("email")));
