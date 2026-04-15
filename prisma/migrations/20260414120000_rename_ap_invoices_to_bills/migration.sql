-- Rename table
ALTER TABLE "ap_invoices" RENAME TO "bills";

-- Rename indexes
ALTER INDEX "ap_invoices_pkey" RENAME TO "bills_pkey";
ALTER INDEX "ap_invoices_number_key" RENAME TO "bills_number_key";
ALTER INDEX "ap_invoices_status_idx" RENAME TO "bills_status_idx";

-- Rename foreign key constraint
ALTER TABLE "bills" RENAME CONSTRAINT "ap_invoices_vendorId_fkey" TO "bills_vendorId_fkey";
