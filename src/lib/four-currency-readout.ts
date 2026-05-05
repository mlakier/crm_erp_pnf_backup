import type { RecordHeaderField } from '@/components/RecordHeaderDetails'

export const CURRENCY_READOUT_SECTION_TITLE = '4-Currency Context'

export const CURRENCY_READOUT_FIELD_KEYS = [
  'currency-posting-status',
  'currency-open-item-number',
  'currency-translation-status',
  'currency-transaction-amount',
  'currency-local-amount',
  'currency-functional-amount',
  'currency-group-amount',
  'currency-realized-fx-local',
  'currency-realized-fx-functional',
  'currency-realized-fx-group',
  'currency-local-fx-rate',
  'currency-functional-fx-rate',
  'currency-group-fx-rate',
  'currency-fx-rate-type',
  'currency-fx-audit',
] as const

export type CurrencyReadoutFieldKey = (typeof CURRENCY_READOUT_FIELD_KEYS)[number]

export const CURRENCY_READOUT_CUSTOMIZE_FIELDS: Array<{
  id: CurrencyReadoutFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}> = [
  { id: 'currency-posting-status', label: 'Posting Status', fieldType: 'text', source: 'Posted open item', description: 'Whether the source transaction has posted into open items.' },
  { id: 'currency-open-item-number', label: 'Open Item', fieldType: 'text', source: 'Posted open item', description: 'Open-item number created from this transaction.' },
  { id: 'currency-translation-status', label: 'Translation Status', fieldType: 'text', source: 'Posted open item', description: 'Quick read of which translated currency amounts are populated.' },
  { id: 'currency-transaction-amount', label: 'TXN Amount', fieldType: 'currency', source: 'Posted open item', description: 'Original document amount in transaction currency.' },
  { id: 'currency-local-amount', label: 'Local Amount', fieldType: 'currency', source: 'Posted open item', description: 'Local/statutory currency amount.' },
  { id: 'currency-functional-amount', label: 'Functional Amount', fieldType: 'currency', source: 'Posted open item', description: 'Functional currency amount.' },
  { id: 'currency-group-amount', label: 'Group Amount', fieldType: 'currency', source: 'Posted open item', description: 'Group/reporting currency amount.' },
  { id: 'currency-realized-fx-local', label: 'Realized FX Local', fieldType: 'currency', source: 'Settlement FX', description: 'Realized FX effect in local currency.' },
  { id: 'currency-realized-fx-functional', label: 'Realized FX Functional', fieldType: 'currency', source: 'Settlement FX', description: 'Realized FX effect in functional currency.' },
  { id: 'currency-realized-fx-group', label: 'Realized FX Group', fieldType: 'currency', source: 'Settlement FX', description: 'Realized FX effect in group currency.' },
  { id: 'currency-local-fx-rate', label: 'Local FX Rate', fieldType: 'text', source: 'Exchange rates', description: 'Rate used to translate transaction amount into local currency.' },
  { id: 'currency-functional-fx-rate', label: 'Functional FX Rate', fieldType: 'text', source: 'Exchange rates', description: 'Rate used to translate transaction amount into functional currency.' },
  { id: 'currency-group-fx-rate', label: 'Group FX Rate', fieldType: 'text', source: 'Exchange rates', description: 'Rate used to translate transaction amount into group currency.' },
  { id: 'currency-fx-rate-type', label: 'FX Rate Type', fieldType: 'text', source: 'Exchange rates', description: 'Configured FX rate type used for translation.' },
  { id: 'currency-fx-audit', label: 'FX Rate Audit', fieldType: 'text', source: 'Exchange rates', description: 'Effective date and source summary for the translated rates.' },
]

export function buildDefaultCurrencyReadoutFieldCustomizations({
  showRealizedFx = false,
}: {
  showRealizedFx?: boolean
} = {}) {
  return {
    'currency-transaction-amount': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 0, column: 1 },
    'currency-local-amount': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 1, column: 1 },
    'currency-functional-amount': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 2, column: 1 },
    'currency-group-amount': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 3, column: 1 },
    'currency-fx-audit': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 0, column: 2 },
    'currency-local-fx-rate': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 1, column: 2 },
    'currency-functional-fx-rate': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 2, column: 2 },
    'currency-group-fx-rate': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 3, column: 2 },
    'currency-fx-rate-type': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 0, column: 3 },
    'currency-realized-fx-functional': { visible: showRealizedFx, section: CURRENCY_READOUT_SECTION_TITLE, order: 1, column: 3 },
    'currency-realized-fx-local': { visible: showRealizedFx, section: CURRENCY_READOUT_SECTION_TITLE, order: 2, column: 3 },
    'currency-realized-fx-group': { visible: showRealizedFx, section: CURRENCY_READOUT_SECTION_TITLE, order: 3, column: 3 },
    'currency-translation-status': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 0, column: 4 },
    'currency-posting-status': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 1, column: 4 },
    'currency-open-item-number': { visible: true, section: CURRENCY_READOUT_SECTION_TITLE, order: 2, column: 4 },
  } satisfies Record<CurrencyReadoutFieldKey, { visible: boolean; section: string; order: number; column: number }>
}

type CurrencyFormatterValue =
  | number
  | string
  | null
  | undefined
  | {
      toString(): string
      toNumber?: () => number
    }

function toNumber(value: CurrencyFormatterValue) {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value.toNumber === 'function') {
    const parsed = Number(value.toNumber())
    return Number.isFinite(parsed) ? parsed : null
  }
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : null
}

function buildFxRateDisplay(
  transactionAmount: CurrencyFormatterValue,
  translatedAmount: CurrencyFormatterValue,
  transactionCurrencyCode?: string | null,
  targetCurrencyCode?: string | null,
) {
  const baseAmount = toNumber(transactionAmount)
  const targetAmount = toNumber(translatedAmount)
  if (baseAmount == null || targetAmount == null || baseAmount === 0) {
    return '-'
  }

  const rate = targetAmount / baseAmount
  const roundedRate = Number.isFinite(rate) ? rate.toFixed(6) : null
  if (!roundedRate) return '-'
  if (transactionCurrencyCode && targetCurrencyCode) {
    return `1 ${transactionCurrencyCode} = ${roundedRate} ${targetCurrencyCode}`
  }
  return roundedRate
}

export function buildCurrencyLayerDisplayValue(
  amount: CurrencyFormatterValue,
  currencyCode: string | null | undefined,
  formatCurrency: (value: CurrencyFormatterValue, currencyCode?: string | null) => string,
  pendingLabel = 'Not translated yet',
) {
  if (amount == null) {
    return pendingLabel
  }
  return formatCurrency(amount, currencyCode)
}

export function buildTranslationStatusDisplay(
  layers: Array<{ label: string; amount: CurrencyFormatterValue }>,
) {
  return layers
    .map((layer) => (layer.amount == null ? `${layer.label} pending` : `${layer.label} ready`))
    .join(' | ')
}

export function buildPostedCurrencyReadoutSection(input: {
  title?: string
  description?: string
  hasPostedContext?: boolean
  postingStatus: string
  openItemId?: string | null
  openItemNumber?: string | null
  transactionAmount: CurrencyFormatterValue
  transactionCurrencyCode?: string | null
  transactionCurrencyLabel?: string | null
  localAmount: CurrencyFormatterValue
  localCurrencyCode?: string | null
  localCurrencyLabel?: string | null
  functionalAmount: CurrencyFormatterValue
  functionalCurrencyCode?: string | null
  functionalCurrencyLabel?: string | null
  groupAmount: CurrencyFormatterValue
  groupCurrencyCode?: string | null
  groupCurrencyLabel?: string | null
  realizedFxLocalAmount?: CurrencyFormatterValue
  realizedFxFunctionalAmount?: CurrencyFormatterValue
  realizedFxGroupAmount?: CurrencyFormatterValue
  fxRateType?: string | null
  fxRateSource?: string | null
  fxEffectiveDateLabel?: string | null
  formatCurrency: (value: CurrencyFormatterValue, currencyCode?: string | null) => string
}) {
  const {
    title = '',
    description,
    hasPostedContext,
    postingStatus,
    openItemId,
    openItemNumber,
    transactionAmount,
    transactionCurrencyCode,
    localAmount,
    localCurrencyCode,
    functionalAmount,
    functionalCurrencyCode,
    groupAmount,
    groupCurrencyCode,
    realizedFxLocalAmount,
    realizedFxFunctionalAmount,
    realizedFxGroupAmount,
    fxRateType,
    fxRateSource,
    fxEffectiveDateLabel,
    formatCurrency,
  } = input

  const hasPostedOpenItemContext = hasPostedContext ?? Boolean(openItemNumber)

  const transactionDisplay = buildCurrencyLayerDisplayValue(
    transactionAmount,
    transactionCurrencyCode,
    formatCurrency,
    'Missing transaction amount',
  )
  const localDisplay = buildCurrencyLayerDisplayValue(localAmount, localCurrencyCode, formatCurrency)
  const functionalDisplay = buildCurrencyLayerDisplayValue(functionalAmount, functionalCurrencyCode, formatCurrency)
  const groupDisplay = buildCurrencyLayerDisplayValue(groupAmount, groupCurrencyCode, formatCurrency)
  const realizedFxLocalDisplay =
    !hasPostedOpenItemContext || realizedFxLocalAmount == null ? '-' : formatCurrency(realizedFxLocalAmount, localCurrencyCode)
  const realizedFxFunctionalDisplay =
    !hasPostedOpenItemContext || realizedFxFunctionalAmount == null ? '-' : formatCurrency(realizedFxFunctionalAmount, functionalCurrencyCode)
  const realizedFxGroupDisplay =
    !hasPostedOpenItemContext || realizedFxGroupAmount == null ? '-' : formatCurrency(realizedFxGroupAmount, groupCurrencyCode)
  const localFxRateDisplay = buildFxRateDisplay(
    transactionAmount,
    localAmount,
    transactionCurrencyCode,
    localCurrencyCode,
  )
  const functionalFxRateDisplay = buildFxRateDisplay(
    transactionAmount,
    functionalAmount,
    transactionCurrencyCode,
    functionalCurrencyCode,
  )
  const groupFxRateDisplay = buildFxRateDisplay(
    transactionAmount,
    groupAmount,
    transactionCurrencyCode,
    groupCurrencyCode,
  )
  const fxRateAuditValue = hasPostedOpenItemContext
    ? [fxEffectiveDateLabel, fxRateSource].filter(Boolean).join(' | ')
    : ''
  const fxRateAuditDisplayValue = hasPostedOpenItemContext
    ? [fxEffectiveDateLabel ? `Effective ${fxEffectiveDateLabel}` : null, fxRateSource].filter(Boolean).join(' | ') || '-'
    : '-'
  const fxRateTypeValue = hasPostedOpenItemContext ? (fxRateType ?? '') : ''
  const fxRateTypeDisplayValue = hasPostedOpenItemContext ? (fxRateType ?? '-') : '-'
  return {
    title,
    description,
    rows: 4,
    fields: [
      {
        key: 'currency-transaction-amount',
        label: 'TXN Amount',
        value: String(transactionAmount ?? ''),
        displayValue: transactionDisplay,
        column: 1,
        order: 0,
        helpText: 'Original document amount in the transaction-entered currency.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-local-amount',
        label: 'Local Amount',
        value: localAmount == null ? '' : String(localAmount),
        displayValue: localDisplay,
        column: 1,
        order: 1,
        helpText: 'Statutory/local-currency amount. If the transaction was not translated into local currency yet, this stays blank instead of being guessed.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-functional-amount',
        label: 'Functional Amount',
        value: functionalAmount == null ? '' : String(functionalAmount),
        displayValue: functionalDisplay,
        column: 1,
        order: 2,
        helpText: 'Functional-currency amount for the subsidiary. It may differ from local currency when the entity mainly operates in another currency.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-group-amount',
        label: 'Group Amount',
        value: groupAmount == null ? '' : String(groupAmount),
        displayValue: groupDisplay,
        column: 1,
        order: 3,
        helpText: 'Consolidated group/reporting-currency amount. This remains blank until the system has a real group-currency translation basis.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-fx-audit',
        label: 'FX Rate Audit',
        value: fxRateAuditValue,
        displayValue: fxRateAuditDisplayValue,
        column: 2,
        order: 0,
        helpText: 'Effective date and source summary for the translated settlement rates currently stored on this transaction.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-local-fx-rate',
        label: 'Local FX Rate',
        value: localFxRateDisplay,
        displayValue: localFxRateDisplay,
        column: 2,
        order: 1,
        helpText: 'Implied rate used to translate the transaction amount into local currency on this posted record.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-functional-fx-rate',
        label: 'Functional FX Rate',
        value: functionalFxRateDisplay,
        displayValue: functionalFxRateDisplay,
        column: 2,
        order: 2,
        helpText: 'Implied rate used to translate the transaction amount into functional currency on this posted record.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-group-fx-rate',
        label: 'Group FX Rate',
        value: groupFxRateDisplay,
        displayValue: groupFxRateDisplay,
        column: 2,
        order: 3,
        helpText: 'Implied rate used to translate the transaction amount into group/reporting currency on this posted record.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-fx-rate-type',
        label: 'FX Rate Type',
        value: fxRateTypeValue,
        displayValue: fxRateTypeDisplayValue,
        column: 3,
        order: 0,
        helpText: 'Rate type used to translate this settlement transaction into the non-transaction currency layers.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-realized-fx-functional',
        label: 'Realized FX Functional',
        value: !hasPostedOpenItemContext || realizedFxFunctionalAmount == null ? '' : String(realizedFxFunctionalAmount),
        displayValue: realizedFxFunctionalDisplay,
        column: 3,
        order: 1,
        helpText: 'Realized foreign exchange effect in functional currency for this settlement, when the system can calculate it.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-realized-fx-local',
        label: 'Realized FX Local',
        value: !hasPostedOpenItemContext || realizedFxLocalAmount == null ? '' : String(realizedFxLocalAmount),
        displayValue: realizedFxLocalDisplay,
        column: 3,
        order: 2,
        helpText: 'Realized foreign exchange effect in local currency for this settlement, when the system can calculate it.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-realized-fx-group',
        label: 'Realized FX Group',
        value: !hasPostedOpenItemContext || realizedFxGroupAmount == null ? '' : String(realizedFxGroupAmount),
        displayValue: realizedFxGroupDisplay,
        column: 3,
        order: 3,
        helpText: 'Realized foreign exchange effect in group/reporting currency for this settlement, when the system can calculate it.',
        fieldType: 'currency',
      } satisfies RecordHeaderField,
      {
        key: 'currency-translation-status',
        label: 'Translation Status',
        value: buildTranslationStatusDisplay([
          { label: 'Local', amount: localAmount },
          { label: 'Functional', amount: functionalAmount },
          { label: 'Group', amount: groupAmount },
        ]),
        displayValue: buildTranslationStatusDisplay([
          { label: 'Local', amount: localAmount },
          { label: 'Functional', amount: functionalAmount },
          { label: 'Group', amount: groupAmount },
        ]),
        column: 4,
        order: 0,
        helpText: 'Quick read of which translated currency amounts are populated versus still awaiting real FX translation.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-posting-status',
        label: 'Posting Status',
        value: postingStatus,
        displayValue: postingStatus,
        column: 4,
        order: 1,
        helpText: 'Shows whether this transaction has posted into open items, which is the source of the current 4-currency readout.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
      {
        key: 'currency-open-item-number',
        label: 'Open Item',
        value: openItemNumber ?? '',
        displayValue: openItemNumber ?? '-',
        href: openItemId ? `/open-items/${openItemId}` : null,
        column: 4,
        order: 2,
        helpText: 'Open item generated from this transaction. The currency amounts below are being read from that posted open-item context.',
        fieldType: 'text',
      } satisfies RecordHeaderField,
    ],
  }
}
