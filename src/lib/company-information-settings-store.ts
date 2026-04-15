import { promises as fs } from 'fs'
import path from 'path'

export type CompanyInformationSettings = {
  companyName: string
  legalName: string
  companyLogoFormsFileId: string
  companyLogoPagesFileId: string
  displayLogoInternally: boolean
  webSite: string
  stateProvince: string
  country: string
  returnEmail: string
  fax: string
  currency: string
  ein: string
  ssnTin: string
  firstFiscalMonth: string
  timeZone: string
  accountId: string
  mainDataCenter: string
  disasterRecoveryDataCenter: string
  legalEntityRegisteredAs: string
  uen: string
  brn: string
}

const STORE_PATH = path.join(process.cwd(), 'config', 'company-information-settings.json')

const DEFAULT_SETTINGS: CompanyInformationSettings = {
  companyName: '',
  legalName: '',
  companyLogoFormsFileId: '',
  companyLogoPagesFileId: '',
  displayLogoInternally: true,
  webSite: '',
  stateProvince: '',
  country: '',
  returnEmail: '',
  fax: '',
  currency: '',
  ein: '',
  ssnTin: '',
  firstFiscalMonth: '',
  timeZone: '',
  accountId: '',
  mainDataCenter: '',
  disasterRecoveryDataCenter: '',
  legalEntityRegisteredAs: '',
  uen: '',
  brn: '',
}

function sanitize(input: unknown): CompanyInformationSettings {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS
  const root = input as Record<string, unknown>
  const str = (key: string) => typeof root[key] === 'string' ? root[key] as string : ''
  return {
    companyName: str('companyName'),
    legalName: str('legalName'),
    companyLogoFormsFileId: str('companyLogoFormsFileId'),
    companyLogoPagesFileId: str('companyLogoPagesFileId'),
    displayLogoInternally: typeof root.displayLogoInternally === 'boolean' ? root.displayLogoInternally : true,
    webSite: str('webSite'),
    stateProvince: str('stateProvince'),
    country: str('country'),
    returnEmail: str('returnEmail'),
    fax: str('fax'),
    currency: str('currency'),
    ein: str('ein'),
    ssnTin: str('ssnTin'),
    firstFiscalMonth: str('firstFiscalMonth'),
    timeZone: str('timeZone'),
    accountId: str('accountId'),
    mainDataCenter: str('mainDataCenter'),
    disasterRecoveryDataCenter: str('disasterRecoveryDataCenter'),
    legalEntityRegisteredAs: str('legalEntityRegisteredAs'),
    uen: str('uen'),
    brn: str('brn'),
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
