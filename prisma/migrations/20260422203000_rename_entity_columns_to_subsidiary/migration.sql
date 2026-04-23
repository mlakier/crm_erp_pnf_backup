-- Rename subsidiary foreign-key columns from entityId to subsidiaryId.
-- Generic activity/system-note/custom-field entityId columns are intentionally not touched.

CREATE OR REPLACE FUNCTION "_rename_column_if_exists"("p_table_name" TEXT, "p_old_name" TEXT, "p_new_name" TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = "p_table_name"
      AND column_name = "p_old_name"
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = "p_table_name"
      AND column_name = "p_new_name"
  ) THEN
    EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', "p_table_name", "p_old_name", "p_new_name");
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "_rename_index_if_exists"("p_old_name" TEXT, "p_new_name" TEXT)
RETURNS VOID AS $$
BEGIN
  IF to_regclass("p_old_name") IS NOT NULL AND to_regclass("p_new_name") IS NULL THEN
    EXECUTE format('ALTER INDEX %I RENAME TO %I', "p_old_name", "p_new_name");
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "_rename_constraint_if_exists"("p_table_name" TEXT, "p_old_name" TEXT, "p_new_name" TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = "p_table_name"
      AND constraint_name = "p_old_name"
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = "p_table_name"
      AND constraint_name = "p_new_name"
  ) THEN
    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', "p_table_name", "p_old_name", "p_new_name");
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT "_rename_column_if_exists"('user_subsidiaries', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('customers', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('vendors', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('department_subsidiaries', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('leads', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('opportunities', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('quotes', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('sales_orders', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('invoices', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('requisitions', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('purchase_orders', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('credit_memos', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('bill_credits', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('bills', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('journal_entries', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('accounting_periods', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('items', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('item_subsidiaries', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('employees', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('employee_subsidiaries', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('fulfillments', 'entityId', 'subsidiaryId');
SELECT "_rename_column_if_exists"('subsidiaries', 'parentEntityId', 'parentSubsidiaryId');

SELECT "_rename_index_if_exists"('user_subsidiaries_userId_entityId_key', 'user_subsidiaries_userId_subsidiaryId_key');
SELECT "_rename_index_if_exists"('user_subsidiaries_entityId_idx', 'user_subsidiaries_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('user_subsidiaries', 'user_subsidiaries_entityId_fkey', 'user_subsidiaries_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('customers_entityId_idx', 'customers_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('customers', 'customers_entityId_fkey', 'customers_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('vendors_entityId_idx', 'vendors_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('vendors', 'vendors_entityId_fkey', 'vendors_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('department_subsidiaries_departmentId_entityId_key', 'department_subsidiaries_departmentId_subsidiaryId_key');
SELECT "_rename_index_if_exists"('department_subsidiaries_entityId_idx', 'department_subsidiaries_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('department_subsidiaries', 'department_subsidiaries_entityId_fkey', 'department_subsidiaries_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('leads_entityId_idx', 'leads_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('leads', 'leads_entityId_fkey', 'leads_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('opportunities_entityId_idx', 'opportunities_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('opportunities', 'opportunities_entityId_fkey', 'opportunities_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('quotes_entityId_idx', 'quotes_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('quotes', 'quotes_entityId_fkey', 'quotes_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('sales_orders_entityId_idx', 'sales_orders_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('sales_orders', 'sales_orders_entityId_fkey', 'sales_orders_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('invoices_entityId_idx', 'invoices_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('invoices', 'invoices_entityId_fkey', 'invoices_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('requisitions_entityId_idx', 'requisitions_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('requisitions', 'requisitions_entityId_fkey', 'requisitions_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('purchase_orders_entityId_idx', 'purchase_orders_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('purchase_orders', 'purchase_orders_entityId_fkey', 'purchase_orders_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('credit_memos_entityId_idx', 'credit_memos_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('credit_memos', 'credit_memos_entityId_fkey', 'credit_memos_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('bill_credits_entityId_idx', 'bill_credits_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('bill_credits', 'bill_credits_entityId_fkey', 'bill_credits_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('bills_entityId_idx', 'bills_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('bills', 'bills_entityId_fkey', 'bills_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('journal_entries_entityId_idx', 'journal_entries_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('journal_entries', 'journal_entries_entityId_fkey', 'journal_entries_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('accounting_periods_entityId_idx', 'accounting_periods_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('accounting_periods', 'accounting_periods_entityId_fkey', 'accounting_periods_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('items_entityId_idx', 'items_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('items', 'items_entityId_fkey', 'items_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('item_subsidiaries_itemId_entityId_key', 'item_subsidiaries_itemId_subsidiaryId_key');
SELECT "_rename_index_if_exists"('item_subsidiaries_entityId_idx', 'item_subsidiaries_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('item_subsidiaries', 'item_subsidiaries_entityId_fkey', 'item_subsidiaries_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('employees_entityId_idx', 'employees_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('employees', 'employees_entityId_fkey', 'employees_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('employee_subsidiaries_employeeId_entityId_key', 'employee_subsidiaries_employeeId_subsidiaryId_key');
SELECT "_rename_index_if_exists"('employee_subsidiaries_entityId_idx', 'employee_subsidiaries_subsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('employee_subsidiaries', 'employee_subsidiaries_entityId_fkey', 'employee_subsidiaries_subsidiaryId_fkey');

SELECT "_rename_constraint_if_exists"('fulfillments', 'fulfillments_entityId_fkey', 'fulfillments_subsidiaryId_fkey');

SELECT "_rename_index_if_exists"('subsidiaries_parentEntityId_idx', 'subsidiaries_parentSubsidiaryId_idx');
SELECT "_rename_constraint_if_exists"('subsidiaries', 'subsidiaries_parentEntityId_fkey', 'subsidiaries_parentSubsidiaryId_fkey');

DROP FUNCTION "_rename_constraint_if_exists"(TEXT, TEXT, TEXT);
DROP FUNCTION "_rename_index_if_exists"(TEXT, TEXT);
DROP FUNCTION "_rename_column_if_exists"(TEXT, TEXT, TEXT);
