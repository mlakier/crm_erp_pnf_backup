'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'

type CustomerEditValues = {
  name: string
  email: string
  phone: string
  address: string
  industry: string
  primarySubsidiaryId: string
  primaryCurrencyId: string
  inactive: boolean
}

function parseAddress(raw: string) {
  if (!raw.trim()) {
    return { street1: '', street2: '', street3: '', city: '', stateProvince: '', postalCode: '', country: 'US' }
  }
  const parts = raw.split(', ')
  if (parts.length < 3) {
    return { street1: raw, street2: '', street3: '', city: '', stateProvince: '', postalCode: '', country: 'US' }
  }
  const country = parts[parts.length - 1]
  const statePostal = parts[parts.length - 2]
  const city = parts[parts.length - 3]
  const streetParts = parts.slice(0, parts.length - 3)
  const lastSpace = statePostal.lastIndexOf(' ')
  const stateProvince = lastSpace !== -1 ? statePostal.slice(0, lastSpace) : statePostal
  const postalCode = lastSpace !== -1 ? statePostal.slice(lastSpace + 1) : ''
  return {
    street1: streetParts[0] ?? '',
    street2: streetParts[1] ?? '',
    street3: streetParts[2] ?? '',
    city,
    stateProvince,
    postalCode,
    country,
  }
}

export default function CustomerEditButton({
  customerId,
  values,
  entities,
  currencies,
  industryOptions,
}: {
  customerId: string
  values: CustomerEditValues
  entities: Array<{ id: string; code: string; name: string }>
  currencies: Array<{ id: string; code: string; name: string }>
  industryOptions: string[]
}) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dismissPrompt, setDismissPrompt] = useState('')
  const [formValues, setFormValues] = useState<CustomerEditValues>(values)

  const [address, setAddress] = useState(values.address)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [addressModalPrompt, setAddressModalPrompt] = useState('')
  const [addressValidationError, setAddressValidationError] = useState('')
  const [validatingAddress, setValidatingAddress] = useState(false)
  const parsed = parseAddress(values.address)
  const [street1, setStreet1] = useState(parsed.street1)
  const [street2, setStreet2] = useState(parsed.street2)
  const [street3, setStreet3] = useState(parsed.street3)
  const [city, setCity] = useState(parsed.city)
  const [stateProvince, setStateProvince] = useState(parsed.stateProvince)
  const [postalCode, setPostalCode] = useState(parsed.postalCode)
  const [country, setCountry] = useState(parsed.country || 'US')

  useEffect(() => {
    setMounted(true)
  }, [])

  function resetFromProps() {
    setFormValues(values)
    const p = parseAddress(values.address)
    setAddress(values.address)
    setStreet1(p.street1)
    setStreet2(p.street2)
    setStreet3(p.street3)
    setCity(p.city)
    setStateProvince(p.stateProvince)
    setPostalCode(p.postalCode)
    setCountry(p.country || 'US')
    setAddressModalOpen(false)
    setAddressModalPrompt('')
    setAddressValidationError('')
    setValidatingAddress(false)
    setError('')
    setDismissPrompt('')
  }

  function formatAddress(): string {
    const lines = [street1.trim(), street2.trim(), street3.trim()].filter(Boolean)
    const cityLine = `${city.trim()}, ${stateProvince.trim()} ${postalCode.trim()}`.trim()
    return [...lines, cityLine, country.trim()].filter(Boolean).join(', ')
  }

  function validateAddressDraft(): string | null {
    const hasAnyAddressPart = [street1, street2, street3, city, stateProvince, postalCode, country]
      .some((v) => v.trim().length > 0)

    if (!hasAnyAddressPart) return 'Enter at least one address value'
    if (!street1.trim()) return 'Street Address 1 is required'
    if (!city.trim()) return 'City is required'
    if (!stateProvince.trim()) return 'State/Province is required'
    if (!postalCode.trim()) return 'Zip/Postal Code is required'
    if (!country.trim()) return 'Country is required'

    const normalizedCountry = country.trim().toUpperCase()
    const normalizedPostal = postalCode.trim()

    if (normalizedCountry === 'US' && !/^\d{5}(-\d{4})?$/.test(normalizedPostal)) {
      return 'US Zip Code must be 5 digits or ZIP+4 (e.g. 90210 or 90210-1234)'
    }
    if (normalizedCountry === 'CA' && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(normalizedPostal)) {
      return 'Canadian Postal Code must match format A1A 1A1'
    }
    return null
  }

  function saveAddressFromModal() {
    const validationError = validateAddressDraft()
    if (validationError) {
      setAddressValidationError(validationError)
      return
    }
    setAddressValidationError('')
    setValidatingAddress(false)
    const formattedAddress = formatAddress()
    setAddress(formattedAddress)
    setFormValues((prev) => ({ ...prev, address: formattedAddress }))
    setAddressModalPrompt('')
    setAddressModalOpen(false)
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
      const response = await fetch(`/api/customers?id=${encodeURIComponent(customerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formValues, address }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Failed to update customer')
      setOpen(false)
      setDismissPrompt('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer')
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
            <h3 className="mb-4 text-base font-semibold text-white">Edit Customer</h3>
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
                  <span>Industry</span>
                  <select
                    value={formValues.industry}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, industry: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                    style={{ borderColor: 'var(--border-muted)' }}
                  >
                    <option value="">None</option>
                    {industryOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Billing Address</label>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddressModalPrompt('')
                      setAddressValidationError('')
                      setAddressModalOpen(true)
                    }}
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
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>{e.code} - {e.name}</option>
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
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="customer-inactive"
                  checked={formValues.inactive}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, inactive: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <label htmlFor="customer-inactive" className="text-sm text-white">Inactive</label>
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

            {addressModalOpen ? (
              <div
                className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setAddressModalPrompt('Use Save Address or Cancel to close this window.')
                  }
                }}
              >
                <div
                  className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
                  style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-white">Validate Address</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setAddressModalPrompt('')
                        setAddressModalOpen(false)
                      }}
                      className="rounded-md px-2 py-1 text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                  </div>

                  {addressModalPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{addressModalPrompt}</p> : null}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Street Address 1 *</label>
                      <input
                        value={street1}
                        onChange={(e) => setStreet1(e.target.value)}
                        className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                        style={{ borderColor: 'var(--border-muted)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Street Address 2</label>
                      <input
                        value={street2}
                        onChange={(e) => setStreet2(e.target.value)}
                        className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                        style={{ borderColor: 'var(--border-muted)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Street Address 3</label>
                      <input
                        value={street3}
                        onChange={(e) => setStreet3(e.target.value)}
                        className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                        style={{ borderColor: 'var(--border-muted)' }}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>City *</label>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>State/Province *</label>
                        <input
                          value={stateProvince}
                          onChange={(e) => setStateProvince(e.target.value)}
                          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Zip Code / Postal Code *</label>
                        <input
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Country *</label>
                        <input
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </div>
                    </div>

                    {addressValidationError ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{addressValidationError}</p> : null}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAddressModalOpen(false)}
                        disabled={validatingAddress}
                        className="rounded-md border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveAddressFromModal}
                        disabled={validatingAddress}
                        className="rounded-md px-3 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: validatingAddress ? '#64748b' : 'var(--accent-primary-strong)' }}
                      >
                        {validatingAddress ? 'Validating...' : 'Validate and Save Address'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
