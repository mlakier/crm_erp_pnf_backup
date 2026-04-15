'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'

export default function EmployeeCreateForm({
  entities,
  departments,
  onSuccess,
  onCancel,
}: {
  entities: Array<{ id: string; subsidiaryId: string; name: string }>
  departments: Array<{ id: string; departmentId: string; name: string }>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [entityId, setEntityId] = useState('')
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
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, title, departmentId, entityId, inactive: false }),
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>First Name *</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Last Name *</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Department</span>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
          <option value="">None</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.departmentId} - {department.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Subsidiary</span>
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
          <option value="">None</option>
          {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>)}
        </select>
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Employee'}</button>
      </div>
    </form>
  )
}
