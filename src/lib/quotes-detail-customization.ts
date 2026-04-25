export type QuoteDetailFieldKey =
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
  | 'createdBy'
  | 'createdFrom'
  | 'opportunity'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'validUntil'
  | 'total'
  | 'notes'

export type QuoteLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'

export type QuoteStatCardKey =
  | 'total'
  | 'customerId'
  | 'validUntil'
  | 'opportunityId'
  | 'lineCount'
  | 'status'

export type QuoteStatCardSlot = {
  id: string
  metric: QuoteStatCardKey
  visible: boolean
  order: number
}

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
}

export type QuoteDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<QuoteDetailFieldKey, QuoteDetailFieldCustomization>
  lineColumns: Record<QuoteLineColumnKey, QuoteLineColumnCustomization>
  statCards: QuoteStatCardSlot[]
}

export const QUOTE_DETAIL_FIELDS: QuoteDetailFieldMeta[] = [
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
  { id: 'createdBy', label: 'Created By', fieldType: 'text', source: 'Users master data', description: 'User who created the quote.' },
  { id: 'createdFrom', label: 'Created From', fieldType: 'text', source: 'Source transaction', description: 'Source transaction that created this quote.' },
  { id: 'opportunity', label: 'Opportunity', fieldType: 'text', source: 'Opportunities', description: 'Opportunity linked to this quote.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns the quote.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for the quote.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'System quote statuses', description: 'Current lifecycle stage of the quote.' },
  { id: 'validUntil', label: 'Valid Until', fieldType: 'date', description: 'Date through which the quote remains valid.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Document total based on all quote line amounts.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Internal quote notes or summary context.' },
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

export const DEFAULT_QUOTE_STAT_CARD_METRICS: QuoteStatCardKey[] = [
  'total',
  'customerId',
  'validUntil',
  'status',
]

export const DEFAULT_QUOTE_DETAIL_SECTIONS = ['Customer', 'Quote Details'] as const

export function defaultQuoteDetailCustomization(): QuoteDetailCustomizationConfig {
  const sectionMap: Record<QuoteDetailFieldKey, string> = {
    customerId: 'Quote Details',
    customerName: 'Customer',
    customerNumber: 'Customer',
    customerEmail: 'Customer',
    customerPhone: 'Customer',
    customerAddress: 'Customer',
    customerPrimarySubsidiary: 'Customer',
    customerPrimaryCurrency: 'Customer',
    customerInactive: 'Customer',
    number: 'Quote Details',
    createdBy: 'Quote Details',
    createdFrom: 'Quote Details',
    opportunity: 'Quote Details',
    subsidiaryId: 'Quote Details',
    currencyId: 'Quote Details',
    status: 'Quote Details',
    validUntil: 'Quote Details',
    total: 'Quote Details',
    notes: 'Quote Details',
  }

  const columnMap: Record<QuoteDetailFieldKey, number> = {
    customerId: 1,
    customerName: 1,
    customerNumber: 1,
    customerEmail: 2,
    customerPhone: 2,
    customerAddress: 3,
    customerPrimarySubsidiary: 1,
    customerPrimaryCurrency: 2,
    customerInactive: 3,
    number: 1,
    createdBy: 2,
    createdFrom: 2,
    opportunity: 1,
    subsidiaryId: 1,
    currencyId: 2,
    status: 3,
    validUntil: 2,
    total: 3,
    notes: 1,
  }

  const rowMap: Record<QuoteDetailFieldKey, number> = {
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
    createdBy: 1,
    createdFrom: 0,
    opportunity: 1,
    subsidiaryId: 1,
    currencyId: 0,
    status: 1,
    validUntil: 1,
    total: 0,
    notes: 2,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_QUOTE_DETAIL_SECTIONS],
    sectionRows: {
      Customer: 3,
      'Quote Details': 5,
    },
    fields: Object.fromEntries(
      QUOTE_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: field.id === 'customerAddress' || field.id === 'customerInactive' ? false : true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<QuoteDetailFieldKey, QuoteDetailFieldCustomization>,
    lineColumns: Object.fromEntries(
      QUOTE_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
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
