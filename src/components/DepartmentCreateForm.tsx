'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DepartmentCustomizationConfig } from '@/lib/department-customization'

export default function DepartmentCreateForm({
  managers,
  subsidiaries,
  customization,
  divisionOptions,
  onSuccess,
  onCancel,
}: {
  managers?: Array<{ id: string; firstName: string; lastName: string; employeeNumber?: string | null }>
  subsidiaries?: Array<{ id: string; code: string; name: string }>
  customization?: DepartmentCustomizationConfig
  divisionOptions?: string[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [division, setDivision] = useState('')
  const [entityId, setEntityId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fieldConfig = customization?.fields
  const showDescription = fieldConfig?.description?.visible ?? true
  const showDivision = fieldConfig?.division?.visible ?? true
  const showSubsidiary = fieldConfig?.entityId?.visible ?? true
  const showManager = fieldConfig?.managerId?.visible ?? true

  const requireDescription = fieldConfig?.description?.required ?? false
  const requireDivision = fieldConfig?.division?.required ?? false
  const requireSubsidiary = fieldConfig?.entityId?.required ?? false
  const requireManager = fieldConfig?.managerId?.required ?? false

  const useDivisionDropdown = Boolean(customization?.listBindings.divisionCustomListId && (divisionOptions?.length ?? 0) > 0)

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, description, division, entityId, managerId, inactive: false }),
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
          <span>Code *</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      </div>
      {showDescription ? (
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Description{requireDescription ? ' *' : ''}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required={requireDescription} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
        </label>
      ) : null}
      {(showDivision || showSubsidiary) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {showDivision ? (
            <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Division{requireDivision ? ' *' : ''}</span>
              {useDivisionDropdown ? (
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  required={requireDivision}
                  className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  <option value="">Select division</option>
                  {(divisionOptions ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={division} onChange={(e) => setDivision(e.target.value)} required={requireDivision} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
              )}
            </label>
          ) : null}
          {showSubsidiary ? (
            <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Subsidiary{requireSubsidiary ? ' *' : ''}</span>
              <select value={entityId} onChange={(e) => setEntityId(e.target.value)} required={requireSubsidiary} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="">None</option>
                {(subsidiaries ?? []).map((subsidiary) => (
                  <option key={subsidiary.id} value={subsidiary.id}>
                    {subsidiary.code} - {subsidiary.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {showManager ? (
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Manager{requireManager ? ' *' : ''}</span>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} required={requireManager} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
            <option value="">None</option>
            {(managers ?? []).map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.firstName} {manager.lastName}{manager.employeeNumber ? ` (${manager.employeeNumber})` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Department'}</button>
      </div>
    </form>
  )
}
