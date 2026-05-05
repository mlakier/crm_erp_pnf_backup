import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'
import {
  buildDefaultTransactionReferenceLayout,
  type TransactionReferenceLayout,
} from '@/lib/transaction-reference-layouts'
import {
  type LinkedRecordReferenceSource,
  CUSTOMER_FULL_REFERENCE_FIELDS,
  CURRENCY_FULL_REFERENCE_FIELDS,
  QUOTE_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type OpportunityDetailFieldKey =
  | 'id'
  | 'customerId'
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'userId'
  | 'opportunityNumber'
  | 'name'
  | 'stage'
  | 'amount'
  | 'closeDate'
  | 'probability'
  | 'subsidiaryId'
  | 'currencyId'
  | 'quoteNumber'
  | 'inactive'
  | 'createdAt'
  | 'updatedAt'

export type OpportunityLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'
  | 'notes'

export type OpportunityDetailFieldMeta = {
  id: OpportunityDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type OpportunityDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type OpportunityLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: OpportunityLineWidthMode
  editDisplay: OpportunityLineDisplayMode
  viewDisplay: OpportunityLineDisplayMode
  dropdownDisplay: OpportunityLineDisplayMode
  dropdownSort: OpportunityLineDropdownSortMode
}

export type OpportunityLineFontSize = 'xs' | 'sm'

export type OpportunityLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type OpportunityLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type OpportunityLineDropdownSortMode = 'id' | 'label'

export type OpportunityLineSettings = {
  fontSize: OpportunityLineFontSize
}

export type OpportunityStatCardKey =
  | 'amount'
  | 'closeDate'
  | 'lineCount'
  | 'quoteNumber'
  | 'stage'

export type OpportunityStatCardSlot = TransactionStatCardSlot<OpportunityStatCardKey>

export type OpportunityDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<OpportunityDetailFieldKey, OpportunityDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: OpportunityLineSettings
  lineColumns: Record<OpportunityLineColumnKey, OpportunityLineColumnCustomization>
  statCards: OpportunityStatCardSlot[]
}

export const OPPORTUNITY_DETAIL_FIELDS: OpportunityDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for the opportunity record.' },
  { id: 'customerId', label: 'Customer Id', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier linked to the opportunity.' },
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.' },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.' },
  { id: 'userId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'Internal user identifier for the opportunity owner.' },
  { id: 'opportunityNumber', label: 'Opportunity Id', fieldType: 'text', description: 'Unique identifier for the opportunity.' },
  { id: 'name', label: 'Opportunity Name', fieldType: 'text', description: 'Display name for the opportunity.' },
  { id: 'stage', label: 'Stage', fieldType: 'list', source: 'Opportunity stage list', description: 'Current lifecycle stage of the opportunity.' },
  { id: 'amount', label: 'Amount', fieldType: 'currency', description: 'Current estimated amount or total of the opportunity.' },
  { id: 'closeDate', label: 'Close Date', fieldType: 'date', description: 'Expected close date for the opportunity.' },
  { id: 'probability', label: 'Probability', fieldType: 'number', description: 'Forecast probability percentage for the opportunity.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Owning subsidiary for the opportunity.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for the opportunity.' },
  { id: 'quoteNumber', label: 'Quote', fieldType: 'text', source: 'Quote transaction', description: 'Quote generated from this opportunity.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'boolean', description: 'Whether the opportunity is inactive.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the opportunity record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the opportunity record was last modified.' },
]

export const OPPORTUNITY_LINE_COLUMNS: Array<{
  id: OpportunityLineColumnKey
  label: string
  description?: string
}> = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the opportunity.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the opportunity line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Expected quantity for the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Expected price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
  { id: 'notes', label: 'Notes', description: 'Line-level notes captured for the opportunity line.' },
]

export const OPPORTUNITY_STAT_CARDS: Array<{
  id: OpportunityStatCardKey
  label: string
  description?: string
}> = [
  { id: 'amount', label: 'Amount', description: 'Current estimated amount for the opportunity.' },
  { id: 'closeDate', label: 'Close Date', description: 'Expected close date for the opportunity.' },
  { id: 'lineCount', label: 'Opportunity Lines', description: 'Number of line items linked to the opportunity.' },
  { id: 'quoteNumber', label: 'Quote', description: 'Quote generated from this opportunity.' },
  { id: 'stage', label: 'Stage', description: 'Current opportunity stage.' },
]

export const OPPORTUNITY_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'customer',
    label: 'Customer',
    linkedFieldLabel: 'Customer Id',
    description: 'Expand the linked customer record for this opportunity.',
    fields: CUSTOMER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['customerNumber', 'customerName', 'customerEmail', 'customerPhone'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'User Id',
    description: 'Expand the linked owner user record for this opportunity.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'quote',
    label: 'Quote',
    linkedFieldLabel: 'Quote',
    description: 'Expand the linked quote record for this opportunity.',
    fields: QUOTE_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['quoteNumber'],
    defaultColumns: 1,
    defaultRows: 1,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for this opportunity.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for this opportunity.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
]

const DEFAULT_OPPORTUNITY_STAT_CARD_METRICS: OpportunityStatCardKey[] = [
  'amount',
  'closeDate',
  'lineCount',
  'stage',
]

const DEFAULT_OPPORTUNITY_LINE_WIDTHS: Record<OpportunityLineColumnKey, OpportunityLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  quantity: 'compact',
  'unit-price': 'normal',
  'line-total': 'normal',
  notes: 'wide',
}

const DEFAULT_OPPORTUNITY_LINE_EDIT_DISPLAY: Record<OpportunityLineColumnKey, OpportunityLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  quantity: 'label',
  'unit-price': 'label',
  'line-total': 'label',
  notes: 'label',
}

const DEFAULT_OPPORTUNITY_LINE_VIEW_DISPLAY: Record<OpportunityLineColumnKey, OpportunityLineDisplayMode> = {
  ...DEFAULT_OPPORTUNITY_LINE_EDIT_DISPLAY,
}

const DEFAULT_OPPORTUNITY_LINE_DROPDOWN_DISPLAY: Record<OpportunityLineColumnKey, OpportunityLineDisplayMode> = {
  ...DEFAULT_OPPORTUNITY_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_OPPORTUNITY_LINE_DROPDOWN_SORT: Record<OpportunityLineColumnKey, OpportunityLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  quantity: 'id',
  'unit-price': 'id',
  'line-total': 'id',
  notes: 'label',
}

export function defaultOpportunityDetailCustomization(): OpportunityDetailCustomizationConfig {
  return {
    formColumns: 3,
    sections: [
      'Document Identity',
      'Customer Snapshot',
      'Pipeline & Forecast',
      'Commercial Context',
      'Record Keys',
      'System Dates',
    ],
    sectionRows: {
      'Document Identity': 1,
      'Customer Snapshot': 2,
      'Pipeline & Forecast': 2,
      'Commercial Context': 1,
      'Record Keys': 1,
      'System Dates': 1,
    },
    lineSettings: {
      fontSize: 'xs',
    },
    fields: {
      id: { visible: false, section: 'Record Keys', order: 0, column: 1 },
      customerId: { visible: true, section: 'Customer Snapshot', order: 0, column: 1 },
      customerName: { visible: true, section: 'Customer Snapshot', order: 0, column: 2 },
      customerEmail: { visible: true, section: 'Customer Snapshot', order: 0, column: 3 },
      customerPhone: { visible: true, section: 'Customer Snapshot', order: 1, column: 1 },
      userId: { visible: true, section: 'Record Keys', order: 0, column: 3 },
      opportunityNumber: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      name: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      stage: { visible: true, section: 'Pipeline & Forecast', order: 0, column: 1 },
      amount: { visible: true, section: 'Pipeline & Forecast', order: 0, column: 2 },
      closeDate: { visible: true, section: 'Pipeline & Forecast', order: 0, column: 3 },
      probability: { visible: true, section: 'Pipeline & Forecast', order: 1, column: 1 },
      subsidiaryId: { visible: true, section: 'Commercial Context', order: 0, column: 1 },
      currencyId: { visible: true, section: 'Commercial Context', order: 0, column: 2 },
      quoteNumber: { visible: true, section: 'Document Identity', order: 0, column: 3 },
      inactive: { visible: false, section: 'Pipeline & Forecast', order: 1, column: 2 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
    },
    referenceLayouts: [buildDefaultTransactionReferenceLayout(OPPORTUNITY_REFERENCE_SOURCES, 'customer')],
    lineColumns: Object.fromEntries(
      OPPORTUNITY_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_OPPORTUNITY_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_OPPORTUNITY_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_OPPORTUNITY_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_OPPORTUNITY_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_OPPORTUNITY_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as Record<OpportunityLineColumnKey, OpportunityLineColumnCustomization>,
    statCards: DEFAULT_OPPORTUNITY_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
