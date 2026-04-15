'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useListOptions } from '@/lib/list-options-client'

export default function ItemCreateForm({
  entities,
  currencies,
  onSuccess,
  onCancel,
}: {
  entities: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [itemId, setItemId] = useState('')
  const [sku, setSku] = useState('')
  const [itemType, setItemType] = useState('service')
  const [uom, setUom] = useState('')
  const [listPrice, setListPrice] = useState('0')
  const [entityId, setEntityId] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemTypeOptions = useListOptions('item', 'type')

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, itemId, sku, itemType, uom, listPrice: Number(listPrice), entityId, currencyId, inactive: false }),
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
          <span>Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Item Id</span>
          <input value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>SKU</span>
          <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Item Type</span>
          <select value={itemType} onChange={(e) => setItemType(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            {itemTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>UOM</span>
          <input value={uom} onChange={(e) => setUom(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>List Price</span>
          <input type="number" step="0.01" value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Subsidiary</span>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Currency</span>
          <select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.currencyId} - {currency.name}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Item'}</button>
      </div>
    </form>
  )
}
