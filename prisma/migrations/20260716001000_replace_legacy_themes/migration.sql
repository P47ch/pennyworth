ALTER TABLE "User" ALTER COLUMN "theme" SET DEFAULT 'light';

UPDATE "User"
SET "theme" = CASE
  WHEN "theme" = 'terminal-green' THEN 'dark'
  ELSE 'light'
END
WHERE "theme" IN ('ledger-light', 'terminal-light', 'terminal-green');
