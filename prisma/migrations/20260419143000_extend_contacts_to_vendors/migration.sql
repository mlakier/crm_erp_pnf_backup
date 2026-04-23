-- Allow contacts to belong to either customers or vendors.
ALTER TABLE "contacts"
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "contacts"
  ADD COLUMN "vendorId" TEXT;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "contacts_vendorId_idx" ON "contacts"("vendorId");
