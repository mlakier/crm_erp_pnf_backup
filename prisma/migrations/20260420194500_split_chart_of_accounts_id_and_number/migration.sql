ALTER TABLE "chart_of_accounts" ADD COLUMN "accountId" TEXT;

WITH ordered_accounts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS seq
  FROM "chart_of_accounts"
)
UPDATE "chart_of_accounts" AS coa
SET "accountId" = 'GL' || LPAD(ordered_accounts.seq::text, 5, '0')
FROM ordered_accounts
WHERE coa."id" = ordered_accounts."id";

ALTER TABLE "chart_of_accounts"
  ALTER COLUMN "accountId" SET NOT NULL;

CREATE UNIQUE INDEX "chart_of_accounts_accountId_key" ON "chart_of_accounts"("accountId");
