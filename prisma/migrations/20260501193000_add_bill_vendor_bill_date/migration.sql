ALTER TABLE "bills"
ADD COLUMN "vendorBillDate" TIMESTAMP(3);

CREATE INDEX "bills_vendorBillDate_idx" ON "bills"("vendorBillDate");
