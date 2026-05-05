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
  CURRENCY_FULL_REFERENCE_FIELDS,
  SALES_ORDER_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type FulfillmentDetailFieldKey =
  | 'customerName'
  | 'customerNumber'
  | 'id'
  | 'number'
  | 'salesOrderId'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'date'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'

export type FulfillmentLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'ordered-qty'
  | 'fulfilled-qty'
  | 'open-qty'
  | 'notes'

export type FulfillmentLineFontSize = 'xs' | 'sm'

export type FulfillmentLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type FulfillmentLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type FulfillmentLineDropdownSortMode = 'id' | 'label'

export type FulfillmentStatCardKey =
  | 'status'
  | 'salesOrder'
  | 'date'
  | 'lineCount'
  | 'totalQuantity'

export type FulfillmentDetailFieldMeta = {
  id: FulfillmentDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type FulfillmentLineColumnMeta = {
  id: FulfillmentLineColumnKey
  label: string
  description?: string
}

export type FulfillmentStatCardSlot = TransactionStatCardSlot<FulfillmentStatCardKey>

export type FulfillmentDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type FulfillmentLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: FulfillmentLineWidthMode
  editDisplay: FulfillmentLineDisplayMode
  viewDisplay: FulfillmentLineDisplayMode
  dropdownDisplay: FulfillmentLineDisplayMode
  dropdownSort: FulfillmentLineDropdownSortMode
}

export type FulfillmentLineSettings = {
  fontSize: FulfillmentLineFontSize
}

export type FulfillmentDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<FulfillmentDetailFieldKey, FulfillmentDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: FulfillmentLineSettings
  lineColumns: Record<FulfillmentLineColumnKey, FulfillmentLineColumnCustomization>
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards: FulfillmentStatCardSlot[]
}

export const FULFILLMENT_STAT_CARDS: Array<{ id: FulfillmentStatCardKey; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'salesOrder', label: 'Sales Order' },
  { id: 'date', label: 'Fulfillment Date' },
  { id: 'lineCount', label: 'Fulfillment Lines' },
  { id: 'totalQuantity', label: 'Fulfilled Qty' },
]

export const FULFILLMENT_DETAIL_FIELDS: FulfillmentDetailFieldMeta[] = [
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked sales order customer.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked sales order customer.' },
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this fulfillment.' },
  { id: 'number', label: 'Fulfillment Id', fieldType: 'text', description: 'Unique identifier for this fulfillment.' },
  { id: 'salesOrderId', label: 'Sales Order Id', fieldType: 'text', source: 'Sales order transaction', description: 'Linked sales order identifier for this fulfillment.' },
  { id: 'quoteId', label: 'Quote Id', fieldType: 'text', source: 'Quote transaction', description: 'Quote identifier linked through the sales order.' },
  { id: 'opportunityId', label: 'Opportunity Id', fieldType: 'text', source: 'Opportunity transaction', description: 'Opportunity identifier linked through the quote.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns the fulfillment.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency from the linked sales order.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Fulfillment status list', description: 'Current lifecycle stage of the fulfillment.' },
  { id: 'date', label: 'Fulfillment Date', fieldType: 'date', description: 'Date the fulfillment was recorded.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Freeform notes for warehouse or shipping context.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the fulfillment record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the fulfillment record was last modified.' },
]

export const FULFILLMENT_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'salesOrder',
    label: 'Sales Order',
    linkedFieldLabel: 'Sales Order Id',
    description: 'Expand the linked sales order context for this fulfillment.',
    fields: SALES_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['salesOrderNumber', 'salesOrderStatus', 'salesOrderTotal'],
    defaultColumns: 2,
    defaultRows: 3,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for this fulfillment.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 1,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for this fulfillment.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 1,
    defaultRows: 1,
  },
]

export const FULFILLMENT_LINE_COLUMNS: FulfillmentLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Sales order line sequence number.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier from the sales order line.' },
  { id: 'description', label: 'Description', description: 'Description carried from the sales order line.' },
  { id: 'ordered-qty', label: 'Ordered Qty', description: 'Original quantity ordered on the sales order line.' },
  { id: 'fulfilled-qty', label: 'Fulfilled Qty', description: 'Quantity fulfilled on this document line.' },
  { id: 'open-qty', label: 'Open Qty', description: 'Remaining quantity still open before this fulfillment.' },
  { id: 'notes', label: 'Notes', description: 'Line-specific fulfillment note or warehouse reference.' },
]

const DEFAULT_FULFILLMENT_LINE_WIDTHS: Record<FulfillmentLineColumnKey, FulfillmentLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  'ordered-qty': 'compact',
  'fulfilled-qty': 'compact',
  'open-qty': 'compact',
  notes: 'wide',
}

const DEFAULT_FULFILLMENT_LINE_EDIT_DISPLAY: Record<FulfillmentLineColumnKey, FulfillmentLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  'ordered-qty': 'label',
  'fulfilled-qty': 'label',
  'open-qty': 'label',
  notes: 'label',
}

const DEFAULT_FULFILLMENT_LINE_VIEW_DISPLAY: Record<FulfillmentLineColumnKey, FulfillmentLineDisplayMode> = {
  ...DEFAULT_FULFILLMENT_LINE_EDIT_DISPLAY,
}

const DEFAULT_FULFILLMENT_LINE_DROPDOWN_DISPLAY: Record<FulfillmentLineColumnKey, FulfillmentLineDisplayMode> = {
  ...DEFAULT_FULFILLMENT_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_FULFILLMENT_LINE_DROPDOWN_SORT: Record<FulfillmentLineColumnKey, FulfillmentLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  'ordered-qty': 'id',
  'fulfilled-qty': 'id',
  'open-qty': 'id',
  notes: 'label',
}

export function defaultFulfillmentDetailCustomization(): FulfillmentDetailCustomizationConfig {
  return {
    formColumns: 3,
    sections: [
      'Document Identity',
      'Source Context',
      'Fulfillment Terms',
      'Commercial Context',
      'Record Keys',
      'System Dates',
    ],
    sectionRows: {
      'Document Identity': 1,
      'Source Context': 1,
      'Fulfillment Terms': 1,
      'Commercial Context': 1,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      customerNumber: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      customerName: { visible: true, section: 'Document Identity', order: 0, column: 3 },
      salesOrderId: { visible: true, section: 'Source Context', order: 0, column: 1 },
      quoteId: { visible: true, section: 'Source Context', order: 0, column: 2 },
      opportunityId: { visible: true, section: 'Source Context', order: 0, column: 3 },
      status: { visible: true, section: 'Fulfillment Terms', order: 0, column: 1 },
      date: { visible: true, section: 'Fulfillment Terms', order: 0, column: 2 },
      notes: { visible: true, section: 'Fulfillment Terms', order: 0, column: 3 },
      subsidiaryId: { visible: true, section: 'Commercial Context', order: 0, column: 1 },
      currencyId: { visible: true, section: 'Commercial Context', order: 0, column: 2 },
      id: { visible: true, section: 'Record Keys', order: 0, column: 1 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
    },
    referenceLayouts: [buildDefaultTransactionReferenceLayout(FULFILLMENT_REFERENCE_SOURCES, 'salesOrder')],
    lineSettings: {
      fontSize: 'sm',
    },
    lineColumns: Object.fromEntries(
      FULFILLMENT_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_FULFILLMENT_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_FULFILLMENT_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_FULFILLMENT_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_FULFILLMENT_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_FULFILLMENT_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as FulfillmentDetailCustomizationConfig['lineColumns'],
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: [
      { id: 'fulfillment-status', metric: 'status', visible: true, order: 0 },
      { id: 'fulfillment-sales-order', metric: 'salesOrder', visible: true, order: 1 },
      { id: 'fulfillment-date', metric: 'date', visible: true, order: 2 },
      { id: 'fulfillment-quantity', metric: 'totalQuantity', visible: true, order: 3 },
    ],
  }
}
