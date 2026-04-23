import type { IdSetting, IdSettingKey } from '@/lib/company-preferences-definitions'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { loadCompanyPreferencesSettings } from '@/lib/company-preferences-store'

export function formatIdentifier(sequence: number, config: IdSetting) {
  return `${config.prefix}${String(sequence).padStart(config.digits, '0')}`
}

export function extractIdentifierSequence(value: string | null | undefined, config: IdSetting) {
  if (!value || !value.startsWith(config.prefix)) return null
  const match = value.match(/(\d+)$/)
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function getNextSequenceFromValues(values: Array<string | null | undefined>, config: IdSetting) {
  let maxSequence = 0

  for (const value of values) {
    const sequence = extractIdentifierSequence(value, config)
    if (sequence != null) {
      maxSequence = Math.max(maxSequence, sequence)
    }
  }

  return maxSequence + 1
}

export async function loadIdSetting(key: IdSettingKey) {
  const settings = await loadCompanyPreferencesSettings()
  return settings.idSettings[key] ?? DEFAULT_ID_SETTINGS[key]
}
