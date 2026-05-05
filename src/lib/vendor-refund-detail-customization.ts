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
  BILL_FULL_REFERENCE_FIELDS,
  PURCHASE_ORDER_FULL_REFERENCE_FIELDS,
  VENDOR_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'
import {
  buildDefaultCurrencyReadoutFieldCustomizations,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
} from '@/lib/four-currency-readout'

export type VendorRefundDetailFieldKey =
  | 'vendorName'
  | 'vendorNumber'
  | 'id'
  | 'number'
  | 'vendorId'
  | 'billPaymentId'
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

export type VendorRefundDetailFieldMeta = {
  id: VendorRefundDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type VendorRefundDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type VendorRefundStatCardKey = 'amount' | 'status' | 'method' | 'vendor'

export type VendorRefundDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<VendorRefundDetailFieldKey, VendorRefundDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<VendorRefundStatCardKey>>
}

export const VENDOR_REFUND_STAT_CARDS: Array<{ id: VendorRefundStatCardKey; label: string }> = [
  { id: 'amount', label: 'Refund Amount' },
  { id: 'status', label: 'Status' },
  { id: 'method', label: 'Method' },
  { id: 'vendor', label: 'Vendor' },
]

export const VENDOR_REFUND_DETAIL_FIELDS: VendorRefundDetailFieldMeta[] = [
  { id: 'vendorName', label: 'Vendor Name', fieldType: 'text', source: 'Vendors master data', description: 'Display name from the linked vendor record.' },
  { id: 'vendorNumber', label: 'Vendor #', fieldType: 'text', source: 'Vendors master data', description: 'Internal vendor identifier from the linked vendor record.' },
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this vendor refund.' },
  { id: 'number', label: 'Vendor Refund Id', fieldType: 'text', description: 'Unique identifier for this vendor refund.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', source: 'Vendor record', description: 'Vendor issuing the refund.' },
  { id: 'billPaymentId', label: 'Refund Source', fieldType: 'text', source: 'Bill payment transaction', description: 'Overpaid bill payment that funded this refund.' },
  { id: 'bankAccountId', label: 'Bank Account', fieldType: 'list', source: 'Chart of accounts', description: 'Cash or bank account receiving the refund disbursement.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiary record', description: 'Transaction subsidiary on this vendor refund.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currency record', description: 'Transaction currency on this vendor refund.' },
  { id: 'amount', label: 'Amount', fieldType: 'currency', description: 'Refund amount received from the vendor.' },
  { id: 'date', label: 'Refund Date', fieldType: 'date', description: 'Date the refund was received.' },
  { id: 'method', label: 'Payment Method', fieldType: 'list', source: 'Payment method list', description: 'Receipt method for the refund.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Vendor refund status list', description: 'Lifecycle stage for the vendor refund.' },
  { id: 'reference', label: 'Reference', fieldType: 'text', description: 'Reference number or memo for this refund.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Internal notes for this refund.' },
  { id: 'journalEntry', label: 'GL Posting', fieldType: 'text', source: 'Journal entry', description: 'Journal entry created when the refund posts to GL.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the vendor refund record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the vendor refund record was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

const VENDOR_REFUND_SOURCE_PAYMENT_FIELDS: LinkedRecordReferenceSource['fields'] = [
  { id: 'billPaymentDbId', label: 'DB Id', fieldType: 'text', source: 'Bill payment transaction', description: 'Internal database identifier for the linked bill payment.', path: ['id'] },
  { id: 'billPaymentNumber', label: 'Bill Payment #', fieldType: 'text', source: 'Bill payment transaction', description: 'Identifier for the linked bill payment.', path: ['number'], linksToSourceRecord: true },
  { id: 'billPaymentStatus', label: 'Status', fieldType: 'list', source: 'Bill payment transaction', description: 'Status from the linked bill payment.', path: ['status'] },
  { id: 'billPaymentAmount', label: 'Amount', fieldType: 'currency', source: 'Bill payment transaction', description: 'Total amount from the linked bill payment.', path: ['amount'] },
  { id: 'billPaymentDate', label: 'Date', fieldType: 'date', source: 'Bill payment transaction', description: 'Payment date from the linked bill payment.', path: ['date'] },
  { id: 'billPaymentMethod', label: 'Method', fieldType: 'list', source: 'Bill payment transaction', description: 'Payment method from the linked bill payment.', path: ['method'] },
  { id: 'billPaymentReference', label: 'Reference', fieldType: 'text', source: 'Bill payment transaction', description: 'Reference from the linked bill payment.', path: ['reference'] },
  { id: 'billPaymentBankAccountDbId', label: 'Bank Account DB Id', fieldType: 'text', source: 'Bill payment transaction', description: 'Internal bank account identifier from the linked bill payment.', path: ['bankAccountId'] },
  { id: 'billPaymentBillDbId', label: 'Bill DB Id', fieldType: 'text', source: 'Bill payment transaction', description: 'Internal bill identifier from the linked bill payment.', path: ['billId'] },
  { id: 'billPaymentCreatedAt', label: 'Created', fieldType: 'date', source: 'Bill payment transaction', description: 'Date/time the linked bill payment was created.', path: ['createdAt'] },
  { id: 'billPaymentUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Bill payment transaction', description: 'Date/time the linked bill payment was last modified.', path: ['updatedAt'] },
]

export const VENDOR_REFUND_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'vendor',
    label: 'Vendor',
    linkedFieldLabel: 'Vendor',
    description: 'Expand the linked vendor context for this refund.',
    fields: VENDOR_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['vendorNumber', 'vendorName', 'vendorEmail', 'vendorPhone'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'billPayment',
    label: 'Bill Payment',
    linkedFieldLabel: 'Refund Source',
    description: 'Expand the linked bill payment that created the refundable overpayment.',
    fields: VENDOR_REFUND_SOURCE_PAYMENT_FIELDS,
    defaultVisibleFieldIds: ['billPaymentNumber', 'billPaymentStatus', 'billPaymentAmount'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'bill',
    label: 'Bill',
    linkedFieldLabel: 'Bill',
    description: 'Expand the linked bill context behind the refund source.',
    fields: BILL_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['billNumber', 'billStatus', 'billTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'purchaseOrder',
    label: 'Purchase Order',
    linkedFieldLabel: 'Purchase Order',
    description: 'Expand the linked purchase order context behind the refund source.',
    fields: PURCHASE_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['purchaseOrderNumber', 'purchaseOrderStatus', 'purchaseOrderTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultVendorRefundDetailCustomization(): VendorRefundDetailCustomizationConfig {
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
      'Vendor Snapshot',
      'Refund Terms',
      'Record Keys',
      'System Dates',
    ],
    sectionRows: {
      [CURRENCY_READOUT_SECTION_TITLE]: 4,
      'Document Identity': 1,
      'Vendor Snapshot': 1,
      'Refund Terms': 3,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      vendorId: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      billPaymentId: { visible: true, section: 'Document Identity', order: 0, column: 3 },
      vendorNumber: { visible: true, section: 'Vendor Snapshot', order: 0, column: 1 },
      vendorName: { visible: true, section: 'Vendor Snapshot', order: 0, column: 2 },
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
      buildDefaultTransactionReferenceLayout(VENDOR_REFUND_REFERENCE_SOURCES, 'vendor'),
      buildDefaultTransactionReferenceLayout(VENDOR_REFUND_REFERENCE_SOURCES, 'billPayment', 'reference-bill-payment-1'),
    ],
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns,
    statCards: [
      { id: 'refund-amount', metric: 'amount', visible: true, order: 0 },
      { id: 'refund-status', metric: 'status', visible: true, order: 1 },
      { id: 'refund-method', metric: 'method', visible: true, order: 2 },
      { id: 'refund-vendor', metric: 'vendor', visible: true, order: 3 },
    ],
  }
}
