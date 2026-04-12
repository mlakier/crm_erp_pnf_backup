import { promises as fs } from 'fs'
import path from 'path'

export type CompanyInformationSettings = {
  companyLogoFormsFileId: string
  companyLogoPagesFileId: string
}

const STORE_PATH = path.join(process.cwd(), 'config', 'company-information-settings.json')

const DEFAULT_SETTINGS: CompanyInformationSettings = {
  companyLogoFormsFileId: '',
  companyLogoPagesFileId: '',
}

function sanitize(input: unknown): CompanyInformationSettings {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS
  const root = input as Record<string, unknown>
  return {
    companyLogoFormsFileId:
      typeof root.companyLogoFormsFileId === 'string' ? root.companyLogoFormsFileId : '',
    companyLogoPagesFileId:
      typeof root.companyLogoPagesFileId === 'string' ? root.companyLogoPagesFileId : '',
  }
}

export async function loadCompanyInformationSettings(): Promise<CompanyInformationSettings> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveCompanyInformationSettings(input: unknown): Promise<CompanyInformationSettings> {
  const settings = sanitize(input)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  return settings
}
