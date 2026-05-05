import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'
import {
  buildDefaultTransactionReferenceLayout,
  type TransactionReferenceLayout,
} from '@/lib/transaction-reference-layouts'
import {
  type LinkedRecordReferenceSource,
  CUSTOMER_FULL_REFERENCE_FIELDS,
  CURRENCY_FULL_REFERENCE_FIELDS,
  OPPORTUNITY_FULL_REFERENCE_FIELDS,
  SALES_ORDER_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type QuoteDetailFieldKey =
  | 'id'
  | 'customerId'
  | 'customerName'
  | 'customerNumber'
  | 'customerEmail'
  | 'customerPhone'
  | 'customerAddress'
  | 'customerPrimarySubsidiary'
  | 'customerPrimaryCurrency'
  | 'customerInactive'
  | 'number'
  | 'userId'
  | 'createdBy'
  | 'opportunityId'
  | 'createdFrom'
  | 'opportunity'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'validUntil'
  | 'total'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'

export type QuoteLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'

export type QuoteLineFontSize = 'xs' | 'sm'

export type QuoteLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type QuoteLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type QuoteLineDropdownSortMode = 'id' | 'label'

export type QuoteStatCardKey =
  | 'total'
  | 'customerId'
  | 'validUntil'
  | 'opportunityId'
  | 'lineCount'
  | 'status'

export type QuoteStatCardSlot = TransactionStatCardSlot<QuoteStatCardKey>

export type QuoteDetailFieldMeta = {
  id: QuoteDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type QuoteDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type QuoteLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: QuoteLineWidthMode
  editDisplay: QuoteLineDisplayMode
  viewDisplay: QuoteLineDisplayMode
  dropdownDisplay: QuoteLineDisplayMode
  dropdownSort: QuoteLineDropdownSortMode
}

export type QuoteLineSettings = {
  fontSize: QuoteLineFontSize
}

export type QuoteDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<QuoteDetailFieldKey, QuoteDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: QuoteLineSettings
  lineColumns: Record<QuoteLineColumnKey, QuoteLineColumnCustomization>
  statCards: QuoteStatCardSlot[]
}

export const QUOTE_DETAIL_FIELDS: QuoteDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for the quote record.' },
  { id: 'customerId', label: 'Customer', fieldType: 'list', source: 'Customers master data', description: 'Customer record linked to this quote.' },
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked customer record.' },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.' },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.' },
  { id: 'customerAddress', label: 'Billing Address', fieldType: 'text', source: 'Customers master data', description: 'Main billing address from the linked customer record.' },
  { id: 'customerPrimarySubsidiary', label: 'Primary Subsidiary', fieldType: 'list', source: 'Customers master data', description: 'Default subsidiary context from the linked customer record.' },
  { id: 'customerPrimaryCurrency', label: 'Primary Currency', fieldType: 'list', source: 'Customers master data', description: 'Default transaction currency from the linked customer record.' },
  { id: 'customerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Customers master data', description: 'Indicates whether the linked customer is inactive for new activity.' },
  { id: 'number', label: 'Quote #', fieldType: 'text', description: 'Unique quote number used across OTC workflows.' },
  { id: 'userId', label: 'User DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal database identifier for the quote owner.' },
  { id: 'createdBy', label: 'Created By', fieldType: 'text', source: 'Users master data', description: 'User who created the quote.' },
  { id: 'opportunityId', label: 'Opportunity DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal database identifier for the linked opportunity.' },
  { id: 'createdFrom', label: 'Created From', fieldType: 'text', source: 'Source transaction', description: 'Source transaction that created this quote.' },
  { id: 'opportunity', label: 'Opportunity', fieldType: 'text', source: 'Opportunities', description: 'Opportunity linked to this quote.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns the quote.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for the quote.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'System quote statuses', description: 'Current lifecycle stage of the quote.' },
  { id: 'validUntil', label: 'Valid Until', fieldType: 'date', description: 'Date through which the quote remains valid.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Document total based on all quote line amounts.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Internal quote notes or summary context.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the quote record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the quote record was last modified.' },
]

export const QUOTE_LINE_COLUMNS: Array<{
  id: QuoteLineColumnKey
  label: string
  description?: string
}> = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the quote.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the quote line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Quoted quantity for the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Quoted price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
]

export const QUOTE_STAT_CARDS: Array<{ id: QuoteStatCardKey; label: string }> = [
  { id: 'total', label: 'Quote Total' },
  { id: 'customerId', label: 'Customer Id' },
  { id: 'validUntil', label: 'Valid Until' },
  { id: 'opportunityId', label: 'Opportunity Id' },
  { id: 'lineCount', label: 'Quote Lines' },
  { id: 'status', label: 'Status' },
]

export const QUOTE_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'customer',
    label: 'Customer',
    linkedFieldLabel: 'Customer',
    description: 'Expand the linked customer record for this quote.',
    fields: CUSTOMER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['customerNumber', 'customerName', 'customerEmail', 'customerPhone'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'opportunity',
    label: 'Opportunity',
    linkedFieldLabel: 'Opportunity',
    description: 'Expand the linked opportunity record for this quote.',
    fields: OPPORTUNITY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['opportunityNumber', 'opportunityName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the linked owner user record for this quote.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for this quote.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 1,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for this quote.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 1,
    defaultRows: 1,
  },
  {
    id: 'salesOrder',
    label: 'Sales Order',
    linkedFieldLabel: 'Created From',
    description: 'Expand the linked downstream sales order created from this quote.',
    fields: SALES_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['salesOrderNumber'],
    defaultColumns: 1,
    defaultRows: 1,
  },
]

export const DEFAULT_QUOTE_STAT_CARD_METRICS: QuoteStatCardKey[] = [
  'total',
  'customerId',
  'validUntil',
  'status',
]

export const DEFAULT_QUOTE_DETAIL_SECTIONS = [
  'Document Identity',
  'Customer Snapshot',
  'Opportunity Context',
  'Commercial Terms',
  'Record Keys',
  'System Dates',
] as const

const DEFAULT_QUOTE_LINE_WIDTHS: Record<QuoteLineColumnKey, QuoteLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  quantity: 'compact',
  'unit-price': 'normal',
  'line-total': 'normal',
}

const DEFAULT_QUOTE_LINE_EDIT_DISPLAY: Record<QuoteLineColumnKey, QuoteLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  quantity: 'label',
  'unit-price': 'label',
  'line-total': 'label',
}

const DEFAULT_QUOTE_LINE_VIEW_DISPLAY: Record<QuoteLineColumnKey, QuoteLineDisplayMode> = {
  ...DEFAULT_QUOTE_LINE_EDIT_DISPLAY,
}

const DEFAULT_QUOTE_LINE_DROPDOWN_DISPLAY: Record<QuoteLineColumnKey, QuoteLineDisplayMode> = {
  ...DEFAULT_QUOTE_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_QUOTE_LINE_DROPDOWN_SORT: Record<QuoteLineColumnKey, QuoteLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  quantity: 'id',
  'unit-price': 'id',
  'line-total': 'id',
}

export function defaultQuoteDetailCustomization(): QuoteDetailCustomizationConfig {
  const sectionMap: Record<QuoteDetailFieldKey, string> = {
    id: 'Record Keys',
    customerId: 'Document Identity',
    customerName: 'Customer Snapshot',
    customerNumber: 'Customer Snapshot',
    customerEmail: 'Customer Snapshot',
    customerPhone: 'Customer Snapshot',
    customerAddress: 'Customer Snapshot',
    customerPrimarySubsidiary: 'Customer Snapshot',
    customerPrimaryCurrency: 'Customer Snapshot',
    customerInactive: 'Customer Snapshot',
    number: 'Document Identity',
    userId: 'Record Keys',
    createdBy: 'Document Identity',
    opportunityId: 'Record Keys',
    createdFrom: 'Opportunity Context',
    opportunity: 'Opportunity Context',
    subsidiaryId: 'Commercial Terms',
    currencyId: 'Commercial Terms',
    status: 'Commercial Terms',
    validUntil: 'Commercial Terms',
    total: 'Commercial Terms',
    notes: 'Commercial Terms',
    createdAt: 'System Dates',
    updatedAt: 'System Dates',
  }

  const columnMap: Record<QuoteDetailFieldKey, number> = {
    id: 1,
    customerId: 3,
    customerName: 1,
    customerNumber: 1,
    customerEmail: 2,
    customerPhone: 2,
    customerAddress: 3,
    customerPrimarySubsidiary: 1,
    customerPrimaryCurrency: 2,
    customerInactive: 3,
    number: 1,
    userId: 2,
    createdBy: 2,
    opportunityId: 3,
    createdFrom: 1,
    opportunity: 2,
    subsidiaryId: 1,
    currencyId: 2,
    status: 3,
    validUntil: 1,
    total: 2,
    notes: 1,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<QuoteDetailFieldKey, number> = {
    id: 0,
    customerId: 0,
    customerName: 0,
    customerNumber: 1,
    customerEmail: 0,
    customerPhone: 1,
    customerAddress: 0,
    customerPrimarySubsidiary: 2,
    customerPrimaryCurrency: 2,
    customerInactive: 1,
    number: 0,
    userId: 0,
    createdBy: 0,
    opportunityId: 0,
    createdFrom: 0,
    opportunity: 0,
    subsidiaryId: 0,
    currencyId: 0,
    status: 1,
    validUntil: 1,
    total: 1,
    notes: 2,
    createdAt: 0,
    updatedAt: 0,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_QUOTE_DETAIL_SECTIONS],
    sectionRows: {
      'Document Identity': 1,
      'Customer Snapshot': 3,
      'Opportunity Context': 1,
      'Commercial Terms': 3,
      'Record Keys': 1,
      'System Dates': 1,
    },
    lineSettings: {
      fontSize: 'xs',
    },
    fields: Object.fromEntries(
      QUOTE_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: field.id === 'customerAddress' || field.id === 'customerInactive' || field.id === 'id' || field.id === 'userId' || field.id === 'opportunityId' ? false : true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<QuoteDetailFieldKey, QuoteDetailFieldCustomization>,
    referenceLayouts: [buildDefaultTransactionReferenceLayout(QUOTE_REFERENCE_SOURCES, 'customer')],
    lineColumns: Object.fromEntries(
      QUOTE_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_QUOTE_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_QUOTE_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_QUOTE_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_QUOTE_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_QUOTE_LINE_DROPDOWN_SORT[column.id],
        },
      ])
    ) as Record<QuoteLineColumnKey, QuoteLineColumnCustomization>,
    statCards: DEFAULT_QUOTE_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
