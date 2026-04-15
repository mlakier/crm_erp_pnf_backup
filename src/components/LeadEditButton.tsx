'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'
import { useListOptions } from '@/lib/list-options-client'
import AddressModal, { parseAddress } from '@/components/AddressModal'

type LeadEditValues = {
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  title: string
  website: string
  industry: string
  status: string
  source: string
  rating: string
  expectedValue: string
  entityId: string
  currencyId: string
  lastContactedAt: string
  qualifiedAt: string
  convertedAt: string
  notes: string
  address: string
}

export default function LeadEditButton({
  leadId,
  values,
  entities,
  currencies,
}: {
  leadId: string
  values: LeadEditValues
  entities: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; name: string }>
}) {
  const router = useRouter()
  const leadSourceOptions = useListOptions('lead', 'source')
  const leadRatingOptions = useListOptions('lead', 'rating')

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dismissPrompt, setDismissPrompt] = useState('')
  const [formValues, setFormValues] = useState<LeadEditValues>(values)

  const [address, setAddress] = useState(values.address)
  const [addressModalOpen, setAddressModalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function resetFromProps() {
    setFormValues(values)
    setAddress(values.address)
    setAddressModalOpen(false)
    setError('')
    setDismissPrompt('')
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    if (formValues.email.trim() && !isValidEmail(formValues.email)) {
      setError('Please enter a valid email address')
      setSaving(false)
      return
    }

    try {
      const response = await fetch(`/api/leads?id=${encodeURIComponent(leadId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formValues, address }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to update lead')
      }

      setOpen(false)
      setDismissPrompt('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetFromProps()
          setOpen(true)
        }}
        className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: 'var(--accent-primary-strong)' }}
      >
        Edit
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDismissPrompt('Use Save changes to keep updates or Cancel to discard.')
            }
          }}
        >
          <div
            className="relative w-full max-w-3xl rounded-xl border p-6 shadow-xl"
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-white">Edit Lead</h3>
            {dismissPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{dismissPrompt}</p> : null}

            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>First Name</span>
                  <input
                    value={formValues.firstName}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Last Name</span>
                  <input
                    value={formValues.lastName}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Company</span>
                  <input
                    value={formValues.company}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, company: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Title</span>
                  <input
                    value={formValues.title}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={formValues.email}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Phone</span>
                  <input
                    value={formValues.phone}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
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
                  <select
                    value={formValues.status}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="new">New</option>
                    <option value="working">Working</option>
                    <option value="qualified">Qualified</option>
                    <option value="nurturing">Nurturing</option>
                    <option value="converted">Converted</option>
                    <option value="unqualified">Unqualified</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Source</span>
                  <select
                    value={formValues.source}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, source: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {leadSourceOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Rating</span>
                  <select
                    value={formValues.rating}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, rating: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {leadRatingOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Expected Value</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formValues.expectedValue}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, expectedValue: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Website</span>
                  <input
                    value={formValues.website}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, website: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Industry</span>
                  <input
                    value={formValues.industry}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, industry: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Subsidiary</span>
                  <select
                    value={formValues.entityId}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, entityId: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Currency</span>
                  <select
                    value={formValues.currencyId}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, currencyId: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.currencyId} - {currency.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Last Contacted</span>
                  <input
                    type="date"
                    value={formValues.lastContactedAt}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, lastContactedAt: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Qualified At</span>
                  <input
                    type="date"
                    value={formValues.qualifiedAt}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, qualifiedAt: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Converted At</span>
                  <input
                    type="date"
                    value={formValues.convertedAt}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, convertedAt: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              </div>

              <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>Notes</span>
                <textarea
                  value={formValues.notes}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
              </label>

              {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDismissPrompt('')
                    setOpen(false)
                  }}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>

            <AddressModal
              open={addressModalOpen}
              onClose={() => setAddressModalOpen(false)}
              onSave={(formatted) => {
                setAddress(formatted)
                setFormValues((prev) => ({ ...prev, address: formatted }))
                setAddressModalOpen(false)
              }}
              initialFields={parseAddress(address)}
              zIndex={130}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
