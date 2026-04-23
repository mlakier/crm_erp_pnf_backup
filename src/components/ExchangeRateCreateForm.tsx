'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CurrencyOption = {
  id: string
  currencyId: string
  code?: string
  name: string
}

type SelectOption = {
  value: string
  label: string
}

export default function ExchangeRateCreateForm({
  currencies,
  rateTypeOptions,
  onSuccess,
  onCancel,
}: {
  currencies: CurrencyOption[]
  rateTypeOptions: SelectOption[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [baseCurrencyId, setBaseCurrencyId] = useState(currencies[0]?.id ?? '')
  const [quoteCurrencyId, setQuoteCurrencyId] = useState(currencies[1]?.id ?? currencies[0]?.id ?? '')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [rate, setRate] = useState('')
  const [rateType, setRateType] = useState(rateTypeOptions[0]?.value ?? '')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCurrencyId,
          quoteCurrencyId,
          effectiveDate,
          rate,
          rateType,
          source,
          notes,
          active,
        }),
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
          <span>Base Currency *</span>
          <select
            value={baseCurrencyId}
            onChange={(event) => setBaseCurrencyId(event.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                {currency.code ?? currency.currencyId} - {currency.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Quote Currency *</span>
          <select
            value={quoteCurrencyId}
            onChange={(event) => setQuoteCurrencyId(event.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                {currency.code ?? currency.currencyId} - {currency.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Effective Date *</span>
          <input
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Rate *</span>
          <input
            type="number"
            step="0.000001"
            min="0.000001"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Rate Type</span>
          <select
            value={rateType}
            onChange={(event) => setRateType(event.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {rateTypeOptions.map((option) => (
              <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Source</span>
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="ECB, Open Exchange Rates, manual, etc."
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span>Active</span>
        </label>
      </div>

      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
          {saving ? 'Saving...' : 'Create Exchange Rate'}
        </button>
      </div>
    </form>
  )
}
