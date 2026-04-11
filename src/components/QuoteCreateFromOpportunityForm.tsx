'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type OpportunityOption = {
  id: string
  label: string
}

export default function QuoteCreateFromOpportunityForm({
  opportunities,
  onSuccess,
  onCancel,
}: {
  opportunities: OpportunityOption[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to create quote')
        setSaving(false)
        return
      }

      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch {
      setError('Unable to create quote')
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Opportunity</label>
        <select
          value={opportunityId}
          onChange={(event) => setOpportunityId(event.target.value)}
          required
          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          {opportunities.length === 0 ? <option value="">No eligible opportunities</option> : null}
          {opportunities.map((opportunity) => (
            <option key={opportunity.id} value={opportunity.id}>
              {opportunity.label}
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
          disabled={saving || opportunities.length === 0}
          className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          {saving ? 'Creating...' : 'Create Quote'}
        </button>
      </div>
    </form>
  )
}
