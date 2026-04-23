ALTER TABLE "cash_receipts" ADD COLUMN "number" TEXT;

WITH numbered_receipts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS sequence
  FROM "cash_receipts"
)
UPDATE "cash_receipts"
SET "number" = 'IR-' || LPAD(numbered_receipts.sequence::text, 6, '0')
FROM numbered_receipts
WHERE "cash_receipts"."id" = numbered_receipts."id";

CREATE UNIQUE INDEX "cash_receipts_number_key" ON "cash_receipts"("number");
