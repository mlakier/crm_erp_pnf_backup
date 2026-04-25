export type OpportunityDetailFieldKey =
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'opportunityNumber'
  | 'name'
  | 'stage'
  | 'amount'
  | 'closeDate'
  | 'quoteNumber'
  | 'createdAt'
  | 'updatedAt'

export type OpportunityLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'

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
}

export type OpportunityStatCardKey =
  | 'amount'
  | 'close-date'
  | 'line-count'
  | 'quote'
  | 'stage'

export type OpportunityStatCardSlot = {
  id: string
  metric: OpportunityStatCardKey
  visible: boolean
  order: number
}

export type OpportunityDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<OpportunityDetailFieldKey, OpportunityDetailFieldCustomization>
  lineColumns: Record<OpportunityLineColumnKey, OpportunityLineColumnCustomization>
  statCards: OpportunityStatCardSlot[]
}

export const OPPORTUNITY_DETAIL_FIELDS: OpportunityDetailFieldMeta[] = [
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.' },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.' },
  { id: 'opportunityNumber', label: 'Opportunity Id', fieldType: 'text', description: 'Unique identifier for the opportunity.' },
  { id: 'name', label: 'Opportunity Name', fieldType: 'text', description: 'Display name for the opportunity.' },
  { id: 'stage', label: 'Stage', fieldType: 'list', source: 'Opportunity stage list', description: 'Current lifecycle stage of the opportunity.' },
  { id: 'amount', label: 'Amount', fieldType: 'currency', description: 'Current estimated amount or total of the opportunity.' },
  { id: 'closeDate', label: 'Close Date', fieldType: 'date', description: 'Expected close date for the opportunity.' },
  { id: 'quoteNumber', label: 'Quote', fieldType: 'text', source: 'Quote transaction', description: 'Quote generated from this opportunity.' },
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
]

export const OPPORTUNITY_STAT_CARDS: Array<{
  id: OpportunityStatCardKey
  label: string
  description?: string
}> = [
  { id: 'amount', label: 'Amount', description: 'Current estimated amount for the opportunity.' },
  { id: 'close-date', label: 'Close Date', description: 'Expected close date for the opportunity.' },
  { id: 'line-count', label: 'Opportunity Lines', description: 'Number of line items linked to the opportunity.' },
  { id: 'quote', label: 'Quote', description: 'Quote generated from this opportunity.' },
  { id: 'stage', label: 'Stage', description: 'Current opportunity stage.' },
]

const DEFAULT_OPPORTUNITY_STAT_CARD_METRICS: OpportunityStatCardKey[] = [
  'amount',
  'close-date',
  'line-count',
  'stage',
]

export function defaultOpportunityDetailCustomization(): OpportunityDetailCustomizationConfig {
  return {
    formColumns: 3,
    sections: ['Customer', 'Opportunity Details'],
    sectionRows: {
      Customer: 2,
      'Opportunity Details': 3,
    },
    fields: {
      customerName: { visible: true, section: 'Customer', order: 0, column: 1 },
      customerEmail: { visible: true, section: 'Customer', order: 0, column: 2 },
      customerPhone: { visible: true, section: 'Customer', order: 1, column: 1 },
      opportunityNumber: { visible: true, section: 'Opportunity Details', order: 0, column: 1 },
      name: { visible: true, section: 'Opportunity Details', order: 0, column: 2 },
      stage: { visible: true, section: 'Opportunity Details', order: 1, column: 1 },
      amount: { visible: true, section: 'Opportunity Details', order: 1, column: 2 },
      closeDate: { visible: true, section: 'Opportunity Details', order: 1, column: 3 },
      quoteNumber: { visible: true, section: 'Opportunity Details', order: 2, column: 1 },
      createdAt: { visible: true, section: 'Opportunity Details', order: 2, column: 2 },
      updatedAt: { visible: true, section: 'Opportunity Details', order: 2, column: 3 },
    },
    lineColumns: Object.fromEntries(
      OPPORTUNITY_LINE_COLUMNS.map((column, index) => [
        column.id,
        { visible: true, order: index },
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
