'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useListOptions } from '@/lib/list-options-client'

export default function LeadConvertOpportunityForm({
  leadId,
  defaultName,
  defaultStage,
}: {
  leadId: string
  defaultName: string
  defaultStage: string
}) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState(defaultStage)
  const [closeDate, setCloseDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const stageOptions = useListOptions('opportunity', 'stage')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/leads/convert?id=${encodeURIComponent(leadId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount,
          stage,
          closeDate: closeDate || null,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to convert lead')
        setSaving(false)
        return
      }

      if (body?.opportunityId) {
        router.push(`/opportunities/${body.opportunityId}`)
        router.refresh()
        return
      }

      router.push('/opportunities')
      router.refresh()
    } catch {
      setError('Unable to convert lead')
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Complete this opportunity setup to convert the lead.
      </p>

      <div>
        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Opportunity name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Leave blank if unknown"
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Stage</label>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {stageOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Close date</label>
        <input
          type="date"
          value={closeDate}
          onChange={(event) => setCloseDate(event.target.value)}
          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      </div>

      {error ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
        >
          {saving ? 'Creating...' : 'Create Opportunity'}
        </button>
      </div>
    </form>
  )
}