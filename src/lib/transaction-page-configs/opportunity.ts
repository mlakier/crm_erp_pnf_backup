import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type OpportunityPageConfigRecord = {
  amount: number
  closeDate: Date | null
  lineCount: number
  stageLabel: string
  stageTone?: 'default' | 'accent' | 'teal' | 'yellow' | 'green' | 'red'
  quoteNumber: string | null
  quoteHref: string | null
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const opportunityPageConfig: TransactionPageConfig<OpportunityPageConfigRecord> = {
  sectionDescriptions: {
    Customer: 'Customer context from the linked master data record.',
    'Opportunity Details': 'Core opportunity fields, stage context, and forecast controls.',
  },
  stats: [
    {
      id: 'amount',
      label: 'Amount',
      accent: true,
      getValue: (record) => fmtCurrency(record.amount, undefined, record.moneySettings),
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
    },
    {
      id: 'stage',
      label: 'Stage',
      getValue: (record) => record.stageLabel,
      getValueTone: (record) => record.stageTone ?? 'default',
    },
  ],
}
