export type TransactionGlImpactColumnKey =
  | 'date'
  | 'journalNumber'
  | 'sourceType'
  | 'sourceNumber'
  | 'account'
  | 'description'
  | 'debit'
  | 'credit'
  | 'txnAmount'
  | 'localAmount'
  | 'functionalAmount'
  | 'groupAmount'

export type TransactionGlImpactFontSize = 'xs' | 'sm'
export type TransactionGlImpactWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type TransactionGlImpactSettings = {
  fontSize: TransactionGlImpactFontSize
}

export type TransactionGlImpactColumnCustomization = {
  visible: boolean
  order: number
  widthMode: TransactionGlImpactWidthMode
}

export type TransactionGlImpactColumnMeta = {
  id: TransactionGlImpactColumnKey
  label: string
  description?: string
}

export type TransactionGlImpactRow = {
  id: string
  date: string
  journalNumber: string
  sourceType: string
  sourceNumber: string
  account: string
  description: string
  debit: number
  credit: number
  txnAmount: number
  localAmount: number
  functionalAmount: number
  groupAmount: number
}

export const TRANSACTION_GL_IMPACT_COLUMNS: TransactionGlImpactColumnMeta[] = [
  { id: 'date', label: 'Date', description: 'Posting date of the journal entry line.' },
  { id: 'journalNumber', label: 'Journal #', description: 'Journal entry number that posted the impact.' },
  { id: 'sourceType', label: 'Source', description: 'Source document type for the posted entry.' },
  { id: 'sourceNumber', label: 'Source Txn', description: 'Source transaction number for the posted entry.' },
  { id: 'account', label: 'Account', description: 'GL account impacted by the posting.' },
  { id: 'description', label: 'Description', description: 'Posted line description or memo.' },
  { id: 'debit', label: 'Debit', description: 'Debit amount posted by the entry.' },
  { id: 'credit', label: 'Credit', description: 'Credit amount posted by the entry.' },
  { id: 'txnAmount', label: 'TXN Amount', description: 'Signed transaction-currency amount for the posted line.' },
  { id: 'localAmount', label: 'Local Amount', description: 'Signed local-currency amount for the posted line.' },
  { id: 'functionalAmount', label: 'Functional Amount', description: 'Signed functional-currency amount for the posted line.' },
  { id: 'groupAmount', label: 'Group Amount', description: 'Signed group-currency amount for the posted line.' },
]

export const TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY = Object.fromEntries(
  TRANSACTION_GL_IMPACT_COLUMNS.map((column) => [column.id, ['widthMode']]),
) as Record<TransactionGlImpactColumnKey, string[]>

const DEFAULT_TRANSACTION_GL_IMPACT_WIDTHS: Record<
  TransactionGlImpactColumnKey,
  TransactionGlImpactWidthMode
> = {
  date: 'normal',
  journalNumber: 'normal',
  sourceType: 'normal',
  sourceNumber: 'normal',
  account: 'wide',
  description: 'wide',
  debit: 'normal',
  credit: 'normal',
  txnAmount: 'normal',
  localAmount: 'normal',
  functionalAmount: 'normal',
  groupAmount: 'normal',
}

export function defaultTransactionGlImpactSettings(): TransactionGlImpactSettings {
  return { fontSize: 'xs' }
}

export function defaultTransactionGlImpactColumns(): Record<
  TransactionGlImpactColumnKey,
  TransactionGlImpactColumnCustomization
> {
  return Object.fromEntries(
    TRANSACTION_GL_IMPACT_COLUMNS.map((column, index) => [
      column.id,
      {
        visible:
          column.id === 'localAmount' ||
          column.id === 'functionalAmount' ||
          column.id === 'groupAmount'
            ? false
            : true,
        order: index,
        widthMode: DEFAULT_TRANSACTION_GL_IMPACT_WIDTHS[column.id],
      },
    ]),
  ) as Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
}

export function getOrderedVisibleTransactionGlImpactColumns(
  columnDefinitions: readonly TransactionGlImpactColumnMeta[],
  columnCustomization?: Partial<Record<TransactionGlImpactColumnKey, Partial<TransactionGlImpactColumnCustomization>>>,
) {
  return [...columnDefinitions]
    .filter((column) => (columnCustomization?.[column.id]?.visible ?? true) !== false)
    .sort(
      (left, right) =>
        (columnCustomization?.[left.id]?.order ?? 0) -
        (columnCustomization?.[right.id]?.order ?? 0),
    )
}
