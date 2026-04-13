ALTER TABLE "ap_invoices"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS seq
  FROM "ap_invoices"
  WHERE number IS NULL OR btrim(number) = ''
)
UPDATE "ap_invoices" AS ap
SET number = 'BILL-' || LPAD(numbered.seq::text, 6, '0')
FROM numbered
WHERE ap.id = numbered.id;

ALTER TABLE "ap_invoices"
  ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ap_invoices_number_key" ON "ap_invoices"("number");
CREATE INDEX IF NOT EXISTS "ap_invoices_status_idx" ON "ap_invoices"("status");
