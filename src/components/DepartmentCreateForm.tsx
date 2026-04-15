'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DepartmentCustomizationConfig } from '@/lib/department-customization'
import {
  CustomFieldDefinitionSummary,
  parseCustomFieldOptions,
} from '@/lib/custom-fields'

export default function DepartmentCreateForm({
  managers,
  subsidiaries,
  customization,
  divisionOptions,
  customFields,
  onSuccess,
  onCancel,
}: {
  managers?: Array<{ id: string; firstName: string; lastName: string; employeeId?: string | null }>
  subsidiaries?: Array<{ id: string; subsidiaryId: string; name: string }>
  customization?: DepartmentCustomizationConfig
  divisionOptions?: string[]
  customFields?: CustomFieldDefinitionSummary[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [departmentId, setDepartmentId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [entityId, setEntityId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (customFields ?? []).map((field) => [field.id, field.defaultValue ?? (field.type === 'checkbox' ? 'false' : '')])
    )
  )
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
  const [division, setDivision] = useState(() => customization?.listBindings.divisionDefaultValue ?? '')

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, name, description, division, entityId, managerId, inactive: false }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Create failed')

      const createdDepartmentId = String(json?.id ?? '')
      if (createdDepartmentId) {
        const valueRequests = (customFields ?? [])
          .map((field) => ({
            fieldId: field.id,
            type: field.type,
            value: customFieldValues[field.id] ?? '',
          }))
          .filter(({ type, value }) => type === 'checkbox' || value.trim() !== '')
          .map(async ({ fieldId, value }) => {
            const saveResponse = await fetch('/api/custom-field-values', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fieldId,
                entityType: 'department',
                recordId: createdDepartmentId,
                value,
              }),
            })

            if (!saveResponse.ok) {
              const body = await saveResponse.json().catch(() => null)
              throw new Error(body?.error ?? 'Failed to save custom field values')
            }
          })

        await Promise.all(valueRequests)
      }

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
          <span>Department Id *</span>
          <input value={departmentId} onChange={(e) => setDepartmentId(e.target.value.toUpperCase())} required className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
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
                    {subsidiary.subsidiaryId} - {subsidiary.name}
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
                {manager.firstName} {manager.lastName}{manager.employeeId ? ` (${manager.employeeId})` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {(customFields?.length ?? 0) > 0 ? (
        <section className="space-y-4 rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
          <div>
            <h3 className="text-sm font-semibold text-white">Custom Fields</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Department-specific fields configured in the customization window.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(customFields ?? []).map((field) => {
              const value = customFieldValues[field.id] ?? ''
              const options = parseCustomFieldOptions(field.options)

              if (field.type === 'textarea') {
                return (
                  <label key={field.id} className="space-y-1 text-sm md:col-span-2" style={{ color: 'var(--text-secondary)' }}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    <textarea
                      value={value}
                      onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      rows={3}
                      required={field.required}
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </label>
                )
              }

              if (field.type === 'select') {
                return (
                  <label key={field.id} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    <select
                      value={value}
                      onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      required={field.required}
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value="">Select {field.label}</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              }

              if (field.type === 'checkbox') {
                return (
                  <label key={field.id} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-muted)' }}>
                    <input
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.checked ? 'true' : 'false' }))}
                    />
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                  </label>
                )
              }

              return (
                <label key={field.id} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={value}
                    onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
                    required={field.required}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              )
            })}
          </div>
        </section>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Department'}</button>
      </div>
    </form>
  )
}
