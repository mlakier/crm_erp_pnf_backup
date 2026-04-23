'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { isValidEmail } from '@/lib/validation'

export interface InlineRecordField {
  name: string
  label: string
  value: string
  type?: 'text' | 'number' | 'date' | 'email' | 'select' | 'checkbox' | 'address'
  multiple?: boolean
  column?: number
  order?: number
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  helpText?: string
  sourceText?: string
  disabledWhen?: {
    fieldName: string
    equals: string
  }
  disabledReason?: string
}

export interface InlineRecordSection {
  title: string
  description?: string
  fields: InlineRecordField[]
  collapsible?: boolean
  defaultExpanded?: boolean
}

export default function InlineRecordDetails({
  resource,
  id,
  title,
  fields,
  sections,
  editing,
  columns = 2,
  showInternalActions = true,
}: {
  resource: string
  id: string
  title: string
  fields?: InlineRecordField[]
  sections?: InlineRecordSection[]
  editing: boolean
  columns?: number
  showInternalActions?: boolean
}) {
  const resolvedSections = sections ?? [{ title, fields: fields ?? [] }]
  const allFields = resolvedSections.flatMap((section) => section.fields)
  const router = useRouter()
  const pathname = usePathname()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allFields.map((field) => [field.name, field.value]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [addressFieldBeingEdited, setAddressFieldBeingEdited] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      resolvedSections.map((section) => [section.title, section.defaultExpanded ?? true])
    )
  )

  const optionLabelsByField = useMemo(
    () =>
      Object.fromEntries(
        allFields.map((field) => [
          field.name,
          Object.fromEntries((field.options ?? []).map((option) => [option.value, option.label])),
        ])
      ) as Record<string, Record<string, string>>,
    [allFields]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    for (const field of allFields) {
      const isEmailField = field.type === 'email' || field.name.toLowerCase().includes('email')
      if (!isEmailField) continue

      const value = (values[field.name] ?? '').trim()
      if (value && !isValidEmail(value)) {
        setError(`${field.label} is not a valid email address`)
        setSaving(false)
        return
      }
    }

    try {
      const response = await fetch(`/api/${resource}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const raw = await response.text()
      if (!response.ok) {
        try {
          const body = JSON.parse(raw) as { error?: string }
          setError(body.error ?? 'Failed to save changes')
        } catch {
          setError(raw || 'Failed to save changes')
        }
        return
      }

      router.replace(pathname)
      router.refresh()
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{title}</h2>
        {editing && showInternalActions ? (
          <div className="flex items-center gap-2">
            <Link
              href={pathname}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              form={`inline-record-form-${id}`}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <form id={`inline-record-form-${id}`} onSubmit={handleSubmit}>
          <div className="space-y-6">
            {resolvedSections.map((section, index) => (
              <div
                key={section.title}
                className={index > 0 ? 'border-t pt-6' : ''}
                style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
              >
                <SectionHeader
                  title={section.title}
                  description={section.description}
                  collapsible={Boolean(section.collapsible)}
                  expanded={expandedSections[section.title] ?? true}
                  onToggle={() =>
                    setExpandedSections((prev) => ({ ...prev, [section.title]: !(prev[section.title] ?? true) }))
                  }
                  grouped={Boolean(sections)}
                />
                {(expandedSections[section.title] ?? true) ? (
                  <SectionFieldGrid
                    columns={columns}
                    fields={section.fields}
                    mode="edit"
                    values={values}
                    optionLabelsByField={optionLabelsByField}
                    setValues={setValues}
                    setAddressFieldBeingEdited={setAddressFieldBeingEdited}
                  />
                ) : null}
              </div>
            ))}
          </div>
          {error ? <p className="mt-4 text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        </form>
      ) : (
        <div className="space-y-6">
            {resolvedSections.map((section, index) => (
              <div
                key={section.title}
                className={index > 0 ? 'border-t pt-6' : ''}
                style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
              >
                <SectionHeader
                  title={section.title}
                  description={section.description}
                  collapsible={Boolean(section.collapsible)}
                  expanded={expandedSections[section.title] ?? true}
                  onToggle={() =>
                    setExpandedSections((prev) => ({ ...prev, [section.title]: !(prev[section.title] ?? true) }))
                  }
                  grouped={Boolean(sections)}
                />
                {(expandedSections[section.title] ?? true) ? (
                  <SectionFieldGrid
                    columns={columns}
                    fields={section.fields}
                    mode="view"
                    values={values}
                    optionLabelsByField={optionLabelsByField}
                  />
                ) : null}
              </div>
            ))}
          </div>
      )}

      <AddressModal
        open={addressFieldBeingEdited !== null}
        onClose={() => setAddressFieldBeingEdited(null)}
        onSave={(formattedAddress) => {
          const fieldName = addressFieldBeingEdited
          if (!fieldName) return

          const parsed = parseAddress(formattedAddress)
          setValues((prev) => {
            const next = { ...prev, [fieldName]: formattedAddress }
            if (Object.prototype.hasOwnProperty.call(next, 'country')) {
              next.country = parsed.country
            }
            return next
          })
          setAddressFieldBeingEdited(null)
        }}
        initialFields={parseAddress(addressFieldBeingEdited ? values[addressFieldBeingEdited] ?? '' : '')}
        zIndex={130}
      />
    </div>
  )
}

function getGridClassName(columns: number) {
  const normalized = Math.min(4, Math.max(1, columns))
  return {
    className: 'grid gap-3',
    style: { gridTemplateColumns: `repeat(${normalized}, minmax(0, 1fr))` },
  }
}

function getFieldGridStyle(field: InlineRecordField, columns: number): React.CSSProperties {
  const normalizedColumns = Math.min(4, Math.max(1, columns))
  const column = Math.min(normalizedColumns, Math.max(1, field.column ?? 1))
  const row = Math.max(1, (field.order ?? 0) + 1)
  return { gridColumnStart: column, gridRowStart: row }
}

function SectionFieldGrid({
  columns,
  fields,
  mode,
  values,
  optionLabelsByField,
  setValues,
  setAddressFieldBeingEdited,
}: {
  columns: number
  fields: InlineRecordField[]
  mode: 'view' | 'edit'
  values: Record<string, string>
  optionLabelsByField: Record<string, Record<string, string>>
  setValues?: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setAddressFieldBeingEdited?: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const normalizedColumns = Math.min(4, Math.max(1, columns))
  const grid = getGridClassName(normalizedColumns)
  const orderedFields = [...fields].sort((a, b) => {
    const leftColumn = a.column ?? 1
    const rightColumn = b.column ?? 1
    if (leftColumn !== rightColumn) return leftColumn - rightColumn
    return (a.order ?? 0) - (b.order ?? 0)
  })

  return (
    <dl className={grid.className} style={grid.style}>
      {orderedFields.map((field) => {
        const cellStyle = getFieldGridStyle(field, normalizedColumns)
        if (mode === 'edit' && setValues && setAddressFieldBeingEdited) {
          const isDisabled = isFieldDisabled(field, values)
          return (
            <div key={field.name} style={cellStyle}>
              <dt className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <span>{field.label}</span>
                {field.helpText ? <FieldTooltip content={buildTooltipContent(field)} /> : null}
              </dt>
              <dd className="mt-1">
                {field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={values[field.name] === 'true'}
                      disabled={isDisabled}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [field.name]: event.target.checked ? 'true' : 'false' }))
                      }
                      className="h-4 w-4 rounded disabled:opacity-50"
                    />
                    {field.placeholder ?? field.label}
                  </label>
                ) : field.type === 'address' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setAddressFieldBeingEdited(field.name)}
                      className="rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                    >
                      {values[field.name] ? 'Edit Address' : 'Enter Address'}
                    </button>
                    <p className="text-xs" style={{ color: values[field.name] ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {values[field.name] || 'No address saved yet'}
                    </p>
                  </div>
                ) : field.type === 'select' ? (
                  field.multiple ? (
                    <MultiSelectDropdown
                      value={splitMultiValue(values[field.name] ?? '')}
                      options={field.options ?? []}
                      disabled={isDisabled}
                      placeholder={field.placeholder ?? 'Select options'}
                      onChange={(next) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: next.join(','),
                        }))
                      }
                    />
                  ) : (
                    <select
                      value={values[field.name] ?? ''}
                      disabled={isDisabled}
                      onChange={(event) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: event.target.value,
                        }))
                      }
                      className="block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                        {field.placeholder ?? 'Select option'}
                      </option>
                      {(field.options ?? []).map((option) => (
                        <option
                          key={`${field.name}-${option.value}`}
                          value={option.value}
                          style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    value={values[field.name] ?? ''}
                    disabled={isDisabled}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                )}
                {isDisabled && field.disabledReason ? (
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{field.disabledReason}</p>
                ) : null}
              </dd>
            </div>
          )
        }

        return (
          <div key={field.name} style={cellStyle}>
            <dt className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              <span>{field.label}</span>
              {field.helpText ? <FieldTooltip content={buildTooltipContent(field)} /> : null}
            </dt>
            <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatDisplayValue(field, values[field.name] ?? '', optionLabelsByField[field.name] ?? {})}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function formatDisplayValue(field: InlineRecordField, value: string, optionLabels: Record<string, string>) {
  if (field.type === 'checkbox') return value === 'true' ? 'Yes' : 'No'
  if (field.type === 'select') {
    if (field.multiple) {
      const labels = splitMultiValue(value).map((entry) => optionLabels[entry] ?? entry).filter(Boolean)
      return labels.length > 0 ? labels.join(', ') : '-'
    }
    return optionLabels[value] ?? value ?? '-'
  }
  return value || '-'
}

function splitMultiValue(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function buildTooltipContent(field: InlineRecordField) {
  const fieldType = field.type ? mapFieldTypeLabel(field.type) : 'text'
  const sourceLine = fieldType === 'list' && field.sourceText ? `\nField Source: ${field.sourceText}` : ''
  return `${field.helpText}\n\nField ID: ${field.name}\nField Type: ${fieldType}${sourceLine}`
}

function SectionHeader({
  title,
  description,
  collapsible,
  expanded,
  onToggle,
  grouped,
}: {
  title: string
  description?: string
  collapsible: boolean
  expanded: boolean
  onToggle: () => void
  grouped: boolean
}) {
  if (!grouped) return null

  if (!collapsible) {
    return (
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description ? <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p> : null}
      </div>
    )
  }

  return (
    <button type="button" onClick={onToggle} className="mb-4 flex w-full items-start justify-between gap-3 text-left">
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        {description ? <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>{description}</span> : null}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
        {expanded ? '▼' : '▶'}
      </span>
    </button>
  )
}

function isFieldDisabled(field: InlineRecordField, values: Record<string, string>) {
  if (!field.disabledWhen) return false
  return (values[field.disabledWhen.fieldName] ?? '') === field.disabledWhen.equals
}

function mapFieldTypeLabel(fieldType: NonNullable<InlineRecordField['type']>) {
  if (fieldType === 'select') return 'list'
  return fieldType
}

function FieldTooltip({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        aria-label={content}
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[60] mt-2 hidden w-72 rounded-lg border px-3 py-2 text-left text-xs leading-5 shadow-xl group-hover:block"
        style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className="block whitespace-pre-wrap">
            {line || '\u00A0'}
          </span>
        ))}
      </span>
    </span>
  )
}
