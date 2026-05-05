import { promises as fs } from 'fs'
import path from 'path'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'

export type CompanySetupSettings = {
  defaultApAccountId: string
  defaultArAccountId: string
  realizedFxGainAccountId: string
  realizedFxLossAccountId: string
  unrealizedFxGainAccountId: string
  unrealizedFxLossAccountId: string
}

const STORE_PATH = path.join(process.cwd(), 'config', 'company-setup-settings.json')

const DEFAULT_SETTINGS: CompanySetupSettings = {
  defaultApAccountId: '',
  defaultArAccountId: '',
  realizedFxGainAccountId: '',
  realizedFxLossAccountId: '',
  unrealizedFxGainAccountId: '',
  unrealizedFxLossAccountId: '',
}

function sanitize(input: unknown): CompanySetupSettings {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS
  const root = input as Record<string, unknown>
  const str = (key: keyof CompanySetupSettings) => typeof root[key] === 'string' ? root[key] as string : ''
  return {
    defaultApAccountId: str('defaultApAccountId'),
    defaultArAccountId: str('defaultArAccountId'),
    realizedFxGainAccountId: str('realizedFxGainAccountId'),
    realizedFxLossAccountId: str('realizedFxLossAccountId'),
    unrealizedFxGainAccountId: str('unrealizedFxGainAccountId'),
    unrealizedFxLossAccountId: str('unrealizedFxLossAccountId'),
  }
}

export async function loadCompanySetupSettings(): Promise<CompanySetupSettings> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return sanitize(JSON.parse(raw))
  } catch {
    const companyInformation = await loadCompanyInformationSettings()
    return {
      ...DEFAULT_SETTINGS,
      defaultApAccountId: companyInformation.defaultApAccountId,
      defaultArAccountId: companyInformation.defaultArAccountId,
    }
  }
}

export async function saveCompanySetupSettings(input: unknown): Promise<CompanySetupSettings> {
  const settings = sanitize(input)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  return settings
}
