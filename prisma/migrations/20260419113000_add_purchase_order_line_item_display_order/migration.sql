ALTER TABLE "purchase_order_line_items"
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_rows AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "purchaseOrderId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS row_num
  FROM "purchase_order_line_items"
)
UPDATE "purchase_order_line_items" poli
SET "displayOrder" = ordered_rows.row_num
FROM ordered_rows
WHERE poli.id = ordered_rows.id;
