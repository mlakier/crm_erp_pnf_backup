-- Expand chart_of_accounts fields
ALTER TABLE "chart_of_accounts"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "accountType" TEXT,
  ADD COLUMN IF NOT EXISTS "inventory" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "revalueOpenBalance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "eliminateIntercoTransactions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "summary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parentSubsidiaryId" TEXT,
  ADD COLUMN IF NOT EXISTS "includeChildren" BOOLEAN NOT NULL DEFAULT false;

-- Backfill accountType from previous type column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chart_of_accounts'
      AND column_name = 'type'
  ) THEN
    UPDATE "chart_of_accounts"
    SET "accountType" = COALESCE("accountType", "type")
    WHERE "accountType" IS NULL;

    ALTER TABLE "chart_of_accounts" DROP COLUMN "type";
  END IF;
END $$;

UPDATE "chart_of_accounts"
SET "accountType" = COALESCE(NULLIF(BTRIM("accountType"), ''), 'Asset');

ALTER TABLE "chart_of_accounts"
  ALTER COLUMN "accountType" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chart_of_accounts_parentSubsidiaryId_fkey'
  ) THEN
    ALTER TABLE "chart_of_accounts"
      ADD CONSTRAINT "chart_of_accounts_parentSubsidiaryId_fkey"
      FOREIGN KEY ("parentSubsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "chart_of_accounts_parentSubsidiaryId_idx" ON "chart_of_accounts"("parentSubsidiaryId");

-- Many-to-many selected subsidiaries for chart accounts
CREATE TABLE IF NOT EXISTS "chart_of_account_subsidiaries" (
  "id" TEXT NOT NULL,
  "chartOfAccountId" TEXT NOT NULL,
  "subsidiaryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chart_of_account_subsidiaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_account_subsidiaries_chartOfAccountId_subsidiaryId_key"
  ON "chart_of_account_subsidiaries"("chartOfAccountId", "subsidiaryId");

CREATE INDEX IF NOT EXISTS "chart_of_account_subsidiaries_subsidiaryId_idx"
  ON "chart_of_account_subsidiaries"("subsidiaryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chart_of_account_subsidiaries_chartOfAccountId_fkey'
  ) THEN
    ALTER TABLE "chart_of_account_subsidiaries"
      ADD CONSTRAINT "chart_of_account_subsidiaries_chartOfAccountId_fkey"
      FOREIGN KEY ("chartOfAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chart_of_account_subsidiaries_subsidiaryId_fkey'
  ) THEN
    ALTER TABLE "chart_of_account_subsidiaries"
      ADD CONSTRAINT "chart_of_account_subsidiaries_subsidiaryId_fkey"
      FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
