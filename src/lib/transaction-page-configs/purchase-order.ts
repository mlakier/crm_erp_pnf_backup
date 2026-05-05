import { fmtCurrency } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type PurchaseOrderPageConfigRecord = {
  total: number
  currencyCode?: string | null
  lineCount: number
  receiptCount: number
  statusLabel: string
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const purchaseOrderPageConfig: TransactionPageConfig<PurchaseOrderPageConfigRecord> = {
  sectionDescriptions: {
    'Document Identity': 'Document numbering, provenance, and ownership for the purchase order.',
    'Workflow & Approval': 'Current workflow status and approval ownership for the purchase order.',
    'Sourcing & Financials': 'Vendor, subsidiary, currency, and total purchasing context for the order.',
    'Record Keys': 'Internal and linked transaction identifiers for this purchase order.',
    'System Dates': 'System-managed timestamps for this purchase order.',
  },
  stats: [
    {
      id: 'total',
      label: 'Purchase Order Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, record.currencyCode ?? undefined, record.moneySettings),
    },
    {
      id: 'lineCount',
      label: 'Line Items',
      getValue: (record) => record.lineCount,
    },
    {
      id: 'receiptCount',
      label: 'Receipts',
      getValue: (record) => record.receiptCount,
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) =>
        record.statusLabel === 'Received'
          ? 'green'
          : record.statusLabel === 'Approved'
            ? 'accent'
            : record.statusLabel === 'Pending'
              ? 'yellow'
              : record.statusLabel === 'Cancelled'
                ? 'red'
                : 'default',
    },
  ],
}
