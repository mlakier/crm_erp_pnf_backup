export type SalesOrderDetailFieldKey =
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
  | 'total'

export type SalesOrderLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'fulfilled-qty'
  | 'open-qty'
  | 'unit-price'
  | 'line-total'

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

export type SalesOrderDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<SalesOrderDetailFieldKey, SalesOrderDetailFieldCustomization>
  lineColumns: Record<SalesOrderLineColumnKey, SalesOrderLineColumnCustomization>
}

export const SALES_ORDER_DETAIL_FIELDS: SalesOrderDetailFieldMeta[] = [
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
    id: 'opportunity',
    label: 'Opportunity',
    fieldType: 'text',
    source: 'Opportunities',
    description: 'Opportunity linked through the source quote.',
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

export function defaultSalesOrderDetailCustomization(): SalesOrderDetailCustomizationConfig {
  const sectionMap: Record<SalesOrderDetailFieldKey, string> = {
    customerName: 'Customer',
    customerNumber: 'Customer',
    customerEmail: 'Customer',
    customerPhone: 'Customer',
    customerAddress: 'Customer',
    customerPrimarySubsidiary: 'Customer',
    customerPrimaryCurrency: 'Customer',
    customerInactive: 'Customer',
    number: 'Sales Order Details',
    createdBy: 'Sales Order Details',
    createdFrom: 'Sales Order Details',
    opportunity: 'Sales Order Details',
    subsidiaryId: 'Sales Order Details',
    currencyId: 'Sales Order Details',
    status: 'Sales Order Details',
    total: 'Sales Order Details',
  }

  const columnMap: Record<SalesOrderDetailFieldKey, number> = {
    customerName: 1,
    customerNumber: 1,
    customerEmail: 2,
    customerPhone: 2,
    customerAddress: 3,
    customerPrimarySubsidiary: 1,
    customerPrimaryCurrency: 2,
    customerInactive: 3,
    number: 1,
    createdBy: 3,
    createdFrom: 2,
    opportunity: 3,
    subsidiaryId: 1,
    currencyId: 2,
    status: 1,
    total: 2,
  }

  const rowMap: Record<SalesOrderDetailFieldKey, number> = {
    customerName: 0,
    customerNumber: 1,
    customerEmail: 0,
    customerPhone: 1,
    customerAddress: 0,
    customerPrimarySubsidiary: 2,
    customerPrimaryCurrency: 2,
    customerInactive: 1,
    number: 0,
    createdBy: 0,
    createdFrom: 0,
    opportunity: 1,
    subsidiaryId: 1,
    currencyId: 1,
    status: 2,
    total: 2,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_SALES_ORDER_DETAIL_SECTIONS],
    sectionRows: {
      Customer: 3,
      'Sales Order Details': 3,
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
  }
}
