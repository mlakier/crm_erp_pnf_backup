import { fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type FulfillmentPageConfigRecord = {
  statusLabel: string
  salesOrderId: string | null
  salesOrderNumber: string | null
  lineCount: number
  totalQuantity: number
  date: Date | null
  moneySettings?: Parameters<typeof fmtDocumentDate>[1]
}

export const fulfillmentPageConfig: TransactionPageConfig<FulfillmentPageConfigRecord> = {
  sectionDescriptions: {
    Customer: 'Customer context derived from the linked sales order.',
    'Fulfillment Details': 'Core fulfillment fields, source sales context, and warehouse notes.',
  },
  stats: [
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) =>
        record.statusLabel === 'Shipped'
          ? 'green'
          : record.statusLabel === 'Cancelled'
            ? 'red'
            : record.statusLabel === 'Packed'
              ? 'accent'
              : 'default',
    },
    {
      id: 'salesOrder',
      label: 'Sales Order',
      getValue: (record) => record.salesOrderNumber ?? '-',
      getHref: (record) => (record.salesOrderId ? `/sales-orders/${record.salesOrderId}` : null),
      getValueTone: () => 'accent',
    },
    {
      id: 'date',
      label: 'Fulfillment Date',
      getValue: (record) => (record.date ? fmtDocumentDate(record.date, record.moneySettings) : '-'),
    },
    {
      id: 'lineCount',
      label: 'Fulfillment Lines',
      getValue: (record) => record.lineCount,
    },
    {
      id: 'totalQuantity',
      label: 'Fulfilled Qty',
      accent: true,
      getValue: (record) => record.totalQuantity,
      getValueTone: () => 'teal',
    },
  ],
}
