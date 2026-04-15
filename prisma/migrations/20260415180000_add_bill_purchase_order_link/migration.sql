-- Add optional purchase order link to bills
ALTER TABLE "bills" ADD COLUMN "purchaseOrderId" TEXT;

-- Create index for the FK
CREATE INDEX "bills_purchaseOrderId_idx" ON "bills"("purchaseOrderId");

-- Add foreign key constraint
ALTER TABLE "bills" ADD CONSTRAINT "bills_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
