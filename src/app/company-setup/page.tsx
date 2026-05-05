'use client'

import { useEffect, useMemo, useState } from 'react'
import SearchableSelect from '@/components/SearchableSelect'

type AccountOption = {
  id: string
  accountId: string
  accountNumber: string
  name: string
  accountType: string
  accountRole?: string | null
  isPosting: boolean
  active: boolean
}

type Settings = {
  defaultApAccountId: string
  defaultArAccountId: string
  realizedFxGainAccountId: string
  realizedFxLossAccountId: string
  unrealizedFxGainAccountId: string
  unrealizedFxLossAccountId: string
}

const DEFAULT_SETTINGS: Settings = {
  defaultApAccountId: '',
  defaultArAccountId: '',
  realizedFxGainAccountId: '',
  realizedFxLossAccountId: '',
  unrealizedFxGainAccountId: '',
  unrealizedFxLossAccountId: '',
}

export default function CompanySetupPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadPage() {
      const [settingsResponse, accountsResponse] = await Promise.all([
        fetch('/api/company-setup/settings', { cache: 'no-store' }),
        fetch('/api/chart-of-accounts', { cache: 'no-store' }),
      ])

      const settingsBody = settingsResponse.ok ? ((await settingsResponse.json()) as Partial<Settings>) : {}
      const accountsBody = accountsResponse.ok ? ((await accountsResponse.json()) as AccountOption[]) : []

      if (!mounted) return

      setAccounts(accountsBody)
      const nextSettings = {
        defaultApAccountId: typeof settingsBody.defaultApAccountId === 'string' ? settingsBody.defaultApAccountId : '',
        defaultArAccountId: typeof settingsBody.defaultArAccountId === 'string' ? settingsBody.defaultArAccountId : '',
        realizedFxGainAccountId: typeof settingsBody.realizedFxGainAccountId === 'string' ? settingsBody.realizedFxGainAccountId : '',
        realizedFxLossAccountId: typeof settingsBody.realizedFxLossAccountId === 'string' ? settingsBody.realizedFxLossAccountId : '',
        unrealizedFxGainAccountId: typeof settingsBody.unrealizedFxGainAccountId === 'string' ? settingsBody.unrealizedFxGainAccountId : '',
        unrealizedFxLossAccountId: typeof settingsBody.unrealizedFxLossAccountId === 'string' ? settingsBody.unrealizedFxLossAccountId : '',
      }
      setSettings(nextSettings)
      setSavedSettings(nextSettings)
    }

    void loadPage()

    return () => {
      mounted = false
    }
  }, [])

  function updateSetting(field: keyof Settings, value: string) {
    const next = { ...settings, [field]: value }
    setSettings(next)
    setSaveMessage(null)
  }

  async function saveSettings() {
    setSaving(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/company-setup/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!response.ok) {
        throw new Error('Failed to save company setup defaults')
      }
      const saved = (await response.json()) as Settings
      setSettings(saved)
      setSavedSettings(saved)
      setSaveMessage('Accounting defaults saved.')
    } catch {
      setSaveMessage('Unable to save accounting defaults right now.')
    } finally {
      setSaving(false)
    }
  }

  const isDirty =
    settings.defaultApAccountId !== savedSettings.defaultApAccountId
    || settings.defaultArAccountId !== savedSettings.defaultArAccountId
    || settings.realizedFxGainAccountId !== savedSettings.realizedFxGainAccountId
    || settings.realizedFxLossAccountId !== savedSettings.realizedFxLossAccountId
    || settings.unrealizedFxGainAccountId !== savedSettings.unrealizedFxGainAccountId
    || settings.unrealizedFxLossAccountId !== savedSettings.unrealizedFxLossAccountId

  const postingAccounts = accounts.filter((account) => account.active !== false && account.isPosting !== false)
  const filterByRole = (roles: string[], fallback: (account: AccountOption) => boolean) => {
    const roleMatches = postingAccounts.filter((account) => roles.includes(account.accountRole ?? ''))
    return roleMatches.length > 0 ? roleMatches : postingAccounts.filter(fallback)
  }

  const liabilityAccounts = filterByRole(
    ['AP Trade'],
    (account) => account.accountType.toLowerCase().includes('liability'),
  )
  const assetAccounts = filterByRole(
    ['AR Trade'],
    (account) => account.accountType.toLowerCase().includes('asset'),
  )
  const profitAndLossAccounts = postingAccounts.filter((account) => {
    const accountType = account.accountType.toLowerCase()
    return (
      accountType.includes('revenue')
      || accountType.includes('income')
      || accountType.includes('expense')
      || accountType.includes('cost')
      || accountType.includes('other')
      || accountType.includes('gain')
      || accountType.includes('loss')
    )
  })
  const gainAccounts = filterByRole(
    ['FX Gain'],
    (account) => profitAndLossAccounts.includes(account),
  )
  const lossAccounts = filterByRole(
    ['FX Loss'],
    (account) => profitAndLossAccounts.includes(account),
  )

  const toOptions = (rows: AccountOption[]) =>
    rows.map((account) => ({
      value: account.id,
      label: `${account.accountNumber} - ${account.name}`,
      searchText: `${account.accountId} ${account.accountNumber} ${account.name} ${account.accountType} ${account.accountRole ?? ''}`,
    }))

  const apOptions = useMemo(() => toOptions(liabilityAccounts), [liabilityAccounts])
  const arOptions = useMemo(() => toOptions(assetAccounts), [assetAccounts])
  const fallbackFxAccounts = profitAndLossAccounts.length ? profitAndLossAccounts : postingAccounts
  const realizedFxGainOptions = useMemo(() => toOptions(gainAccounts.length ? gainAccounts : fallbackFxAccounts), [gainAccounts, fallbackFxAccounts])
  const realizedFxLossOptions = useMemo(() => toOptions(lossAccounts.length ? lossAccounts : fallbackFxAccounts), [lossAccounts, fallbackFxAccounts])
  const unrealizedFxGainOptions = realizedFxGainOptions
  const unrealizedFxLossOptions = realizedFxLossOptions

  return (
    <div className="min-h-full px-8 py-8">
      <div
        className="max-w-5xl rounded-2xl border p-8"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Company Setup</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Maintain company-wide accounting defaults here instead of mixing them into legal company information or hardcoding them in transaction flows.
          </p>
        </div>

        <div
          className="mt-6 space-y-4 rounded-xl border p-5"
          style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}
        >
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Accounting Defaults
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              These defaults back core AR, AP, realized FX, and later unrealized FX / revaluation behavior across the ERP. If a setting is blank, the system may still use a bootstrap fallback, but the goal is for this page to become the explicit source of truth.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--border-muted)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Review your changes, then save them as the live company accounting defaults.
            </p>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={!isDirty || saving}
              className="rounded-md px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? 'Saving...' : 'Save Defaults'}
            </button>
          </div>

          {saveMessage ? (
            <p className="text-sm" style={{ color: saveMessage.includes('Unable') ? '#fca5a5' : 'var(--text-secondary)' }}>
              {saveMessage}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Default AP Account
            </span>
            <SearchableSelect
              selectedValue={settings.defaultApAccountId}
              onSelect={(value) => updateSetting('defaultApAccountId', value)}
              options={apOptions}
              placeholder="Select default AP account"
              searchPlaceholder="Search AP account"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Default AR Account
            </span>
            <SearchableSelect
              selectedValue={settings.defaultArAccountId}
              onSelect={(value) => updateSetting('defaultArAccountId', value)}
              options={arOptions}
              placeholder="Select default AR account"
              searchPlaceholder="Search AR account"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Realized FX Gain Account
            </span>
            <SearchableSelect
              selectedValue={settings.realizedFxGainAccountId}
              onSelect={(value) => updateSetting('realizedFxGainAccountId', value)}
              options={realizedFxGainOptions}
              placeholder="Select realized FX gain account"
              searchPlaceholder="Search gain account"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Realized FX Loss Account
            </span>
            <SearchableSelect
              selectedValue={settings.realizedFxLossAccountId}
              onSelect={(value) => updateSetting('realizedFxLossAccountId', value)}
              options={realizedFxLossOptions}
              placeholder="Select realized FX loss account"
              searchPlaceholder="Search loss account"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Unrealized FX Gain Account
            </span>
            <SearchableSelect
              selectedValue={settings.unrealizedFxGainAccountId}
              onSelect={(value) => updateSetting('unrealizedFxGainAccountId', value)}
              options={unrealizedFxGainOptions}
              placeholder="Select unrealized FX gain account"
              searchPlaceholder="Search gain account"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Unrealized FX Loss Account
            </span>
            <SearchableSelect
              selectedValue={settings.unrealizedFxLossAccountId}
              onSelect={(value) => updateSetting('unrealizedFxLossAccountId', value)}
              options={unrealizedFxLossOptions}
              placeholder="Select unrealized FX loss account"
              searchPlaceholder="Search loss account"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
