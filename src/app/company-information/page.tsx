"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'

type CabinetFile = {
  id: string
  originalName: string
}

type Settings = {
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

export default function CompanyInformationPage() {
  const [cabinetFiles, setCabinetFiles] = useState<CabinetFile[]>([])
  const [loadingCabinet, setLoadingCabinet] = useState(true)
  const [settings, setSettings] = useState<Settings>({
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
  })

  useEffect(() => {
    let mounted = true

    async function loadCabinetFiles() {
      try {
        setLoadingCabinet(true)
        const response = await fetch('/api/company-information/file-cabinet', { cache: 'no-store' })
        const body = (await response.json()) as { files?: CabinetFile[] }
        if (!response.ok) return

        const settingsResponse = await fetch('/api/company-information/settings', { cache: 'no-store' })
        const settingsBody = (await settingsResponse.json()) as Partial<Settings>

        const files = body.files ?? []
        const hasForms = typeof settingsBody.companyLogoFormsFileId === 'string' && settingsBody.companyLogoFormsFileId.length > 0
        const hasPages = typeof settingsBody.companyLogoPagesFileId === 'string' && settingsBody.companyLogoPagesFileId.length > 0
        const firstFileId = files[0]?.id ?? ''
        const str = (key: keyof Settings) => typeof settingsBody[key] === 'string' ? settingsBody[key] as string : ''
        const nextSettings: Settings = {
          companyName: str('companyName'),
          legalName: str('legalName'),
          companyLogoFormsFileId: hasForms ? settingsBody.companyLogoFormsFileId as string : firstFileId,
          companyLogoPagesFileId: hasPages ? settingsBody.companyLogoPagesFileId as string : firstFileId,
          displayLogoInternally: typeof settingsBody.displayLogoInternally === 'boolean' ? settingsBody.displayLogoInternally : true,
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

        if (mounted) {
          setCabinetFiles(files)
          setSettings(nextSettings)
        }

        if ((!hasForms || !hasPages) && firstFileId) {
          await fetch('/api/company-information/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextSettings),
          })
        }
      } finally {
        if (mounted) setLoadingCabinet(false)
      }
    }

    void loadCabinetFiles()

    return () => {
      mounted = false
    }
  }, [])

  async function updateSetting(field: keyof Settings, value: string | boolean) {
    const next = { ...settings, [field]: value }
    setSettings(next)

    try {
      await fetch('/api/company-information/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch {
      // keep local state even if save fails; user can retry by selecting again
    }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-6xl rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Company Information</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Review and maintain company-level profile, identity, and compliance details.
            </p>
          </div>
          <Link href="/company-information/file-cabinet" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
            Open File Cabinet
          </Link>
        </div>

        <form className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border p-5" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>General</h2>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Company Name *</span>
              <input
                value={settings.companyName}
                onChange={(event) => updateSetting('companyName', event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Legal Name</span>
              <input value={settings.legalName} onChange={(e) => updateSetting('legalName', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Company Logo (Forms)</span>
              <select
                value={settings.companyLogoFormsFileId}
                onChange={(event) => updateSetting('companyLogoFormsFileId', event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                <option value="" disabled>
                  {loadingCabinet
                    ? 'Loading File Cabinet...'
                    : cabinetFiles.length > 0
                      ? 'Select from File Cabinet'
                      : 'No files in File Cabinet'}
                </option>
                {cabinetFiles.map((file) => (
                  <option key={file.id} value={file.id}>{file.originalName}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Company Logo (Pages)</span>
              <select
                value={settings.companyLogoPagesFileId}
                onChange={(event) => updateSetting('companyLogoPagesFileId', event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                <option value="" disabled>
                  {loadingCabinet
                    ? 'Loading File Cabinet...'
                    : cabinetFiles.length > 0
                      ? 'Select from File Cabinet'
                      : 'No files in File Cabinet'}
                </option>
                {cabinetFiles.map((file) => (
                  <option key={file.id} value={file.id}>{file.originalName}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 pt-1">
              <input type="checkbox" checked={settings.displayLogoInternally} onChange={(e) => updateSetting('displayLogoInternally', e.target.checked)} className="h-4 w-4" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Display logo internally</span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Web Site</span>
              <input value={settings.webSite} onChange={(e) => updateSetting('webSite', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>County/State/Province *</span>
              <input value={settings.stateProvince} onChange={(e) => updateSetting('stateProvince', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Country</span>
              <input value={settings.country} onChange={(e) => updateSetting('country', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Return Email Address *</span>
              <input value={settings.returnEmail} onChange={(e) => updateSetting('returnEmail', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fax</span>
              <input value={settings.fax} onChange={(e) => updateSetting('fax', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Currency</span>
              <input value={settings.currency} onChange={(e) => updateSetting('currency', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Employer Identification Number (EIN)</span>
              <input value={settings.ein} onChange={(e) => updateSetting('ein', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>SSN or TIN (Social Security Number, Tax ID Number)</span>
              <input value={settings.ssnTin} onChange={(e) => updateSetting('ssnTin', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>First Fiscal Month</span>
              <input value={settings.firstFiscalMonth} onChange={(e) => updateSetting('firstFiscalMonth', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Time Zone</span>
              <input value={settings.timeZone} onChange={(e) => updateSetting('timeZone', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>
          </div>

          <div className="space-y-4 rounded-xl border p-5" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Regional & Registration</h2>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Account ID</span>
              <input value={settings.accountId} onChange={(e) => updateSetting('accountId', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Main Data Center</span>
              <input value={settings.mainDataCenter} onChange={(e) => updateSetting('mainDataCenter', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Disaster Recovery Data Center</span>
              <input value={settings.disasterRecoveryDataCenter} onChange={(e) => updateSetting('disasterRecoveryDataCenter', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Legal Subsidiary Registered As</span>
              <input value={settings.legalEntityRegisteredAs} onChange={(e) => updateSetting('legalEntityRegisteredAs', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>UEN</span>
              <input value={settings.uen} onChange={(e) => updateSetting('uen', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>BRN</span>
              <input value={settings.brn} onChange={(e) => updateSetting('brn', e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>
          </div>
        </form>
      </div>
    </div>
  )
}
