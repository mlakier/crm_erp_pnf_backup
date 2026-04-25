export type JournalDetailFieldKey =
  | 'number'
  | 'date'
  | 'description'
  | 'status'
  | 'subsidiaryId'
  | 'currencyId'
  | 'accountingPeriodId'
  | 'journalType'
  | 'computedTotal'
  | 'sourceType'
  | 'sourceId'
  | 'postedByEmployeeId'
  | 'approvedByEmployeeId'
  | 'createdAt'
  | 'updatedAt'

export type JournalStatCardKey =
  | 'totalDebits'
  | 'totalCredits'
  | 'balance'
  | 'journalLines'
  | 'status'
  | 'sourceId'

export type JournalStatCardSlot = {
  id: string
  metric: JournalStatCardKey
  visible: boolean
  order: number
}

export type JournalDetailFieldMeta = {
  id: JournalDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type JournalDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type JournalDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<JournalDetailFieldKey, JournalDetailFieldCustomization>
  statCards: JournalStatCardSlot[]
}

export const JOURNAL_DETAIL_FIELDS: JournalDetailFieldMeta[] = [
  { id: 'number', label: 'Journal Id', fieldType: 'text', description: 'Unique journal identifier.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Posting date for the journal entry.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Header description for the journal entry.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Journal status list', description: 'Current lifecycle stage of the journal.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Default subsidiary context for the journal.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Currency used for the journal header total display.' },
  { id: 'accountingPeriodId', label: 'Accounting Period', fieldType: 'list', source: 'Accounting periods', description: 'Accounting period that owns the journal.' },
  { id: 'journalType', label: 'Journal Type', fieldType: 'text', description: 'Standard or intercompany journal classification.' },
  { id: 'computedTotal', label: 'Total', fieldType: 'currency', description: 'Balanced total based on journal debits.' },
  { id: 'sourceType', label: 'Source Type', fieldType: 'list', source: 'Journal source type list', description: 'Origin or purpose classification for the journal.' },
  { id: 'sourceId', label: 'Source Id', fieldType: 'text', description: 'Identifier from the originating source record.' },
  { id: 'postedByEmployeeId', label: 'Prepared By', fieldType: 'list', source: 'Employees master data', description: 'Employee that prepared the journal.' },
  { id: 'approvedByEmployeeId', label: 'Approved By', fieldType: 'list', source: 'Employees master data', description: 'Employee that approved the journal.' },
  { id: 'createdAt', label: 'Date Created', fieldType: 'date', description: 'Timestamp when the journal was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Timestamp of the most recent journal update.' },
]

export const DEFAULT_JOURNAL_DETAIL_SECTIONS = ['Journal Entry', 'Source And Approval'] as const

export const JOURNAL_STAT_CARDS: Array<{ id: JournalStatCardKey; label: string }> = [
  { id: 'totalDebits', label: 'Total Debits' },
  { id: 'totalCredits', label: 'Total Credits' },
  { id: 'balance', label: 'Balance' },
  { id: 'journalLines', label: 'Journal Lines' },
  { id: 'status', label: 'Status' },
  { id: 'sourceId', label: 'Source Id' },
]

export const DEFAULT_JOURNAL_STAT_CARD_METRICS: JournalStatCardKey[] = [
  'totalDebits',
  'totalCredits',
  'balance',
  'journalLines',
]

export function defaultJournalDetailCustomization(): JournalDetailCustomizationConfig {
  const sectionMap: Record<JournalDetailFieldKey, string> = {
    number: 'Journal Entry',
    date: 'Journal Entry',
    description: 'Journal Entry',
    status: 'Journal Entry',
    subsidiaryId: 'Journal Entry',
    currencyId: 'Journal Entry',
    accountingPeriodId: 'Journal Entry',
    journalType: 'Journal Entry',
    computedTotal: 'Journal Entry',
    sourceType: 'Source And Approval',
    sourceId: 'Source And Approval',
    postedByEmployeeId: 'Source And Approval',
    approvedByEmployeeId: 'Source And Approval',
    createdAt: 'Source And Approval',
    updatedAt: 'Source And Approval',
  }

  const columnMap: Record<JournalDetailFieldKey, number> = {
    number: 1,
    date: 1,
    description: 1,
    status: 2,
    subsidiaryId: 2,
    currencyId: 2,
    accountingPeriodId: 3,
    journalType: 3,
    computedTotal: 4,
    sourceType: 1,
    sourceId: 1,
    postedByEmployeeId: 2,
    approvedByEmployeeId: 2,
    createdAt: 3,
    updatedAt: 3,
  }

  const rowMap: Record<JournalDetailFieldKey, number> = {
    number: 0,
    date: 1,
    description: 2,
    status: 0,
    subsidiaryId: 1,
    currencyId: 2,
    accountingPeriodId: 0,
    journalType: 2,
    computedTotal: 0,
    sourceType: 0,
    sourceId: 1,
    postedByEmployeeId: 0,
    approvedByEmployeeId: 1,
    createdAt: 0,
    updatedAt: 1,
  }

  return {
    formColumns: 4,
    sections: [...DEFAULT_JOURNAL_DETAIL_SECTIONS],
    sectionRows: {
      'Journal Entry': 3,
      'Source And Approval': 2,
    },
    fields: Object.fromEntries(
      JOURNAL_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<JournalDetailFieldKey, JournalDetailFieldCustomization>,
    statCards: DEFAULT_JOURNAL_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
