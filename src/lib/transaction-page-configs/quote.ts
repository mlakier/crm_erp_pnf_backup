import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig, TransactionVisualTone } from '@/lib/transaction-page-config'

export type QuotePageConfigRecord = {
  customerId: string | null
  customerHref: string | null
  opportunityId: string | null
  opportunityHref: string | null
  total: number
  currencyCode?: string | null
  validUntil: Date | null
  lineCount: number
  statusLabel: string
  statusTone?: TransactionVisualTone
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const quotePageConfig: TransactionPageConfig<QuotePageConfigRecord> = {
  sectionDescriptions: {
    'Document Identity': 'Quote number, customer selection, and ownership context for this document.',
    'Customer Snapshot': 'Primary customer contact and default commercial context from the linked master data record.',
    'Opportunity Context': 'Upstream opportunity references that produced or inform this quote.',
    'Commercial Terms': 'Status, validity, currency, totals, and internal commercial notes for the quote.',
    'Record Keys': 'Internal database and linked-record identifiers tied to this quote.',
    'System Dates': 'System-managed timestamps for this quote record.',
  },
  stats: [
    {
      id: 'total',
      label: 'Quote Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, record.currencyCode ?? undefined, record.moneySettings),
    },
    {
      id: 'customerId',
      label: 'Customer Id',
      getValue: (record) => record.customerId ?? '-',
      getHref: (record) => record.customerHref,
      getValueTone: (record) => (record.customerHref ? 'accent' : 'default'),
    },
    {
      id: 'validUntil',
      label: 'Valid Until',
      getValue: (record) => (record.validUntil ? fmtDocumentDate(record.validUntil, record.moneySettings) : '-'),
    },
    {
      id: 'opportunityId',
      label: 'Opportunity Id',
      getValue: (record) => record.opportunityId ?? '-',
      getHref: (record) => record.opportunityHref,
      getValueTone: (record) => (record.opportunityHref ? 'accent' : 'default'),
    },
    {
      id: 'lineCount',
      label: 'Quote Lines',
      getValue: (record) => record.lineCount,
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) => record.statusTone ?? 'default',
    },
  ],
}
