"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  type CompanyPreferencesSettings,
  type IdSetting,
  type IdSettingKey,
  COMPANY_DOCUMENT_DATE_FORMAT_OPTIONS,
  COMPANY_MONEY_LOCALE_OPTIONS,
  COMPANY_NEGATIVE_COLOR_OPTIONS,
  COMPANY_SHOW_CURRENCY_ON_OPTIONS,
  COMPANY_ZERO_FORMAT_OPTIONS,
  DEFAULT_ID_SETTINGS,
  DEFAULT_MONEY_SETTINGS,
  ID_SETTING_DEFINITIONS,
  type DocumentDateFormat,
  type MoneyDisplay,
  type NegativeColor,
  type NegativeNumberFormat,
  type ShowCurrencyOn,
  type ZeroFormat,
} from '@/lib/company-preferences-definitions'
import { fmtCurrency, fmtDocumentDate, getNegativeAmountColor } from '@/lib/format'

type Settings = CompanyPreferencesSettings

const DEFAULT_SETTINGS: Settings = {
  idSettings: DEFAULT_ID_SETTINGS,
  moneySettings: DEFAULT_MONEY_SETTINGS,
}

const TRANSACTION_SUBGROUP_ORDER = ['Order to Cash', 'Purchase to Pay', 'Record to Report'] as const

function isTransactionDefinition(group: string) {
  return group === 'Transactions'
}

function formatIdPreview(config: IdSetting) {
  const sequence = Math.max(config.startingNumber, 1)
  const suffix = config.digits > 0 ? String(sequence).padStart(config.digits, '0') : String(sequence)
  return `${config.prefix}${suffix}`
}

export default function CompanyPreferencesPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [draftSettings, setDraftSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadSettings() {
      try {
        const response = await fetch('/api/company-preferences/settings', { cache: 'no-store' })
        const body = (await response.json()) as Partial<Settings>
        if (!response.ok || !mounted) return
        const nextSettings = {
          idSettings: {
            ...DEFAULT_ID_SETTINGS,
            ...(body.idSettings ?? {}),
          },
          moneySettings: {
            ...DEFAULT_MONEY_SETTINGS,
            ...(body.moneySettings ?? {}),
          },
        }
        setSettings(nextSettings)
        setDraftSettings(nextSettings)
      } catch {
        if (mounted) setMessage('Unable to load company preferences')
      }
    }

    void loadSettings()

    return () => {
      mounted = false
    }
  }, [])

  const groupedDefinitions = useMemo(() => {
    return ID_SETTING_DEFINITIONS.reduce<Record<string, typeof ID_SETTING_DEFINITIONS>>((acc, definition) => {
      if (!acc[definition.group]) acc[definition.group] = []
      acc[definition.group].push(definition)
      return acc
    }, {})
  }, [])

  const transactionDefinitionsBySubgroup = useMemo(() => {
    const definitions = groupedDefinitions.Transactions ?? []
    return TRANSACTION_SUBGROUP_ORDER.map((subgroup) => ({
      subgroup,
      definitions: definitions.filter((definition) => definition.subgroup === subgroup),
    })).filter((entry) => entry.definitions.length > 0)
  }, [groupedDefinitions])

  const hasChanges = JSON.stringify(draftSettings) !== JSON.stringify(settings)

  function updateIdSetting(
    key: IdSettingKey,
    field: keyof IdSetting,
    value: string | boolean,
  ) {
    setDraftSettings((current) => ({
      ...current,
      idSettings: {
        ...current.idSettings,
        [key]: {
          ...current.idSettings[key],
          [field]:
            field === 'digits'
              ? Math.min(12, Math.max(0, Number.parseInt(String(value || '0'), 10) || 0))
              : field === 'startingNumber'
                ? Math.min(999999999, Math.max(1, Number.parseInt(String(value || '1'), 10) || 1))
                : value,
        },
      },
    }))
    setMessage('')
  }

  function renderIdSettingsTable(
    definitions: typeof ID_SETTING_DEFINITIONS,
    options?: { transactions?: boolean },
  ) {
    const transactions = options?.transactions ?? false
    return (
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Record Type</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Prefix</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Starting Number</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Digits</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Auto-Increment</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Lock</th>
              <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Preview</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((definition) => {
              const config = draftSettings.idSettings[definition.key]
              const digitsDisabled = transactions

              return (
                <tr key={definition.key} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <td className="px-4 py-2 text-sm text-white">{definition.label}</td>
                  <td className="px-4 py-2">
                    <input
                      value={config.prefix}
                      onChange={(event) => updateIdSetting(definition.key, 'prefix', event.target.value)}
                      className="w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      value={config.startingNumber}
                      onChange={(event) => updateIdSetting(definition.key, 'startingNumber', event.target.value)}
                      className="w-28 rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={config.digits}
                      disabled={digitsDisabled}
                      onChange={(event) => updateIdSetting(definition.key, 'digits', event.target.value)}
                      className="w-24 rounded-md border bg-transparent px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={config.autoIncrement}
                        onChange={(event) => updateIdSetting(definition.key, 'autoIncrement', event.target.checked)}
                        className="h-4 w-4 rounded border"
                        style={{ borderColor: 'var(--border-muted)' }}
                      />
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={config.locked}
                        onChange={(event) => updateIdSetting(definition.key, 'locked', event.target.checked)}
                        className="h-4 w-4 rounded border"
                        style={{ borderColor: 'var(--border-muted)' }}
                      />
                    </label>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                    {formatIdPreview(config)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function updateMoneySetting(
    field: keyof Settings['moneySettings'],
    value: string,
  ) {
    setDraftSettings((current) => ({
      ...current,
      moneySettings: {
        ...current.moneySettings,
        [field]: value,
      },
    }))
    setMessage('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch('/api/company-preferences/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftSettings),
      })

      if (!response.ok) {
        setMessage('Failed to save company preferences')
        setSaving(false)
        return
      }

      setSettings(draftSettings)
      if (typeof window !== 'undefined') {
        ;(window as Window & { __COMPANY_MONEY_SETTINGS__?: Settings['moneySettings'] }).__COMPANY_MONEY_SETTINGS__ = draftSettings.moneySettings
      }
      setMessage('Company preferences saved')
      setSaving(false)
    } catch {
      setMessage('Failed to save company preferences')
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraftSettings(settings)
    setMessage('')
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div
        className="max-w-7xl rounded-2xl border p-8"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Company Prefs</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Set company-wide identifier and money display rules so records and transactions follow one standard.
          </p>
        </div>

        {message ? (
          <p className="mt-4 text-sm" style={{ color: message.includes('Failed') ? '#fca5a5' : 'var(--text-secondary)' }}>
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!hasChanges || saving}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-6 grid gap-6">
          <section
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Money Display
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Locale</span>
                <select
                  value={draftSettings.moneySettings.locale}
                  onChange={(event) => updateMoneySetting('locale', event.target.value)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  {COMPANY_MONEY_LOCALE_OPTIONS.map((locale) => (
                    <option key={locale.value} value={locale.value} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Fallback Currency</span>
                <input
                  value={draftSettings.moneySettings.fallbackCurrencyCode}
                  onChange={(event) => updateMoneySetting('fallbackCurrencyCode', event.target.value.toUpperCase())}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                  maxLength={3}
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Currency Display</span>
                <select
                  value={draftSettings.moneySettings.currencyDisplay}
                  onChange={(event) => updateMoneySetting('currencyDisplay', event.target.value as MoneyDisplay)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  <option value="code" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>Code</option>
                  <option value="symbol" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>Symbol</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Negative Format</span>
                <select
                  value={draftSettings.moneySettings.negativeNumberFormat}
                  onChange={(event) => updateMoneySetting('negativeNumberFormat', event.target.value as NegativeNumberFormat)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  <option value="parentheses" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>Parentheses</option>
                  <option value="minus" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>Minus</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Decimal Places</span>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={draftSettings.moneySettings.decimalPlaces}
                  onChange={(event) => updateMoneySetting('decimalPlaces', String(Math.min(6, Math.max(0, Number.parseInt(event.target.value || '0', 10) || 0))))}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Zero Format</span>
                <select
                  value={draftSettings.moneySettings.zeroFormat}
                  onChange={(event) => updateMoneySetting('zeroFormat', event.target.value as ZeroFormat)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  {COMPANY_ZERO_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Show Currency On</span>
                <select
                  value={draftSettings.moneySettings.showCurrencyOn}
                  onChange={(event) => updateMoneySetting('showCurrencyOn', event.target.value as ShowCurrencyOn)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  {COMPANY_SHOW_CURRENCY_ON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Negative Color</span>
                <select
                  value={draftSettings.moneySettings.negativeColor}
                  onChange={(event) => updateMoneySetting('negativeColor', event.target.value as NegativeColor)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  {COMPANY_NEGATIVE_COLOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm md:col-span-2 xl:col-span-4">
                <span style={{ color: 'var(--text-muted)' }}>Document Date Format</span>
                <select
                  value={draftSettings.moneySettings.documentDateFormat}
                  onChange={(event) => updateMoneySetting('documentDateFormat', event.target.value as DocumentDateFormat)}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  {COMPANY_DOCUMENT_DATE_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              className="mt-4 rounded-lg border p-4"
              style={{ borderColor: 'var(--border-muted)', backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Positive</p>
                  <p className="mt-1 text-sm font-medium text-white">{fmtCurrency(1234567.89, undefined, draftSettings.moneySettings)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Negative</p>
                  <p
                    className="mt-1 text-sm font-medium"
                    style={{ color: getNegativeAmountColor(draftSettings.moneySettings) ?? '#ffffff' }}
                  >
                    {fmtCurrency(-1234567.89, undefined, draftSettings.moneySettings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Line Example</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    Qty 12 x {fmtCurrency(249.5, undefined, draftSettings.moneySettings)} = {fmtCurrency(2994, undefined, draftSettings.moneySettings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Zero Example</p>
                  <p className="mt-1 text-sm font-medium text-white">{fmtCurrency(0, undefined, draftSettings.moneySettings) || '(blank)'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Base Currency</p>
                  <p className="mt-1 text-sm font-medium text-white">{fmtCurrency(1234.56, draftSettings.moneySettings.fallbackCurrencyCode, draftSettings.moneySettings)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Foreign Currency</p>
                  <p className="mt-1 text-sm font-medium text-white">{fmtCurrency(1234.56, 'EUR', draftSettings.moneySettings)}</p>
                </div>
                <div className="md:col-span-3">
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Document Date</p>
                  <p className="mt-1 text-sm font-medium text-white">{fmtDocumentDate('2026-04-23', draftSettings.moneySettings)}</p>
                </div>
              </div>
            </div>
          </section>

          {Object.entries(groupedDefinitions).map(([group, definitions]) => (
            <section
              key={group}
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {group} Id Settings
              </h2>

              {isTransactionDefinition(group) ? (
                <div className="mt-4 grid gap-6">
                  {transactionDefinitionsBySubgroup.map((entry) => (
                    <div key={entry.subgroup}>
                      <h3 className="text-sm font-semibold text-white">{entry.subgroup}</h3>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Transactions use flexible numbering, so preview and generation follow the starting number without forced padding.
                      </p>
                      {renderIdSettingsTable(entry.definitions, { transactions: true })}
                    </div>
                  ))}
                </div>
              ) : (
                renderIdSettingsTable(definitions)
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
