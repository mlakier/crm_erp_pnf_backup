'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchaseOrderReceiptForm({ purchaseOrderId, userId }: { purchaseOrderId: string; userId: string }) {
  const [quantity, setQuantity] = useState('1')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
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
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId, quantity, date, notes, userId }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to record receipt')
        setSaving(false)
        return
      }

      const createdId = body?.id as string | undefined
      setQuantity('1')
      setDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setSuccess('Receipt recorded')
      setSaving(false)
      window.setTimeout(() => setSuccess(''), 2200)
      router.refresh()
      if (createdId) focusRow(`receipt-${createdId}`)
    } catch {
      setError('Unable to record receipt')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      {success ? <div className="fixed right-4 top-4 z-50 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">{success}</div> : null}
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Record Receipt</h3>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            min="1"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Received quantity"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Receipt notes"
          rows={3}
          className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
        {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Saving...' : 'Record Receipt'}
        </button>
      </form>
    </section>
  )
}