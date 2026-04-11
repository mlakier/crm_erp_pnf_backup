'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EntityCreateForm({
  currencies,
  onSuccess,
  onCancel,
}: {
  currencies: Array<{ id: string; code: string; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [currencyOptions, setCurrencyOptions] = useState(currencies)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [entityType, setEntityType] = useState('')
  const [defaultCurrencyId, setDefaultCurrencyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCurrencyOptions(currencies)
  }, [currencies])

  useEffect(() => {
    let mounted = true
    async function loadCurrencies() {
      if (currencies.length > 0) return
      try {
        const response = await fetch('/api/currencies', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body)) return
        if (mounted) {
          setCurrencyOptions(
            body
              .filter((item: unknown): item is { id: string; code: string; name: string } => {
                if (!item || typeof item !== 'object') return false
                const row = item as { id?: unknown; code?: unknown; name?: unknown }
                return typeof row.id === 'string' && typeof row.code === 'string' && typeof row.name === 'string'
              })
              .sort((a, b) => a.code.localeCompare(b.code)),
          )
        }
      } catch {
        // Keep form usable even if the fetch fails.
      }
    }
    loadCurrencies()
    return () => {
      mounted = false
    }
  }, [currencies])

  const hasCurrencies = useMemo(() => currencyOptions.length > 0, [currencyOptions])

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, legalName, entityType, defaultCurrencyId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Create failed')
      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={submitForm}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Code *</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Legal Name</span>
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Type</span>
          <input value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Default Currency</span>
        <select
          value={defaultCurrencyId}
          onChange={(e) => setDefaultCurrencyId(e.target.value)}
          disabled={!hasCurrencies}
          className="w-full rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
        >
          <option value="" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}>
            {hasCurrencies ? 'None' : 'No currencies available'}
          </option>
          {currencyOptions.map((currency) => (
            <option key={currency.id} value={currency.id} style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}>
              {currency.code} - {currency.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Subsidiary'}</button>
      </div>
    </form>
  )
}
