"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'

type CabinetFile = {
  id: string
  originalName: string
}

type Settings = {
  companyLogoFormsFileId: string
  companyLogoPagesFileId: string
}

export default function CompanyInformationPage() {
  const [cabinetFiles, setCabinetFiles] = useState<CabinetFile[]>([])
  const [loadingCabinet, setLoadingCabinet] = useState(true)
  const [settings, setSettings] = useState<Settings>({
    companyLogoFormsFileId: '',
    companyLogoPagesFileId: '',
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
        const nextSettings: Settings = {
          companyLogoFormsFileId: hasForms ? settingsBody.companyLogoFormsFileId as string : firstFileId,
          companyLogoPagesFileId: hasPages ? settingsBody.companyLogoPagesFileId as string : firstFileId,
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

  async function updateSetting(field: keyof Settings, value: string) {
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
              <input defaultValue="Tillster, Inc." className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Legal Name</span>
              <input defaultValue="Tillster, Inc." className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
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
              <input type="checkbox" defaultChecked className="h-4 w-4" />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Display logo internally</span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Web Site</span>
              <input defaultValue="www.tillster.com" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>County/State/Province *</span>
              <select defaultValue="Delaware" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="Delaware">Delaware</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Country</span>
              <select defaultValue="United States" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="United States">United States</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Return Email Address *</span>
              <input defaultValue="billing@tillster.com" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fax</span>
              <input defaultValue="" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Currency</span>
              <select defaultValue="USD" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Employer Identification Number (EIN)</span>
              <input defaultValue="26-0053244" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>SSN or TIN (Social Security Number, Tax ID Number)</span>
              <input defaultValue="26-0053244" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>First Fiscal Month</span>
              <select defaultValue="January" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="January">January</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Time Zone</span>
              <select defaultValue="(GMT-08:00) Pacific Time (US & Canada)" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="(GMT-08:00) Pacific Time (US & Canada)">(GMT-08:00) Pacific Time (US & Canada)</option>
              </select>
            </label>
          </div>

          <div className="space-y-4 rounded-xl border p-5" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Regional & Registration</h2>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Account ID</span>
              <input defaultValue="4460219_SB1" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Main Data Center</span>
              <input defaultValue="US Phoenix2" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Disaster Recovery Data Center</span>
              <input defaultValue="US Ashburn 2" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Legal Entity Registered As</span>
              <input defaultValue="" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>UEN</span>
              <input defaultValue="" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>BRN</span>
              <input defaultValue="" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            </label>
          </div>
        </form>
      </div>
    </div>
  )
}
