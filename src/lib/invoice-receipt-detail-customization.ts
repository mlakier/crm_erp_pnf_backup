export type InvoiceReceiptDetailFieldKey =
  | 'customerName'
  | 'customerNumber'
  | 'id'
  | 'number'
  | 'invoiceId'
  | 'amount'
  | 'date'
  | 'method'
  | 'reference'
  | 'createdAt'
  | 'updatedAt'

export type InvoiceReceiptDetailFieldMeta = {
  id: InvoiceReceiptDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type InvoiceReceiptDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type InvoiceReceiptDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<InvoiceReceiptDetailFieldKey, InvoiceReceiptDetailFieldCustomization>
  statCards?: Array<{ id: string; metric: string; visible: boolean; order: number }>
}

export type InvoiceReceiptStatCardKey = 'amount' | 'date' | 'method' | 'invoice'

export const INVOICE_RECEIPT_STAT_CARDS: Array<{ id: InvoiceReceiptStatCardKey; label: string }> = [
  { id: 'amount', label: 'Receipt Amount' },
  { id: 'date', label: 'Receipt Date' },
  { id: 'method', label: 'Method' },
  { id: 'invoice', label: 'Invoice' },
]

export const INVOICE_RECEIPT_DETAIL_FIELDS: InvoiceReceiptDetailFieldMeta[] = [
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked invoice customer.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked invoice customer.' },
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this invoice receipt.' },
  { id: 'number', label: 'Invoice Receipt Id', fieldType: 'text', description: 'Unique identifier for this invoice receipt.' },
  { id: 'invoiceId', label: 'Invoice', fieldType: 'text', source: 'Invoice transaction', description: 'Linked invoice identifier for this cash receipt.' },
  { id: 'amount', label: 'Amount', fieldType: 'currency', description: 'Cash receipt amount applied to the invoice.' },
  { id: 'date', label: 'Receipt Date', fieldType: 'date', description: 'Date the receipt was recorded.' },
  { id: 'method', label: 'Method', fieldType: 'list', source: 'Payment method list', description: 'Method used to receive payment.' },
  { id: 'reference', label: 'Reference', fieldType: 'text', description: 'Reference number or memo for the receipt.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the invoice receipt record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the invoice receipt record was last modified.' },
]

export function defaultInvoiceReceiptDetailCustomization(): InvoiceReceiptDetailCustomizationConfig {
  return {
    formColumns: 3,
    sections: ['Customer', 'Invoice Receipt Details'],
    sectionRows: {
      Customer: 1,
      'Invoice Receipt Details': 3,
    },
    fields: {
      customerName: { visible: true, section: 'Customer', order: 0, column: 1 },
      customerNumber: { visible: true, section: 'Customer', order: 0, column: 2 },
      id: { visible: true, section: 'Invoice Receipt Details', order: 0, column: 1 },
      number: { visible: true, section: 'Invoice Receipt Details', order: 0, column: 2 },
      invoiceId: { visible: true, section: 'Invoice Receipt Details', order: 0, column: 3 },
      amount: { visible: true, section: 'Invoice Receipt Details', order: 1, column: 1 },
      date: { visible: true, section: 'Invoice Receipt Details', order: 1, column: 2 },
      method: { visible: true, section: 'Invoice Receipt Details', order: 1, column: 3 },
      reference: { visible: true, section: 'Invoice Receipt Details', order: 2, column: 1 },
      createdAt: { visible: true, section: 'Invoice Receipt Details', order: 2, column: 2 },
      updatedAt: { visible: true, section: 'Invoice Receipt Details', order: 2, column: 3 },
    },
    statCards: [
      { id: 'receipt-amount', metric: 'amount', visible: true, order: 0 },
      { id: 'receipt-date', metric: 'date', visible: true, order: 1 },
      { id: 'receipt-method', metric: 'method', visible: true, order: 2 },
      { id: 'linked-invoice', metric: 'invoice', visible: true, order: 3 },
    ],
  }
}
