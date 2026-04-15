'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'
import AddressModal, { parseAddress } from '@/components/AddressModal'

type VendorEditValues = {
  name: string
  email: string
  phone: string
  address: string
  taxId: string
  primarySubsidiaryId: string
  primaryCurrencyId: string
  inactive: boolean
}

export default function VendorEditButton({
  vendorId,
  values,
  subsidiaries,
  currencies,
}: {
  vendorId: string
  values: VendorEditValues
  subsidiaries: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; name: string }>
}) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dismissPrompt, setDismissPrompt] = useState('')
  const [formValues, setFormValues] = useState<VendorEditValues>(values)
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
      const response = await fetch(`/api/vendors?id=${encodeURIComponent(vendorId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formValues, address }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Failed to update vendor')
      setOpen(false)
      setDismissPrompt('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update vendor')
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
            <h3 className="mb-4 text-base font-semibold text-white">Edit Vendor</h3>
            {dismissPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{dismissPrompt}</p> : null}

            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Name *</span>
                  <input
                    required
                    value={formValues.name}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Phone</span>
                  <input
                    value={formValues.phone}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Tax ID</span>
                  <input
                    value={formValues.taxId}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, taxId: e.target.value }))}
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
                  <span>Primary Subsidiary</span>
                  <select
                    value={formValues.primarySubsidiaryId}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, primarySubsidiaryId: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {subsidiaries.map((subsidiary) => (
                      <option key={subsidiary.id} value={subsidiary.id}>{subsidiary.subsidiaryId} - {subsidiary.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Primary Currency</span>
                  <select
                    value={formValues.primaryCurrencyId}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, primaryCurrencyId: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>{currency.currencyId} - {currency.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`vendor-inactive-${vendorId}`}
                  checked={formValues.inactive}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, inactive: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <label htmlFor={`vendor-inactive-${vendorId}`} className="text-sm text-white">Inactive</label>
              </div>

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
