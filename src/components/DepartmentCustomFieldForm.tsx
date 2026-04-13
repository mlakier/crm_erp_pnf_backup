'use client'

import { useEffect, useState } from 'react'
import {
  CUSTOM_FIELD_TYPES,
  CustomFieldDefinitionSummary,
  CustomFieldType,
  normalizeCustomFieldName,
} from '@/lib/custom-fields'

const RESERVED_FIELD_NAMES = new Set([
  'code',
  'name',
  'description',
  'division',
  'entityid',
  'managerid',
  'inactive',
  'createdat',
  'updatedat',
])

export default function DepartmentCustomFieldForm({
  existingFields,
  onCreated,
  onCancel,
}: {
  existingFields: CustomFieldDefinitionSummary[]
  onCreated?: (field: CustomFieldDefinitionSummary) => void
  onCancel?: () => void
}) {
  const [label, setLabel] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [required, setRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameEdited, setNameEdited] = useState(false)

  useEffect(() => {
    if (nameEdited) return
    setName(normalizeCustomFieldName(label))
  }, [label, nameEdited])

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const normalizedName = normalizeCustomFieldName(name)
    const existingNames = new Set(existingFields.map((field) => field.name.toLowerCase()))
    const existingLabels = new Set(existingFields.map((field) => field.label.trim().toLowerCase()))

    if (!normalizedName) {
      setError('Field ID is required')
      setSaving(false)
      return
    }

    if (RESERVED_FIELD_NAMES.has(normalizedName.replace(/_/g, ''))) {
      setError('That field ID is reserved by the standard department schema')
      setSaving(false)
      return
    }

    if (existingNames.has(normalizedName)) {
      setError('A department custom field with that field ID already exists')
      setSaving(false)
      return
    }

    if (existingLabels.has(label.trim().toLowerCase())) {
      setError('A department custom field with that label already exists')
      setSaving(false)
      return
    }

    const options = type === 'select'
      ? optionsText.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
      : []

    try {
      const response = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          label: label.trim(),
          type,
          required,
          defaultValue: type === 'checkbox' ? (defaultValue === 'true' ? 'true' : 'false') : defaultValue.trim(),
          options,
          entityType: 'department',
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error ?? 'Unable to create custom field')
      }

      onCreated?.(body as CustomFieldDefinitionSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create custom field')
      setSaving(false)
      return
    }

    setSaving(false)
  }

  return (
    <form className="space-y-4" onSubmit={submitForm}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Field Name *</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Field ID *</span>
          <input
            value={name}
            onChange={(event) => {
              setNameEdited(true)
              setName(normalizeCustomFieldName(event.target.value))
            }}
            required
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Field Type *</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as CustomFieldType)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {CUSTOM_FIELD_TYPES.map((fieldType) => (
              <option key={fieldType} value={fieldType}>
                {fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 pt-7 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
          <span>Required field</span>
        </label>
      </div>

      {type === 'select' ? (
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Options *</span>
          <textarea
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            rows={5}
            required
            placeholder="One option per line"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
      ) : null}

      {type === 'checkbox' ? (
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Default Value</span>
          <select
            value={defaultValue || 'false'}
            onChange={(event) => setDefaultValue(event.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
      ) : (
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Default Value</span>
          <input
            value={defaultValue}
            onChange={(event) => setDefaultValue(event.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
      )}

      {error ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Creating...' : 'Create field'}
        </button>
      </div>
    </form>
  )
}