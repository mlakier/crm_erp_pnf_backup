ALTER TABLE "subsidiaries"
RENAME COLUMN "defaultCurrencyId" TO "localCurrencyId";

ALTER TABLE "subsidiaries"
RENAME COLUMN "reportingCurrencyId" TO "groupCurrencyId";

ALTER INDEX IF EXISTS "subsidiaries_defaultCurrencyId_idx"
RENAME TO "subsidiaries_localCurrencyId_idx";

ALTER INDEX IF EXISTS "subsidiaries_reportingCurrencyId_idx"
RENAME TO "subsidiaries_groupCurrencyId_idx";

ALTER TABLE "subsidiaries"
RENAME CONSTRAINT "subsidiaries_defaultCurrencyId_fkey" TO "subsidiaries_localCurrencyId_fkey";

ALTER TABLE "subsidiaries"
RENAME CONSTRAINT "subsidiaries_reportingCurrencyId_fkey" TO "subsidiaries_groupCurrencyId_fkey";
