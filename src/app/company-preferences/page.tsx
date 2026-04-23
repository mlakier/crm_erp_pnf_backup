"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  type CompanyPreferencesSettings,
  type IdSettingKey,
  DEFAULT_ID_SETTINGS,
  ID_SETTING_DEFINITIONS,
} from '@/lib/company-preferences-definitions'

type Settings = CompanyPreferencesSettings

const DEFAULT_SETTINGS: Settings = {
  idSettings: DEFAULT_ID_SETTINGS,
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

  const hasChanges = JSON.stringify(draftSettings) !== JSON.stringify(settings)

  function updateIdSetting(key: IdSettingKey, field: 'prefix' | 'digits', value: string) {
    setDraftSettings((current) => ({
      idSettings: {
        ...current.idSettings,
        [key]: {
          ...current.idSettings[key],
          [field]: field === 'digits' ? Math.max(1, Number.parseInt(value || '1', 10) || 1) : value,
        },
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
            Set company-wide ID prefix and digit rules for generated master data and transaction identifiers.
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
          {Object.entries(groupedDefinitions).map(([group, definitions]) => (
            <section
              key={group}
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {group} Id Settings
              </h2>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Record Type</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Prefix</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Digits</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {definitions.map((definition) => {
                      const config = draftSettings.idSettings[definition.key]
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
                              max={12}
                              value={config.digits}
                              onChange={(event) => updateIdSetting(definition.key, 'digits', event.target.value)}
                              className="w-24 rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
                              style={{ borderColor: 'var(--border-muted)' }}
                            />
                          </td>
                          <td className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                            {`${config.prefix}${'1'.padStart(config.digits, '0')}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
