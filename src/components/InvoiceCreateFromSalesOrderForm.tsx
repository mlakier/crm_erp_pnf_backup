'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type SalesOrderOption = {
  id: string
  label: string
}

export default function InvoiceCreateFromSalesOrderForm({
  salesOrders,
  onSuccess,
  onCancel,
}: {
  salesOrders: SalesOrderOption[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [salesOrderId, setSalesOrderId] = useState(salesOrders[0]?.id ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesOrderId }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to create invoice')
        setSaving(false)
        return
      }

      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch {
      setError('Unable to create invoice')
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sales Order</label>
        <select
          value={salesOrderId}
          onChange={(event) => setSalesOrderId(event.target.value)}
          required
          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          {salesOrders.length === 0 ? <option value="">No eligible sales orders</option> : null}
          {salesOrders.map((salesOrder) => (
            <option key={salesOrder.id} value={salesOrder.id}>
              {salesOrder.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm font-medium"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || salesOrders.length === 0}
          className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          {saving ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}
