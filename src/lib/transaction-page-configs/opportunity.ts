import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig, TransactionVisualTone } from '@/lib/transaction-page-config'

export type OpportunityPageConfigRecord = {
  amount: number
  currencyCode?: string | null
  closeDate: Date | null
  lineCount: number
  stageLabel: string
  stageTone?: TransactionVisualTone
  quoteNumber: string | null
  quoteHref: string | null
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const opportunityPageConfig: TransactionPageConfig<OpportunityPageConfigRecord> = {
  sectionDescriptions: {
    'Document Identity': 'Opportunity numbering, naming, and source-document context for this pipeline record.',
    'Customer Snapshot': 'Primary customer context captured directly on the opportunity detail page.',
    'Pipeline & Forecast': 'Stage, amount, probability, and expected close timing for this opportunity.',
    'Commercial Context': 'Subsidiary and currency context for this opportunity.',
    'Record Keys': 'Internal identifiers and ownership keys tied to this opportunity.',
    'System Dates': 'System-managed timestamps for this opportunity record.',
  },
  stats: [
    {
      id: 'amount',
      label: 'Amount',
      accent: true,
      getValue: (record) => fmtCurrency(record.amount, record.currencyCode ?? undefined, record.moneySettings),
    },
    {
      id: 'closeDate',
      label: 'Close Date',
      getValue: (record) => (record.closeDate ? fmtDocumentDate(record.closeDate, record.moneySettings) : '-'),
    },
    {
      id: 'lineCount',
      label: 'Line Items',
      getValue: (record) => record.lineCount,
    },
    {
      id: 'quoteNumber',
      label: 'Quote',
      getValue: (record) => record.quoteNumber ?? '-',
      getHref: (record) => record.quoteHref,
      getValueTone: (record) => (record.quoteHref ? 'accent' : 'default'),
    },
    {
      id: 'stage',
      label: 'Stage',
      getValue: (record) => record.stageLabel,
      getValueTone: (record) => record.stageTone ?? 'default',
    },
  ],
}
