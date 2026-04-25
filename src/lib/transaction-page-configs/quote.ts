import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type QuotePageConfigRecord = {
  customerId: string | null
  customerHref: string | null
  opportunityId: string | null
  opportunityHref: string | null
  total: number
  validUntil: Date | null
  lineCount: number
  statusLabel: string
  statusTone?: 'default' | 'accent' | 'teal' | 'yellow' | 'green' | 'red'
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const quotePageConfig: TransactionPageConfig<QuotePageConfigRecord> = {
  sectionDescriptions: {
    Customer: 'Customer contact and default commercial context from the linked master data record.',
    'Quote Details': 'Core quote fields, upstream opportunity context, and commercial controls.',
  },
  stats: [
    {
      id: 'total',
      label: 'Quote Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, undefined, record.moneySettings),
    },
    {
      id: 'customerId',
      label: 'Customer Id',
      getValue: (record) => record.customerId ?? '-',
      getHref: (record) => record.customerHref,
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
