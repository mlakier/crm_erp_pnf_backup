'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CustomerDetailContactForm({
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

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
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, position, customerId, userId }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to create contact')
        setSaving(false)
        return
      }

      const createdId = body?.id as string | undefined

      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setPosition('')
      setSuccess('Contact created')
      setSaving(false)
      window.setTimeout(() => setSuccess(''), 2200)
      onSuccess?.()
      router.refresh()
      if (createdId) focusRow(`contact-${createdId}`)
    } catch {
      setError('Unable to create contact')
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
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Position"
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
            {saving ? 'Saving...' : 'Create Contact'}
          </button>
        </div>
      </form>
    </>
  )
}
