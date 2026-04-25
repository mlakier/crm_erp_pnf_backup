import { CHART_OF_ACCOUNTS_FORM_FIELDS } from '@/lib/chart-of-accounts-form-customization'
import { CONTACT_FORM_FIELDS } from '@/lib/contact-form-customization'
import { CURRENCY_FORM_FIELDS } from '@/lib/currency-form-customization'
import { CUSTOMER_FORM_FIELDS } from '@/lib/customer-form-customization'
import { DEPARTMENT_FORM_FIELDS } from '@/lib/department-form-customization'
import { EMPLOYEE_FORM_FIELDS } from '@/lib/employee-form-customization'
import { ITEM_FORM_FIELDS } from '@/lib/item-form-customization'
import { LOCATION_FORM_FIELDS } from '@/lib/location-form-customization'
import { ROLE_FORM_FIELDS } from '@/lib/role-form-customization'
import { SUBSIDIARY_FORM_FIELDS } from '@/lib/subsidiary-form-customization'
import { USER_FORM_FIELDS } from '@/lib/user-form-customization'
import { VENDOR_FORM_FIELDS } from '@/lib/vendor-form-customization'

type FieldWithManagedListSource = {
  label: string
  sourceType?: string
  sourceKey?: string
}

export type ManagedListDefinition = {
  key: string
  label: string
  whereUsed: string[]
  defaultValues?: string[]
}

const STATIC_MANAGED_LISTS: ManagedListDefinition[] = [
  { key: 'BILL-STATUS', label: 'Bill Status', whereUsed: ['Bills'] },
  { key: 'BILL-PAYMENT-STATUS', label: 'Bill Payment Status', whereUsed: ['Bill Payments'] },
  { key: 'ACCOUNTING-PERIOD-STATUS', label: 'Accounting Period Status', whereUsed: ['Accounting Periods'] },
  { key: 'COA-CASH-FLOW-CATEGORY', label: 'Cash Flow Category', whereUsed: ['Chart of Accounts'] },
  { key: 'COA-FS-CATEGORY', label: 'Financial Statement Category', whereUsed: ['Chart of Accounts'] },
  { key: 'COA-FS-GROUP', label: 'Financial Statement Group', whereUsed: ['Chart of Accounts'] },
  { key: 'COA-FS-SECTION', label: 'Financial Statement Section', whereUsed: ['Chart of Accounts'] },
  { key: 'COA-SUBLEDGER-TYPE', label: 'Required Subledger Type', whereUsed: ['Chart of Accounts'] },
  { key: 'CONSOLIDATION-METHOD', label: 'Consolidation Method', whereUsed: ['Subsidiaries'] },
  { key: 'ENTITY-TYPE', label: 'Subsidiary Type', whereUsed: ['Subsidiaries'] },
  { key: 'EXCHANGE-RATE-TYPE', label: 'Exchange Rate Type', whereUsed: ['Exchange Rates'] },
  { key: 'FULFILL-STATUS', label: 'Fulfillment Status', whereUsed: ['Fulfillments'] },
  { key: 'INV-RECEIPT-STATUS', label: 'Invoice Receipt Status', whereUsed: ['Invoice Receipts'] },
  { key: 'INV-STATUS', label: 'Invoice Status', whereUsed: ['Invoices'] },
  { key: 'JOURNAL-STATUS', label: 'Journal Status', whereUsed: ['Journals'] },
  { key: 'JOURNAL-SOURCE-TYPE', label: 'Journal Source Type', whereUsed: ['Journals', 'Intercompany Journals'] },
  { key: 'LEAD-RAT', label: 'Lead Rating', whereUsed: ['Leads'] },
  { key: 'LEAD-SRC', label: 'Lead Source', whereUsed: ['Leads'] },
  { key: 'LEAD-STATUS', label: 'Lead Status', whereUsed: ['Leads'] },
  { key: 'LOCATION-TYPE', label: 'Location Type', whereUsed: ['Locations'] },
  { key: 'OPP-STAGE', label: 'Opportunity Stage', whereUsed: ['Opportunities'] },
  { key: 'PAYMENT-METHOD', label: 'Payment Method', whereUsed: ['Invoice Receipts', 'Bill Payments'] },
  { key: 'PO-STATUS', label: 'Purchase Order Status', whereUsed: ['Purchase Orders'] },
  { key: 'QUOTE-STATUS', label: 'Quote Status', whereUsed: ['Quotes'] },
  { key: 'RECEIPT-STATUS', label: 'Receipt Status', whereUsed: ['Receipts'] },
  { key: 'REQ-STATUS', label: 'Requisition Status', whereUsed: ['Purchase Requisitions'] },
  { key: 'SO-STATUS', label: 'Sales Order Status', whereUsed: ['Sales Orders'] },
]

const MANAGED_LIST_DEFAULT_VALUES: Record<string, string[]> = {
  'ACCOUNTING-PERIOD-STATUS': ['Open', 'Closed', 'Locked'],
  'BILL-PAYMENT-STATUS': ['Pending', 'Processed', 'Cleared', 'Void'],
  'COA-CASH-FLOW-CATEGORY': ['Operating', 'Investing', 'Financing', 'Non-Cash'],
  'COA-FS-CATEGORY': ['Cash', 'Accounts Receivable', 'Inventory', 'Prepaids', 'Other Current Assets', 'Fixed Assets', 'Accounts Payable', 'Accrued Liabilities', 'Deferred Revenue', 'Debt', 'Equity', 'Revenue', 'Cost of Sales', 'Operating Expenses', 'Depreciation', 'Interest', 'FX', 'Other Income', 'Other Expense'],
  'COA-FS-GROUP': ['Current Assets', 'Non-Current Assets', 'Current Liabilities', 'Non-Current Liabilities', 'Equity', 'Revenue', 'Cost of Goods Sold', 'Operating Expenses', 'Other Income and Expense'],
  'COA-FS-SECTION': ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses', 'Other Income and Expense'],
  'COA-SUBLEDGER-TYPE': ['Customer', 'Vendor', 'Employee', 'Item', 'Project', 'Department', 'Subsidiary'],
  'CONSOLIDATION-METHOD': ['Full Consolidation', 'Equity Method', 'Proportional Consolidation', 'Not Consolidated'],
  'ENTITY-TYPE': ['Corporation', 'LLC', 'Partnership', 'Branch', 'Disregarded Subsidiary', 'Other'],
  'EMP-LABOR-TYPE': ['FTE', 'PTE', 'IC', 'Intern'],
  'EXCHANGE-RATE-TYPE': ['Spot', 'Average', 'Closing', 'Budget'],
  'FULFILL-STATUS': ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
  'JOURNAL-STATUS': ['Draft', 'Posted', 'Void'],
  'JOURNAL-SOURCE-TYPE': ['Manual', 'Allocation', 'Accrual', 'Reclass', 'Elimination', 'Recurring'],
  'ITEM-RECOGNITION-METHOD': ['Point in Time', 'Over Time'],
  'ITEM-RECOGNITION-TRIGGER': ['Sales Order Approval', 'Invoice Posting', 'Fulfillment', 'Manual'],
  'ITEM-REV-ARRANGEMENT-TRIGGER': ['Sales Order Approval', 'Invoice Posting', 'Fulfillment', 'Manual'],
  'ITEM-FORECAST-PLAN-TRIGGER': ['Quote Approval', 'Opportunity Close-Won', 'Sales Order Creation', 'Sales Order Approval', 'Manual'],
  'ITEM-REVENUE-PLAN-TRIGGER': ['Invoice Posting', 'Fulfillment', 'Service Start', 'Manual'],
  'ITEM-PERFORMANCE-OBLIGATION-TYPE': ['License', 'Subscription', 'Service', 'Support', 'Hardware', 'Usage', 'Milestone', 'Other'],
  'ITEM-BILLING-TYPE': ['One-Time', 'Recurring', 'Usage', 'Milestone'],
  'ITEM-UNITS-TYPE': ['Each', 'Hours', 'Days', 'Months', 'Seats'],
  'LOCATION-TYPE': ['Office', 'Warehouse', 'Store'],
  'PAYMENT-METHOD': ['Check', 'Wire', 'ACH', 'Credit Card', 'Cash'],
}

const FIELD_GROUPS: Array<{ whereUsed: string; fields: FieldWithManagedListSource[] }> = [
  { whereUsed: 'Chart of Accounts', fields: CHART_OF_ACCOUNTS_FORM_FIELDS },
  { whereUsed: 'Contacts', fields: CONTACT_FORM_FIELDS },
  { whereUsed: 'Currencies', fields: CURRENCY_FORM_FIELDS },
  { whereUsed: 'Customers', fields: CUSTOMER_FORM_FIELDS },
  { whereUsed: 'Departments', fields: DEPARTMENT_FORM_FIELDS },
  { whereUsed: 'Employees', fields: EMPLOYEE_FORM_FIELDS },
  { whereUsed: 'Items', fields: ITEM_FORM_FIELDS },
  { whereUsed: 'Locations', fields: LOCATION_FORM_FIELDS },
  { whereUsed: 'Roles', fields: ROLE_FORM_FIELDS },
  { whereUsed: 'Subsidiaries', fields: SUBSIDIARY_FORM_FIELDS },
  { whereUsed: 'Users', fields: USER_FORM_FIELDS },
  { whereUsed: 'Vendors', fields: VENDOR_FORM_FIELDS },
]

export function normalizeManagedListKey(sourceKey: string): string {
  const trimmed = sourceKey.trim().toUpperCase()
  return trimmed.startsWith('LIST-') ? trimmed.slice(5) : trimmed
}

export function loadManagedListDefinitions(): ManagedListDefinition[] {
  const byKey = new Map<string, ManagedListDefinition>()

  function upsert(definition: ManagedListDefinition) {
    const key = normalizeManagedListKey(definition.key)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        label: definition.label,
        whereUsed: [...definition.whereUsed],
        defaultValues: definition.defaultValues ?? MANAGED_LIST_DEFAULT_VALUES[key],
      })
      return
    }

    existing.whereUsed = Array.from(new Set([...existing.whereUsed, ...definition.whereUsed]))
    existing.defaultValues ??= definition.defaultValues ?? MANAGED_LIST_DEFAULT_VALUES[key]
  }

  STATIC_MANAGED_LISTS.forEach(upsert)

  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      if (field.sourceType !== 'managed-list' || !field.sourceKey) continue
      upsert({
        key: field.sourceKey,
        label: field.label,
        whereUsed: [group.whereUsed],
      })
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function getManagedListDefinition(key: string): ManagedListDefinition | undefined {
  const normalizedKey = normalizeManagedListKey(key)
  return loadManagedListDefinitions().find((definition) => definition.key === normalizedKey)
}
