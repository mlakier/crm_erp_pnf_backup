'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { isValidElement, type ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { RecordDetailSection } from '@/components/RecordDetailPanels'
import SearchableSelect from '@/components/SearchableSelect'

export type RecordHeaderField = {
  key: string
  label: string
  value: string
  displayValue?: ReactNode
  editable?: boolean
  required?: boolean
  requiredLocked?: boolean
  disabled?: boolean
  readOnly?: boolean
  type?: 'text' | 'number' | 'select' | 'date' | 'email' | 'checkbox' | 'address'
  multiple?: boolean
  options?: Array<{ value: string; label: string }>
  column?: number
  order?: number
  helpText?: string
  fieldType?: 'text' | 'number' | 'date' | 'email' | 'list' | 'checkbox' | 'currency'
  sourceText?: string
  href?: string | null
  subsectionTitle?: string
  subsectionDescription?: string
  placeholder?: string
}

export type RecordHeaderSection = {
  title: string
  description?: string
  rows?: number
  fields: RecordHeaderField[]
}

export default function RecordHeaderDetails({
  purchaseOrderId,
  editing,
  sections,
  columns,
  containerTitle,
  containerDescription,
  showSubsections = true,
  showSectionDescriptions = true,
  containerSectionMode = 'stacked',
  formId,
  submitMode = 'update',
  updateUrl,
  onSubmit,
  onValuesChange,
}: {
  purchaseOrderId?: string
  editing: boolean
  sections: RecordHeaderSection[]
  columns: number
  containerTitle?: string
  containerDescription?: string
  showSubsections?: boolean
  showSectionDescriptions?: boolean
  containerSectionMode?: 'stacked' | 'tabs'
  formId?: string
  submitMode?: 'update' | 'controlled'
  updateUrl?: string
  onSubmit?: (values: Record<string, string>) => Promise<{ ok?: boolean; error?: string } | void>
  onValuesChange?: (values: Record<string, string>) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const allFields = useMemo(
    () => sections.flatMap((section) => section.fields),
    [sections]
  )
  const incomingValues = useMemo(
    () => Object.fromEntries(allFields.map((field) => [field.key, field.value])),
    [allFields]
  )
  const [values, setValues] = useState<Record<string, string>>(() => incomingValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeSectionTitle, setActiveSectionTitle] = useState<string | null>(sections[0]?.title ?? null)
  const [openDateFieldKey, setOpenDateFieldKey] = useState<string | null>(null)
  const [visibleMonthByField, setVisibleMonthByField] = useState<Record<string, string>>({})
  const [showMonthYearPickerByField, setShowMonthYearPickerByField] = useState<Record<string, boolean>>({})
  const [datePopoverStyle, setDatePopoverStyle] = useState<{ top: number; left: number } | null>(null)
  const [addressFieldBeingEdited, setAddressFieldBeingEdited] = useState<string | null>(null)
  const datePopoverRef = useRef<HTMLDivElement | null>(null)
  const dateTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const editableFieldKeys = useMemo(
    () => new Set(allFields.filter((field) => field.editable).map((field) => field.key)),
    [allFields]
  )

  useEffect(() => {
    setValues((current) => {
      if (recordsMatch(current, incomingValues)) {
        return current
      }
      return incomingValues
    })
  }, [incomingValues])

  useEffect(() => {
    if (!sections.some((section) => section.title === activeSectionTitle)) {
      setActiveSectionTitle(sections[0]?.title ?? null)
    }
  }, [activeSectionTitle, sections])

  useEffect(() => {
    if (!openDateFieldKey) return
    const activeDateFieldKey = openDateFieldKey

    function updatePopoverPosition() {
      const trigger = dateTriggerRefs.current[activeDateFieldKey]
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const popoverWidth = 224
      const horizontalGap = 8
      const viewportPadding = 8
      let left = rect.right + horizontalGap

      if (left + popoverWidth > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, rect.left - popoverWidth - horizontalGap)
      }

      const top = Math.max(viewportPadding, rect.top)
      setDatePopoverStyle({ top, left })
    }

    updatePopoverPosition()

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      const trigger = dateTriggerRefs.current[activeDateFieldKey]
      if (!datePopoverRef.current?.contains(target) && !trigger?.contains(target)) {
        setOpenDateFieldKey(null)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenDateFieldKey(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [openDateFieldKey])

  function updateValue(fieldKey: string, nextValue: string) {
    if (values[fieldKey] === nextValue) return
    const nextValues = { ...values, [fieldKey]: nextValue }
    setValues(nextValues)
    onValuesChange?.(nextValues)
  }

  function renderPlacedFieldGrid(sectionFields: RecordHeaderField[], rowCount: number) {
    const normalizedColumns = Math.min(4, Math.max(1, columns))
    const normalizedRows = Math.max(
      1,
      Math.max(
        rowCount,
        ...sectionFields.map((field) => Math.max(1, (field.order ?? 0) + 1)),
      ),
    )

    const fieldByCell = new Map<string, RecordHeaderField>()
    for (const field of sectionFields) {
      const column = Math.min(normalizedColumns, Math.max(1, field.column ?? 1))
      const row = Math.max(1, (field.order ?? 0) + 1)
      const cellKey = `${column}:${row}`
      if (!fieldByCell.has(cellKey)) {
        fieldByCell.set(cellKey, field)
      }
    }

    return (
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${normalizedColumns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: normalizedRows }, (_, rowIndex) =>
          Array.from({ length: normalizedColumns }, (_, columnIndex) => {
            const cellField = fieldByCell.get(`${columnIndex + 1}:${rowIndex + 1}`)
            if (!cellField) {
              return <div key={`empty-${columnIndex + 1}-${rowIndex + 1}`} />
            }
            return (
              <div key={`${cellField.key}-${columnIndex + 1}-${rowIndex + 1}`}>
                {renderField(cellField, false)}
              </div>
            )
          }),
        )}
      </div>
    )
  }

  const renderField = (field: RecordHeaderField, useExplicitPlacement = true) => {
    const column = Math.min(4, Math.max(1, field.column ?? 1))
    const row = Math.max(1, (field.order ?? 0) + 1)
    const isSelect = field.type === 'select'
    const isDate = field.type === 'date'
    const isCheckbox = field.type === 'checkbox'
    const isAddress = field.type === 'address'
    const isDisabled = Boolean(field.disabled)
    const isReadOnly = Boolean(field.readOnly)
    const isUnavailable = isDisabled || isReadOnly
    const currentValue = values[field.key] ?? ''

    return (
      <div
        style={
          useExplicitPlacement
            ? {
                ...(typeof field.column === 'number' ? { gridColumnStart: column } : {}),
                ...(typeof field.order === 'number' ? { gridRowStart: row } : {}),
              }
            : undefined
        }
      >
        <dt className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          <span>{field.label}</span>
          {field.required ? (
            <span aria-hidden="true" style={{ color: 'var(--danger)' }}>
              *
            </span>
          ) : null}
          {field.helpText ? (
            <FieldTooltip content={buildTooltipContent(field)} />
          ) : null}
        </dt>
        <dd className="mt-1">
          {editing && field.editable ? (
            isCheckbox ? (
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={currentValue === 'true'}
                  disabled={isUnavailable}
                  onChange={(event) => updateValue(field.key, event.target.checked ? 'true' : 'false')}
                  className="h-4 w-4 rounded disabled:opacity-50"
                />
                {field.placeholder ?? field.label}
              </label>
            ) : isAddress ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => setAddressFieldBeingEdited(field.key)}
                  className="rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  {currentValue ? 'Edit Address' : 'Enter Address'}
                </button>
                <p className="text-xs" style={{ color: currentValue ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {currentValue || 'No address saved yet'}
                </p>
              </div>
            ) : isDate ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={currentValue}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  placeholder="YYYY-MM-DD"
                  required={field.required}
                  disabled={isUnavailable}
                  className="block min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)', opacity: isUnavailable ? 0.7 : 1, cursor: isUnavailable ? 'not-allowed' : 'text' }}
                />
                <button
                  type="button"
                  ref={(node) => {
                    dateTriggerRefs.current[field.key] = node
                  }}
                  onClick={() => {
                    setVisibleMonthByField((prev) => ({
                      ...prev,
                      [field.key]: getMonthStart(currentValue || new Date().toISOString().slice(0, 10)),
                    }))
                    setShowMonthYearPickerByField((prev) => ({
                      ...prev,
                      [field.key]: false,
                    }))
                    setOpenDateFieldKey((current) => (current === field.key ? null : field.key))
                  }}
                  className="shrink-0 rounded-md border px-2.5 py-2 text-xs font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', opacity: isUnavailable ? 0.7 : 1, cursor: isUnavailable ? 'not-allowed' : 'pointer' }}
                  disabled={isUnavailable}
                  aria-label={`Open ${field.label} calendar`}
                  title={`Open ${field.label} calendar`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4" />
                    <path d="M8 3v4" />
                    <path d="M3 10h18" />
                    <path d="M8 14h3" />
                    <path d="M13 14h3" />
                    <path d="M8 18h3" />
                  </svg>
                </button>
              </div>
            ) : isSelect && field.multiple ? (
              <MultiSelectDropdown
                value={splitMultiValue(currentValue)}
                options={field.options ?? []}
                disabled={isUnavailable}
                placeholder={field.placeholder ?? 'Select options'}
                onChange={(next) => updateValue(field.key, next.join(','))}
              />
            ) : isSelect && isUnavailable ? (
              <input
                type="text"
                value={formatDisplayValue(field, currentValue)}
                readOnly
                disabled
                className="block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)', opacity: 0.7, cursor: 'default' }}
              />
            ) : isSelect ? (
              <SearchableSelect
                selectedValue={currentValue}
                options={(field.options ?? []).map((option) => ({
                  value: option.value,
                  label: option.label,
                  searchText: `${option.value} ${option.label}`,
                  sortIdText: option.value,
                  sortLabelText: option.label,
                }))}
                placeholder={field.placeholder ?? 'Select option'}
                searchPlaceholder={`Search ${field.label}`}
                sortMode="label"
                disabled={isUnavailable}
                textClassName="text-sm"
                onSelect={(value) => updateValue(field.key, value)}
              />
            ) : (
                <input
                  type={field.type ?? 'text'}
                  value={currentValue}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  required={field.required}
                  disabled={isUnavailable}
                  readOnly={isReadOnly}
                  placeholder={field.placeholder}
                  className="block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)', opacity: isUnavailable ? 0.7 : 1, cursor: isUnavailable ? 'not-allowed' : 'text' }}
                />
              )
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {renderReadOnlyValue(field, currentValue)}
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

      const resolvedUpdateUrl =
        updateUrl ?? (purchaseOrderId ? `/api/purchase-orders?id=${encodeURIComponent(purchaseOrderId)}` : null)

      if (!resolvedUpdateUrl) {
        setError('Missing update endpoint')
        return
      }

      const response = await fetch(
        resolvedUpdateUrl,
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

  function renderSectionBody(section: RecordHeaderSection, embedded = false) {
    const wrapperClassName = embedded ? 'pt-3' : 'px-6 py-6'
    if (!showSubsections) {
      return (
        <div className={wrapperClassName}>
          {showSectionDescriptions && section.description ? (
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {section.description}
            </p>
          ) : null}
          {typeof section.rows === 'number'
            ? renderPlacedFieldGrid(section.fields, section.rows)
            : (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, columns))}, minmax(0, 1fr))` }}
              >
                {[...section.fields]
                  .sort((left, right) => {
                    const leftColumn = left.column ?? 1
                    const rightColumn = right.column ?? 1
                    if (leftColumn !== rightColumn) return leftColumn - rightColumn
                    return (left.order ?? 0) - (right.order ?? 0)
                  })
                  .map((field, index) => (
                    <div key={`${field.key}-${field.column ?? 1}-${field.order ?? 0}-${index}`}>
                      {renderField(field, true)}
                    </div>
                  ))}
              </div>
            )}
        </div>
      )
    }

    return (
      <div className={wrapperClassName}>
        {section.description ? (
          <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {section.description}
          </p>
        ) : null}
        {Object.entries(
          section.fields.reduce<Record<string, RecordHeaderField[]>>((groups, field) => {
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
              className={index > 0 ? 'mt-5 border-t pt-5' : ''}
              style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
            >
              {subsectionTitle ? (
                <div className="mb-3">
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
                  .map((field, index) => (
                    <div key={`${field.key}-${field.column ?? 1}-${field.order ?? 0}-${index}`}>
                      {renderField(field, !subsectionTitle)}
                    </div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderFlatSectionGrid(section: RecordHeaderSection, embedded = false) {
    return (
      <>
        {showSectionDescriptions && section.description ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {section.description}
          </p>
        ) : null}
        <div className={embedded ? 'mt-3' : 'mt-4'}>
          {typeof section.rows === 'number'
            ? renderPlacedFieldGrid(section.fields, section.rows)
            : (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, columns))}, minmax(0, 1fr))` }}
              >
                {[...section.fields]
                  .sort((left, right) => {
                    const leftColumn = left.column ?? 1
                    const rightColumn = right.column ?? 1
                    if (leftColumn !== rightColumn) return leftColumn - rightColumn
                    return (left.order ?? 0) - (right.order ?? 0)
                  })
                  .map((field, index) => (
                    <div key={`${field.key}-${field.column ?? 1}-${field.order ?? 0}-${index}`}>
                      {renderField(field, true)}
                    </div>
                  ))}
              </div>
            )}
        </div>
      </>
    )
  }

  const normalizedContainerSectionMode =
    containerSectionMode === 'tabs' && sections.length > 1 ? 'tabs' : 'stacked'
  const activeTabbedSection =
    normalizedContainerSectionMode === 'tabs'
      ? sections.find((section) => section.title === activeSectionTitle) ?? sections[0] ?? null
      : null

  return (
    <>
      <form id={formId ?? `inline-record-form-${purchaseOrderId ?? 'draft'}`} onSubmit={handleSubmit} className="space-y-6">
      {containerTitle ? (
        <RecordDetailSection title={containerTitle} count={allFields.length}>
          {containerDescription ? (
            <div className="px-6 pt-5">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {containerDescription}
              </p>
            </div>
          ) : null}
          <div className="px-6 py-5">
            {normalizedContainerSectionMode === 'tabs' && activeTabbedSection ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {sections.map((section) => {
                    const isActive = section.title === activeTabbedSection.title
                    return (
                      <button
                        key={section.title}
                        type="button"
                        onClick={() => setActiveSectionTitle(section.title)}
                        className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{
                          borderColor: isActive ? 'rgba(59,130,246,0.45)' : 'var(--border-muted)',
                          backgroundColor: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
                          color: isActive ? 'var(--accent-primary-strong)' : 'var(--text-secondary)',
                        }}
                      >
                        {activeTabbedSection.title === section.title
                          ? `${section.title} (${section.fields.length})`
                          : section.title}
                      </button>
                    )
                  })}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{activeTabbedSection.title}</h2>
                  {showSubsections
                    ? renderSectionBody(activeTabbedSection, true)
                    : renderFlatSectionGrid(activeTabbedSection, true)}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {sections.map((section, index) => (
                  <div
                    key={`${section.title}-${index}`}
                    className={index > 0 ? 'border-t pt-4' : ''}
                    style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
                  >
                    {section.title ? (
                      <div>
                        <h2 className="text-base font-semibold text-white">{section.title}</h2>
                      </div>
                    ) : null}
                    {showSubsections ? renderSectionBody(section, true) : renderFlatSectionGrid(section, true)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </RecordDetailSection>
      ) : (
        sections.map((section, index) => (
          <RecordDetailSection
            key={`${section.title}-${index}`}
            title={section.title}
            count={section.fields.length}
          >
            {renderSectionBody(section)}
          </RecordDetailSection>
        ))
      )}
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
      {openDateFieldKey && datePopoverStyle
        ? createPortal(
            <div
              ref={datePopoverRef}
              className="fixed z-[120] w-56 rounded-lg border p-2 shadow-xl"
              style={{
                top: datePopoverStyle.top,
                left: datePopoverStyle.left,
                backgroundColor: 'var(--card-elevated)',
                borderColor: 'var(--border-muted)',
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (showMonthYearPickerByField[openDateFieldKey]) {
                      setShowMonthYearPickerByField((prev) => ({ ...prev, [openDateFieldKey]: false }))
                      return
                    }
                    setVisibleMonthByField((prev) => ({
                      ...prev,
                      [openDateFieldKey]: shiftMonth(
                        visibleMonthByField[openDateFieldKey] ?? getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)),
                        -1,
                      ),
                    }))
                  }}
                  className="rounded-md border px-1.5 py-1 text-[10px] font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  {showMonthYearPickerByField[openDateFieldKey] ? 'Close' : 'Prev'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setShowMonthYearPickerByField((prev) => ({
                      ...prev,
                      [openDateFieldKey]: !prev[openDateFieldKey],
                    }))
                  }
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-white"
                >
                  {formatMonthLabel(visibleMonthByField[openDateFieldKey] ?? getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)))}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMonthByField((prev) => ({
                      ...prev,
                      [openDateFieldKey]: shiftMonth(
                        visibleMonthByField[openDateFieldKey] ?? getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)),
                        1,
                      ),
                    }))
                  }
                  className="rounded-md border px-1.5 py-1 text-[10px] font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Next
                </button>
              </div>
              {showMonthYearPickerByField[openDateFieldKey] ? (
                <div className="mb-2 space-y-2 rounded-md border p-2" style={{ borderColor: 'var(--border-muted)' }}>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Year
                    </label>
                    <SearchableSelect
                      selectedValue={String(
                        getYearPart(
                          visibleMonthByField[openDateFieldKey] ??
                            getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)),
                        ),
                      )}
                      onSelect={(value) =>
                        setVisibleMonthByField((prev) => ({
                          ...prev,
                          [openDateFieldKey]: setMonthStartYear(
                            visibleMonthByField[openDateFieldKey] ??
                              getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)),
                            Number(value),
                          ),
                        }))
                      }
                      options={buildYearOptions(
                        visibleMonthByField[openDateFieldKey] ??
                          getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)),
                      ).map((year) => ({
                        value: String(year),
                        label: String(year),
                        searchText: String(year),
                        sortIdText: String(year),
                        sortLabelText: String(year),
                      }))}
                      placeholder="Select year"
                      searchPlaceholder="Search year"
                      textClassName="text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Month
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {MONTH_OPTIONS.map((month) => {
                        const activeMonth = getMonthPart(visibleMonthByField[openDateFieldKey] ?? getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)))
                        const isActive = month.value === activeMonth
                        return (
                          <button
                            key={`${openDateFieldKey}-${month.value}`}
                            type="button"
                            onClick={() => {
                              setVisibleMonthByField((prev) => ({
                                ...prev,
                                [openDateFieldKey]: setMonthStartMonth(
                                  visibleMonthByField[openDateFieldKey] ?? getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10)),
                                  month.value,
                                ),
                              }))
                              setShowMonthYearPickerByField((prev) => ({ ...prev, [openDateFieldKey]: false }))
                            }}
                            className="rounded-md border px-1 py-1.5 text-[10px] font-medium"
                            style={{
                              borderColor: isActive ? 'var(--accent-primary-strong)' : 'var(--border-muted)',
                              backgroundColor: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
                              color: isActive ? '#ffffff' : 'var(--text-secondary)',
                            }}
                          >
                            {month.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <span key={`${openDateFieldKey}-${day}`}>{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {buildCalendarDays(visibleMonthByField[openDateFieldKey] ?? getMonthStart(values[openDateFieldKey] || new Date().toISOString().slice(0, 10))).map((day) => {
                  const isSelected = day.value === (values[openDateFieldKey] ?? '')
                  const isCurrentMonth = day.inCurrentMonth
                  return (
                    <button
                      key={`${openDateFieldKey}-${day.value}`}
                      type="button"
                      onClick={() => {
                        updateValue(openDateFieldKey, day.value)
                        setOpenDateFieldKey(null)
                      }}
                      className="rounded-md px-0 py-1 text-[10px] transition-colors"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-primary-strong)' : 'transparent',
                        color: isSelected ? '#ffffff' : isCurrentMonth ? 'var(--foreground)' : 'var(--text-muted)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary-strong)' : 'transparent'}`,
                      }}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
      <AddressModal
        open={addressFieldBeingEdited !== null}
        onClose={() => setAddressFieldBeingEdited(null)}
        onSave={(formattedAddress) => {
          const fieldKey = addressFieldBeingEdited
          if (!fieldKey) return

          const parsed = parseAddress(formattedAddress)
          setValues((prev) => {
            const next = { ...prev, [fieldKey]: formattedAddress }
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
      </form>
    </>
  )
}

function formatDisplayValue(field: RecordHeaderField, value: string) {
  if (field.type === 'checkbox') {
    return value === 'true' ? 'Yes' : 'No'
  }
  if (field.type === 'select') {
    if (field.multiple) {
      const labels = splitMultiValue(value)
        .map((entry) => field.options?.find((option) => option.value === entry)?.label ?? entry)
        .filter(Boolean)
      return labels.length > 0 ? labels.join(', ') : '-'
    }
    return field.options?.find((option) => option.value === value)?.label ?? value ?? '-'
  }
  return value || '-'
}

function splitMultiValue(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function renderReadOnlyValue(field: RecordHeaderField, value: string) {
  const content = field.displayValue ?? formatDisplayValue(field, value)
  const resolvedHref = field.href ?? null
  if (!resolvedHref) return content
  if (isValidElement(content)) return content
  if (field.displayValue !== undefined && typeof content === 'object' && content !== null) return content

  const textContent = typeof content === 'string' || typeof content === 'number' ? String(content) : value
  if (!textContent || textContent === '-') return content

  return (
    <Link href={resolvedHref} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
      {content}
    </Link>
  )
}

function buildTooltipContent(field: RecordHeaderField) {
  const fieldType = field.fieldType ?? 'text'
  const sourceLine = fieldType === 'list' && field.sourceText ? `\nField Source: ${field.sourceText}` : ''
  return `${field.helpText}\n\nField ID: ${field.key}\nField Type: ${fieldType}${sourceLine}`
}

function FieldTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const lines = content.split('\n')

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const tooltipWidth = 288
      const tooltipGap = 10
      const viewportPadding = 8
      let left = rect.left

      if (left + tooltipWidth > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding)
      }

      let top = rect.bottom + tooltipGap
      const estimatedHeight = Math.max(72, lines.length * 22 + 20)
      if (top + estimatedHeight > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, rect.top - estimatedHeight - tooltipGap)
      }

      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, lines.length])

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        aria-label={content}
        aria-expanded={open}
      >
        ?
      </button>
      {open && position
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[140] w-72 rounded-lg border px-3 py-2 text-left text-xs leading-5 shadow-xl"
              style={{
                top: position.top,
                left: position.left,
                backgroundColor: 'var(--card-elevated)',
                borderColor: 'var(--border-muted)',
                color: 'var(--text-secondary)',
              }}
            >
              {lines.map((line, index) => (
                <span key={`${line}-${index}`} className="block whitespace-pre-wrap">
                  {line || '\u00A0'}
                </span>
              ))}
            </div>,
            document.body,
          )
        : null}
    </span>
  )
}

function getMonthStart(dateValue: string) {
  const [year, month] = (dateValue || new Date().toISOString().slice(0, 10)).split('-').map(Number)
  if (!year || !month) {
    const today = new Date()
    return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function shiftMonth(monthStart: string, offset: number) {
  const [year, month] = monthStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function formatMonthLabel(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  )
}

function buildCalendarDays(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const firstWeekday = firstDay.getUTCDay()
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - firstWeekday))

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart)
    current.setUTCDate(gridStart.getUTCDate() + index)
    return {
      value: `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`,
      label: current.getUTCDate(),
      inCurrentMonth: current.getUTCMonth() === month - 1,
    }
  })
}

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
]

function getYearPart(monthStart: string) {
  return Number(monthStart.split('-')[0])
}

function getMonthPart(monthStart: string) {
  return Number(monthStart.split('-')[1])
}

function setMonthStartYear(monthStart: string, year: number) {
  return `${year}-${String(getMonthPart(monthStart)).padStart(2, '0')}-01`
}

function setMonthStartMonth(monthStart: string, month: number) {
  return `${getYearPart(monthStart)}-${String(month).padStart(2, '0')}-01`
}

function buildYearOptions(monthStart: string) {
  const selectedYear = getYearPart(monthStart)
  return Array.from({ length: 21 }, (_, index) => selectedYear - 10 + index)
}

function recordsMatch(left: Record<string, string> | null, right: Record<string, string>) {
  if (!left) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => left[key] === right[key])
}
