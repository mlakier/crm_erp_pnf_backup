'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SalesOrderCreateInvoiceButton({ salesOrderId, existingInvoiceId }: { salesOrderId: string; existingInvoiceId?: string | null }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (existingInvoiceId) {
      router.push(`/invoices/${existingInvoiceId}`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesOrderId }),
      })

      const body = await response.json()
      if (!response.ok) {
        if (response.status === 409 && body?.invoiceId) {
          router.push(`/invoices/${body.invoiceId}`)
          return
        }

        setError(body?.error || 'Unable to create invoice')
        setSaving(false)
        return
      }

      router.push(`/invoices/${body.id}`)
      router.refresh()
    } catch {
      setError('Unable to create invoice')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={handleCreate} disabled={saving} className="inline-flex items-center rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:bg-violet-400">
        {saving ? 'Creating...' : existingInvoiceId ? 'Open Invoice' : 'Create Invoice'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
