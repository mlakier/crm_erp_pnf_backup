'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import { useEffect } from 'react'
import { isValidEmail } from '@/lib/validation'
import AddressModal, { parseAddress } from '@/components/AddressModal'

export default function VendorCreateForm({
  subsidiaries,
  currencies,
  onSuccess,
  onCancel,
}: {
  subsidiaries: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [taxId, setTaxId] = useState('')
  const [primarySubsidiaryId, setPrimarySubsidiaryId] = useState('')
  const [primaryCurrencyId, setPrimaryCurrencyId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    async function loadRequirements() {
      try {
        const response = await fetch('/api/config/form-requirements', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) return
        if (mounted) setRuntimeRequirements(body?.config?.vendorCreate ?? null)
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
    return isFieldRequired('vendorCreate', field)
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

    if (email.trim() && !isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (req('address') && !address.trim()) {
      setError('Address is required. Click Address and save a validated address.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, phone, address, taxId, primarySubsidiaryId, primaryCurrencyId }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create vendor')
        setSaving(false)
        return
      }

      setName('')
      setEmail('')
      setPhone('')
      setAddress('')
      setTaxId('')
      setPrimarySubsidiaryId('')
      setPrimaryCurrencyId('')
      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch (err) {
      setError('Unable to create vendor')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg p-2">
      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Vendor ID is generated automatically when the record is created.</p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Vendor name', req('name'))}</label>
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
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Tax ID</label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
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
                {subsidiary.subsidiaryId} - {subsidiary.name}
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
                  {currency.currencyId} - {currency.name}
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
        <AddressModal
          open={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          onSave={(formatted) => {
            setAddress(formatted)
            setAddressModalOpen(false)
          }}
          initialFields={parseAddress(address)}
          zIndex={130}
        />
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
            {saving ? 'Saving...' : 'Create Vendor'}
          </button>
        </div>
      </form>
    </section>
  )
}