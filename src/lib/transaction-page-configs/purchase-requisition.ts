import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type PurchaseRequisitionPageConfigRecord = {
  total: number
  currencyCode?: string | null
  neededByDate: Date | null
  lineCount: number
  statusLabel: string
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const purchaseRequisitionPageConfig: TransactionPageConfig<PurchaseRequisitionPageConfigRecord> = {
  sectionDescriptions: {
    'Document Identity': 'Document numbering, provenance, and ownership for the purchase requisition.',
    'Workflow & Timing': 'Current workflow status, urgency, approval context, and required-by timing.',
    'Request Details': 'Business purpose, summary, and internal notes for the requisition request.',
    'Sourcing & Financials': 'Department, vendor, subsidiary, currency, and financial context for the request.',
    'Record Keys': 'Internal and linked transaction identifiers for this requisition.',
    'System Dates': 'System-managed timestamps for this purchase requisition.',
  },
  stats: [
    {
      id: 'total',
      label: 'Requisition Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, record.currencyCode ?? undefined, record.moneySettings),
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
