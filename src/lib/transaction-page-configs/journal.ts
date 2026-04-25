import { fmtCurrency } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type JournalPageConfigRecord = {
  totalDebits: number
  totalCredits: number
  balance: number
  lineCount: number
  lineSummary: string
  sourceId: string | null
  sourceHref: string | null
  statusLabel: string
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const journalPageConfig: TransactionPageConfig<JournalPageConfigRecord> = {
  sectionDescriptions: {
    'Journal Entry': 'Core journal header information and posting context.',
    'Source And Approval': 'Reference source and approval ownership for the journal entry.',
  },
  stats: [
    {
      id: 'totalDebits',
      label: 'Total Debits',
      accent: true,
      getValue: (record) => fmtCurrency(record.totalDebits, undefined, record.moneySettings),
    },
    {
      id: 'totalCredits',
      label: 'Total Credits',
      accent: 'teal',
      getValue: (record) => fmtCurrency(record.totalCredits, undefined, record.moneySettings),
    },
    {
      id: 'balance',
      label: 'Balance',
      getValue: (record) => fmtCurrency(record.balance, undefined, record.moneySettings),
      getValueTone: (record) => (Math.abs(record.balance) < 0.00001 ? 'green' : 'red'),
    },
    {
      id: 'journalLines',
      label: 'Journal Lines',
      getValue: (record) => record.lineSummary || String(record.lineCount),
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) =>
        record.statusLabel.toLowerCase() === 'posted'
          ? 'green'
          : record.statusLabel.toLowerCase() === 'approved'
            ? 'accent'
            : record.statusLabel.toLowerCase() === 'rejected'
              ? 'red'
              : 'default',
    },
    {
      id: 'sourceId',
      label: 'Source Id',
      getValue: (record) => record.sourceId ?? '-',
      getHref: (record) => record.sourceHref,
    },
  ],
}
