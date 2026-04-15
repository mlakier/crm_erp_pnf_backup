-- =============================================================================
-- Schema cleanup 2: PO line item cascade, Invoice userId, JournalEntry
-- currencyId+userId, missing FK indexes batch 2
-- =============================================================================

-- -------------------------------------------------------
-- 1. Fix PurchaseOrderLineItem onDelete → CASCADE
-- -------------------------------------------------------
ALTER TABLE "purchase_order_line_items"
  DROP CONSTRAINT "purchase_order_line_items_purchaseOrderId_fkey";

ALTER TABLE "purchase_order_line_items"
  ADD CONSTRAINT "purchase_order_line_items_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -------------------------------------------------------
-- 2. Add userId to Invoice
-- -------------------------------------------------------
ALTER TABLE "invoices" ADD COLUMN "userId" TEXT;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "invoices_userId_idx" ON "invoices"("userId");

-- -------------------------------------------------------
-- 3. Add currencyId + userId to JournalEntry
-- -------------------------------------------------------
ALTER TABLE "journal_entries" ADD COLUMN "currencyId" TEXT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "journal_entries_currencyId_idx" ON "journal_entries"("currencyId");

ALTER TABLE "journal_entries" ADD COLUMN "userId" TEXT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "journal_entries_userId_idx" ON "journal_entries"("userId");

-- -------------------------------------------------------
-- 4. Missing FK indexes (batch 2)
-- -------------------------------------------------------

-- users
CREATE INDEX IF NOT EXISTS "users_departmentId_idx" ON "users"("departmentId");

-- customers
CREATE INDEX IF NOT EXISTS "customers_userId_idx" ON "customers"("userId");

-- projects
CREATE INDEX IF NOT EXISTS "projects_userId_idx" ON "projects"("userId");

-- tasks
CREATE INDEX IF NOT EXISTS "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX IF NOT EXISTS "tasks_userId_idx" ON "tasks"("userId");

-- leads
CREATE INDEX IF NOT EXISTS "leads_userId_idx" ON "leads"("userId");

-- opportunities
CREATE INDEX IF NOT EXISTS "opportunities_customerId_idx" ON "opportunities"("customerId");
CREATE INDEX IF NOT EXISTS "opportunities_userId_idx" ON "opportunities"("userId");

-- requisitions
CREATE INDEX IF NOT EXISTS "requisitions_userId_idx" ON "requisitions"("userId");
CREATE INDEX IF NOT EXISTS "requisitions_departmentId_idx" ON "requisitions"("departmentId");
CREATE INDEX IF NOT EXISTS "requisitions_vendorId_idx" ON "requisitions"("vendorId");

-- custom_field_values
CREATE INDEX IF NOT EXISTS "custom_field_values_fieldId_idx" ON "custom_field_values"("fieldId");
CREATE INDEX IF NOT EXISTS "custom_field_values_entityType_recordId_idx" ON "custom_field_values"("entityType", "recordId");

-- attachments
CREATE INDEX IF NOT EXISTS "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- approval_records
CREATE INDEX IF NOT EXISTS "approval_records_entityType_entityId_idx" ON "approval_records"("entityType", "entityId");
