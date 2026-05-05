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
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
  buildDefaultCurrencyReadoutFieldCustomizations,
  CREDIT_DOCUMENT_LINE_COLUMNS,
  defaultCreditDocumentLineColumns,
  defaultCreditDocumentLineSettings,
  type CreditDocumentLineColumnCustomization,
  type CreditDocumentLineColumnKey,
  type CreditDocumentLineSettings,
} from '@/lib/credit-document-detail-customization-shared'
import {
  CUSTOMER_FULL_REFERENCE_FIELDS,
  CURRENCY_FULL_REFERENCE_FIELDS,
  INVOICE_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  type LinkedRecordReferenceSource,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type CreditMemoDetailFieldKey =
  | 'id'
  | 'number'
  | 'customerId'
  | 'invoiceId'
  | 'reason'
  | 'notes'
  | 'status'
  | 'date'
  | 'subsidiaryId'
  | 'currencyId'
  | 'total'
  | 'userId'
  | 'createdAt'
  | 'updatedAt'
  | CurrencyReadoutFieldKey

export type CreditMemoDetailFieldMeta = {
  id: CreditMemoDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type CreditMemoDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type CreditMemoStatCardKey = 'total' | 'status' | 'date' | 'customer'

export type CreditMemoDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<CreditMemoDetailFieldKey, CreditMemoDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: CreditDocumentLineSettings
  lineColumns: Record<CreditDocumentLineColumnKey, CreditDocumentLineColumnCustomization>
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<CreditMemoStatCardKey>>
}

export const CREDIT_MEMO_STAT_CARDS: Array<{ id: CreditMemoStatCardKey; label: string }> = [
  { id: 'total', label: 'Total' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'customer', label: 'Customer' },
]

export const CREDIT_MEMO_DETAIL_FIELDS: CreditMemoDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this credit memo.' },
  { id: 'number', label: 'Credit Memo Id', fieldType: 'text', description: 'Business identifier for this credit memo.' },
  { id: 'customerId', label: 'Customer', fieldType: 'list', source: 'Customers master data', description: 'Customer linked to this credit memo.' },
  { id: 'invoiceId', label: 'Invoice', fieldType: 'list', source: 'Invoice transaction', description: 'Source invoice linked to this credit memo.' },
  { id: 'reason', label: 'Reason', fieldType: 'text', description: 'Reason for issuing the credit memo.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Free-form notes for this credit memo.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Credit memo status list', description: 'Current lifecycle status of this credit memo.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Transaction date of the credit memo.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns this credit memo.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for this credit memo.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Current credit memo total based on line amounts.' },
  { id: 'userId', label: 'Created By', fieldType: 'list', source: 'Users master data', description: 'User who created this credit memo.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the credit memo was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the credit memo was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

export const CREDIT_MEMO_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'customer',
    label: 'Customer',
    linkedFieldLabel: 'Customer',
    description: 'Expand the linked customer context for this credit memo.',
    fields: CUSTOMER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['customerNumber', 'customerName', 'customerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    linkedFieldLabel: 'Invoice',
    description: 'Expand the linked invoice context for this credit memo.',
    fields: INVOICE_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['invoiceNumber', 'invoiceStatus', 'invoiceTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the creating user context for this credit memo.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary context for this credit memo.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency context for this credit memo.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultCreditMemoDetailCustomization(): CreditMemoDetailCustomizationConfig {
  return {
    formColumns: 4,
    sections: [
      CURRENCY_READOUT_SECTION_TITLE,
      'Document Identity',
      'Workflow & Timing',
      'Sourcing & Financials',
      'Record Keys',
      'System Dates',
    ],
    sectionRows: {
      [CURRENCY_READOUT_SECTION_TITLE]: 4,
      'Document Identity': 2,
      'Workflow & Timing': 1,
      'Sourcing & Financials': 1,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      id: { visible: true, section: 'Record Keys', order: 0, column: 1 },
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      customerId: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      invoiceId: { visible: true, section: 'Document Identity', order: 0, column: 3 },
      reason: { visible: true, section: 'Document Identity', order: 0, column: 4 },
      notes: { visible: true, section: 'Document Identity', order: 1, column: 1 },
      status: { visible: true, section: 'Workflow & Timing', order: 0, column: 1 },
      date: { visible: true, section: 'Workflow & Timing', order: 0, column: 2 },
      subsidiaryId: { visible: true, section: 'Sourcing & Financials', order: 0, column: 1 },
      currencyId: { visible: true, section: 'Sourcing & Financials', order: 0, column: 2 },
      total: { visible: true, section: 'Sourcing & Financials', order: 0, column: 3 },
      userId: { visible: true, section: 'Record Keys', order: 0, column: 2 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
      ...buildDefaultCurrencyReadoutFieldCustomizations({ showRealizedFx: true }),
    },
    referenceLayouts: [buildDefaultTransactionReferenceLayout(CREDIT_MEMO_REFERENCE_SOURCES, 'invoice')],
    lineSettings: defaultCreditDocumentLineSettings(),
    lineColumns: defaultCreditDocumentLineColumns(),
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: [
      { id: 'credit-memo-total', metric: 'total', visible: true, order: 0 },
      { id: 'credit-memo-status', metric: 'status', visible: true, order: 1 },
      { id: 'credit-memo-date', metric: 'date', visible: true, order: 2 },
      { id: 'credit-memo-customer', metric: 'customer', visible: true, order: 3 },
    ],
  }
}

export { CREDIT_DOCUMENT_LINE_COLUMNS }
