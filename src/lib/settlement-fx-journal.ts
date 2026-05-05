import { deriveRealizedFxActivityType } from '@/lib/accounting-activity-types'

const MONEY_TOLERANCE = 0.005

function roundMoney(value: number | null | undefined) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100
}

function isMaterialAmount(value: number | null | undefined) {
  return Math.abs(roundMoney(value)) > MONEY_TOLERANCE
}

export function deriveCarriedSettlementAmount(
  settledAmount: number | null | undefined,
  realizedFxAmount: number | null | undefined,
) {
  if (settledAmount == null) return null
  return roundMoney(settledAmount - roundMoney(realizedFxAmount))
}

export function computeProportionalTranslatedSettlementAmount(
  originalTransactionAmount: number | null | undefined,
  originalTranslatedAmount: number | null | undefined,
  settledTransactionAmount: number | null | undefined,
) {
  const originalTxn = roundMoney(originalTransactionAmount)
  const originalTranslated = originalTranslatedAmount == null ? null : roundMoney(originalTranslatedAmount)
  const settledTxn = roundMoney(settledTransactionAmount)
  if (!Number.isFinite(originalTxn) || Math.abs(originalTxn) <= MONEY_TOLERANCE) return null
  if (originalTranslated == null || !Number.isFinite(originalTranslated)) return null
  if (!Number.isFinite(settledTxn)) return null
  return roundMoney((originalTranslated / originalTxn) * settledTxn)
}

export function computeRealizedFxLayerAmount(input: {
  originalTransactionAmount: number | null | undefined
  originalTranslatedAmount: number | null | undefined
  settledTransactionAmount: number | null | undefined
  settledTranslatedAmount: number | null | undefined
}) {
  const carriedAmount = computeProportionalTranslatedSettlementAmount(
    input.originalTransactionAmount,
    input.originalTranslatedAmount,
    input.settledTransactionAmount,
  )
  const settledTranslated =
    input.settledTranslatedAmount == null ? null : roundMoney(input.settledTranslatedAmount)
  if (carriedAmount == null || settledTranslated == null) return null
  return roundMoney(settledTranslated - carriedAmount)
}

type CounterpartyOrientation = 'asset' | 'liability'

type RealizedFxLineInput = {
  description: string
  memo?: string | null
  subsidiaryId?: string | null
  customerId?: string | null
  vendorId?: string | null
  realizedFxGainAccountId: string | null
  realizedFxLossAccountId: string | null
  orientation: CounterpartyOrientation
  localAmount?: number | null
  functionalAmount?: number | null
  groupAmount?: number | null
  startingDisplayOrder: number
}

type RealizedFxJournalLine = {
  displayOrder: number
  description: string
  memo: string | null
  activityTypeCode: string
  debit: number
  credit: number
  localDebit?: number
  localCredit?: number
  functionalDebit?: number
  functionalCredit?: number
  groupDebit?: number
  groupCredit?: number
  accountId: string
  subsidiaryId?: string | null
  customerId?: string | null
  vendorId?: string | null
}

function resolveFxSide(
  amount: number | null | undefined,
  orientation: CounterpartyOrientation,
) {
  const rounded = roundMoney(amount)
  if (!isMaterialAmount(rounded)) return null

  if (orientation === 'liability') {
    if (rounded > 0) {
      return { accountKind: 'loss' as const, side: 'debit' as const, amount: rounded }
    }
    return { accountKind: 'gain' as const, side: 'credit' as const, amount: Math.abs(rounded) }
  }

  if (rounded > 0) {
    return { accountKind: 'gain' as const, side: 'credit' as const, amount: rounded }
  }
  return { accountKind: 'loss' as const, side: 'debit' as const, amount: Math.abs(rounded) }
}

export function buildRealizedFxJournalLines(input: RealizedFxLineInput): RealizedFxJournalLine[] {
  const lines: RealizedFxJournalLine[] = []
  let displayOrder = input.startingDisplayOrder

  const appendLayerLine = (
    label: 'Local' | 'Functional',
    amount: number | null | undefined,
    localOrFunctional: 'local' | 'functional',
  ) => {
    const resolved = resolveFxSide(amount ?? null, input.orientation)
    if (!resolved) return

    const accountId =
      resolved.accountKind === 'gain'
        ? input.realizedFxGainAccountId
        : input.realizedFxLossAccountId

    if (!accountId) {
      throw new Error(`Configure ${resolved.accountKind === 'gain' ? 'Realized FX Gain Account' : 'Realized FX Loss Account'} in Company Setup before posting settlements with realized FX.`)
    }

    lines.push({
      displayOrder,
      description: `${input.description} realized FX (${label})`,
      memo: input.memo ?? null,
      activityTypeCode: deriveRealizedFxActivityType(amount ?? 0),
      debit: 0,
      credit: 0,
      ...(localOrFunctional === 'local'
        ? {
            localDebit: resolved.side === 'debit' ? resolved.amount : 0,
            localCredit: resolved.side === 'credit' ? resolved.amount : 0,
          }
        : {
            functionalDebit: resolved.side === 'debit' ? resolved.amount : 0,
            functionalCredit: resolved.side === 'credit' ? resolved.amount : 0,
          }),
      accountId,
      subsidiaryId: input.subsidiaryId ?? null,
      customerId: input.customerId ?? null,
      vendorId: input.vendorId ?? null,
    })
    displayOrder += 1
  }

  appendLayerLine('Local', input.localAmount, 'local')
  appendLayerLine('Functional', input.functionalAmount, 'functional')
  const resolvedGroup = resolveFxSide(input.groupAmount ?? null, input.orientation)
  if (resolvedGroup) {
    const accountId =
      resolvedGroup.accountKind === 'gain'
        ? input.realizedFxGainAccountId
        : input.realizedFxLossAccountId

    if (!accountId) {
      throw new Error(`Configure ${resolvedGroup.accountKind === 'gain' ? 'Realized FX Gain Account' : 'Realized FX Loss Account'} in Company Setup before posting settlements with realized FX.`)
    }

    lines.push({
      displayOrder,
      description: `${input.description} realized FX (Group)`,
      memo: input.memo ?? null,
      activityTypeCode: deriveRealizedFxActivityType(input.groupAmount ?? 0),
      debit: 0,
      credit: 0,
      groupDebit: resolvedGroup.side === 'debit' ? resolvedGroup.amount : 0,
      groupCredit: resolvedGroup.side === 'credit' ? resolvedGroup.amount : 0,
      accountId,
      subsidiaryId: input.subsidiaryId ?? null,
      customerId: input.customerId ?? null,
      vendorId: input.vendorId ?? null,
    })
  }

  return lines
}
