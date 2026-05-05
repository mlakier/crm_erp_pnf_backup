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
  BILL_FULL_REFERENCE_FIELDS,
  CURRENCY_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  type LinkedRecordReferenceSource,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'
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

export type BillCreditDetailFieldKey =
  | 'id'
  | 'number'
  | 'vendorId'
  | 'billId'
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

export type BillCreditDetailFieldMeta = {
  id: BillCreditDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type BillCreditDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type BillCreditStatCardKey = 'total' | 'status' | 'date' | 'vendor'

export type BillCreditDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<BillCreditDetailFieldKey, BillCreditDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: CreditDocumentLineSettings
  lineColumns: Record<CreditDocumentLineColumnKey, CreditDocumentLineColumnCustomization>
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<BillCreditStatCardKey>>
}

export const BILL_CREDIT_STAT_CARDS: Array<{ id: BillCreditStatCardKey; label: string }> = [
  { id: 'total', label: 'Total' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'vendor', label: 'Vendor' },
]

export const BILL_CREDIT_DETAIL_FIELDS: BillCreditDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this bill credit.' },
  { id: 'number', label: 'Bill Credit Id', fieldType: 'text', description: 'Business identifier for this bill credit.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', source: 'Vendors master data', description: 'Vendor linked to this bill credit.' },
  { id: 'billId', label: 'Bill', fieldType: 'list', source: 'Bill transaction', description: 'Source bill linked to this bill credit.' },
  { id: 'reason', label: 'Reason', fieldType: 'text', description: 'Reason for issuing the bill credit.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Free-form notes for this bill credit.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Bill credit status list', description: 'Current lifecycle status of this bill credit.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Transaction date of the bill credit.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns this bill credit.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for this bill credit.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Current bill credit total based on line amounts.' },
  { id: 'userId', label: 'Created By', fieldType: 'list', source: 'Users master data', description: 'User who created this bill credit.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the bill credit was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the bill credit was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

export const BILL_CREDIT_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'bill',
    label: 'Bill',
    linkedFieldLabel: 'Bill',
    description: 'Expand the linked bill context for this bill credit.',
    fields: BILL_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['billNumber', 'billStatus', 'billTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the creating user context for this bill credit.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary context for this bill credit.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency context for this bill credit.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultBillCreditDetailCustomization(): BillCreditDetailCustomizationConfig {
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
      vendorId: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      billId: { visible: true, section: 'Document Identity', order: 0, column: 3 },
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
    referenceLayouts: [buildDefaultTransactionReferenceLayout(BILL_CREDIT_REFERENCE_SOURCES, 'bill')],
    lineSettings: defaultCreditDocumentLineSettings(),
    lineColumns: defaultCreditDocumentLineColumns(),
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: [
      { id: 'bill-credit-total', metric: 'total', visible: true, order: 0 },
      { id: 'bill-credit-status', metric: 'status', visible: true, order: 1 },
      { id: 'bill-credit-date', metric: 'date', visible: true, order: 2 },
      { id: 'bill-credit-vendor', metric: 'vendor', visible: true, order: 3 },
    ],
  }
}

export { CREDIT_DOCUMENT_LINE_COLUMNS }
