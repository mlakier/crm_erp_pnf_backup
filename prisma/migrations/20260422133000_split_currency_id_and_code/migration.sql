ALTER TABLE "currencies"
ADD COLUMN IF NOT EXISTS "currencyId" TEXT;

WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS sequence
  FROM "currencies"
  WHERE "currencyId" IS NULL OR "currencyId" = ''
)
UPDATE "currencies" AS currency
SET "currencyId" = 'CUR-' || LPAD(ordered.sequence::text, 5, '0')
FROM ordered
WHERE currency."id" = ordered."id";

UPDATE "currencies"
SET "symbol" = "code"
WHERE "symbol" IS NULL OR BTRIM("symbol") = '';

ALTER TABLE "currencies"
ALTER COLUMN "currencyId" SET NOT NULL,
ALTER COLUMN "symbol" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "currencies_currencyId_key" ON "currencies"("currencyId");
