import { promises as fs } from 'fs'
import path from 'path'
import {
  type CompanyPreferencesSettings,
  type IdSetting,
  type IdSettingKey,
  DEFAULT_ID_SETTINGS,
} from '@/lib/company-preferences-definitions'

const DEFAULT_SETTINGS: CompanyPreferencesSettings = {
  idSettings: DEFAULT_ID_SETTINGS,
}

const STORE_PATH = path.join(process.cwd(), 'config', 'company-preferences.json')

function sanitizeIdSetting(input: unknown, fallback: IdSetting): IdSetting {
  if (!input || typeof input !== 'object') return fallback
  const root = input as Record<string, unknown>
  const prefix = typeof root.prefix === 'string' ? root.prefix : fallback.prefix
  const digitsRaw = typeof root.digits === 'number' ? root.digits : Number(root.digits)
  const digits = Number.isFinite(digitsRaw) ? Math.min(12, Math.max(1, Math.trunc(digitsRaw))) : fallback.digits

  return {
    prefix,
    digits,
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

  return { idSettings }
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
