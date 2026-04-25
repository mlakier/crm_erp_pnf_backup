export type SalesOrderDetailFieldKey =
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
  | 'quoteId'
  | 'createdBy'
  | 'createdFrom'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'total'
  | 'createdAt'
  | 'updatedAt'

export type SalesOrderLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'fulfilled-qty'
  | 'open-qty'
  | 'unit-price'
  | 'line-total'

export type SalesOrderStatCardKey =
  | 'total'
  | 'createdFrom'
  | 'lineCount'
  | 'status'
  | 'customerId'
  | 'userId'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'createdAt'
  | 'updatedAt'
  | 'dbId'

export type SalesOrderDetailFieldMeta = {
  id: SalesOrderDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type SalesOrderLineColumnMeta = {
  id: SalesOrderLineColumnKey
  label: string
  description?: string
}

export type SalesOrderDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type SalesOrderLineColumnCustomization = {
  visible: boolean
  order: number
}

export type SalesOrderStatCardSlot = {
  id: string
  metric: SalesOrderStatCardKey
  visible: boolean
  order: number
}

export type SalesOrderDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<SalesOrderDetailFieldKey, SalesOrderDetailFieldCustomization>
  lineColumns: Record<SalesOrderLineColumnKey, SalesOrderLineColumnCustomization>
  statCards: SalesOrderStatCardSlot[]
}

export const SALES_ORDER_DETAIL_FIELDS: SalesOrderDetailFieldMeta[] = [
  {
    id: 'id',
    label: 'DB Id',
    fieldType: 'text',
    description: 'Internal database identifier for the sales order record.',
  },
  {
    id: 'customerId',
    label: 'Customer Id',
    fieldType: 'text',
    source: 'Customers master data',
    description: 'Customer identifier linked to this sales order.',
  },
  {
    id: 'customerName',
    label: 'Customer Name',
    fieldType: 'text',
    source: 'Customers master data',
    description: 'Display name from the linked customer record.',
  },
  {
    id: 'customerNumber',
    label: 'Customer #',
    fieldType: 'text',
    source: 'Customers master data',
    description: 'Internal customer identifier from the linked customer record.',
  },
  {
    id: 'customerEmail',
    label: 'Email',
    fieldType: 'email',
    source: 'Customers master data',
    description: 'Primary customer email address.',
  },
  {
    id: 'customerPhone',
    label: 'Phone',
    fieldType: 'text',
    source: 'Customers master data',
    description: 'Primary customer phone number.',
  },
  {
    id: 'customerAddress',
    label: 'Billing Address',
    fieldType: 'text',
    source: 'Customers master data',
    description: 'Main billing address from the linked customer record.',
  },
  {
    id: 'customerPrimarySubsidiary',
    label: 'Primary Subsidiary',
    fieldType: 'list',
    source: 'Customers master data',
    description: 'Default subsidiary context from the linked customer record.',
  },
  {
    id: 'customerPrimaryCurrency',
    label: 'Primary Currency',
    fieldType: 'list',
    source: 'Customers master data',
    description: 'Default transaction currency from the linked customer record.',
  },
  {
    id: 'customerInactive',
    label: 'Inactive',
    fieldType: 'boolean',
    source: 'Customers master data',
    description: 'Indicates whether the linked customer is inactive for new activity.',
  },
  {
    id: 'number',
    label: 'Sales Order #',
    fieldType: 'text',
    description: 'Unique sales order number used across OTC workflows.',
  },
  {
    id: 'userId',
    label: 'User Id',
    fieldType: 'text',
    source: 'Users master data',
    description: 'User identifier for the creator/owner of the sales order.',
  },
  {
    id: 'quoteId',
    label: 'Quote Id',
    fieldType: 'text',
    source: 'Source transaction',
    description: 'Quote identifier linked to this sales order.',
  },
  {
    id: 'createdBy',
    label: 'Created By',
    fieldType: 'text',
    source: 'Users master data',
    description: 'User who created the sales order.',
  },
  {
    id: 'createdFrom',
    label: 'Created From',
    fieldType: 'text',
    source: 'Source transaction',
    description: 'Source transaction that created this sales order.',
  },
  {
    id: 'opportunityId',
    label: 'Opportunity Id',
    fieldType: 'text',
    source: 'Opportunities',
    description: 'Opportunity identifier linked through the source quote.',
  },
  {
    id: 'subsidiaryId',
    label: 'Subsidiary',
    fieldType: 'list',
    source: 'Subsidiaries master data',
    description: 'Subsidiary that owns the sales order.',
  },
  {
    id: 'currencyId',
    label: 'Currency',
    fieldType: 'list',
    source: 'Currencies master data',
    description: 'Transaction currency for the sales order.',
  },
  {
    id: 'status',
    label: 'Status',
    fieldType: 'list',
    source: 'System sales order statuses',
    description: 'Current lifecycle stage of the sales order.',
  },
  {
    id: 'total',
    label: 'Total',
    fieldType: 'currency',
    description: 'Document total based on all sales order line amounts.',
  },
  {
    id: 'createdAt',
    label: 'Created',
    fieldType: 'date',
    description: 'Date/time the sales order record was created.',
  },
  {
    id: 'updatedAt',
    label: 'Last Modified',
    fieldType: 'date',
    description: 'Date/time the sales order record was last modified.',
  },
]

export const SALES_ORDER_STAT_CARDS: Array<{ id: SalesOrderStatCardKey; label: string }> = [
  { id: 'total', label: 'Sales Order Total' },
  { id: 'createdFrom', label: 'Created From' },
  { id: 'lineCount', label: 'Sales Order Lines' },
  { id: 'status', label: 'Status' },
  { id: 'customerId', label: 'Customer Id' },
  { id: 'userId', label: 'User Id' },
  { id: 'quoteId', label: 'Quote Id' },
  { id: 'opportunityId', label: 'Opportunity Id' },
  { id: 'subsidiaryId', label: 'Subsidiary Id' },
  { id: 'currencyId', label: 'Currency Id' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Last Modified' },
  { id: 'dbId', label: 'DB Id' },
]

export const SALES_ORDER_LINE_COLUMNS: SalesOrderLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the sales order.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the sales order line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Ordered quantity for the line item.' },
  { id: 'fulfilled-qty', label: 'Fulfilled Qty', description: 'Fulfilled quantity associated with the line item.' },
  { id: 'open-qty', label: 'Open Qty', description: 'Remaining open quantity not yet fulfilled.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
]

export const DEFAULT_SALES_ORDER_DETAIL_SECTIONS = ['Customer', 'Sales Order Details'] as const

export const DEFAULT_SALES_ORDER_STAT_CARD_METRICS: SalesOrderStatCardKey[] = [
  'total',
  'createdFrom',
  'lineCount',
  'status',
]

export function defaultSalesOrderDetailCustomization(): SalesOrderDetailCustomizationConfig {
  const sectionMap: Record<SalesOrderDetailFieldKey, string> = {
    id: 'Sales Order Details',
    customerId: 'Sales Order Details',
    customerName: 'Customer',
    customerNumber: 'Customer',
    customerEmail: 'Customer',
    customerPhone: 'Customer',
    customerAddress: 'Customer',
    customerPrimarySubsidiary: 'Customer',
    customerPrimaryCurrency: 'Customer',
    customerInactive: 'Customer',
    number: 'Sales Order Details',
    userId: 'Sales Order Details',
    quoteId: 'Sales Order Details',
    createdBy: 'Sales Order Details',
    createdFrom: 'Sales Order Details',
    opportunityId: 'Sales Order Details',
    subsidiaryId: 'Sales Order Details',
    currencyId: 'Sales Order Details',
    status: 'Sales Order Details',
    total: 'Sales Order Details',
    createdAt: 'Sales Order Details',
    updatedAt: 'Sales Order Details',
  }

  const columnMap: Record<SalesOrderDetailFieldKey, number> = {
    id: 1,
    customerId: 2,
    customerName: 1,
    customerNumber: 1,
    customerEmail: 2,
    customerPhone: 2,
    customerAddress: 3,
    customerPrimarySubsidiary: 1,
    customerPrimaryCurrency: 2,
    customerInactive: 3,
    userId: 1,
    quoteId: 3,
    number: 1,
    createdBy: 3,
    createdFrom: 2,
    opportunityId: 2,
    subsidiaryId: 1,
    currencyId: 2,
    status: 3,
    total: 1,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<SalesOrderDetailFieldKey, number> = {
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
    userId: 2,
    quoteId: 0,
    number: 1,
    createdBy: 1,
    createdFrom: 1,
    opportunityId: 2,
    subsidiaryId: 3,
    currencyId: 3,
    status: 3,
    total: 4,
    createdAt: 2,
    updatedAt: 4,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_SALES_ORDER_DETAIL_SECTIONS],
    sectionRows: {
      Customer: 3,
      'Sales Order Details': 5,
    },
    fields: Object.fromEntries(
      SALES_ORDER_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: field.id === 'customerAddress' || field.id === 'customerInactive' ? false : true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<SalesOrderDetailFieldKey, SalesOrderDetailFieldCustomization>,
    lineColumns: Object.fromEntries(
      SALES_ORDER_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
        },
      ])
    ) as Record<SalesOrderLineColumnKey, SalesOrderLineColumnCustomization>,
    statCards: DEFAULT_SALES_ORDER_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
