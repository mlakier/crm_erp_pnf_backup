'use client'

import Link from 'next/link'
import { useState } from 'react'
import DeleteButton from '@/components/DeleteButton'

export default function PurchaseOrderPageActions({
  purchaseOrderId,
  detailHref,
  editing,
}: {
  purchaseOrderId: string
  detailHref: string
  editing: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')

    try {
      const result = await window.__purchaseOrderLineItemSavers?.[purchaseOrderId]?.()
      if (result && !result.ok) {
        setError(result.error ?? 'Failed to save line items')
        return
      }

      const form = document.getElementById(`inline-record-form-${purchaseOrderId}`) as HTMLFormElement | null
      form?.requestSubmit()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Link
              href={detailHref}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          <Link
            href={`${detailHref}?edit=1`}
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Edit
          </Link>
        )}
        <DeleteButton resource="purchase-orders" id={purchaseOrderId} />
      </div>
      {error ? (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
