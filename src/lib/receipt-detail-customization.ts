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
  PURCHASE_ORDER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type ReceiptDetailFieldKey =
  | 'id'
  | 'number'
  | 'purchaseOrderId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'quantity'
  | 'date'
  | 'status'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'

export type ReceiptDetailFieldMeta = {
  id: ReceiptDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type ReceiptDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type ReceiptDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<ReceiptDetailFieldKey, ReceiptDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<ReceiptStatCardKey>>
}

export type ReceiptStatCardKey = 'quantity' | 'status' | 'date' | 'purchaseOrder'

export const RECEIPT_STAT_CARDS: Array<{ id: ReceiptStatCardKey; label: string }> = [
  { id: 'quantity', label: 'Quantity' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'purchaseOrder', label: 'Purchase Order' },
]

export const RECEIPT_DETAIL_FIELDS: ReceiptDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this receipt.' },
  { id: 'number', label: 'Receipt Id', fieldType: 'text', description: 'Display identifier for this receipt.' },
  { id: 'purchaseOrderId', label: 'Purchase Order', fieldType: 'text', source: 'Purchase order transaction', description: 'Linked purchase order for this receipt.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Purchase order transaction', description: 'Subsidiary derived from the linked purchase order posting context.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Purchase order transaction', description: 'Transaction currency derived from the linked purchase order posting context.' },
  { id: 'quantity', label: 'Quantity', fieldType: 'number', description: 'Total quantity received on this receipt.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Date the receipt was recorded.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Receipt status list', description: 'Status of this receipt.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Free-form notes for this receipt.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the receipt record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the receipt record was last modified.' },
]

export const RECEIPT_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'purchaseOrder',
    label: 'Purchase Order',
    linkedFieldLabel: 'Purchase Order',
    description: 'Expand the linked purchase order context for this receipt.',
    fields: PURCHASE_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['purchaseOrderNumber', 'purchaseOrderStatus', 'purchaseOrderTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultReceiptDetailCustomization(): ReceiptDetailCustomizationConfig {
  return {
    formColumns: 3,
    sections: ['Document Identity', 'Receipt Terms', 'Record Keys', 'System Dates'],
    sectionRows: {
      'Document Identity': 2,
      'Receipt Terms': 2,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      id: { visible: true, section: 'Record Keys', order: 0, column: 1 },
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      purchaseOrderId: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      subsidiaryId: { visible: true, section: 'Document Identity', order: 1, column: 1 },
      currencyId: { visible: true, section: 'Document Identity', order: 1, column: 2 },
      quantity: { visible: true, section: 'Receipt Terms', order: 0, column: 1 },
      date: { visible: true, section: 'Receipt Terms', order: 0, column: 2 },
      status: { visible: true, section: 'Receipt Terms', order: 0, column: 3 },
      notes: { visible: true, section: 'Receipt Terms', order: 1, column: 1 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
    },
    referenceLayouts: [buildDefaultTransactionReferenceLayout(RECEIPT_REFERENCE_SOURCES, 'purchaseOrder')],
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: [
      { id: 'receipt-quantity', metric: 'quantity', visible: true, order: 0 },
      { id: 'receipt-status', metric: 'status', visible: true, order: 1 },
      { id: 'receipt-date', metric: 'date', visible: true, order: 2 },
      { id: 'receipt-po', metric: 'purchaseOrder', visible: true, order: 3 },
    ],
  }
}
