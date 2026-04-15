-- =============================================================================
-- Schema cleanup: remove duplicate tables, fix JournalEntry, normalize Bill,
-- make Invoice.salesOrderId optional, add missing FK indexes, drop redundant cols
-- =============================================================================

-- -------------------------------------------------------
-- 1. DROP duplicate / unused tables (order_items first due to FK)
-- -------------------------------------------------------
DROP TABLE IF EXISTS "order_items";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "inventories";
DROP TABLE IF EXISTS "products";
DROP TABLE IF EXISTS "deals";

-- -------------------------------------------------------
-- 2. Fix journal_entries: drop legalEntityId + accountId, add entityId
-- -------------------------------------------------------
-- Drop FK constraints first
ALTER TABLE "journal_entries" DROP CONSTRAINT IF EXISTS "journal_entries_legalEntityId_fkey";
ALTER TABLE "journal_entries" DROP CONSTRAINT IF EXISTS "journal_entries_accountId_fkey";

-- Drop columns
ALTER TABLE "journal_entries" DROP COLUMN IF EXISTS "legalEntityId";
ALTER TABLE "journal_entries" DROP COLUMN IF EXISTS "accountId";

-- Add entityId (nullable) + FK
ALTER TABLE "journal_entries" ADD COLUMN "entityId" TEXT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "journal_entries_entityId_idx" ON "journal_entries"("entityId");

-- Now safe to drop legal_entities (no more FK references)
DROP TABLE IF EXISTS "legal_entities";

-- -------------------------------------------------------
-- 3. Make Invoice.salesOrderId optional
-- -------------------------------------------------------
ALTER TABLE "invoices" ALTER COLUMN "salesOrderId" DROP NOT NULL;

-- -------------------------------------------------------
-- 4. Normalize Bill: drop booleans, add entityId/currencyId/userId
-- -------------------------------------------------------
ALTER TABLE "bills" DROP COLUMN IF EXISTS "coded";
ALTER TABLE "bills" DROP COLUMN IF EXISTS "approved";
ALTER TABLE "bills" DROP COLUMN IF EXISTS "paid";

ALTER TABLE "bills" ADD COLUMN "entityId" TEXT;
ALTER TABLE "bills" ADD COLUMN "currencyId" TEXT;
ALTER TABLE "bills" ADD COLUMN "userId" TEXT;

ALTER TABLE "bills" ADD CONSTRAINT "bills_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -------------------------------------------------------
-- 5. Drop redundant Employee.department string column
-- -------------------------------------------------------
ALTER TABLE "employees" DROP COLUMN IF EXISTS "department";

-- -------------------------------------------------------
-- 6. Add missing FK indexes
-- -------------------------------------------------------

-- contacts
CREATE INDEX IF NOT EXISTS "contacts_customerId_idx" ON "contacts"("customerId");
CREATE INDEX IF NOT EXISTS "contacts_userId_idx" ON "contacts"("userId");

-- cash_receipts
CREATE INDEX IF NOT EXISTS "cash_receipts_invoiceId_idx" ON "cash_receipts"("invoiceId");

-- receipts
CREATE INDEX IF NOT EXISTS "receipts_purchaseOrderId_idx" ON "receipts"("purchaseOrderId");

-- invoices
CREATE INDEX IF NOT EXISTS "invoices_customerId_idx" ON "invoices"("customerId");
CREATE INDEX IF NOT EXISTS "invoices_salesOrderId_idx" ON "invoices"("salesOrderId");

-- quotes
CREATE INDEX IF NOT EXISTS "quotes_customerId_idx" ON "quotes"("customerId");
CREATE INDEX IF NOT EXISTS "quotes_userId_idx" ON "quotes"("userId");

-- sales_orders
CREATE INDEX IF NOT EXISTS "sales_orders_customerId_idx" ON "sales_orders"("customerId");
CREATE INDEX IF NOT EXISTS "sales_orders_userId_idx" ON "sales_orders"("userId");

-- purchase_orders
CREATE INDEX IF NOT EXISTS "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");
CREATE INDEX IF NOT EXISTS "purchase_orders_userId_idx" ON "purchase_orders"("userId");

-- bills
CREATE INDEX IF NOT EXISTS "bills_vendorId_idx" ON "bills"("vendorId");
CREATE INDEX IF NOT EXISTS "bills_userId_idx" ON "bills"("userId");
CREATE INDEX IF NOT EXISTS "bills_entityId_idx" ON "bills"("entityId");
CREATE INDEX IF NOT EXISTS "bills_currencyId_idx" ON "bills"("currencyId");

-- line items (parent FK)
CREATE INDEX IF NOT EXISTS "requisition_line_items_requisitionId_idx" ON "requisition_line_items"("requisitionId");
CREATE INDEX IF NOT EXISTS "purchase_order_line_items_purchaseOrderId_idx" ON "purchase_order_line_items"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "opportunity_line_items_opportunityId_idx" ON "opportunity_line_items"("opportunityId");
CREATE INDEX IF NOT EXISTS "quote_line_items_quoteId_idx" ON "quote_line_items"("quoteId");
CREATE INDEX IF NOT EXISTS "sales_order_line_items_salesOrderId_idx" ON "sales_order_line_items"("salesOrderId");
CREATE INDEX IF NOT EXISTS "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");
CREATE INDEX IF NOT EXISTS "bill_line_items_billId_idx" ON "bill_line_items"("billId");
CREATE INDEX IF NOT EXISTS "credit_memo_line_items_creditMemoId_idx" ON "credit_memo_line_items"("creditMemoId");
CREATE INDEX IF NOT EXISTS "bill_credit_line_items_billCreditId_idx" ON "bill_credit_line_items"("billCreditId");
CREATE INDEX IF NOT EXISTS "journal_entry_line_items_journalEntryId_idx" ON "journal_entry_line_items"("journalEntryId");

-- credit_memos
CREATE INDEX IF NOT EXISTS "credit_memos_customerId_idx" ON "credit_memos"("customerId");
CREATE INDEX IF NOT EXISTS "credit_memos_invoiceId_idx" ON "credit_memos"("invoiceId");
CREATE INDEX IF NOT EXISTS "credit_memos_userId_idx" ON "credit_memos"("userId");

-- bill_credits
CREATE INDEX IF NOT EXISTS "bill_credits_vendorId_idx" ON "bill_credits"("vendorId");
CREATE INDEX IF NOT EXISTS "bill_credits_billId_idx" ON "bill_credits"("billId");
CREATE INDEX IF NOT EXISTS "bill_credits_userId_idx" ON "bill_credits"("userId");
