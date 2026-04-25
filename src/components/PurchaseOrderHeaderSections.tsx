'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { RecordDetailSection } from '@/components/RecordDetailPanels'

export type PurchaseOrderHeaderField = {
  key: string
  label: string
  value: string
  displayValue?: ReactNode
  editable?: boolean
  type?: 'text' | 'number' | 'select' | 'date' | 'email'
  options?: Array<{ value: string; label: string }>
  column?: number
  order?: number
  helpText?: string
  fieldType?: 'text' | 'number' | 'date' | 'email' | 'list' | 'checkbox' | 'currency'
  sourceText?: string
  subsectionTitle?: string
  subsectionDescription?: string
}

export type PurchaseOrderHeaderSection = {
  title: string
  description?: string
  fields: PurchaseOrderHeaderField[]
}

export default function PurchaseOrderHeaderSections({
  purchaseOrderId,
  editing,
  sections,
  columns,
  formId,
  submitMode = 'update',
  updateUrl,
  onSubmit,
  onValuesChange,
}: {
  purchaseOrderId?: string
  editing: boolean
  sections: PurchaseOrderHeaderSection[]
  columns: number
  formId?: string
  submitMode?: 'update' | 'controlled'
  updateUrl?: string
  onSubmit?: (values: Record<string, string>) => Promise<{ ok?: boolean; error?: string } | void>
  onValuesChange?: (values: Record<string, string>) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const allFields = sections.flatMap((section) => section.fields)
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(allFields.map((field) => [field.key, field.value]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const editableFieldKeys = useMemo(
    () => new Set(allFields.filter((field) => field.editable).map((field) => field.key)),
    [allFields]
  )

  useEffect(() => {
    onValuesChange?.(values)
  }, [onValuesChange, values])

  const renderField = (field: PurchaseOrderHeaderField, useExplicitPlacement = true) => {
    const column = Math.min(4, Math.max(1, field.column ?? 1))
    const row = Math.max(1, (field.order ?? 0) + 1)
    const isSelect = field.type === 'select'
    const currentValue = values[field.key] ?? ''

    return (
      <div
        key={field.key}
        style={useExplicitPlacement ? { gridColumnStart: column, gridRowStart: row } : undefined}
      >
        <dt className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          <span>{field.label}</span>
          {field.helpText ? (
            <FieldTooltip content={buildTooltipContent(field)} />
          ) : null}
        </dt>
        <dd className="mt-1">
          {editing && field.editable ? (
            isSelect ? (
              <select
                value={currentValue}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                className="block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  Select option
                </option>
                {(field.options ?? []).map((option) => (
                  <option
                    key={`${field.key}-${option.value}`}
                    value={option.value}
                    style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type ?? 'text'}
                value={currentValue}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                className="block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            )
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {field.displayValue ?? formatDisplayValue(field, currentValue)}
            </div>
          )}
        </dd>
      </div>
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = Object.fromEntries(
      Object.entries(values).filter(([key]) => editableFieldKeys.has(key))
    )

    try {
      if (submitMode === 'controlled') {
        const result = await onSubmit?.(payload)
        if (result && result.ok === false) {
          setError(result.error ?? 'Failed to save changes')
        }
        return
      }

      if (!purchaseOrderId) {
        setError('Missing purchase order id')
        return
      }

      const response = await fetch(
        updateUrl ?? `/api/purchase-orders?id=${encodeURIComponent(purchaseOrderId)}`,
        {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        }
      )

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
    <form id={formId ?? `inline-record-form-${purchaseOrderId ?? 'draft'}`} onSubmit={handleSubmit} className="space-y-6">
      {sections.map((section) => (
        <RecordDetailSection
          key={section.title}
          title={section.title}
          count={section.fields.length}
        >
          <div className="px-6 py-6">
            {section.description ? (
              <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                {section.description}
              </p>
            ) : null}
            {Object.entries(
              section.fields.reduce<Record<string, PurchaseOrderHeaderField[]>>((groups, field) => {
                const key = field.subsectionTitle ?? '__default__'
                if (!groups[key]) groups[key] = []
                groups[key].push(field)
                return groups
              }, {})
            ).map(([subsectionKey, subsectionFields], index) => {
              const subsectionTitle = subsectionKey === '__default__' ? null : subsectionKey
              const subsectionDescription =
                subsectionTitle ? subsectionFields.find((field) => field.subsectionDescription)?.subsectionDescription : null

              return (
                <div
                  key={`${section.title}-${subsectionKey}`}
                  className={index > 0 ? 'mt-6 border-t pt-6' : ''}
                  style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
                >
                  {subsectionTitle ? (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-white">{subsectionTitle}</h3>
                      {subsectionDescription ? (
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {subsectionDescription}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, columns))}, minmax(0, 1fr))` }}
                  >
                    {[...subsectionFields]
                      .sort((left, right) => {
                        const leftColumn = left.column ?? 1
                        const rightColumn = right.column ?? 1
                        if (leftColumn !== rightColumn) return leftColumn - rightColumn
                        return (left.order ?? 0) - (right.order ?? 0)
                      })
                      .map((field) => renderField(field, !subsectionTitle))}
                  </div>
                </div>
              )
            })}
          </div>
        </RecordDetailSection>
      ))}
      {error ? (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      {saving ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Saving...
        </p>
      ) : null}
    </form>
  )
}

function formatDisplayValue(field: PurchaseOrderHeaderField, value: string) {
  if (field.type === 'select') {
    return field.options?.find((option) => option.value === value)?.label ?? value ?? '-'
  }
  return value || '-'
}

function buildTooltipContent(field: PurchaseOrderHeaderField) {
  const fieldType = field.fieldType ?? 'text'
  const sourceLine = fieldType === 'list' && field.sourceText ? `\nField Source: ${field.sourceText}` : ''
  return `${field.helpText}\n\nField ID: ${field.key}\nField Type: ${fieldType}${sourceLine}`
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
