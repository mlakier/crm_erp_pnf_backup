'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function OpportunityCreateQuoteButton({
  opportunityId,
  existingQuoteId,
}: {
  opportunityId: string
  existingQuoteId?: string | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (existingQuoteId) {
      router.push(`/quotes/${existingQuoteId}`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId }),
      })

      const body = await response.json()
      if (!response.ok) {
        if (response.status === 409 && body?.quoteId) {
          router.push(`/quotes/${body.quoteId}`)
          return
        }

        setError(body?.error || 'Unable to create quote')
        setSaving(false)
        return
      }

      router.push(`/quotes/${body.id}`)
      router.refresh()
    } catch {
      setError('Unable to create quote')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleCreate}
        disabled={saving}
        className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
      >
        {saving ? 'Creating...' : existingQuoteId ? 'Open Quote' : 'Create Quote'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}