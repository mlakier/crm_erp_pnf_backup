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

export type FulfillmentStatCardSlot = {
  id: string
  metric: FulfillmentStatCardKey
  visible: boolean
  order: number
}

export type FulfillmentDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type FulfillmentDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<FulfillmentDetailFieldKey, FulfillmentDetailFieldCustomization>
  lineColumns: Record<FulfillmentLineColumnKey, { visible: boolean; order: number }>
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

export const FULFILLMENT_LINE_COLUMNS: FulfillmentLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Sales order line sequence number.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier from the sales order line.' },
  { id: 'description', label: 'Description', description: 'Description carried from the sales order line.' },
  { id: 'ordered-qty', label: 'Ordered Qty', description: 'Original quantity ordered on the sales order line.' },
  { id: 'fulfilled-qty', label: 'Fulfilled Qty', description: 'Quantity fulfilled on this document line.' },
  { id: 'open-qty', label: 'Open Qty', description: 'Remaining quantity still open before this fulfillment.' },
  { id: 'notes', label: 'Notes', description: 'Line-specific fulfillment note or warehouse reference.' },
]

export function defaultFulfillmentDetailCustomization(): FulfillmentDetailCustomizationConfig {
  return {
    formColumns: 3,
    sections: ['Customer', 'Fulfillment Details'],
    sectionRows: {
      Customer: 1,
      'Fulfillment Details': 4,
    },
    fields: {
      customerName: { visible: true, section: 'Customer', order: 0, column: 1 },
      customerNumber: { visible: true, section: 'Customer', order: 0, column: 2 },
      id: { visible: true, section: 'Fulfillment Details', order: 0, column: 1 },
      number: { visible: true, section: 'Fulfillment Details', order: 0, column: 2 },
      salesOrderId: { visible: true, section: 'Fulfillment Details', order: 0, column: 3 },
      quoteId: { visible: true, section: 'Fulfillment Details', order: 1, column: 1 },
      opportunityId: { visible: true, section: 'Fulfillment Details', order: 1, column: 2 },
      status: { visible: true, section: 'Fulfillment Details', order: 1, column: 3 },
      subsidiaryId: { visible: true, section: 'Fulfillment Details', order: 2, column: 1 },
      currencyId: { visible: true, section: 'Fulfillment Details', order: 2, column: 2 },
      date: { visible: true, section: 'Fulfillment Details', order: 2, column: 3 },
      notes: { visible: true, section: 'Fulfillment Details', order: 3, column: 1 },
      createdAt: { visible: true, section: 'Fulfillment Details', order: 3, column: 2 },
      updatedAt: { visible: true, section: 'Fulfillment Details', order: 3, column: 3 },
    },
    lineColumns: Object.fromEntries(
      FULFILLMENT_LINE_COLUMNS.map((column, index) => [column.id, { visible: true, order: index }]),
    ) as FulfillmentDetailCustomizationConfig['lineColumns'],
    statCards: [
      { id: 'fulfillment-status', metric: 'status', visible: true, order: 0 },
      { id: 'fulfillment-sales-order', metric: 'salesOrder', visible: true, order: 1 },
      { id: 'fulfillment-date', metric: 'date', visible: true, order: 2 },
      { id: 'fulfillment-quantity', metric: 'totalQuantity', visible: true, order: 3 },
    ],
  }
}
