export type IdSettingKey =
  | 'user'
  | 'chartOfAccount'
  | 'department'
  | 'item'
  | 'contact'
  | 'customer'
  | 'vendor'
  | 'subsidiary'
  | 'currency'
  | 'location'
  | 'lead'
  | 'opportunity'
  | 'quote'
  | 'salesOrder'
  | 'purchaseRequisition'
  | 'purchaseOrder'
  | 'invoice'
  | 'invoiceReceipt'
  | 'bill'
  | 'fulfillment'
  | 'billPayment'

export type IdSetting = {
  prefix: string
  digits: number
}

export type CompanyPreferencesSettings = {
  idSettings: Record<IdSettingKey, IdSetting>
}

export const ID_SETTING_DEFINITIONS: Array<{
  key: IdSettingKey
  label: string
  group: 'Master Data' | 'CRM' | 'Transactions'
}> = [
  { key: 'user', label: 'Users', group: 'Master Data' },
  { key: 'chartOfAccount', label: 'Chart of Accounts', group: 'Master Data' },
  { key: 'department', label: 'Departments', group: 'Master Data' },
  { key: 'item', label: 'Items', group: 'Master Data' },
  { key: 'contact', label: 'Contacts', group: 'Master Data' },
  { key: 'customer', label: 'Customers', group: 'Master Data' },
  { key: 'vendor', label: 'Vendors', group: 'Master Data' },
  { key: 'subsidiary', label: 'Subsidiaries', group: 'Master Data' },
  { key: 'currency', label: 'Currencies', group: 'Master Data' },
  { key: 'location', label: 'Locations', group: 'Master Data' },
  { key: 'lead', label: 'Leads', group: 'CRM' },
  { key: 'opportunity', label: 'Opportunities', group: 'CRM' },
  { key: 'quote', label: 'Quotes', group: 'Transactions' },
  { key: 'salesOrder', label: 'Sales Orders', group: 'Transactions' },
  { key: 'purchaseRequisition', label: 'Purchase Requisitions', group: 'Transactions' },
  { key: 'purchaseOrder', label: 'Purchase Orders', group: 'Transactions' },
  { key: 'invoice', label: 'Invoices', group: 'Transactions' },
  { key: 'invoiceReceipt', label: 'Invoice Receipts', group: 'Transactions' },
  { key: 'bill', label: 'Bills', group: 'Transactions' },
  { key: 'fulfillment', label: 'Fulfillments', group: 'Transactions' },
  { key: 'billPayment', label: 'Bill Payments', group: 'Transactions' },
]

export const DEFAULT_ID_SETTINGS: Record<IdSettingKey, IdSetting> = {
  user: { prefix: 'USER-', digits: 5 },
  chartOfAccount: { prefix: 'GL-', digits: 5 },
  department: { prefix: 'DEPT-', digits: 5 },
  item: { prefix: 'ITEM-', digits: 6 },
  contact: { prefix: 'CONT-', digits: 6 },
  customer: { prefix: 'CUST-', digits: 6 },
  vendor: { prefix: 'VEND-', digits: 6 },
  subsidiary: { prefix: 'SUB-', digits: 3 },
  currency: { prefix: 'CUR-', digits: 5 },
  location: { prefix: 'LOC-', digits: 5 },
  lead: { prefix: 'LEAD-', digits: 6 },
  opportunity: { prefix: 'OPP-', digits: 6 },
  quote: { prefix: 'QUO-', digits: 6 },
  salesOrder: { prefix: 'SO-', digits: 6 },
  purchaseRequisition: { prefix: 'PR-', digits: 6 },
  purchaseOrder: { prefix: 'PO-', digits: 6 },
  invoice: { prefix: 'INV-', digits: 6 },
  invoiceReceipt: { prefix: 'IR-', digits: 6 },
  bill: { prefix: 'BILL-', digits: 6 },
  fulfillment: { prefix: 'FUL-', digits: 6 },
  billPayment: { prefix: 'BP-', digits: 6 },
}
