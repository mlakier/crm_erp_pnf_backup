import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { TransactionPageConfig, TransactionVisualTone } from '@/lib/transaction-page-config'

export type LeadPageConfigRecord = {
  statusLabel: string
  statusTone?: TransactionVisualTone
  company: string | null
  source: string | null
  expectedValue: number
  currencyCode?: string | null
  createdAt: string
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const leadPageConfig: TransactionPageConfig<LeadPageConfigRecord> = {
  sectionDescriptions: {
    'Primary Contact': 'Name, title, email, and phone details for the primary lead contact.',
    'Company Information': 'Company-level context, website, industry, address, and notes for this lead.',
    Qualification: 'Status, source, rating, value, ownership, currency, and qualification dates for this lead.',
    'System Information': 'Lead identifiers, creator, and system-managed timestamps or state.',
  },
  stats: [
    {
      id: 'company',
      label: 'Company',
      getValue: (record) => record.company ?? '-',
    },
    {
      id: 'source',
      label: 'Source',
      getValue: (record) => record.source ?? '-',
    },
    {
      id: 'expectedValue',
      label: 'Expected Value',
      accent: true,
      getValue: (record) => fmtCurrency(record.expectedValue, record.currencyCode ?? undefined, record.moneySettings),
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) => record.statusTone ?? 'default',
    },
    {
      id: 'createdAt',
      label: 'Created',
      getValue: (record) => record.createdAt ? record.createdAt : fmtDocumentDate(new Date(), record.moneySettings),
    },
  ],
}
