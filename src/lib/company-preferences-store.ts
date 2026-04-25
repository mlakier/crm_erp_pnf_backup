import { promises as fs } from 'fs'
import path from 'path'
import {
  type CompanyPreferencesSettings,
  type IdSetting,
  type IdSettingKey,
  DEFAULT_ID_SETTINGS,
  DEFAULT_MONEY_SETTINGS,
  type MoneySettings,
} from '@/lib/company-preferences-definitions'

const DEFAULT_SETTINGS: CompanyPreferencesSettings = {
  idSettings: DEFAULT_ID_SETTINGS,
  moneySettings: DEFAULT_MONEY_SETTINGS,
}

const STORE_PATH = path.join(process.cwd(), 'config', 'company-preferences.json')

function sanitizeIdSetting(input: unknown, fallback: IdSetting): IdSetting {
  if (!input || typeof input !== 'object') return fallback
  const root = input as Record<string, unknown>
  const prefix = typeof root.prefix === 'string' ? root.prefix : fallback.prefix
  const startingNumberRaw =
    typeof root.startingNumber === 'number' ? root.startingNumber : Number(root.startingNumber)
  const digitsRaw = typeof root.digits === 'number' ? root.digits : Number(root.digits)
  const startingNumber = Number.isFinite(startingNumberRaw)
    ? Math.min(999999999, Math.max(1, Math.trunc(startingNumberRaw)))
    : fallback.startingNumber
  const digits = Number.isFinite(digitsRaw) ? Math.min(12, Math.max(0, Math.trunc(digitsRaw))) : fallback.digits
  const autoIncrement = typeof root.autoIncrement === 'boolean' ? root.autoIncrement : fallback.autoIncrement
  const locked = typeof root.locked === 'boolean' ? root.locked : fallback.locked

  return {
    prefix,
    startingNumber,
    digits,
    autoIncrement,
    locked,
  }
}

function sanitize(input: unknown): CompanyPreferencesSettings {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS
  const root = input as Record<string, unknown>
  const rawIdSettings =
    root.idSettings && typeof root.idSettings === 'object'
      ? (root.idSettings as Record<string, unknown>)
      : {}

  const idSettings = Object.fromEntries(
    Object.entries(DEFAULT_ID_SETTINGS).map(([key, fallback]) => [
      key,
      sanitizeIdSetting(rawIdSettings[key], fallback),
    ]),
  ) as Record<IdSettingKey, IdSetting>

  return {
    idSettings,
    moneySettings: sanitizeMoneySettings(root.moneySettings),
  }
}

function sanitizeMoneySettings(input: unknown): MoneySettings {
  if (!input || typeof input !== 'object') return DEFAULT_MONEY_SETTINGS
  const root = input as Record<string, unknown>
  const locale = typeof root.locale === 'string' && root.locale.trim() ? root.locale.trim() : DEFAULT_MONEY_SETTINGS.locale
  const fallbackCurrencyCode =
    typeof root.fallbackCurrencyCode === 'string' && root.fallbackCurrencyCode.trim()
      ? root.fallbackCurrencyCode.trim().toUpperCase()
      : DEFAULT_MONEY_SETTINGS.fallbackCurrencyCode
  const currencyDisplay =
    root.currencyDisplay === 'symbol' || root.currencyDisplay === 'code'
      ? root.currencyDisplay
      : DEFAULT_MONEY_SETTINGS.currencyDisplay
  const negativeNumberFormat =
    root.negativeNumberFormat === 'minus' || root.negativeNumberFormat === 'parentheses'
      ? root.negativeNumberFormat
      : DEFAULT_MONEY_SETTINGS.negativeNumberFormat
  const decimalPlacesRaw = typeof root.decimalPlaces === 'number' ? root.decimalPlaces : Number(root.decimalPlaces)
  const decimalPlaces = Number.isFinite(decimalPlacesRaw)
    ? Math.min(6, Math.max(0, Math.trunc(decimalPlacesRaw)))
    : DEFAULT_MONEY_SETTINGS.decimalPlaces
  const zeroFormat =
    root.zeroFormat === 'dash' || root.zeroFormat === 'blank' || root.zeroFormat === 'zero'
      ? root.zeroFormat
      : DEFAULT_MONEY_SETTINGS.zeroFormat
  const showCurrencyOn =
    root.showCurrencyOn === 'foreignOnly' || root.showCurrencyOn === 'documentHeadersOnly' || root.showCurrencyOn === 'all'
      ? root.showCurrencyOn
      : DEFAULT_MONEY_SETTINGS.showCurrencyOn
  const negativeColor =
    root.negativeColor === 'red' || root.negativeColor === 'default'
      ? root.negativeColor
      : DEFAULT_MONEY_SETTINGS.negativeColor
  const documentDateFormat =
    root.documentDateFormat === 'MM/DD/YYYY'
    || root.documentDateFormat === 'DD/MM/YYYY'
    || root.documentDateFormat === 'YYYY-MM-DD'
    || root.documentDateFormat === 'locale'
      ? root.documentDateFormat
      : DEFAULT_MONEY_SETTINGS.documentDateFormat

  return {
    locale,
    fallbackCurrencyCode,
    currencyDisplay,
    negativeNumberFormat,
    decimalPlaces,
    zeroFormat,
    showCurrencyOn,
    negativeColor,
    documentDateFormat,
  }
}

export async function loadCompanyPreferencesSettings(): Promise<CompanyPreferencesSettings> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveCompanyPreferencesSettings(input: unknown): Promise<CompanyPreferencesSettings> {
  const settings = sanitize(input)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  return settings
}
