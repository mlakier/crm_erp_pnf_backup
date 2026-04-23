'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ManageListCreateForm() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [whereUsed, setWhereUsed] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const normalizedKey = key.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')

    try {
      const response = await fetch('/api/config/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-list',
          key: normalizedKey,
          label,
          whereUsed: whereUsed.split(',').map((entry) => entry.trim()).filter(Boolean),
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? 'Unable to create list')
        return
      }

      router.push(`/lists/${encodeURIComponent(normalizedKey)}/edit`)
      router.refresh()
    } catch {
      setError('Unable to create list')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="managed-list-create-form" onSubmit={handleSubmit} className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>List Key</span>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            required
            placeholder="e.g. CUSTOMER-SEGMENT"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm uppercase text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>Keys are normalized to uppercase with dashes.</span>
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Name</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            placeholder="e.g. Customer Segment"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2" style={{ color: 'var(--text-secondary)' }}>
          <span>Where Used</span>
          <input
            value={whereUsed}
            onChange={(event) => setWhereUsed(event.target.value)}
            placeholder="e.g. Customers, Vendors"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>Optional. Separate multiple areas with commas.</span>
        </label>
      </div>
      {error ? <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      {saving ? <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Creating list...</p> : null}
    </form>
  )
}
