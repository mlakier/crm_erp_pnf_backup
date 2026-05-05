import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'
import {
  buildDefaultTransactionReferenceLayout,
  type TransactionReferenceLayout,
} from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactColumns,
  defaultTransactionGlImpactSettings,
  type TransactionGlImpactColumnCustomization,
  type TransactionGlImpactColumnKey,
  type TransactionGlImpactSettings,
} from '@/lib/transaction-gl-impact'
import {
  type LinkedRecordReferenceSource,
  CUSTOMER_FULL_REFERENCE_FIELDS,
  INVOICE_FULL_REFERENCE_FIELDS,
  OPPORTUNITY_FULL_REFERENCE_FIELDS,
  QUOTE_FULL_REFERENCE_FIELDS,
  SALES_ORDER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'
import {
  buildDefaultCurrencyReadoutFieldCustomizations,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
} from '@/lib/four-currency-readout'

export type CustomerRefundDetailFieldKey =
  | 'customerName'
  | 'customerNumber'
  | 'id'
  | 'number'
  | 'customerId'
  | 'cashReceiptId'
  | 'bankAccountId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'amount'
  | 'date'
  | 'method'
  | 'status'
  | 'reference'
  | 'notes'
  | 'journalEntry'
  | 'createdAt'
  | 'updatedAt'
  | CurrencyReadoutFieldKey

export type CustomerRefundDetailFieldMeta = {
  id: CustomerRefundDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type CustomerRefundDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type CustomerRefundDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<CustomerRefundDetailFieldKey, CustomerRefundDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<CustomerRefundStatCardKey>>
}

export type CustomerRefundStatCardKey = 'amount' | 'status' | 'method' | 'customer'

export const CUSTOMER_REFUND_STAT_CARDS: Array<{ id: CustomerRefundStatCardKey; label: string }> = [
  { id: 'amount', label: 'Refund Amount' },
  { id: 'status', label: 'Status' },
  { id: 'method', label: 'Method' },
  { id: 'customer', label: 'Customer' },
]

export const CUSTOMER_REFUND_DETAIL_FIELDS: CustomerRefundDetailFieldMeta[] = [
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked customer record.' },
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this customer refund.' },
  { id: 'number', label: 'Customer Refund Id', fieldType: 'text', description: 'Unique identifier for this customer refund.' },
  { id: 'customerId', label: 'Customer', fieldType: 'list', source: 'Customer record', description: 'Customer receiving the refund.' },
  { id: 'cashReceiptId', label: 'Refund Source', fieldType: 'text', source: 'Invoice receipt transaction', description: 'Refund-pending invoice receipt that funded this refund.' },
  { id: 'bankAccountId', label: 'Bank Account', fieldType: 'list', source: 'Chart of accounts', description: 'Cash or bank account used for the refund disbursement.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiary record', description: 'Transaction subsidiary on this customer refund.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currency record', description: 'Transaction currency on this customer refund.' },
  { id: 'amount', label: 'Amount', fieldType: 'currency', description: 'Refund amount issued to the customer.' },
  { id: 'date', label: 'Refund Date', fieldType: 'date', description: 'Date the refund was issued.' },
  { id: 'method', label: 'Payment Method', fieldType: 'list', source: 'Payment method list', description: 'Disbursement method for the refund.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Customer refund status list', description: 'Lifecycle stage for the customer refund.' },
  { id: 'reference', label: 'Reference', fieldType: 'text', description: 'Reference number or memo for this refund.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Internal notes for this refund.' },
  { id: 'journalEntry', label: 'GL Posting', fieldType: 'text', source: 'Journal entry', description: 'Journal entry created when the refund posts to GL.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the customer refund record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the customer refund record was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

const CUSTOMER_REFUND_SOURCE_RECEIPT_FIELDS: LinkedRecordReferenceSource['fields'] = [
  { id: 'receiptDbId', label: 'DB Id', fieldType: 'text', source: 'Invoice receipt transaction', description: 'Internal database identifier for the linked invoice receipt.', path: ['id'] },
  { id: 'receiptNumber', label: 'Invoice Receipt #', fieldType: 'text', source: 'Invoice receipt transaction', description: 'Identifier for the linked invoice receipt.', path: ['number'], linksToSourceRecord: true },
  { id: 'receiptStatus', label: 'Status', fieldType: 'list', source: 'Invoice receipt transaction', description: 'Status from the linked invoice receipt.', path: ['status'] },
  { id: 'receiptAmount', label: 'Amount', fieldType: 'currency', source: 'Invoice receipt transaction', description: 'Total amount from the linked invoice receipt.', path: ['amount'] },
  { id: 'receiptDate', label: 'Receipt Date', fieldType: 'date', source: 'Invoice receipt transaction', description: 'Receipt date from the linked invoice receipt.', path: ['date'] },
  { id: 'receiptMethod', label: 'Method', fieldType: 'list', source: 'Invoice receipt transaction', description: 'Payment method from the linked invoice receipt.', path: ['method'] },
  { id: 'receiptReference', label: 'Reference', fieldType: 'text', source: 'Invoice receipt transaction', description: 'Reference from the linked invoice receipt.', path: ['reference'] },
  { id: 'receiptBankAccountDbId', label: 'Bank Account DB Id', fieldType: 'text', source: 'Invoice receipt transaction', description: 'Internal bank account identifier from the linked invoice receipt.', path: ['bankAccountId'] },
  { id: 'receiptInvoiceDbId', label: 'Invoice DB Id', fieldType: 'text', source: 'Invoice receipt transaction', description: 'Internal invoice identifier from the linked invoice receipt.', path: ['invoiceId'] },
  { id: 'receiptCreatedAt', label: 'Created', fieldType: 'date', source: 'Invoice receipt transaction', description: 'Date/time the linked invoice receipt was created.', path: ['createdAt'] },
  { id: 'receiptUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Invoice receipt transaction', description: 'Date/time the linked invoice receipt was last modified.', path: ['updatedAt'] },
]

export const CUSTOMER_REFUND_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'customer',
    label: 'Customer',
    linkedFieldLabel: 'Customer',
    description: 'Expand the linked customer context for this refund.',
    fields: CUSTOMER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['customerNumber', 'customerName', 'customerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'receipt',
    label: 'Invoice Receipt',
    linkedFieldLabel: 'Refund Source',
    description: 'Expand the linked invoice receipt that created the refundable overpayment.',
    fields: CUSTOMER_REFUND_SOURCE_RECEIPT_FIELDS,
    defaultVisibleFieldIds: ['receiptNumber', 'receiptStatus', 'receiptAmount'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    linkedFieldLabel: 'Invoice',
    description: 'Expand the linked invoice context behind the refund source.',
    fields: INVOICE_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['invoiceNumber', 'invoiceStatus', 'invoiceTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'salesOrder',
    label: 'Sales Order',
    linkedFieldLabel: 'Sales Order',
    description: 'Expand the linked sales order context behind the refund source.',
    fields: SALES_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['salesOrderNumber', 'salesOrderStatus', 'salesOrderTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'quote',
    label: 'Quote',
    linkedFieldLabel: 'Quote',
    description: 'Expand the linked quote context behind the refund source.',
    fields: QUOTE_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['quoteNumber', 'quoteStatus', 'quoteTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'opportunity',
    label: 'Opportunity',
    linkedFieldLabel: 'Opportunity',
    description: 'Expand the linked opportunity context behind the refund source.',
    fields: OPPORTUNITY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['opportunityNumber', 'opportunityName', 'opportunityAmount'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultCustomerRefundDetailCustomization(): CustomerRefundDetailCustomizationConfig {
  const glImpactColumns = defaultTransactionGlImpactColumns()
  glImpactColumns.txnAmount.visible = true
  glImpactColumns.localAmount.visible = true
  glImpactColumns.functionalAmount.visible = true
  glImpactColumns.groupAmount.visible = true

  return {
    formColumns: 3,
    sections: [
      CURRENCY_READOUT_SECTION_TITLE,
      'Document Identity',
      'Customer Snapshot',
      'Refund Terms',
      'Record Keys',
      'System Dates',
    ],
    sectionRows: {
      [CURRENCY_READOUT_SECTION_TITLE]: 4,
      'Document Identity': 1,
      'Customer Snapshot': 1,
      'Refund Terms': 3,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      customerId: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      cashReceiptId: { visible: true, section: 'Document Identity', order: 0, column: 3 },
      customerNumber: { visible: true, section: 'Customer Snapshot', order: 0, column: 1 },
      customerName: { visible: true, section: 'Customer Snapshot', order: 0, column: 2 },
      bankAccountId: { visible: true, section: 'Refund Terms', order: 0, column: 1 },
      amount: { visible: true, section: 'Refund Terms', order: 0, column: 2 },
      date: { visible: true, section: 'Refund Terms', order: 0, column: 3 },
      method: { visible: true, section: 'Refund Terms', order: 1, column: 1 },
      status: { visible: true, section: 'Refund Terms', order: 1, column: 2 },
      reference: { visible: true, section: 'Refund Terms', order: 1, column: 3 },
      notes: { visible: true, section: 'Refund Terms', order: 2, column: 1 },
      subsidiaryId: { visible: true, section: 'Refund Terms', order: 2, column: 2 },
      currencyId: { visible: true, section: 'Refund Terms', order: 2, column: 3 },
      id: { visible: true, section: 'Record Keys', order: 0, column: 1 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
      journalEntry: { visible: true, section: 'System Dates', order: 0, column: 3 },
      ...buildDefaultCurrencyReadoutFieldCustomizations({ showRealizedFx: true }),
    },
    referenceLayouts: [
      buildDefaultTransactionReferenceLayout(CUSTOMER_REFUND_REFERENCE_SOURCES, 'customer'),
      buildDefaultTransactionReferenceLayout(CUSTOMER_REFUND_REFERENCE_SOURCES, 'receipt', 'reference-receipt-1'),
    ],
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns,
    statCards: [
      { id: 'refund-amount', metric: 'amount', visible: true, order: 0 },
      { id: 'refund-status', metric: 'status', visible: true, order: 1 },
      { id: 'refund-method', metric: 'method', visible: true, order: 2 },
      { id: 'refund-customer', metric: 'customer', visible: true, order: 3 },
    ],
  }
}
