ALTER TABLE "users"
  ALTER COLUMN "approvalLimit" TYPE DECIMAL(18, 2) USING ROUND("approvalLimit"::numeric, 2);

ALTER TABLE "leads"
  ALTER COLUMN "expectedValue" TYPE DECIMAL(18, 2) USING ROUND("expectedValue"::numeric, 2);

ALTER TABLE "opportunities"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "opportunity_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "quotes"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "sales_orders"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "invoices"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "cash_receipts"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "requisitions"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "requisition_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "purchase_orders"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "purchase_order_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "quote_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "sales_order_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "invoice_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2),
  ALTER COLUMN "standaloneSellingPrice" TYPE DECIMAL(18, 2) USING ROUND("standaloneSellingPrice"::numeric, 2),
  ALTER COLUMN "allocatedAmount" TYPE DECIMAL(18, 2) USING ROUND("allocatedAmount"::numeric, 2);

ALTER TABLE "bill_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2),
  ALTER COLUMN "standaloneSellingPrice" TYPE DECIMAL(18, 2) USING ROUND("standaloneSellingPrice"::numeric, 2),
  ALTER COLUMN "allocatedAmount" TYPE DECIMAL(18, 2) USING ROUND("allocatedAmount"::numeric, 2);

ALTER TABLE "credit_memos"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "credit_memo_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "bill_credits"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "bill_credit_line_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(18, 2) USING ROUND("lineTotal"::numeric, 2);

ALTER TABLE "journal_entry_line_items"
  ALTER COLUMN "debit" TYPE DECIMAL(18, 2) USING ROUND("debit"::numeric, 2),
  ALTER COLUMN "credit" TYPE DECIMAL(18, 2) USING ROUND("credit"::numeric, 2);

ALTER TABLE "bills"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "journal_entries"
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "exchange_rates"
  ALTER COLUMN "rate" TYPE DECIMAL(18, 8) USING ROUND("rate"::numeric, 8);

ALTER TABLE "items"
  ALTER COLUMN "standaloneSellingPrice" TYPE DECIMAL(18, 2) USING ROUND("standaloneSellingPrice"::numeric, 2),
  ALTER COLUMN "listPrice" TYPE DECIMAL(18, 2) USING ROUND("listPrice"::numeric, 2),
  ALTER COLUMN "standardCost" TYPE DECIMAL(18, 2) USING ROUND("standardCost"::numeric, 2),
  ALTER COLUMN "averageCost" TYPE DECIMAL(18, 2) USING ROUND("averageCost"::numeric, 2);

ALTER TABLE "employees"
  ALTER COLUMN "laborCostRate" TYPE DECIMAL(18, 2) USING ROUND("laborCostRate"::numeric, 2),
  ALTER COLUMN "billingRate" TYPE DECIMAL(18, 2) USING ROUND("billingRate"::numeric, 2);

ALTER TABLE "bill_payments"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING ROUND("amount"::numeric, 2);
