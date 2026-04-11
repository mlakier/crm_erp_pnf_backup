'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function QuoteCreateSalesOrderButton({
  quoteId,
  existingSalesOrderId,
}: {
  quoteId: string
  existingSalesOrderId?: string | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (existingSalesOrderId) {
      router.push(`/sales-orders/${existingSalesOrderId}`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      })

      const body = await response.json()
      if (!response.ok) {
        if (response.status === 409 && body?.salesOrderId) {
          router.push(`/sales-orders/${body.salesOrderId}`)
          return
        }

        setError(body?.error || 'Unable to create sales order')
        setSaving(false)
        return
      }

      router.push(`/sales-orders/${body.id}`)
      router.refresh()
    } catch {
      setError('Unable to create sales order')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleCreate}
        disabled={saving}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400"
      >
        {saving ? 'Creating...' : existingSalesOrderId ? 'Open Sales Order' : 'Create Sales Order'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}