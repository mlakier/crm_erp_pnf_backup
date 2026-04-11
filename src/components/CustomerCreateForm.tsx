'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import { useEffect } from 'react'
import { useListOptions } from '@/lib/list-options-client'

export default function CustomerCreateForm({
  ownerUserId,
  subsidiaries,
  currencies,
  onSuccess,
  onCancel,
}: {
  ownerUserId: string
  subsidiaries: Array<{ id: string; code: string; name: string }>
  currencies: Array<{ id: string; code: string; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [industry, setIndustry] = useState('')
  const [primarySubsidiaryId, setPrimarySubsidiaryId] = useState('')
  const [primaryCurrencyId, setPrimaryCurrencyId] = useState('')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [addressValidationError, setAddressValidationError] = useState('')
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [street1, setStreet1] = useState('')
  const [street2, setStreet2] = useState('')
  const [street3, setStreet3] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('US')
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactPosition, setContactPosition] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const router = useRouter()
  const industryOptions = useListOptions('customer', 'industry')

  useEffect(() => {
    let mounted = true
    async function loadRequirements() {
      try {
        const response = await fetch('/api/config/form-requirements', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) return
        if (mounted) setRuntimeRequirements(body?.config?.customerCreate ?? null)
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
    return isFieldRequired('customerCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return (
      <>
        {text} <span style={{ color: 'var(--danger)' }}>*</span>
      </>
    )
  }

  function formatAddress(): string {
    const lines = [street1.trim(), street2.trim(), street3.trim()].filter(Boolean)
    const cityLine = `${city.trim()}, ${stateProvince.trim()} ${postalCode.trim()}`.trim()
    return [...lines, cityLine, country.trim()].join(', ')
  }

  function validateAddressDraft(): string | null {
    if (req('addressStreet1') && !street1.trim()) return 'Street Address 1 is required'
    if (req('addressCity') && !city.trim()) return 'City is required'
    if (req('addressStateProvince') && !stateProvince.trim()) return 'State/Province is required'
    if (req('addressPostalCode') && !postalCode.trim()) return 'Zip/Postal Code is required'
    if (req('addressCountry') && !country.trim()) return 'Country is required'

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

  async function saveAddressFromModal() {
    const validationError = validateAddressDraft()
    if (validationError) {
      setAddressValidationError(validationError)
      return
    }

    setAddressValidationError('')
    // Temporarily using local validation until external address API key is configured.
    setAddress(formatAddress())
    setAddressModalOpen(false)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (req('address') && !address.trim()) {
      setError('Address is required. Click Address and save a validated address.')
      return
    }

    if (
      req('primaryContact') &&
      (req('contactFirstName') && !contactFirstName.trim())
    ) {
      setError('Primary contact first name is required')
      return
    }

    if (
      req('primaryContact') &&
      (req('contactLastName') && !contactLastName.trim())
    ) {
      setError('Primary contact last name is required')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          industry,
          primarySubsidiaryId,
          primaryCurrencyId,
          userId: ownerUserId,
          contacts: [
            {
              firstName: contactFirstName,
              lastName: contactLastName,
              email: contactEmail,
              phone: contactPhone,
              position: contactPosition,
            },
          ],
        }),
      })

      const body = await response.json()

      if (!response.ok) {
        setError(body.error || 'Unable to create customer')
        setSaving(false)
        return
      }

      setName('')
      setEmail('')
      setPhone('')
      setAddress('')
      setIndustry('')
      setPrimarySubsidiaryId('')
      setPrimaryCurrencyId('')
      setStreet1('')
      setStreet2('')
      setStreet3('')
      setCity('')
      setStateProvince('')
      setPostalCode('')
      setCountry('US')
      setAddressValidationError('')
      setValidatingAddress(false)
      setContactFirstName('')
      setContactLastName('')
      setContactEmail('')
      setContactPhone('')
      setContactPosition('')
      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch (err) {
      setError('Unable to create customer')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg p-2">
      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Customer ID is generated automatically when the record is created.</p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Name', req('name'))}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={req('name')}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Email', req('email'))}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={req('email')}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Phone', req('phone'))}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={req('phone')}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <option value="">None</option>
              {industryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Primary Subsidiary</label>
          <select
            value={primarySubsidiaryId}
            onChange={(e) => setPrimarySubsidiaryId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>None</option>
            {subsidiaries.map((subsidiary) => (
              <option key={subsidiary.id} value={subsidiary.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                {subsidiary.code} - {subsidiary.name}
              </option>
            ))}
          </select>
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Primary Currency</label>
            <select
              value={primaryCurrencyId}
              onChange={(e) => setPrimaryCurrencyId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
            >
              <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>None</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Address', req('address'))}</label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddressModalOpen(true)}
              className="rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              {address ? 'Edit Address' : 'Enter Address'}
            </button>
            <p className="text-xs" style={{ color: address ? 'var(--text-secondary)' : 'var(--danger)' }}>
              {address ? address : 'No validated address saved yet'}
            </p>
          </div>
        </div>

        <div className="rounded-md border p-4" style={{ borderColor: 'var(--border-muted)' }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Primary Contact {req('primaryContact') ? '(Required)' : '(Optional)'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('First name', req('contactFirstName'))}</label>
              <input
                value={contactFirstName}
                onChange={(e) => setContactFirstName(e.target.value)}
                required={req('contactFirstName')}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Last name', req('contactLastName'))}</label>
              <input
                value={contactLastName}
                onChange={(e) => setContactLastName(e.target.value)}
                required={req('contactLastName')}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Contact email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Contact phone</label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Position</label>
            <input
              value={contactPosition}
              onChange={(e) => setContactPosition(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
        </div>

        {addressModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAddressModalOpen(false)}>
            <div
              className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
              style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">Validate Address</h2>
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="rounded-md px-2 py-1 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Street Address 1', req('addressStreet1'))}</label>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('City', req('addressCity'))}</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('State/Province', req('addressStateProvince'))}</label>
                    <input
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                      className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Zip Code / Postal Code', req('addressPostalCode'))}</label>
                    <input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Country', req('addressCountry'))}</label>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                      placeholder="US"
                    />
                  </div>
                </div>

                {addressValidationError ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{addressValidationError}</p> : null}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(false)}
                    disabled={validatingAddress}
                    className="rounded-md border px-4 py-2 text-sm font-medium"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveAddressFromModal}
                    disabled={validatingAddress}
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: validatingAddress ? '#64748b' : 'var(--accent-primary-strong)' }}
                  >
                    {validatingAddress ? 'Validating...' : 'Validate and Save Address'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
            {saving ? 'Saving...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </section>
  )
}