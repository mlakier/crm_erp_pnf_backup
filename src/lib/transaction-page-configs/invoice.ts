import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig, TransactionVisualTone } from '@/lib/transaction-page-config'

export type InvoicePageConfigRecord = {
  total: number
  currencyCode?: string | null
  statusLabel: string
  statusTone?: TransactionVisualTone
  dueDate: Date | null
  paidDate: Date | null
  salesOrderId: string | null
  salesOrderNumber: string | null
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const invoicePageConfig: TransactionPageConfig<InvoicePageConfigRecord> = {
  sectionDescriptions: {
    'Document Identity': 'Primary invoice identifiers, customer ownership, and record origin.',
    'Customer Snapshot': 'Customer contact and default commercial context from the linked master data record.',
    'Source Context': 'Upstream sales documents that produced this invoice.',
    'Financial Terms': 'Status, dates, and monetary context for this invoice.',
    'Record Keys': 'Internal database identifiers for this invoice and its owner.',
    'System Dates': 'System-managed timestamps for this invoice.',
  },
  stats: [
    {
      id: 'total',
      label: 'Invoice Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, record.currencyCode ?? undefined, record.moneySettings),
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) => record.statusTone ?? 'default',
    },
    {
      id: 'salesOrder',
      label: 'Created From',
      getValue: (record) => record.salesOrderNumber ?? '-',
      getHref: (record) => (record.salesOrderId ? `/sales-orders/${record.salesOrderId}` : null),
      getValueTone: (record) => (record.salesOrderId ? 'accent' : 'default'),
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
