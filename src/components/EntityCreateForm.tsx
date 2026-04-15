'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE } from '@/lib/address-country-config'

export default function EntityCreateForm({
  currencies,
  parentEntities,
  initialSubsidiaryId,
  onSuccess,
  onCancel,
}: {
  currencies: Array<{ id: string; currencyId: string; name: string }>
  parentEntities?: Array<{ id: string; subsidiaryId: string; name: string }>
  initialSubsidiaryId: string
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [currencyOptions, setCurrencyOptions] = useState(currencies)
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [entityType, setEntityType] = useState('')
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [taxId, setTaxId] = useState('')
  const [address, setAddress] = useState('')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [defaultCurrencyId, setDefaultCurrencyId] = useState('')
  const [parentEntityId, setParentEntityId] = useState('')
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
              .filter((item: unknown): item is { id: string; currencyId: string; name: string } => {
                if (!item || typeof item !== 'object') return false
                const row = item as { id?: unknown; currencyId?: unknown; name?: unknown }
                return typeof row.id === 'string' && typeof row.currencyId === 'string' && typeof row.name === 'string'
              })
              .sort((a, b) => a.currencyId.localeCompare(b.currencyId)),
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
        body: JSON.stringify({ name, legalName, entityType, country, taxId, address, defaultCurrencyId, parentEntityId, inactive: false }),
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
          <span>Subsidiary Id *</span>
          <input value={initialSubsidiaryId} readOnly disabled className="w-full rounded-md border px-3 py-2 text-white bg-transparent opacity-80" style={{ borderColor: 'var(--border-muted)' }} />
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code} style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Tax ID</span>
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Address</span>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddressModalOpen(true)}
            className="rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            {address ? 'Edit Address' : 'Enter Address'}
          </button>
          <p className="text-xs" style={{ color: address ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
            {address ? address : 'No address saved yet'}
          </p>
        </div>
      </label>
      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Parent Subsidiary</span>
        <select
          value={parentEntityId}
          onChange={(e) => setParentEntityId(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
        >
          <option value="" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}>None</option>
          {(parentEntities ?? []).map((entity) => (
            <option key={entity.id} value={entity.id} style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}>
              {entity.subsidiaryId} - {entity.name}
            </option>
          ))}
        </select>
      </label>
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
              {currency.currencyId} - {currency.name}
            </option>
          ))}
        </select>
      </label>
      <AddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSave={(formattedAddress) => {
          setAddress(formattedAddress)
          setCountry(parseAddress(formattedAddress).country)
          setAddressModalOpen(false)
        }}
        initialFields={{ ...parseAddress(address), country }}
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Subsidiary'}</button>
      </div>
    </form>
  )
}
