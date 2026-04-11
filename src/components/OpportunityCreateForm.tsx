'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import { useEffect } from 'react'
import { useListOptions } from '@/lib/list-options-client'

export default function OpportunityCreateForm({
  userId,
  customers,
  onSuccess,
  onCancel,
}: {
  userId: string
  customers: Array<{ id: string; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState('prospecting')
  const [closeDate, setCloseDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const router = useRouter()
  const stageOptions = useListOptions('opportunity', 'stage')

  useEffect(() => {
    let mounted = true
    async function loadRequirements() {
      try {
        const response = await fetch('/api/config/form-requirements', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) return
        if (mounted) setRuntimeRequirements(body?.config?.opportunityCreate ?? null)
      } catch {
        // Keep static defaults when config API is unavailable.
      }
    }
    loadRequirements()
    return () => {
      mounted = false
    }
  }, [])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('opportunityCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return (
      <>
        {text} <span style={{ color: 'var(--danger)' }}>*</span>
      </>
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (req('customerId') && !customerId) {
      setError('Please select a customer')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setError(body.error || 'Unable to create opportunity')
        setSaving(false)
        return
      }

      setName('')
      setAmount('')
      setStage('prospecting')
      setCloseDate('')
      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch (err) {
      setError('Unable to create opportunity')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg p-2">
      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Opportunity ID is generated automatically when the record is created.</p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Opportunity name', req('name'))}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={req('name')}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Amount', req('amount'))}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required={req('amount')}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
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
            onChange={(e) => setCloseDate(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Customer', req('customerId'))}</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required={req('customerId')}
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" disabled>
              Select customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
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
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#7fd0cf', color: '#0f172a' }}
          >
            {saving ? 'Saving...' : 'Create Opportunity'}
          </button>
        </div>
      </form>
    </section>
  )
}