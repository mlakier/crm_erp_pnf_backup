import { DEFAULT_MONEY_SETTINGS, type MoneySettings } from '@/lib/company-preferences-definitions'

type RuntimeGlobal = typeof globalThis & {
  __COMPANY_MONEY_SETTINGS__?: Partial<MoneySettings>
}

type NumericLike =
  | number
  | string
  | null
  | undefined
  | {
      toString(): string
      toNumber?: () => number
    }

function resolveMoneySettings(overrides?: Partial<MoneySettings>): MoneySettings {
  const runtime = globalThis as RuntimeGlobal
  const runtimeSettings = runtime.__COMPANY_MONEY_SETTINGS__ ?? {}

  return {
    locale: overrides?.locale ?? runtimeSettings.locale ?? DEFAULT_MONEY_SETTINGS.locale,
    fallbackCurrencyCode:
      overrides?.fallbackCurrencyCode
      ?? runtimeSettings.fallbackCurrencyCode
      ?? DEFAULT_MONEY_SETTINGS.fallbackCurrencyCode,
    currencyDisplay:
      overrides?.currencyDisplay
      ?? runtimeSettings.currencyDisplay
      ?? DEFAULT_MONEY_SETTINGS.currencyDisplay,
    negativeNumberFormat:
      overrides?.negativeNumberFormat
      ?? runtimeSettings.negativeNumberFormat
      ?? DEFAULT_MONEY_SETTINGS.negativeNumberFormat,
    decimalPlaces:
      overrides?.decimalPlaces
      ?? runtimeSettings.decimalPlaces
      ?? DEFAULT_MONEY_SETTINGS.decimalPlaces,
    zeroFormat:
      overrides?.zeroFormat
      ?? runtimeSettings.zeroFormat
      ?? DEFAULT_MONEY_SETTINGS.zeroFormat,
    showCurrencyOn:
      overrides?.showCurrencyOn
      ?? runtimeSettings.showCurrencyOn
      ?? DEFAULT_MONEY_SETTINGS.showCurrencyOn,
    negativeColor:
      overrides?.negativeColor
      ?? runtimeSettings.negativeColor
      ?? DEFAULT_MONEY_SETTINGS.negativeColor,
    documentDateFormat:
      overrides?.documentDateFormat
      ?? runtimeSettings.documentDateFormat
      ?? DEFAULT_MONEY_SETTINGS.documentDateFormat,
  }
}

export function toNumericValue(value: NumericLike, fallback = 0): number {
  if (value == null) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : fallback
  }
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      const parsed = value.toNumber()
      return Number.isFinite(parsed) ? parsed : fallback
    }
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function roundMoney(value: NumericLike, decimals = 2): number {
  const n = toNumericValue(value, 0)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** decimals
  return Math.round((n + Number.EPSILON) * factor) / factor
}

export function parseMoneyInput(value: unknown, decimals = 2): number | null {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  const parsed = toNumericValue(normalized, Number.NaN)
  if (!Number.isFinite(parsed)) return null
  return roundMoney(parsed, decimals)
}

/**
 * Format a number as currency with company-wide preferences.
 */
export function fmtCurrency(
  value: NumericLike,
  currency?: string | null,
  moneySettings?: Partial<MoneySettings>,
  formatOptions?: { context?: 'default' | 'documentHeader' },
): string {
  const settings = resolveMoneySettings(moneySettings)
  const currencyCode = (currency ?? settings.fallbackCurrencyCode).trim().toUpperCase() || settings.fallbackCurrencyCode
  const numericValue = roundMoney(value ?? 0, settings.decimalPlaces)
  const absoluteValue = Math.abs(numericValue)
  const isZero = absoluteValue === 0
  const shouldShowCurrency =
    settings.showCurrencyOn === 'all'
    || (settings.showCurrencyOn === 'foreignOnly' && currencyCode !== settings.fallbackCurrencyCode)
    || (settings.showCurrencyOn === 'documentHeadersOnly' && formatOptions?.context === 'documentHeader')

  if (isZero) {
    if (settings.zeroFormat === 'blank') return ''
    if (settings.zeroFormat === 'dash') return '-'
  }

  let formatted: string
  try {
    formatted = shouldShowCurrency
      ? new Intl.NumberFormat(settings.locale, {
          style: 'currency',
          currency: currencyCode,
          currencyDisplay: settings.currencyDisplay,
          minimumFractionDigits: settings.decimalPlaces,
          maximumFractionDigits: settings.decimalPlaces,
        }).format(absoluteValue)
      : new Intl.NumberFormat(settings.locale, {
          minimumFractionDigits: settings.decimalPlaces,
          maximumFractionDigits: settings.decimalPlaces,
        }).format(absoluteValue)
  } catch {
    formatted = new Intl.NumberFormat(DEFAULT_MONEY_SETTINGS.locale, {
      minimumFractionDigits: settings.decimalPlaces,
      maximumFractionDigits: settings.decimalPlaces,
    }).format(absoluteValue)
    if (shouldShowCurrency) {
      formatted = `${currencyCode} ${formatted}`
    }
  }

  if (numericValue < 0) {
    return settings.negativeNumberFormat === 'minus' ? `-${formatted}` : `(${formatted})`
  }

  return formatted
}

export function getNegativeAmountColor(moneySettings?: Partial<MoneySettings>): string | undefined {
  const settings = resolveMoneySettings(moneySettings)
  return settings.negativeColor === 'red' ? '#f87171' : undefined
}

export function fmtDocumentDate(
  value: Date | string | null | undefined,
  moneySettings?: Partial<MoneySettings>,
  fallback = '-',
): string {
  if (!value) return fallback
  const settings = resolveMoneySettings(moneySettings)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())

  switch (settings.documentDateFormat) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    default:
      return date.toLocaleDateString(settings.locale)
  }
}

/**
 * Normalize US phone numbers to +1 (###) ###-#### when possible.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')

  let tenDigits: string | null = null
  if (digits.length === 7) {
    // Backfill legacy local numbers by assuming the default app area code.
    tenDigits = `818${digits}`
  } else if (digits.length === 10) {
    tenDigits = digits
  } else if (digits.length === 11 && digits.startsWith('1')) {
    tenDigits = digits.slice(1)
  } else if (digits.length > 10) {
    // Keep deterministic behavior for noisy inputs by taking the first 10 digits.
    tenDigits = digits.slice(0, 10)
  }

  if (!tenDigits) return raw

  const area = tenDigits.slice(0, 3)
  const prefix = tenDigits.slice(3, 6)
  const line = tenDigits.slice(6, 10)
  return `+1 (${area}) ${prefix}-${line}`
}

export function fmtPhone(value: string | null | undefined): string {
  return normalizePhone(value) ?? '—'
}
