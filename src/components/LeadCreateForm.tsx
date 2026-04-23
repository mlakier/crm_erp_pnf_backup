'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SelectOption } from '@/lib/list-source'
import { isValidEmail } from '@/lib/validation'
import AddressModal, { parseAddress } from '@/components/AddressModal'

export default function LeadCreateForm({
  userId,
  entities,
  currencies,
  leadSourceOptions,
  leadRatingOptions,
  leadStatusOptions,
  onSuccess,
  onCancel,
}: {
  userId: string
  entities: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; code?: string; name: string }>
  leadSourceOptions: SelectOption[]
  leadRatingOptions: SelectOption[]
  leadStatusOptions: SelectOption[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('new')
  const [source, setSource] = useState('')
  const [rating, setRating] = useState('')
  const [expectedValue, setExpectedValue] = useState('')
  const [entityId, setEntityId] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    if (email.trim() && !isValidEmail(email)) {
      setError('Please enter a valid email address')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          address,
          company,
          title,
          status,
          source,
          rating,
          expectedValue: expectedValue === '' ? null : Number(expectedValue),
          entityId,
          currencyId,
          notes,
          userId,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Create failed')
      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={submitForm}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Lead ID and lead number are generated automatically when the record is created.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>First Name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Last Name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Address</label>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddressModalOpen(true)}
            className="rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            {address ? 'Edit Address' : 'Enter Address'}
          </button>
          <p className="text-xs" style={{ color: address ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
            {address ? address : 'No address saved yet'}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            {leadStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {leadSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Rating</span>
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {leadRatingOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Expected Value</span>
          <input type="number" step="0.01" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Subsidiary</span>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Currency</span>
          <select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code ?? currency.currencyId} - {currency.name}</option>)}
          </select>
        </label>
      </div>
      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Lead'}</button>
      </div>

      <AddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSave={(formatted) => {
          setAddress(formatted)
          setAddressModalOpen(false)
        }}
        initialFields={parseAddress(address)}
        zIndex={60}
      />
    </form>
  )
}
