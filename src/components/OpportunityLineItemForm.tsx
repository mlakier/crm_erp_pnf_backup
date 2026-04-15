'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: string; name: string; listPrice: number; itemId: string | null }

export default function OpportunityLineItemForm({
  opportunityId,
  items,
}: {
  opportunityId: string
  items: Item[]
}) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [itemId, setItemId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleItemChange = (id: string) => {
    setItemId(id)
    if (!id) return
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (!description) setDescription(item.name)
    setUnitPrice(String(item.listPrice))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/opportunities/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          description,
          quantity,
          unitPrice,
          notes,
          itemId: itemId || null,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to add line item')
        setSaving(false)
        return
      }

      setDescription('')
      setQuantity('1')
      setUnitPrice('')
      setNotes('')
      setItemId('')
      setSaving(false)
      router.refresh()
    } catch {
      setError('Unable to add line item')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Add Opportunity Line
      </h3>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Item (optional)</label>
          <select
            value={itemId}
            onChange={(e) => handleItemChange(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>— Select item —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {item.itemId ? `${item.itemId} - ${item.name}` : item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Quantity</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Unit Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>

        {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Adding…' : 'Add line item'}
        </button>
      </form>
    </section>
  )
}
