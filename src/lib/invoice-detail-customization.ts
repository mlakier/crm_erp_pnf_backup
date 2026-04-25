export type InvoiceDetailFieldKey =
  | 'customerName'
  | 'customerNumber'
  | 'customerEmail'
  | 'customerPhone'
  | 'customerAddress'
  | 'customerPrimarySubsidiary'
  | 'customerPrimaryCurrency'
  | 'customerInactive'
  | 'id'
  | 'customerId'
  | 'salesOrderId'
  | 'userId'
  | 'number'
  | 'createdBy'
  | 'createdFrom'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'total'
  | 'dueDate'
  | 'paidDate'
  | 'createdAt'
  | 'updatedAt'

export type InvoiceLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'
  | 'notes'
  | 'department'
  | 'location'
  | 'project'
  | 'service-start'
  | 'service-end'
  | 'rev-rec-template'
  | 'performance-obligation-code'
  | 'ssp'
  | 'allocated-amount'

export type InvoiceDetailFieldMeta = {
  id: InvoiceDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type InvoiceDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type InvoiceLineColumnCustomization = {
  visible: boolean
  order: number
}

export type InvoiceStatCardKey =
  | 'total'
  | 'status'
  | 'dueDate'
  | 'paidDate'
  | 'customerId'
  | 'salesOrderId'
  | 'userId'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'createdAt'
  | 'updatedAt'
  | 'dbId'

export type InvoiceStatCardSlot = {
  id: string
  metric: InvoiceStatCardKey
  visible: boolean
  order: number
}

export type InvoiceDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<InvoiceDetailFieldKey, InvoiceDetailFieldCustomization>
  lineColumns: Record<InvoiceLineColumnKey, InvoiceLineColumnCustomization>
  statCards: InvoiceStatCardSlot[]
}

export const INVOICE_DETAIL_FIELDS: InvoiceDetailFieldMeta[] = [
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked customer record.' },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.' },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.' },
  { id: 'customerAddress', label: 'Billing Address', fieldType: 'text', source: 'Customers master data', description: 'Main billing address from the linked customer record.' },
  { id: 'customerPrimarySubsidiary', label: 'Primary Subsidiary', fieldType: 'list', source: 'Customers master data', description: 'Default subsidiary context from the linked customer record.' },
  { id: 'customerPrimaryCurrency', label: 'Primary Currency', fieldType: 'list', source: 'Customers master data', description: 'Default transaction currency from the linked customer record.' },
  { id: 'customerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Customers master data', description: 'Indicates whether the linked customer is inactive for new activity.' },
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for the invoice record.' },
  { id: 'customerId', label: 'Customer Id', fieldType: 'text', source: 'Customers master data', description: 'Customer identifier linked to this invoice.' },
  { id: 'salesOrderId', label: 'Sales Order Id', fieldType: 'text', source: 'Source transaction', description: 'Sales order identifier linked to this invoice.' },
  { id: 'userId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'User identifier for the invoice creator/owner.' },
  { id: 'number', label: 'Invoice #', fieldType: 'text', description: 'Unique invoice number used across OTC workflows.' },
  { id: 'createdBy', label: 'Created By', fieldType: 'text', source: 'Users master data', description: 'User who created the invoice.' },
  { id: 'createdFrom', label: 'Created From', fieldType: 'text', source: 'Source transaction', description: 'Source sales order that created this invoice.' },
  { id: 'quoteId', label: 'Quote Id', fieldType: 'text', source: 'Source transaction', description: 'Quote identifier linked through the sales order.' },
  { id: 'opportunityId', label: 'Opportunity Id', fieldType: 'text', source: 'Opportunities', description: 'Opportunity identifier linked through the source quote.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns the invoice.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for the invoice.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'System invoice statuses', description: 'Current lifecycle stage of the invoice.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Document total based on all invoice line amounts.' },
  { id: 'dueDate', label: 'Due Date', fieldType: 'date', description: 'Date payment is due.' },
  { id: 'paidDate', label: 'Paid Date', fieldType: 'date', description: 'Date payment was completed.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the invoice record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the invoice record was last modified.' },
]

export const INVOICE_LINE_COLUMNS: Array<{ id: InvoiceLineColumnKey; label: string; description?: string }> = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the invoice.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the invoice line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Invoiced quantity for the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Invoiced price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
  { id: 'notes', label: 'Notes', description: 'Invoice line notes.' },
  { id: 'department', label: 'Department', description: 'Department coding on the invoice line.' },
  { id: 'location', label: 'Location', description: 'Location coding on the invoice line.' },
  { id: 'project', label: 'Project', description: 'Project coding on the invoice line.' },
  { id: 'service-start', label: 'Service Start', description: 'Service period start date for the invoice line.' },
  { id: 'service-end', label: 'Service End', description: 'Service period end date for the invoice line.' },
  { id: 'rev-rec-template', label: 'Rev Rec Template', description: 'Revenue recognition template on the invoice line.' },
  { id: 'performance-obligation-code', label: 'Performance Obligation Code', description: 'Performance obligation code for the invoice line.' },
  { id: 'ssp', label: 'Standalone Selling Price', description: 'Standalone selling price on the invoice line.' },
  { id: 'allocated-amount', label: 'Allocated Amount', description: 'Allocated revenue amount on the invoice line.' },
]

export const DEFAULT_INVOICE_DETAIL_SECTIONS = ['Customer', 'Invoice Details'] as const

export const INVOICE_STAT_CARDS: Array<{ id: InvoiceStatCardKey; label: string }> = [
  { id: 'total', label: 'Invoice Total' },
  { id: 'status', label: 'Status' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'paidDate', label: 'Paid Date' },
  { id: 'customerId', label: 'Customer Id' },
  { id: 'salesOrderId', label: 'Sales Order Id' },
  { id: 'userId', label: 'User Id' },
  { id: 'quoteId', label: 'Quote Id' },
  { id: 'opportunityId', label: 'Opportunity Id' },
  { id: 'subsidiaryId', label: 'Subsidiary Id' },
  { id: 'currencyId', label: 'Currency Id' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Last Modified' },
  { id: 'dbId', label: 'DB Id' },
]

export const DEFAULT_INVOICE_STAT_CARD_METRICS: InvoiceStatCardKey[] = [
  'total',
  'status',
  'dueDate',
  'paidDate',
]

export function defaultInvoiceDetailCustomization(): InvoiceDetailCustomizationConfig {
  const sectionMap: Record<InvoiceDetailFieldKey, string> = {
    customerName: 'Customer',
    customerNumber: 'Customer',
    customerEmail: 'Customer',
    customerPhone: 'Customer',
    customerAddress: 'Customer',
    customerPrimarySubsidiary: 'Customer',
    customerPrimaryCurrency: 'Customer',
    customerInactive: 'Customer',
    id: 'Invoice Details',
    customerId: 'Invoice Details',
    salesOrderId: 'Invoice Details',
    userId: 'Invoice Details',
    number: 'Invoice Details',
    createdBy: 'Invoice Details',
    createdFrom: 'Invoice Details',
    quoteId: 'Invoice Details',
    opportunityId: 'Invoice Details',
    subsidiaryId: 'Invoice Details',
    currencyId: 'Invoice Details',
    status: 'Invoice Details',
    total: 'Invoice Details',
    dueDate: 'Invoice Details',
    paidDate: 'Invoice Details',
    createdAt: 'Invoice Details',
    updatedAt: 'Invoice Details',
  }

  const columnMap: Record<InvoiceDetailFieldKey, number> = {
    customerName: 1,
    customerNumber: 1,
    customerEmail: 2,
    customerPhone: 2,
    customerAddress: 3,
    customerPrimarySubsidiary: 1,
    customerPrimaryCurrency: 2,
    customerInactive: 3,
    id: 1,
    customerId: 2,
    salesOrderId: 3,
    userId: 1,
    number: 1,
    createdBy: 3,
    createdFrom: 2,
    quoteId: 2,
    opportunityId: 3,
    subsidiaryId: 1,
    currencyId: 2,
    status: 3,
    total: 1,
    dueDate: 2,
    paidDate: 3,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<InvoiceDetailFieldKey, number> = {
    customerName: 0,
    customerNumber: 1,
    customerEmail: 0,
    customerPhone: 1,
    customerAddress: 0,
    customerPrimarySubsidiary: 2,
    customerPrimaryCurrency: 2,
    customerInactive: 2,
    id: 0,
    customerId: 0,
    salesOrderId: 0,
    userId: 1,
    number: 1,
    createdBy: 1,
    createdFrom: 2,
    quoteId: 2,
    opportunityId: 2,
    subsidiaryId: 3,
    currencyId: 3,
    status: 3,
    total: 4,
    dueDate: 4,
    paidDate: 4,
    createdAt: 5,
    updatedAt: 5,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_INVOICE_DETAIL_SECTIONS],
    sectionRows: {
      Customer: 3,
      'Invoice Details': 6,
    },
    fields: Object.fromEntries(
      INVOICE_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: field.id === 'customerAddress' || field.id === 'customerInactive' || field.id === 'paidDate' ? false : true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<InvoiceDetailFieldKey, InvoiceDetailFieldCustomization>,
    lineColumns: Object.fromEntries(
      INVOICE_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: ['notes', 'department', 'location', 'project', 'service-start', 'service-end', 'rev-rec-template', 'performance-obligation-code', 'ssp', 'allocated-amount'].includes(column.id)
            ? false
            : true,
          order: index,
        },
      ]),
    ) as Record<InvoiceLineColumnKey, InvoiceLineColumnCustomization>,
    statCards: DEFAULT_INVOICE_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
