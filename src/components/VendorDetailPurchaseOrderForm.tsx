'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VendorDetailPurchaseOrderForm({ vendorId, userId }: { vendorId: string; userId: string }) {
  const [total, setTotal] = useState('')
  const [status, setStatus] = useState('draft')
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
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          total: parseFloat(total) || 0,
          vendorId,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to create purchase order')
        setSaving(false)
        return
      }

      const createdId = body?.id as string | undefined
      setTotal('')
      setStatus('draft')
      setSuccess('Purchase order created')
      setSaving(false)
      window.setTimeout(() => setSuccess(''), 2200)
      router.refresh()
      if (createdId) focusRow(`po-${createdId}`)
    } catch {
      setError('Unable to create purchase order')
      setSaving(false)
    }
  }

  return (
    <section className="mb-8 rounded-xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      {success ? (
        <div className="fixed right-4 top-4 z-50 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
          {success}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>New Purchase Order</h3>
      <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Purchase order ID is generated automatically when the record is created.</p>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="Total"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <option value="draft">Draft</option>
          <option value="pending approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
        </select>
        {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Saving...' : 'Create Purchase Order'}
        </button>
      </form>
    </section>
  )
}
