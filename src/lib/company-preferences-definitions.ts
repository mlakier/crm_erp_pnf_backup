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
  | 'journal'
  | 'intercompanyJournal'
  | 'fulfillment'
  | 'billPayment'

export type IdSetting = {
  prefix: string
  startingNumber: number
  digits: number
  autoIncrement: boolean
  locked: boolean
}

export type MoneyDisplay = 'code' | 'symbol'

export type NegativeNumberFormat = 'parentheses' | 'minus'

export type ZeroFormat = 'zero' | 'dash' | 'blank'

export type ShowCurrencyOn = 'all' | 'foreignOnly' | 'documentHeadersOnly'

export type NegativeColor = 'default' | 'red'

export type DocumentDateFormat = 'locale' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'

export type MoneySettings = {
  locale: string
  fallbackCurrencyCode: string
  currencyDisplay: MoneyDisplay
  negativeNumberFormat: NegativeNumberFormat
  decimalPlaces: number
  zeroFormat: ZeroFormat
  showCurrencyOn: ShowCurrencyOn
  negativeColor: NegativeColor
  documentDateFormat: DocumentDateFormat
}

export const COMPANY_MONEY_LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-CA', label: 'English (Canada)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-NZ', label: 'English (New Zealand)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'de-AT', label: 'German (Austria)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'fr-CA', label: 'French (Canada)' },
  { value: 'nl-NL', label: 'Dutch (Netherlands)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)' },
  { value: 'sv-SE', label: 'Swedish (Sweden)' },
  { value: 'da-DK', label: 'Danish (Denmark)' },
  { value: 'nb-NO', label: 'Norwegian Bokmal (Norway)' },
  { value: 'fi-FI', label: 'Finnish (Finland)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
] as const

export const COMPANY_ZERO_FORMAT_OPTIONS = [
  { value: 'zero', label: '0.00' },
  { value: 'dash', label: '-' },
  { value: 'blank', label: 'Blank' },
] as const

export const COMPANY_SHOW_CURRENCY_ON_OPTIONS = [
  { value: 'all', label: 'All Amounts' },
  { value: 'foreignOnly', label: 'Foreign Currency Only' },
  { value: 'documentHeadersOnly', label: 'Document Headers Only' },
] as const

export const COMPANY_NEGATIVE_COLOR_OPTIONS = [
  { value: 'default', label: 'Standard Text' },
  { value: 'red', label: 'Red Negatives' },
] as const

export const COMPANY_DOCUMENT_DATE_FORMAT_OPTIONS = [
  { value: 'locale', label: 'Locale Default' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
] as const

export type CompanyPreferencesSettings = {
  idSettings: Record<IdSettingKey, IdSetting>
  moneySettings: MoneySettings
}

export const ID_SETTING_DEFINITIONS: Array<{
  key: IdSettingKey
  label: string
  group: 'Master Data' | 'CRM' | 'Transactions'
  subgroup?: 'Order to Cash' | 'Purchase to Pay' | 'Record to Report'
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
  { key: 'quote', label: 'Quotes', group: 'Transactions', subgroup: 'Order to Cash' },
  { key: 'salesOrder', label: 'Sales Orders', group: 'Transactions', subgroup: 'Order to Cash' },
  { key: 'invoice', label: 'Invoices', group: 'Transactions', subgroup: 'Order to Cash' },
  { key: 'invoiceReceipt', label: 'Invoice Receipts', group: 'Transactions', subgroup: 'Order to Cash' },
  { key: 'fulfillment', label: 'Fulfillments', group: 'Transactions', subgroup: 'Order to Cash' },
  { key: 'purchaseRequisition', label: 'Purchase Requisitions', group: 'Transactions', subgroup: 'Purchase to Pay' },
  { key: 'purchaseOrder', label: 'Purchase Orders', group: 'Transactions', subgroup: 'Purchase to Pay' },
  { key: 'bill', label: 'Bills', group: 'Transactions', subgroup: 'Purchase to Pay' },
  { key: 'billPayment', label: 'Bill Payments', group: 'Transactions', subgroup: 'Purchase to Pay' },
  { key: 'journal', label: 'Journals', group: 'Transactions', subgroup: 'Record to Report' },
  { key: 'intercompanyJournal', label: 'Intercompany Journals', group: 'Transactions', subgroup: 'Record to Report' },
]

export const DEFAULT_ID_SETTINGS: Record<IdSettingKey, IdSetting> = {
  user: { prefix: 'USER-', startingNumber: 1, digits: 5, autoIncrement: true, locked: false },
  chartOfAccount: { prefix: 'GL-', startingNumber: 1, digits: 5, autoIncrement: true, locked: false },
  department: { prefix: 'DEPT-', startingNumber: 1, digits: 5, autoIncrement: true, locked: false },
  item: { prefix: 'ITEM-', startingNumber: 1, digits: 6, autoIncrement: true, locked: false },
  contact: { prefix: 'CONT-', startingNumber: 1, digits: 6, autoIncrement: true, locked: false },
  customer: { prefix: 'CUST-', startingNumber: 1, digits: 6, autoIncrement: true, locked: false },
  vendor: { prefix: 'VEND-', startingNumber: 1, digits: 6, autoIncrement: true, locked: false },
  subsidiary: { prefix: 'SUB-', startingNumber: 1, digits: 3, autoIncrement: true, locked: false },
  currency: { prefix: 'CUR-', startingNumber: 1, digits: 5, autoIncrement: true, locked: false },
  location: { prefix: 'LOC-', startingNumber: 1, digits: 5, autoIncrement: true, locked: false },
  lead: { prefix: 'LEAD-', startingNumber: 1, digits: 6, autoIncrement: true, locked: false },
  opportunity: { prefix: 'OPP-', startingNumber: 1, digits: 6, autoIncrement: true, locked: false },
  quote: { prefix: 'QUO-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  salesOrder: { prefix: 'SO-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  purchaseRequisition: { prefix: 'PR-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  purchaseOrder: { prefix: 'PO-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  invoice: { prefix: 'INV-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  invoiceReceipt: { prefix: 'IR-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  bill: { prefix: 'BILL-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  journal: { prefix: 'JE-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  intercompanyJournal: { prefix: 'IJE-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  fulfillment: { prefix: 'FUL-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
  billPayment: { prefix: 'BP-', startingNumber: 1, digits: 0, autoIncrement: true, locked: false },
}

export const DEFAULT_MONEY_SETTINGS: MoneySettings = {
  locale: 'en-US',
  fallbackCurrencyCode: 'USD',
  currencyDisplay: 'code',
  negativeNumberFormat: 'parentheses',
  decimalPlaces: 2,
  zeroFormat: 'zero',
  showCurrencyOn: 'all',
  negativeColor: 'default',
  documentDateFormat: 'locale',
}
