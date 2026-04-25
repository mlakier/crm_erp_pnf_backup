import { prisma } from '@/lib/prisma'
import { COUNTRY_OPTIONS } from '@/lib/address-country-config'

export type FieldSourceType = 'reference' | 'managed-list' | 'system'

export type ListSourceDefinition = {
  sourceType?: FieldSourceType
  sourceKey?: string
}

export type SelectOption = {
  value: string
  label: string
}

const MANAGED_LIST_LABELS: Record<string, string> = {
  'ACCOUNTING-PERIOD-STATUS': 'Accounting Period Status',
  'BILL-STATUS': 'Bill Status',
  'BILL-PAYMENT-STATUS': 'Bill Payment Status',
  'COA-CASH-FLOW-CATEGORY': 'Cash Flow Category',
  'COA-FS-CATEGORY': 'Financial Statement Category',
  'COA-FS-GROUP': 'Financial Statement Group',
  'COA-FS-SECTION': 'Financial Statement Section',
  'COA-SUBLEDGER-TYPE': 'Required Subledger Type',
  'CONSOLIDATION-METHOD': 'Consolidation Method',
  'DEPT-DIVISION': 'Division',
  'ENTITY-TYPE': 'Subsidiary Type',
  'EMP-LABOR-TYPE': 'Labor Type',
  'EXCHANGE-RATE-TYPE': 'Exchange Rate Type',
  'FULFILL-STATUS': 'Fulfillment Status',
  'CUST-INDUSTRY': 'Industry',
  'INV-RECEIPT-STATUS': 'Invoice Receipt Status',
  'INV-STATUS': 'Invoice Status',
  'JOURNAL-STATUS': 'Journal Status',
  'JOURNAL-SOURCE-TYPE': 'Journal Source Type',
  'ITEM-TYPE': 'Item Type',
  'ITEM-BILLING-TYPE': 'Billing Type',
  'ITEM-BILLING-TRIGGER': 'Billing Trigger',
  'ITEM-FORECAST-PLAN-TRIGGER': 'Create Forecast Plan On',
  'ITEM-BUSINESS-LINE': 'Business Line',
  'ITEM-PERFORMANCE-OBLIGATION-TYPE': 'Performance Obligation Type',
  'ITEM-PRIMARY-PURCHASE-UNIT': 'Primary Purchase Unit',
  'ITEM-PRIMARY-SALE-UNIT': 'Primary Sales Unit',
  'ITEM-PRODUCT-LINE': 'Product Line',
  'ITEM-REVENUE-PLAN-TRIGGER': 'Create Revenue Plan On',
  'ITEM-REVENUE-STREAM': 'Revenue Stream',
  'ITEM-REV-ARRANGEMENT-TRIGGER': 'Create Revenue Arrangement On',
  'ITEM-UOM': 'UOM',
  'ITEM-UNITS-TYPE': 'Primary Units Type',
  'LEAD-RAT': 'Lead Rating',
  'LEAD-SRC': 'Lead Source',
  'LEAD-STATUS': 'Lead Status',
  'LOCATION-TYPE': 'Location Type',
  'OPP-STAGE': 'Opportunity Stage',
  'PAYMENT-METHOD': 'Payment Method',
  'PO-STATUS': 'Purchase Order Status',
  'QUOTE-STATUS': 'Quote Status',
  'RECEIPT-STATUS': 'Receipt Status',
  'REQ-STATUS': 'Requisition Status',
  'SO-STATUS': 'Sales Order Status',
  'ACCOUNT-TYPE': 'Account Type',
  'NORMAL-BALANCE': 'Normal Balance',
  'ITEM-RECOGNITION-METHOD': 'Item Recognition Method',
  'ITEM-RECOGNITION-TRIGGER': 'Item Recognition Trigger',
  'ITEM-CATEGORY': 'Item Category',
  'DEPT-PLANNING-CATEGORY': 'Department Planning Category',
}

const REFERENCE_SOURCE_LABELS: Record<string, string> = {
  chartOfAccounts: 'Chart of Accounts',
  currencies: 'Currencies master data',
  customers: 'Customers master data',
  departments: 'Departments master data',
  employees: 'Employees master data',
  items: 'Items master data',
  locations: 'Locations master data',
  revRecTemplates: 'Revenue Recognition Templates',
  roles: 'Roles master data',
  subsidiaries: 'Subsidiaries master data',
  users: 'Users master data',
  vendors: 'Vendors master data',
}

const SYSTEM_SOURCE_LABELS: Record<string, string> = {
  activeInactive: 'System status values',
  boolean: 'System values',
  countries: 'System country values',
  accountType: 'System account type values',
  normalBalance: 'System balance values',
}

const MANAGED_LIST_DEFAULT_OPTIONS: Record<string, SelectOption[]> = {
  'ACCOUNTING-PERIOD-STATUS': [
    { value: 'Open', label: 'Open' },
    { value: 'Closed', label: 'Closed' },
    { value: 'Locked', label: 'Locked' },
  ],
  'BILL-PAYMENT-STATUS': [
    { value: 'Pending', label: 'Pending' },
    { value: 'Processed', label: 'Processed' },
    { value: 'Cleared', label: 'Cleared' },
    { value: 'Void', label: 'Void' },
  ],
  'EXCHANGE-RATE-TYPE': [
    { value: 'Spot', label: 'Spot' },
    { value: 'Average', label: 'Average' },
    { value: 'Closing', label: 'Closing' },
    { value: 'Budget', label: 'Budget' },
  ],
  'FULFILL-STATUS': [
    { value: 'Pending', label: 'Pending' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Cancelled', label: 'Cancelled' },
  ],
  'JOURNAL-STATUS': [
    { value: 'Draft', label: 'Draft' },
    { value: 'Posted', label: 'Posted' },
    { value: 'Void', label: 'Void' },
  ],
  'JOURNAL-SOURCE-TYPE': [
    { value: 'Manual', label: 'Manual' },
    { value: 'Allocation', label: 'Allocation' },
    { value: 'Accrual', label: 'Accrual' },
    { value: 'Reclass', label: 'Reclass' },
    { value: 'Elimination', label: 'Elimination' },
    { value: 'Recurring', label: 'Recurring' },
  ],
  'PAYMENT-METHOD': [
    { value: 'Check', label: 'Check' },
    { value: 'Wire', label: 'Wire' },
    { value: 'ACH', label: 'ACH' },
    { value: 'Credit Card', label: 'Credit Card' },
    { value: 'Cash', label: 'Cash' },
  ],
  'ITEM-RECOGNITION-METHOD': [
    { value: 'Point in Time', label: 'Point in Time' },
    { value: 'Over Time', label: 'Over Time' },
  ],
  'ITEM-RECOGNITION-TRIGGER': [
    { value: 'Sales Order Approval', label: 'Sales Order Approval' },
    { value: 'Invoice Posting', label: 'Invoice Posting' },
    { value: 'Fulfillment', label: 'Fulfillment' },
    { value: 'Manual', label: 'Manual' },
  ],
  'ITEM-REV-ARRANGEMENT-TRIGGER': [
    { value: 'Sales Order Approval', label: 'Sales Order Approval' },
    { value: 'Invoice Posting', label: 'Invoice Posting' },
    { value: 'Fulfillment', label: 'Fulfillment' },
    { value: 'Manual', label: 'Manual' },
  ],
  'ITEM-FORECAST-PLAN-TRIGGER': [
    { value: 'Quote Approval', label: 'Quote Approval' },
    { value: 'Opportunity Close-Won', label: 'Opportunity Close-Won' },
    { value: 'Sales Order Creation', label: 'Sales Order Creation' },
    { value: 'Sales Order Approval', label: 'Sales Order Approval' },
    { value: 'Manual', label: 'Manual' },
  ],
  'ITEM-REVENUE-PLAN-TRIGGER': [
    { value: 'Invoice Posting', label: 'Invoice Posting' },
    { value: 'Fulfillment', label: 'Fulfillment' },
    { value: 'Service Start', label: 'Service Start' },
    { value: 'Manual', label: 'Manual' },
  ],
  'ITEM-PERFORMANCE-OBLIGATION-TYPE': [
    { value: 'License', label: 'License' },
    { value: 'Subscription', label: 'Subscription' },
    { value: 'Service', label: 'Service' },
    { value: 'Support', label: 'Support' },
    { value: 'Hardware', label: 'Hardware' },
    { value: 'Usage', label: 'Usage' },
    { value: 'Milestone', label: 'Milestone' },
    { value: 'Other', label: 'Other' },
  ],
  'ITEM-BILLING-TYPE': [
    { value: 'One-Time', label: 'One-Time' },
    { value: 'Recurring', label: 'Recurring' },
    { value: 'Usage', label: 'Usage' },
    { value: 'Milestone', label: 'Milestone' },
  ],
  'ITEM-BILLING-TRIGGER': [
    { value: 'Sales Order Approval', label: 'Sales Order Approval' },
    { value: 'Fulfillment', label: 'Fulfillment' },
    { value: 'Delivery', label: 'Delivery' },
    { value: 'Acceptance', label: 'Acceptance' },
    { value: 'Milestone Completion', label: 'Milestone Completion' },
    { value: 'Manual', label: 'Manual' },
  ],
  'ITEM-UOM': [
    { value: 'Each', label: 'Each' },
    { value: 'Hour', label: 'Hour' },
    { value: 'Day', label: 'Day' },
    { value: 'Month', label: 'Month' },
    { value: 'Seat', label: 'Seat' },
  ],
  'ITEM-PRIMARY-PURCHASE-UNIT': [
    { value: 'Each', label: 'Each' },
    { value: 'Hour', label: 'Hour' },
    { value: 'Day', label: 'Day' },
    { value: 'Month', label: 'Month' },
    { value: 'Seat', label: 'Seat' },
  ],
  'ITEM-PRIMARY-SALE-UNIT': [
    { value: 'Each', label: 'Each' },
    { value: 'Hour', label: 'Hour' },
    { value: 'Day', label: 'Day' },
    { value: 'Month', label: 'Month' },
    { value: 'Seat', label: 'Seat' },
  ],
  'ITEM-UNITS-TYPE': [
    { value: 'Each', label: 'Each' },
    { value: 'Time', label: 'Time' },
    { value: 'Subscription', label: 'Subscription' },
    { value: 'Usage', label: 'Usage' },
  ],
  'EMP-LABOR-TYPE': [
    { value: 'FTE', label: 'FTE' },
    { value: 'PTE', label: 'PTE' },
    { value: 'IC', label: 'IC' },
    { value: 'Intern', label: 'Intern' },
  ],
  'LOCATION-TYPE': [
    { value: 'Office', label: 'Office' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Store', label: 'Store' },
  ],
}

export function normalizeManagedListKey(sourceKey: string): string {
  const trimmed = sourceKey.trim().toUpperCase()
  return trimmed.startsWith('LIST-') ? trimmed.slice(5) : trimmed
}

export function getListSourceText(source: ListSourceDefinition): string | undefined {
  if (!source.sourceType || !source.sourceKey) return undefined

  if (source.sourceType === 'reference') {
    return REFERENCE_SOURCE_LABELS[source.sourceKey] ?? source.sourceKey
  }

  if (source.sourceType === 'managed-list') {
    const normalizedKey = normalizeManagedListKey(source.sourceKey)
    return `Manage Lists -> ${MANAGED_LIST_LABELS[normalizedKey] ?? normalizedKey}`
  }

  return SYSTEM_SOURCE_LABELS[source.sourceKey] ?? 'System values'
}

async function loadReferenceOptions(sourceKey: string): Promise<SelectOption[]> {
  switch (sourceKey) {
    case 'chartOfAccounts': {
      const accounts = await prisma.chartOfAccounts.findMany({
        where: { active: true },
        orderBy: { accountId: 'asc' },
        select: { id: true, accountId: true, accountNumber: true, name: true },
      })
      return accounts.map((account) => ({ value: account.id, label: `${account.accountId} - ${account.accountNumber} - ${account.name}` }))
    }
    case 'currencies': {
      const currencies = await prisma.currency.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      })
      return currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` }))
    }
    case 'customers': {
      const customers = await prisma.customer.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      return customers.map((customer) => ({ value: customer.id, label: customer.name }))
    }
    case 'departments': {
      const departments = await prisma.department.findMany({
        orderBy: { departmentId: 'asc' },
        select: { id: true, departmentId: true, name: true },
      })
      return departments.map((department) => ({ value: department.id, label: `${department.departmentId} - ${department.name}` }))
    }
    case 'employees': {
      const employees = await prisma.employee.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, employeeId: true, firstName: true, lastName: true },
      })
      return employees.map((employee) => ({
        value: employee.id,
        label: `${employee.firstName} ${employee.lastName}${employee.employeeId ? ` (${employee.employeeId})` : ''}`,
      }))
    }
    case 'items': {
      const items = await prisma.item.findMany({
        orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
        select: { id: true, itemId: true, name: true },
      })
      return items.map((item) => ({
        value: item.id,
        label: item.itemId ? `${item.itemId} - ${item.name}` : item.name,
      }))
    }
    case 'locations': {
      const locations = await prisma.location.findMany({
        orderBy: { locationId: 'asc' },
        select: { id: true, locationId: true, code: true, name: true },
      })
      return locations.map((location) => ({
        value: location.id,
        label: `${location.locationId} - ${location.code} - ${location.name}`,
      }))
    }
    case 'revRecTemplates': {
      const templates = await prisma.revRecTemplate.findMany({
        where: { active: true },
        orderBy: { templateId: 'asc' },
        select: { id: true, templateId: true, name: true },
      })
      return templates.map((template) => ({ value: template.id, label: `${template.templateId} - ${template.name}` }))
    }
    case 'roles': {
      const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      return roles.map((role) => ({ value: role.id, label: role.name }))
    }
    case 'subsidiaries': {
      const subsidiaries = await prisma.subsidiary.findMany({
        orderBy: { subsidiaryId: 'asc' },
        select: { id: true, subsidiaryId: true, name: true },
      })
      return subsidiaries.map((subsidiary) => ({ value: subsidiary.id, label: `${subsidiary.subsidiaryId} - ${subsidiary.name}` }))
    }
    case 'users': {
      const users = await prisma.user.findMany({
        orderBy: [{ userId: 'asc' }, { email: 'asc' }],
        select: { id: true, userId: true, name: true, email: true },
      })
      return users.map((user) => ({
        value: user.id,
        label: user.userId ? `${user.userId} - ${user.name ?? user.email}` : user.name ?? user.email,
      }))
    }
    case 'vendors': {
      const vendors = await prisma.vendor.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, vendorNumber: true },
      })
      return vendors.map((vendor) => ({
        value: vendor.id,
        label: vendor.vendorNumber ? `${vendor.vendorNumber} - ${vendor.name}` : vendor.name,
      }))
    }
    default:
      return []
  }
}

async function loadManagedListOptions(sourceKey: string): Promise<SelectOption[]> {
  const normalizedKey = normalizeManagedListKey(sourceKey)
  const defaultOptions = MANAGED_LIST_DEFAULT_OPTIONS[normalizedKey] ?? []
  if (defaultOptions.length > 0) {
    const count = await prisma.listOption.count({ where: { key: normalizedKey } })
    if (count === 0) {
      await prisma.listOption.createMany({
        data: defaultOptions.map((option, index) => ({
          key: normalizedKey,
          listId: `LIST-${normalizedKey}-${String(index + 1).padStart(4, '0')}`,
          value: option.value,
          label: option.label,
          sortOrder: index,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      })
    }
  }

  const rows = await prisma.listOption.findMany({
    where: { key: normalizedKey },
    orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    select: { value: true, label: true },
  })
  return rows.map((row) => ({ value: row.value, label: row.label }))
}

function loadSystemOptions(sourceKey: string): SelectOption[] {
  switch (sourceKey) {
    case 'accountType':
      return [
        { value: 'Asset', label: 'Asset' },
        { value: 'Liability', label: 'Liability' },
        { value: 'Equity', label: 'Equity' },
        { value: 'Revenue', label: 'Revenue' },
        { value: 'Expense', label: 'Expense' },
        { value: 'Other', label: 'Other' },
      ]
    case 'activeInactive':
    case 'boolean':
      return [
        { value: 'false', label: 'No' },
        { value: 'true', label: 'Yes' },
      ]
    case 'normalBalance':
      return [
        { value: 'debit', label: 'Debit' },
        { value: 'credit', label: 'Credit' },
      ]
    case 'countries':
      return COUNTRY_OPTIONS.map((option) => ({ value: option.code, label: option.label }))
    default:
      return []
  }
}

export async function loadListOptionsForSource(source: ListSourceDefinition): Promise<SelectOption[]> {
  if (!source.sourceType || !source.sourceKey) return []

  if (source.sourceType === 'reference') {
    return loadReferenceOptions(source.sourceKey)
  }

  if (source.sourceType === 'managed-list') {
    return loadManagedListOptions(source.sourceKey)
  }

  return loadSystemOptions(source.sourceKey)
}
