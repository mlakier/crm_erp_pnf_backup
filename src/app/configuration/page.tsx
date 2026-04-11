'use client'

import { useEffect, useMemo, useState } from 'react'
import { FORM_LABELS, FORM_REQUIREMENTS, FormKey, FormRequirementsMap } from '@/lib/form-requirements'

type Payload = {
  formLabels: Record<FormKey, string>
  fieldLabels: Record<FormKey, Record<string, string>>
  config: FormRequirementsMap
}

const EMPTY_PAYLOAD: Payload = {
  formLabels: FORM_LABELS,
  fieldLabels: {
    customerCreate: {},
    contactCreate: {},
    vendorCreate: {},
    opportunityCreate: {},
  },
  config: FORM_REQUIREMENTS,
}

export default function ConfigurationPage() {
  const [data, setData] = useState<Payload>(EMPTY_PAYLOAD)
  const [activeForm, setActiveForm] = useState<FormKey>('customerCreate')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        setError('')
        const response = await fetch('/api/config/form-requirements', { cache: 'no-store' })
        const body = (await response.json()) as Payload | { error?: string }

        if (!response.ok) {
          if (mounted) setError((body as { error?: string }).error ?? 'Failed to load configuration')
          return
        }

        if (mounted) setData(body as Payload)
      } catch {
        if (mounted) setError('Failed to load configuration')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const forms = useMemo(() => Object.keys(data.config) as FormKey[], [data.config])

  const fields = useMemo(() => {
    const configForForm = data.config[activeForm] ?? {}
    return Object.keys(configForForm)
  }, [activeForm, data.config])

  const requiredCount = useMemo(() => {
    const configForForm = data.config[activeForm] ?? {}
    return Object.values(configForForm).filter(Boolean).length
  }, [activeForm, data.config])

  function toggleField(field: string) {
    setData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [activeForm]: {
          ...prev.config[activeForm],
          [field]: !prev.config[activeForm][field],
        },
      },
    }))
  }

  async function save() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const response = await fetch('/api/config/form-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: data.config }),
      })

      const body = (await response.json()) as Payload | { error?: string }
      if (!response.ok) {
        setError((body as { error?: string }).error ?? 'Failed to save configuration')
        return
      }

      setData(body as Payload)
      setSuccess('Configuration saved')
      window.setTimeout(() => setSuccess(''), 2000)
    } catch {
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-6xl">
        <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h1 className="text-xl font-semibold text-white">Configuration</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Select a form, then check the fields that should be required.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
            <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Forms
              </p>
              <div className="space-y-1">
                {forms.map((form) => {
                  const active = form === activeForm
                  const count = Object.values(data.config[form] ?? {}).filter(Boolean).length
                  return (
                    <button
                      key={form}
                      type="button"
                      onClick={() => setActiveForm(form)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm"
                      style={
                        active
                          ? { backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#ffffff' }
                          : { color: 'var(--text-secondary)' }
                      }
                    >
                      <span>{data.formLabels[form] ?? form}</span>
                      <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">{data.formLabels[activeForm] ?? activeForm}</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Required fields enabled: {requiredCount}
                  </p>
                </div>
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <label
                      key={field}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {data.fieldLabels[activeForm]?.[field] ?? field}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(data.config[activeForm]?.[field])}
                        onChange={() => toggleField(field)}
                        className="h-4 w-4"
                      />
                    </label>
                  ))}
                </div>
              )}

              {error ? <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
              {success ? <p className="mt-4 text-sm" style={{ color: 'var(--success)' }}>{success}</p> : null}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || loading}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
