'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useListOptions } from '@/lib/list-options-client'

export default function CustomerDetailOpportunityForm({
  customerId,
  userId,
  onSuccess,
  onCancel,
}: {
  customerId: string
  userId: string
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState('prospecting')
  const [closeDate, setCloseDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const stageOptions = useListOptions('opportunity', 'stage')

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
      const response = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: parseFloat(amount) || 0,
          stage,
          closeDate: closeDate || null,
          customerId,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to create opportunity')
        setSaving(false)
        return
      }

      const createdId = body?.id as string | undefined

      setName('')
      setAmount('')
      setStage('prospecting')
      setCloseDate('')
      setSuccess('Opportunity created')
      setSaving(false)
      window.setTimeout(() => setSuccess(''), 2200)
      onSuccess?.()
      router.refresh()
      if (createdId) focusRow(`opportunity-${createdId}`)
    } catch {
      setError('Unable to create opportunity')
      setSaving(false)
    }
  }

  return (
    <>
      {success ? (
        <div className="fixed right-4 top-4 z-50 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
          {success}
        </div>
      ) : null}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Opportunity ID is generated automatically when the record is created.</p>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Opportunity name"
          className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {stageOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <input
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
        {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <div className={onCancel ? 'grid grid-cols-2 gap-3' : ''}>
          {onCancel ? (
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
            className="rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Saving...' : 'Create Opportunity'}
          </button>
        </div>
      </form>
    </>
  )
}
