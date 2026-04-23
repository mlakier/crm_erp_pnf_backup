ALTER TABLE "items"
ADD COLUMN IF NOT EXISTS "salesDescription" TEXT,
ADD COLUMN IF NOT EXISTS "purchaseDescription" TEXT,
ADD COLUMN IF NOT EXISTS "itemCategory" TEXT,
ADD COLUMN IF NOT EXISTS "primaryPurchaseUnit" TEXT,
ADD COLUMN IF NOT EXISTS "primarySaleUnit" TEXT,
ADD COLUMN IF NOT EXISTS "primaryUnitsType" TEXT,
ADD COLUMN IF NOT EXISTS "includeChildren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "line" TEXT,
ADD COLUMN IF NOT EXISTS "productLine" TEXT,
ADD COLUMN IF NOT EXISTS "dropShipItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "specialOrderItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canBeFulfilled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
ADD COLUMN IF NOT EXISTS "locationId" TEXT,
ADD COLUMN IF NOT EXISTS "preferredVendorId" TEXT;

CREATE TABLE IF NOT EXISTS "item_subsidiaries" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_subsidiaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "items_departmentId_idx" ON "items"("departmentId");
CREATE INDEX IF NOT EXISTS "items_locationId_idx" ON "items"("locationId");
CREATE INDEX IF NOT EXISTS "items_preferredVendorId_idx" ON "items"("preferredVendorId");

CREATE UNIQUE INDEX IF NOT EXISTS "item_subsidiaries_itemId_entityId_key" ON "item_subsidiaries"("itemId", "entityId");
CREATE INDEX IF NOT EXISTS "item_subsidiaries_itemId_idx" ON "item_subsidiaries"("itemId");
CREATE INDEX IF NOT EXISTS "item_subsidiaries_entityId_idx" ON "item_subsidiaries"("entityId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_departmentId_fkey') THEN
    ALTER TABLE "items" ADD CONSTRAINT "items_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_locationId_fkey') THEN
    ALTER TABLE "items" ADD CONSTRAINT "items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_preferredVendorId_fkey') THEN
    ALTER TABLE "items" ADD CONSTRAINT "items_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'item_subsidiaries_itemId_fkey') THEN
    ALTER TABLE "item_subsidiaries" ADD CONSTRAINT "item_subsidiaries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'item_subsidiaries_entityId_fkey') THEN
    ALTER TABLE "item_subsidiaries" ADD CONSTRAINT "item_subsidiaries_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
