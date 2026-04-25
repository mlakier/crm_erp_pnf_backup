import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type InvoicePageConfigRecord = {
  total: number
  statusLabel: string
  dueDate: Date | null
  paidDate: Date | null
  salesOrderId: string | null
  salesOrderNumber: string | null
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const invoicePageConfig: TransactionPageConfig<InvoicePageConfigRecord> = {
  sectionDescriptions: {
    Customer: 'Customer contact and default commercial context from the linked master data record.',
    'Invoice Details': 'Core invoice fields, upstream sales context, and financial dates.',
  },
  stats: [
    {
      id: 'total',
      label: 'Invoice Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, undefined, record.moneySettings),
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) =>
        record.statusLabel === 'Paid'
          ? 'green'
          : record.statusLabel === 'Void'
            ? 'red'
            : record.statusLabel === 'Sent'
              ? 'accent'
              : 'default',
    },
    {
      id: 'salesOrder',
      label: 'Created From',
      getValue: (record) => record.salesOrderNumber ?? '-',
      getHref: (record) => (record.salesOrderId ? `/sales-orders/${record.salesOrderId}` : null),
    },
    {
      id: 'dueDate',
      label: 'Due Date',
      getValue: (record) => (record.dueDate ? fmtDocumentDate(record.dueDate, record.moneySettings) : '-'),
    },
    {
      id: 'paidDate',
      label: 'Paid Date',
      getValue: (record) => (record.paidDate ? fmtDocumentDate(record.paidDate, record.moneySettings) : '-'),
    },
  ],
}
