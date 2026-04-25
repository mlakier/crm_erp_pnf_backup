-- Existing data cleanup before enforcing the mutual-exclusion rule.
UPDATE "items"
SET "specialOrderItem" = false
WHERE "dropShipItem" = true
  AND "specialOrderItem" = true;

ALTER TABLE "items"
ADD CONSTRAINT "items_drop_ship_special_order_check"
CHECK (NOT ("dropShipItem" = true AND "specialOrderItem" = true));
