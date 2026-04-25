'use client'

import { useState } from 'react'

declare global {
  interface Window {
    __transactionLineItemSavers?: Record<string, () => Promise<{ ok: boolean; error?: string }>>
  }
}

export default function TransactionSaveButton({
  formId,
  recordId,
}: {
  formId: string
  recordId?: string
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')

    try {
      if (recordId) {
        const result = await window.__transactionLineItemSavers?.[recordId]?.()
        if (result && !result.ok) {
          setError(result.error ?? 'Failed to save line items')
          return
        }
      }

      const form = document.getElementById(formId) as HTMLFormElement | null
      form?.requestSubmit()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent-primary-strong)' }}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
      {error ? (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
