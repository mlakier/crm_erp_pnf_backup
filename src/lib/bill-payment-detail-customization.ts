import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'
import {
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
} from '@/lib/linked-record-reference-catalogs'
import {
  buildDefaultCurrencyReadoutFieldCustomizations,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
} from '@/lib/four-currency-readout'

export type BillPaymentDetailFieldKey =
  | 'id'
  | 'number'
  | 'vendorId'
  | 'billId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'bankAccountId'
  | 'amount'
  | 'date'
  | 'method'
  | 'reference'
  | 'status'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
  | CurrencyReadoutFieldKey

export type BillPaymentDetailFieldMeta = {
  id: BillPaymentDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type BillPaymentDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type BillPaymentDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<BillPaymentDetailFieldKey, BillPaymentDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<BillPaymentStatCardKey>>
}

export type BillPaymentStatCardKey = 'amount' | 'status' | 'date' | 'bill'

export const BILL_PAYMENT_STAT_CARDS: Array<{ id: BillPaymentStatCardKey; label: string }> = [
  { id: 'amount', label: 'Payment Amount' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'bill', label: 'Vendor' },
]

export const BILL_PAYMENT_DETAIL_FIELDS: BillPaymentDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this bill payment.' },
  { id: 'number', label: 'Bill Payment Id', fieldType: 'text', description: 'Identifier for this bill payment.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', source: 'Vendor record', description: 'Vendor this payment is being applied against.' },
  { id: 'billId', label: 'Bill', fieldType: 'text', source: 'Bill transaction', description: 'Linked bill for this payment.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Bill transaction', description: 'Subsidiary derived from the applied bill posting context.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Bill transaction', description: 'Transaction currency derived from the applied bill posting context.' },
  { id: 'bankAccountId', label: 'Bank Account', fieldType: 'list', source: 'Chart of accounts', description: 'Cash or bank GL account used to fund this payment.' },
  { id: 'amount', label: 'Amount', fieldType: 'currency', description: 'Payment amount applied to the bill.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Date the bill payment was recorded.' },
  { id: 'method', label: 'Method', fieldType: 'list', source: 'Payment method list', description: 'Payment method used for this bill payment.' },
  { id: 'reference', label: 'Reference', fieldType: 'text', description: 'Reference number or memo for this payment.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Bill payment status list', description: 'Status of this bill payment.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Free-form notes for this bill payment.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the bill payment record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the bill payment record was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

export const BILL_PAYMENT_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'bill',
    label: 'Bill',
    linkedFieldLabel: 'Bill',
    description: 'Expand the linked bill context for this payment.',
    fields: BILL_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['billNumber', 'billStatus', 'billTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultBillPaymentDetailCustomization(): BillPaymentDetailCustomizationConfig {
  const glImpactColumns = defaultTransactionGlImpactColumns()
  glImpactColumns.txnAmount.visible = true
  glImpactColumns.localAmount.visible = true
  glImpactColumns.functionalAmount.visible = true
  glImpactColumns.groupAmount.visible = true

  return {
    formColumns: 2,
    sections: [CURRENCY_READOUT_SECTION_TITLE, 'Document Identity', 'Payment Terms', 'Record Keys', 'System Dates'],
    sectionRows: {
      [CURRENCY_READOUT_SECTION_TITLE]: 4,
      'Document Identity': 2,
      'Payment Terms': 4,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      vendorId: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      billId: { visible: false, section: 'Document Identity', order: 1, column: 1 },
      subsidiaryId: { visible: true, section: 'Document Identity', order: 1, column: 1 },
      currencyId: { visible: true, section: 'Document Identity', order: 1, column: 2 },
      bankAccountId: { visible: true, section: 'Payment Terms', order: 0, column: 1 },
      amount: { visible: true, section: 'Payment Terms', order: 0, column: 2 },
      date: { visible: true, section: 'Payment Terms', order: 1, column: 1 },
      method: { visible: true, section: 'Payment Terms', order: 1, column: 2 },
      status: { visible: true, section: 'Payment Terms', order: 2, column: 1 },
      reference: { visible: true, section: 'Payment Terms', order: 2, column: 2 },
      notes: { visible: true, section: 'Payment Terms', order: 3, column: 1 },
      id: { visible: true, section: 'Record Keys', order: 0, column: 1 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
      ...buildDefaultCurrencyReadoutFieldCustomizations({ showRealizedFx: true }),
    },
    referenceLayouts: [],
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns,
    statCards: [
      { id: 'bp-amount', metric: 'amount', visible: true, order: 0 },
      { id: 'bp-status', metric: 'status', visible: true, order: 1 },
      { id: 'bp-date', metric: 'date', visible: true, order: 2 },
      { id: 'bp-bill', metric: 'bill', visible: true, order: 3 },
    ],
  }
}
