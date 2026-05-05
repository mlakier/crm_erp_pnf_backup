import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'

export type JournalDetailFieldKey =
  | 'number'
  | 'date'
  | 'description'
  | 'status'
  | 'isOpenItemRelevant'
  | 'subsidiaryId'
  | 'currencyId'
  | 'accountingPeriodId'
  | 'journalType'
  | 'total'
  | 'sourceType'
  | 'sourceId'
  | 'reversesJournalEntryId'
  | 'reversalReasonCode'
  | 'userId'
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

export type JournalLineColumnKey =
  | 'line'
  | 'accountId'
  | 'activityTypeCode'
  | 'description'
  | 'debit'
  | 'credit'
  | 'localDebit'
  | 'localCredit'
  | 'functionalDebit'
  | 'functionalCredit'
  | 'groupDebit'
  | 'groupCredit'
  | 'subsidiaryId'
  | 'departmentId'
  | 'locationId'
  | 'projectId'
  | 'customerId'
  | 'vendorId'
  | 'itemId'
  | 'employeeId'
  | 'settlesOpenItemId'
  | 'memo'

export type JournalGlImpactColumnKey =
  | 'line'
  | 'accountId'
  | 'description'
  | 'subsidiaryId'
  | 'departmentId'
  | 'locationId'
  | 'projectId'
  | 'customerId'
  | 'vendorId'
  | 'itemId'
  | 'employeeId'
  | 'debit'
  | 'credit'
  | 'localDebit'
  | 'localCredit'
  | 'functionalDebit'
  | 'functionalCredit'
  | 'groupDebit'
  | 'groupCredit'

export type JournalStatCardSlot = TransactionStatCardSlot<JournalStatCardKey>

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

export type JournalLineColumnMeta = {
  id: JournalLineColumnKey
  label: string
  description?: string
}

export type JournalLineFontSize = 'xs' | 'sm'

export type JournalLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type JournalLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type JournalLineDropdownSortMode = 'id' | 'label'

export type JournalLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: JournalLineWidthMode
  editDisplay: JournalLineDisplayMode
  viewDisplay: JournalLineDisplayMode
  dropdownDisplay: JournalLineDisplayMode
  dropdownSort: JournalLineDropdownSortMode
}

export type JournalLineSettings = {
  fontSize: JournalLineFontSize
}

export type JournalGlImpactColumnCustomization = {
  visible: boolean
  order: number
  widthMode: JournalLineWidthMode
  viewDisplay: JournalLineDisplayMode
}

export type JournalGlImpactSettings = {
  fontSize: JournalLineFontSize
}

export type JournalGlImpactColumnMeta = {
  id: JournalGlImpactColumnKey
  label: string
  description?: string
}

export type JournalDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<JournalDetailFieldKey, JournalDetailFieldCustomization>
  lineSettings: JournalLineSettings
  lineColumns: Record<JournalLineColumnKey, JournalLineColumnCustomization>
  glImpactSettings: JournalGlImpactSettings
  glImpactColumns: Record<JournalGlImpactColumnKey, JournalGlImpactColumnCustomization>
  statCards: JournalStatCardSlot[]
}

export const JOURNAL_DETAIL_FIELDS: JournalDetailFieldMeta[] = [
  { id: 'number', label: 'Journal Id', fieldType: 'text', description: 'Unique journal identifier.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Posting date for the journal entry.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Header description for the journal entry.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Journal status list', description: 'Current lifecycle stage of the journal.' },
  { id: 'isOpenItemRelevant', label: 'Open Item Relevant', fieldType: 'checkbox', description: 'Determines whether this posted journal should participate in open item management.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Default subsidiary context for the journal.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Currency used for the journal header total display.' },
  { id: 'accountingPeriodId', label: 'Accounting Period', fieldType: 'list', source: 'Accounting periods', description: 'Accounting period that owns the journal.' },
  { id: 'journalType', label: 'Journal Type', fieldType: 'text', description: 'Standard or intercompany journal classification.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Persisted journal total stored on the journal header.' },
  { id: 'sourceType', label: 'Source Type', fieldType: 'list', source: 'Journal source type list', description: 'Origin or purpose classification for the journal.' },
  { id: 'sourceId', label: 'Source Id', fieldType: 'text', description: 'Identifier from the originating source record.' },
  { id: 'reversesJournalEntryId', label: 'Reverses Journal', fieldType: 'list', source: 'Journal entries', description: 'Original journal entry that this journal is intended to reverse.' },
  { id: 'reversalReasonCode', label: 'Reversal Reason', fieldType: 'text', description: 'Reason or explanation for the reversal relationship.' },
  { id: 'userId', label: 'Created By', fieldType: 'list', source: 'Users', description: 'User account that created the journal entry.' },
  { id: 'postedByEmployeeId', label: 'Prepared By', fieldType: 'list', source: 'Employees master data', description: 'Employee that prepared the journal.' },
  { id: 'approvedByEmployeeId', label: 'Approved By', fieldType: 'list', source: 'Employees master data', description: 'Employee that approved the journal.' },
  { id: 'createdAt', label: 'Date Created', fieldType: 'date', description: 'Timestamp when the journal was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Timestamp of the most recent journal update.' },
]

export const DEFAULT_JOURNAL_DETAIL_SECTIONS = [
  'Document Identity',
  'Posting & Financials',
  'Source & Approval',
  'System Dates',
] as const

export const JOURNAL_STAT_CARDS: Array<{ id: JournalStatCardKey; label: string }> = [
  { id: 'totalDebits', label: 'Total Debits' },
  { id: 'totalCredits', label: 'Total Credits' },
  { id: 'balance', label: 'Balance' },
  { id: 'journalLines', label: 'Journal Lines' },
  { id: 'status', label: 'Status' },
  { id: 'sourceId', label: 'Source Id' },
]

export const JOURNAL_LINE_COLUMNS: JournalLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Row number for each journal line.' },
  { id: 'accountId', label: 'GL Account', description: 'Posting account for the journal line.' },
  { id: 'activityTypeCode', label: 'Activity Type', description: 'Accounting movement classification used for rollforwards and downstream reporting.' },
  { id: 'description', label: 'Description', description: 'Line description shown on the journal entry.' },
  { id: 'debit', label: 'Debit', description: 'Debit amount for the journal line.' },
  { id: 'credit', label: 'Credit', description: 'Credit amount for the journal line.' },
  { id: 'localDebit', label: 'Local Debit', description: 'Local-currency debit amount on the journal line.' },
  { id: 'localCredit', label: 'Local Credit', description: 'Local-currency credit amount on the journal line.' },
  { id: 'functionalDebit', label: 'Functional Debit', description: 'Functional-currency debit amount on the journal line.' },
  { id: 'functionalCredit', label: 'Functional Credit', description: 'Functional-currency credit amount on the journal line.' },
  { id: 'groupDebit', label: 'Group Debit', description: 'Group-currency debit amount on the journal line.' },
  { id: 'groupCredit', label: 'Group Credit', description: 'Group-currency credit amount on the journal line.' },
  { id: 'subsidiaryId', label: 'Subsidiary', description: 'Intercompany subsidiary assigned to the line.' },
  { id: 'departmentId', label: 'Department', description: 'Department classification on the line.' },
  { id: 'locationId', label: 'Location', description: 'Location classification on the line.' },
  { id: 'projectId', label: 'Project', description: 'Project associated with the line.' },
  { id: 'customerId', label: 'Customer', description: 'Customer associated with the line.' },
  { id: 'vendorId', label: 'Vendor', description: 'Vendor associated with the line.' },
  { id: 'itemId', label: 'Item', description: 'Item associated with the line.' },
  { id: 'employeeId', label: 'Employee', description: 'Employee associated with the line.' },
  { id: 'settlesOpenItemId', label: 'Settles Open Item', description: 'Open item this journal line should settle when posted.' },
  { id: 'memo', label: 'Memo', description: 'Internal memo stored on the journal line.' },
] as const

export const JOURNAL_GL_IMPACT_COLUMNS: JournalGlImpactColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Row number for each GL impact line.' },
  { id: 'accountId', label: 'Account', description: 'Posting account impacted by the journal line.' },
  { id: 'description', label: 'Description', description: 'Line description or memo contributing to the impact.' },
  { id: 'subsidiaryId', label: 'Subsidiary', description: 'Subsidiary context for the GL impact row.' },
  { id: 'departmentId', label: 'Department', description: 'Department classification on the GL impact row.' },
  { id: 'locationId', label: 'Location', description: 'Location classification on the GL impact row.' },
  { id: 'projectId', label: 'Project', description: 'Project associated with the GL impact row.' },
  { id: 'customerId', label: 'Customer', description: 'Customer associated with the GL impact row.' },
  { id: 'vendorId', label: 'Vendor', description: 'Vendor associated with the GL impact row.' },
  { id: 'itemId', label: 'Item', description: 'Item associated with the GL impact row.' },
  { id: 'employeeId', label: 'Employee', description: 'Employee associated with the GL impact row.' },
  { id: 'debit', label: 'Debit', description: 'Debit amount posted by the GL impact row.' },
  { id: 'credit', label: 'Credit', description: 'Credit amount posted by the GL impact row.' },
  { id: 'localDebit', label: 'Local Debit', description: 'Local-currency debit amount posted by the GL impact row.' },
  { id: 'localCredit', label: 'Local Credit', description: 'Local-currency credit amount posted by the GL impact row.' },
  { id: 'functionalDebit', label: 'Functional Debit', description: 'Functional-currency debit amount posted by the GL impact row.' },
  { id: 'functionalCredit', label: 'Functional Credit', description: 'Functional-currency credit amount posted by the GL impact row.' },
  { id: 'groupDebit', label: 'Group Debit', description: 'Group-currency debit amount posted by the GL impact row.' },
  { id: 'groupCredit', label: 'Group Credit', description: 'Group-currency credit amount posted by the GL impact row.' },
] as const

export const DEFAULT_JOURNAL_STAT_CARD_METRICS: JournalStatCardKey[] = [
  'totalDebits',
  'totalCredits',
  'balance',
  'journalLines',
]

const DEFAULT_JOURNAL_LINE_WIDTHS: Record<JournalLineColumnKey, JournalLineWidthMode> = {
  line: 'compact',
  accountId: 'wide',
  activityTypeCode: 'normal',
  description: 'normal',
  debit: 'normal',
  credit: 'normal',
  localDebit: 'normal',
  localCredit: 'normal',
  functionalDebit: 'normal',
  functionalCredit: 'normal',
  groupDebit: 'normal',
  groupCredit: 'normal',
  subsidiaryId: 'normal',
  departmentId: 'compact',
  locationId: 'compact',
  projectId: 'compact',
  customerId: 'normal',
  vendorId: 'normal',
  itemId: 'normal',
  employeeId: 'normal',
  settlesOpenItemId: 'wide',
  memo: 'normal',
}

const DEFAULT_JOURNAL_LINE_EDIT_DISPLAY: Record<JournalLineColumnKey, JournalLineDisplayMode> = {
  line: 'label',
  accountId: 'idAndLabel',
  activityTypeCode: 'label',
  description: 'label',
  debit: 'label',
  credit: 'label',
  localDebit: 'label',
  localCredit: 'label',
  functionalDebit: 'label',
  functionalCredit: 'label',
  groupDebit: 'label',
  groupCredit: 'label',
  subsidiaryId: 'label',
  departmentId: 'label',
  locationId: 'label',
  projectId: 'label',
  customerId: 'label',
  vendorId: 'label',
  itemId: 'label',
  employeeId: 'label',
  settlesOpenItemId: 'label',
  memo: 'label',
}

const DEFAULT_JOURNAL_LINE_VIEW_DISPLAY: Record<JournalLineColumnKey, JournalLineDisplayMode> = {
  ...DEFAULT_JOURNAL_LINE_EDIT_DISPLAY,
}

const DEFAULT_JOURNAL_LINE_DROPDOWN_DISPLAY: Record<JournalLineColumnKey, JournalLineDisplayMode> = {
  ...DEFAULT_JOURNAL_LINE_EDIT_DISPLAY,
}

const DEFAULT_JOURNAL_LINE_DROPDOWN_SORT: Record<JournalLineColumnKey, JournalLineDropdownSortMode> = {
  line: 'id',
  accountId: 'id',
  activityTypeCode: 'label',
  description: 'label',
  debit: 'id',
  credit: 'id',
  localDebit: 'id',
  localCredit: 'id',
  functionalDebit: 'id',
  functionalCredit: 'id',
  groupDebit: 'id',
  groupCredit: 'id',
  subsidiaryId: 'id',
  departmentId: 'id',
  locationId: 'id',
  projectId: 'label',
  customerId: 'id',
  vendorId: 'id',
  itemId: 'id',
  employeeId: 'id',
  settlesOpenItemId: 'id',
  memo: 'label',
}

const DEFAULT_JOURNAL_GL_IMPACT_WIDTHS: Record<JournalGlImpactColumnKey, JournalLineWidthMode> = {
  line: 'compact',
  accountId: 'wide',
  description: 'wide',
  subsidiaryId: 'normal',
  departmentId: 'compact',
  locationId: 'compact',
  projectId: 'normal',
  customerId: 'wide',
  vendorId: 'wide',
  itemId: 'wide',
  employeeId: 'normal',
  debit: 'normal',
  credit: 'normal',
  localDebit: 'normal',
  localCredit: 'normal',
  functionalDebit: 'normal',
  functionalCredit: 'normal',
  groupDebit: 'normal',
  groupCredit: 'normal',
}

const DEFAULT_JOURNAL_GL_IMPACT_VIEW_DISPLAY: Record<JournalGlImpactColumnKey, JournalLineDisplayMode> = {
  line: 'label',
  accountId: 'idAndLabel',
  description: 'label',
  subsidiaryId: 'idAndLabel',
  departmentId: 'idAndLabel',
  locationId: 'idAndLabel',
  projectId: 'idAndLabel',
  customerId: 'idAndLabel',
  vendorId: 'idAndLabel',
  itemId: 'idAndLabel',
  employeeId: 'idAndLabel',
  debit: 'label',
  credit: 'label',
  localDebit: 'label',
  localCredit: 'label',
  functionalDebit: 'label',
  functionalCredit: 'label',
  groupDebit: 'label',
  groupCredit: 'label',
}

export function defaultJournalDetailCustomization(): JournalDetailCustomizationConfig {
  const sectionMap: Record<JournalDetailFieldKey, string> = {
    number: 'Document Identity',
    description: 'Document Identity',
    journalType: 'Document Identity',
    date: 'Posting & Financials',
    status: 'Posting & Financials',
    isOpenItemRelevant: 'Posting & Financials',
    subsidiaryId: 'Posting & Financials',
    currencyId: 'Posting & Financials',
    accountingPeriodId: 'Posting & Financials',
    total: 'Posting & Financials',
    sourceType: 'Source & Approval',
    sourceId: 'Source & Approval',
    reversesJournalEntryId: 'Source & Approval',
    reversalReasonCode: 'Source & Approval',
    userId: 'Source & Approval',
    postedByEmployeeId: 'Source & Approval',
    approvedByEmployeeId: 'Source & Approval',
    createdAt: 'System Dates',
    updatedAt: 'System Dates',
  }

  const columnMap: Record<JournalDetailFieldKey, number> = {
    number: 1,
    description: 2,
    journalType: 3,
    date: 1,
    status: 2,
    isOpenItemRelevant: 3,
    subsidiaryId: 3,
    currencyId: 4,
    accountingPeriodId: 1,
    total: 2,
    sourceType: 1,
    sourceId: 2,
    reversesJournalEntryId: 3,
    reversalReasonCode: 4,
    userId: 1,
    postedByEmployeeId: 2,
    approvedByEmployeeId: 4,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<JournalDetailFieldKey, number> = {
    number: 0,
    description: 0,
    journalType: 0,
    date: 0,
    status: 0,
    isOpenItemRelevant: 1,
    subsidiaryId: 0,
    currencyId: 0,
    accountingPeriodId: 1,
    total: 1,
    sourceType: 0,
    sourceId: 0,
    reversesJournalEntryId: 0,
    reversalReasonCode: 0,
    userId: 1,
    postedByEmployeeId: 1,
    approvedByEmployeeId: 1,
    createdAt: 0,
    updatedAt: 0,
  }

  return {
    formColumns: 4,
    sections: [...DEFAULT_JOURNAL_DETAIL_SECTIONS],
    sectionRows: {
      'Document Identity': 1,
      'Posting & Financials': 2,
      'Source & Approval': 1,
      'System Dates': 1,
    },
    lineSettings: {
      fontSize: 'xs',
    },
    glImpactSettings: {
      fontSize: 'xs',
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
    lineColumns: Object.fromEntries(
      JOURNAL_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_JOURNAL_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_JOURNAL_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_JOURNAL_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_JOURNAL_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_JOURNAL_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as Record<JournalLineColumnKey, JournalLineColumnCustomization>,
    glImpactColumns: Object.fromEntries(
      JOURNAL_GL_IMPACT_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_JOURNAL_GL_IMPACT_WIDTHS[column.id],
          viewDisplay: DEFAULT_JOURNAL_GL_IMPACT_VIEW_DISPLAY[column.id],
        },
      ]),
    ) as Record<JournalGlImpactColumnKey, JournalGlImpactColumnCustomization>,
    statCards: DEFAULT_JOURNAL_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
