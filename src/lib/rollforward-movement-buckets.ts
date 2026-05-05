export type RollforwardMovementBucket =
  | 'opening_balance'
  | 'additions'
  | 'releases'
  | 'settlements'
  | 'writeoffs'
  | 'reversals'
  | 'reclassifications'
  | 'realized_fx'
  | 'unrealized_fx'
  | 'translation'
  | 'cta'
  | 'other_activity'
  | 'closing_balance'

export const ROLLFORWARD_MOVEMENT_BUCKET_OPTIONS: Array<{
  value: RollforwardMovementBucket
  label: string
  description: string
}> = [
  { value: 'opening_balance', label: 'Opening Balance', description: 'Beginning balance carried into the period.' },
  { value: 'additions', label: 'Additions', description: 'New activity that increases the tracked balance.' },
  { value: 'releases', label: 'Releases', description: 'Recognition or release activity that reduces the tracked balance.' },
  { value: 'settlements', label: 'Settlements', description: 'Cash, clearing, or other settlement activity against the balance.' },
  { value: 'writeoffs', label: 'Write-Offs', description: 'Direct write-off or removal activity.' },
  { value: 'reversals', label: 'Reversals', description: 'Explicit reversals of prior-period or prior-run activity.' },
  { value: 'reclassifications', label: 'Reclassifications', description: 'Transfers or reclasses between related balance-sheet groupings.' },
  { value: 'realized_fx', label: 'Realized FX', description: 'Realized foreign exchange movement on settlement.' },
  { value: 'unrealized_fx', label: 'Unrealized FX', description: 'Period-end unrealized remeasurement movement.' },
  { value: 'translation', label: 'Translation', description: 'General currency translation movement.' },
  { value: 'cta', label: 'CTA', description: 'Cumulative translation adjustment movement.' },
  { value: 'other_activity', label: 'Other Activity', description: 'Controlled fallback when no stronger movement rule applies.' },
  { value: 'closing_balance', label: 'Closing Balance', description: 'Ending balance carried out of the period.' },
]

const RELEASE_ROLLFORWARD_CATEGORIES = new Set([
  'accounts receivable',
  'accounts payable',
  'inventory',
  'prepaids and other current assets',
  'other assets',
  'accrued expenses',
  'deferred revenue',
  'other liabilities',
  'debt',
])

const ACTIVITY_TYPE_DEFAULT_MOVEMENT_BUCKET: Record<string, RollforwardMovementBucket> = {
  opening_balance: 'opening_balance',
  closing_carryforward: 'closing_balance',
  operational_movement: 'other_activity',
  settlement_application: 'settlements',
  refund_settlement: 'settlements',
  writeoff: 'writeoffs',
  reopen: 'reversals',
  accrual: 'additions',
  reversal: 'reversals',
  deferral: 'additions',
  revenue_recognition: 'releases',
  amortization: 'releases',
  realized_fx: 'realized_fx',
  unrealized_fx: 'unrealized_fx',
  translation: 'translation',
  cta: 'cta',
  intercompany_settlement: 'settlements',
  intercompany_reclass: 'reclassifications',
  elimination: 'reclassifications',
  manual_adjustment: 'other_activity',
  reclassification: 'reclassifications',
  allocation: 'reclassifications',
  fmv_allocation: 'reclassifications',
  ar_addition: 'additions',
  ar_settlement: 'settlements',
  ap_addition: 'additions',
  ap_settlement: 'settlements',
  cash_receipt: 'additions',
  cash_disbursement: 'releases',
  deferred_revenue_addition: 'additions',
  expense_recognition: 'releases',
  prepaid_addition: 'additions',
  fx_realized_gain: 'realized_fx',
  fx_realized_loss: 'realized_fx',
  fx_unrealized_revaluation: 'unrealized_fx',
  accrual_build: 'additions',
  accrual_release: 'releases',
  reclass: 'reclassifications',
  amortization_release: 'releases',
  depreciation_expense: 'additions',
  reserve_build: 'additions',
  reserve_release: 'releases',
  open_item_clearing: 'settlements',
}

function normalizeValue(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function isReleaseCategory(rollforwardCategory: string | null | undefined) {
  return RELEASE_ROLLFORWARD_CATEGORIES.has(normalizeValue(rollforwardCategory))
}

export function getRollforwardMovementBucketOptions() {
  return ROLLFORWARD_MOVEMENT_BUCKET_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }))
}

export function deriveDefaultRollforwardMovementBucketForActivityType(activityTypeCode: string | null | undefined) {
  const normalizedActivityType = normalizeValue(activityTypeCode)
  return ACTIVITY_TYPE_DEFAULT_MOVEMENT_BUCKET[normalizedActivityType] ?? 'other_activity'
}

export function deriveRollforwardMovementBucket(args: {
  activityTypeCode?: string | null
  rollforwardCategory?: string | null
}) {
  const activityTypeCode = normalizeValue(args.activityTypeCode)
  const rollforwardCategory = normalizeValue(args.rollforwardCategory)

  switch (activityTypeCode) {
    case 'cash_receipt':
      return rollforwardCategory === 'cash and cash equivalents' ? 'additions' : 'settlements'
    case 'cash_disbursement':
      return rollforwardCategory === 'cash and cash equivalents' ? 'releases' : 'settlements'
    case 'expense_recognition':
    case 'revenue_recognition':
    case 'amortization':
    case 'amortization_release':
    case 'accrual_release':
    case 'reserve_release':
      return isReleaseCategory(rollforwardCategory) ? 'releases' : deriveDefaultRollforwardMovementBucketForActivityType(activityTypeCode)
    case 'depreciation_expense':
      return rollforwardCategory === 'accumulated depreciation and amortization' ? 'additions' : deriveDefaultRollforwardMovementBucketForActivityType(activityTypeCode)
    default:
      return deriveDefaultRollforwardMovementBucketForActivityType(activityTypeCode)
  }
}
