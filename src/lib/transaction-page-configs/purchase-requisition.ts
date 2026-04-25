import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type PurchaseRequisitionPageConfigRecord = {
  total: number
  neededByDate: Date | null
  lineCount: number
  statusLabel: string
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const purchaseRequisitionPageConfig: TransactionPageConfig<PurchaseRequisitionPageConfigRecord> = {
  sectionDescriptions: {
    Vendor: 'Supplier master data linked to this purchase requisition.',
    'Purchase Requisition Details': 'Core requisition fields, approval context, and procurement controls.',
  },
  stats: [
    {
      id: 'total',
      label: 'Requisition Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, undefined, record.moneySettings),
    },
    {
      id: 'neededByDate',
      label: 'Needed By',
      getValue: (record) =>
        record.neededByDate ? fmtDocumentDate(record.neededByDate, record.moneySettings) : '-',
    },
    {
      id: 'lineCount',
      label: 'Line Items',
      getValue: (record) => record.lineCount,
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) =>
        record.statusLabel === 'Approved' || record.statusLabel === 'Ordered'
          ? 'green'
          : record.statusLabel === 'Cancelled'
            ? 'red'
            : record.statusLabel === 'Pending Approval'
              ? 'yellow'
              : 'default',
    },
  ],
}
