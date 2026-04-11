'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchaseOrderLineItemForm({ purchaseOrderId, userId }: { purchaseOrderId: string; userId: string }) {
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const focusRow = (rowId: string) => {
    window.setTimeout(() => {
      const row = document.getElementById(rowId) as HTMLElement | null
      if (!row) return
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.focus()
      row.classList.add('ring-2', 'ring-green-300')
      window.setTimeout(() => row.classList.remove('ring-2', 'ring-green-300'), 1800)
    }, 200)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/purchase-order-line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId, description, quantity, unitPrice, userId }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to add line item')
        setSaving(false)
        return
      }

      const createdId = body?.id as string | undefined
      setDescription('')
      setQuantity('1')
      setUnitPrice('')
      setSuccess('Line item added')
      setSaving(false)
      window.setTimeout(() => setSuccess(''), 2200)
      router.refresh()
      if (createdId) focusRow(`line-item-${createdId}`)
    } catch {
      setError('Unable to add line item')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      {success ? <div className="fixed right-4 top-4 z-50 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">{success}</div> : null}
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Add Line Item</h3>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            min="1"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <input
            required
            min="0"
            step="0.01"
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="Unit price"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Saving...' : 'Add Line Item'}
        </button>
      </form>
    </section>
  )
}