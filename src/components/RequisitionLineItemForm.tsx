'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: string; name: string; listPrice: number }

export default function RequisitionLineItemForm({
  requisitionId,
  items,
}: {
  requisitionId: string
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
  const [success, setSuccess] = useState('')

  const handleItemChange = (id: string) => {
    setItemId(id)
    if (id) {
      const item = items.find((i) => i.id === id)
      if (item) {
        if (!description) setDescription(item.name)
        setUnitPrice(String(item.listPrice))
      }
    }
  }

  const focusRow = (rowId: string) => {
    window.setTimeout(() => {
      const row = document.getElementById(rowId)
      if (!row) return
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.focus()
      row.classList.add('ring-2', 'ring-green-300')
      window.setTimeout(() => row.classList.remove('ring-2', 'ring-green-300'), 1800)
    }, 200)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/purchase-requisitions/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId,
          description,
          quantity: parseInt(quantity) || 1,
          unitPrice: parseFloat(unitPrice) || 0,
          notes: notes || null,
          itemId: itemId || null,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        setError(body?.error || 'Unable to add line item')
        setSaving(false)
        return
      }

      const createdId = body?.id as string | undefined
      setDescription('')
      setQuantity('1')
      setUnitPrice('')
      setNotes('')
      setItemId('')
      setSuccess('Line item added')
      setSaving(false)
      window.setTimeout(() => setSuccess(''), 2200)
      router.refresh()
      if (createdId) focusRow(`req-line-item-${createdId}`)
    } catch {
      setError('Unable to add line item')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      {success ? (
        <div className="fixed right-4 top-4 z-[130] rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
          {success}
        </div>
      ) : null}
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Add Line Item</h3>
      <form className="space-y-3" onSubmit={handleSubmit}>
        {items.length > 0 ? (
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
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <input
            required
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is being requested?"
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Quantity</label>
            <input
              required
              min="1"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Unit price</label>
            <input
              min="0"
              step="0.01"
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
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
