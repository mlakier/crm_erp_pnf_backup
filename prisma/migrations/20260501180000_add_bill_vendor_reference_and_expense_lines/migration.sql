ALTER TABLE "bills"
ADD COLUMN "vendorBillNumber" TEXT;

CREATE INDEX "bills_vendorBillNumber_idx" ON "bills"("vendorBillNumber");

ALTER TABLE "bill_line_items"
ADD COLUMN "lineType" TEXT NOT NULL DEFAULT 'item',
ADD COLUMN "expenseAccountId" TEXT;

CREATE INDEX "bill_line_items_lineType_idx" ON "bill_line_items"("lineType");
CREATE INDEX "bill_line_items_expenseAccountId_idx" ON "bill_line_items"("expenseAccountId");

ALTER TABLE "bill_line_items"
ADD CONSTRAINT "bill_line_items_expenseAccountId_fkey"
FOREIGN KEY ("expenseAccountId") REFERENCES "chart_of_accounts"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
