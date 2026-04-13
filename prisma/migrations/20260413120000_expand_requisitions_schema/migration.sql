-- Expand Requisition model with additional fields and add RequisitionLineItem table

-- Add new columns to requisitions
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "neededByDate" TIMESTAMP(3);
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "requisitions" ADD COLUMN IF NOT EXISTS "currencyId" TEXT;

-- Make departmentId optional (was required)
ALTER TABLE "requisitions" ALTER COLUMN "departmentId" DROP NOT NULL;

-- Make total default to 0 (was required float)
ALTER TABLE "requisitions" ALTER COLUMN "total" SET DEFAULT 0;

-- Add FK indexes for new columns
CREATE INDEX IF NOT EXISTS "requisitions_entityId_idx" ON "requisitions"("entityId");
CREATE INDEX IF NOT EXISTS "requisitions_currencyId_idx" ON "requisitions"("currencyId");
CREATE INDEX IF NOT EXISTS "requisitions_status_idx" ON "requisitions"("status");

-- Add FK constraints for new columns
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create RequisitionLineItem table
CREATE TABLE "requisition_line_items" (
  "id"            TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "quantity"      INTEGER NOT NULL DEFAULT 1,
  "unitPrice"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lineTotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requisitionId" TEXT NOT NULL,
  "itemId"        TEXT,
  CONSTRAINT "requisition_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "requisition_line_items_itemId_idx" ON "requisition_line_items"("itemId");

ALTER TABLE "requisition_line_items" ADD CONSTRAINT "requisition_line_items_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "requisition_line_items" ADD CONSTRAINT "requisition_line_items_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
