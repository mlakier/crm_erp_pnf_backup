'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseMoneyValue } from '@/lib/money'

export default function PurchaseOrderCreateForm({
  userId,
  vendors,
  fullPage,
  onSuccess,
  onCancel,
}: {
  userId: string
  vendors: Array<{ id: string; name: string }>
  fullPage?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [total, setTotal] = useState('')
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [status, setStatus] = useState('draft')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          total: parseMoneyValue(total),
          vendorId,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create purchase order')
        setSaving(false)
        return
      }
      if (fullPage) {
        router.push(`/purchase-orders/${body.id}`)
        return
      }
      setStatus('draft')
      setTotal('')
      setSaving(false)
      router.refresh()
      onSuccess?.()
    } catch {
      setError('Unable to create purchase order')
      setSaving(false)
    }
  }

  return (
    <section className={fullPage ? '' : ''}>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Purchase order ID is generated automatically when the record is created.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Vendor</label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total</label>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <option value="draft">Draft</option>
              <option value="pending approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
            </select>
          </div>
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="flex items-center justify-end gap-3">
          {fullPage ? (
            <button
              type="button"
              onClick={() => router.push('/purchase-orders')}
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed"
            style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Saving...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>
    </section>
  )
}
