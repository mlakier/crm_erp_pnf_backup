'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import { useEffect } from 'react'

export default function ContactCreateForm({
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [customerId, setCustomerId] = useState('')
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
        if (mounted) setRuntimeRequirements(body?.config?.contactCreate ?? null)
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
    return isFieldRequired('contactCreate', field)
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
    setSaving(true)

    try {
      if (req('customerId') && !customerId) {
        setError('Please select a customer')
        setSaving(false)
        return
      }

      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          position,
          customerId,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create contact')
        setSaving(false)
        return
      }

      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setPosition('')
      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch (err) {
      setError('Unable to create contact')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg p-2">
      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Contact ID is generated automatically when the record is created.</p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('First name', req('firstName'))}</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required={req('firstName')}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Last name', req('lastName'))}</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required={req('lastName')}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Position</label>
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
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
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}
          >
            <option value="" disabled style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>
              Select customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
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
            {saving ? 'Saving...' : 'Create Contact'}
          </button>
        </div>
      </form>
    </section>
  )
}