import { deriveDefaultRollforwardMovementBucketForActivityType, type RollforwardMovementBucket } from './rollforward-movement-buckets'

export type AccountingActivityTypeOption = {
  value: string
  label: string
  description: string
  defaultMovementBucket?: RollforwardMovementBucket
}

export const ACCOUNTING_ACTIVITY_TYPE_OPTIONS: AccountingActivityTypeOption[] = [
  { value: 'ar_addition', label: 'AR Addition', description: 'Adds to accounts receivable.' },
  { value: 'ar_settlement', label: 'AR Settlement', description: 'Reduces or settles accounts receivable.' },
  { value: 'ap_addition', label: 'AP Addition', description: 'Adds to accounts payable.' },
  { value: 'ap_settlement', label: 'AP Settlement', description: 'Reduces or settles accounts payable.' },
  { value: 'cash_receipt', label: 'Cash Receipt', description: 'Records receipt of cash or bank funds.' },
  { value: 'cash_disbursement', label: 'Cash Disbursement', description: 'Records payment or cash outflow.' },
  { value: 'revenue_recognition', label: 'Revenue Recognition', description: 'Recognizes revenue into the income statement.' },
  { value: 'deferred_revenue_addition', label: 'Deferred Revenue Addition', description: 'Adds to deferred revenue balances.' },
  { value: 'expense_recognition', label: 'Expense Recognition', description: 'Recognizes expense into the income statement.' },
  { value: 'prepaid_addition', label: 'Prepaid Addition', description: 'Adds to prepaid or deferred cost balances.' },
  { value: 'fx_realized_gain', label: 'FX Realized Gain', description: 'Realized foreign exchange gain on settlement.' },
  { value: 'fx_realized_loss', label: 'FX Realized Loss', description: 'Realized foreign exchange loss on settlement.' },
  { value: 'fx_unrealized_revaluation', label: 'FX Unrealized Revaluation', description: 'Period-end unrealized FX remeasurement.' },
  { value: 'accrual_build', label: 'Accrual Build', description: 'Builds an accrual balance.' },
  { value: 'accrual_release', label: 'Accrual Release', description: 'Releases or reverses an accrual balance.' },
  { value: 'reclass', label: 'Reclass', description: 'Moves balance between accounts without changing net position.' },
  { value: 'amortization_release', label: 'Amortization Release', description: 'Releases deferred cost or prepaid balances over time.' },
  { value: 'depreciation_expense', label: 'Depreciation Expense', description: 'Recognizes depreciation.' },
  { value: 'reserve_build', label: 'Reserve Build', description: 'Builds a reserve or allowance balance.' },
  { value: 'reserve_release', label: 'Reserve Release', description: 'Releases or reverses a reserve or allowance.' },
  { value: 'open_item_clearing', label: 'Open Item Clearing', description: 'Clears open item positions without separate settlement cash flow.' },
  { value: 'manual_adjustment', label: 'Manual Adjustment', description: 'General manual adjustment when no more specific movement applies.' },
]

export function getAccountingActivityTypeOptions() {
  return ACCOUNTING_ACTIVITY_TYPE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    defaultMovementBucket: option.defaultMovementBucket ?? deriveDefaultRollforwardMovementBucketForActivityType(option.value),
  }))
}

function includesKeyword(value: string | null | undefined, keyword: string) {
  return String(value ?? '').trim().toLowerCase().includes(keyword)
}

export function deriveManualJournalActivityType(args: {
  journalType?: string | null
  sourceType?: string | null
}) {
  const sourceType = String(args.sourceType ?? '').trim().toLowerCase()
  const journalType = String(args.journalType ?? '').trim().toLowerCase()

  if (includesKeyword(sourceType, 'accrual reversal') || includesKeyword(sourceType, 'reversal')) {
    return 'accrual_release'
  }
  if (includesKeyword(sourceType, 'accrual')) return 'accrual_build'
  if (includesKeyword(sourceType, 'amort')) return 'amortization_release'
  if (includesKeyword(sourceType, 'depreci')) return 'depreciation_expense'
  if (includesKeyword(sourceType, 'reserve release')) return 'reserve_release'
  if (includesKeyword(sourceType, 'reserve')) return 'reserve_build'
  if (includesKeyword(sourceType, 'reclass')) return 'reclass'
  if (includesKeyword(sourceType, 'revaluation') || includesKeyword(journalType, 'fx_revaluation')) {
    return 'fx_unrealized_revaluation'
  }
  return 'manual_adjustment'
}

export function deriveRealizedFxActivityType(amount: number) {
  return amount >= 0 ? 'fx_realized_gain' : 'fx_realized_loss'
}
