'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  type AccountingPeriodFormCustomizationConfig,
  type AccountingPeriodFormFieldKey,
} from '@/lib/accounting-period-form-customization'

type CustomizeField = {
  id: AccountingPeriodFormFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

type DragState = {
  fieldId: AccountingPeriodFormFieldKey
  section: string
  column: number
  row: number
} | null

export default function AccountingPeriodDetailCustomizeMode({
  detailHref,
  initialLayout,
  initialRequirements,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: AccountingPeriodFormCustomizationConfig
  initialRequirements: Record<string, boolean>
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  const [layout, setLayout] = useState<AccountingPeriodFormCustomizationConfig>(initialLayout)
  const [requirements, setRequirements] = useState<Record<string, boolean>>(initialRequirements)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newSectionName, setNewSectionName] = useState('')
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null)
  const [editingSectionValue, setEditingSectionValue] = useState('')
  const [dragging, setDragging] = useState<DragState>(null)
  const draggingRef = useRef<DragState>(null)

  function getActiveDrag() {
    return draggingRef.current ?? dragging
  }

  function clearDragState() {
    draggingRef.current = null
    setDragging(null)
  }

  function resolveDragPayload(event?: React.DragEvent<HTMLElement>) {
    if (event) {
      const rawPayload = event.dataTransfer.getData('application/x-accounting-period-field')
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as DragState
          if (parsed && typeof parsed.fieldId === 'string' && typeof parsed.section === 'string') {
            return parsed
          }
        } catch {
          // Fall back to local state.
        }
      }
    }

    return getActiveDrag()
  }

  function findFieldAtCell(
    config: AccountingPeriodFormCustomizationConfig,
    section: string,
    column: number,
    row: number
  ) {
    return fields.find((field) => {
      const fieldConfig = config.fields[field.id]
      return fieldConfig.section === section && fieldConfig.column === column && fieldConfig.order === row
    })
  }

  function moveFieldToCell(
    prev: AccountingPeriodFormCustomizationConfig,
    fieldId: AccountingPeriodFormFieldKey,
    nextSection: string,
    nextColumn: number,
    nextRow: number
  ) {
    const nextFields = { ...prev.fields }
    const current = nextFields[fieldId]
    const normalizedColumn = Math.min(prev.formColumns, Math.max(1, nextColumn))
    const sectionRowCount = prev.sectionRows[nextSection] ?? 1
    const normalizedRow = Math.min(Math.max(0, Math.trunc(nextRow)), Math.max(0, sectionRowCount - 1))
    const occupant = findFieldAtCell(prev, nextSection, normalizedColumn, normalizedRow)

    if (occupant && occupant.id !== fieldId) {
      nextFields[occupant.id] = {
        ...nextFields[occupant.id],
        section: current.section,
        column: current.column,
        order: current.order,
      }
    }

    nextFields[fieldId] = {
      ...nextFields[fieldId],
      section: nextSection,
      column: normalizedColumn,
      order: normalizedRow,
    }

    return {
      ...prev,
      fields: nextFields,
    }
  }

  function handleDragStart(
    event: React.DragEvent<HTMLElement>,
    payload: DragState
  ) {
    if (!payload) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', payload.fieldId)
    event.dataTransfer.setData('application/x-accounting-period-field', JSON.stringify(payload))
    draggingRef.current = payload
    setDragging(payload)
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    const activeDrag = resolveDragPayload(event)
    if (!activeDrag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDropToCell(
    event: React.DragEvent<HTMLElement>,
    section: string,
    column: number,
    row: number
  ) {
    const activeDrag = resolveDragPayload(event)
    if (!activeDrag) return
    event.preventDefault()
    setLayout((prev) => moveFieldToCell(prev, activeDrag.fieldId, section, column, row))
    clearDragState()
  }

  function updateFormColumns(nextCount: number) {
    const formColumns = Math.min(4, Math.max(1, nextCount))
    setLayout((prev) => ({
      ...prev,
      formColumns,
      fields: Object.fromEntries(
        fields.map((field) => [
          field.id,
          {
            ...prev.fields[field.id],
            column: Math.min(formColumns, Math.max(1, prev.fields[field.id].column)),
          },
        ])
      ) as AccountingPeriodFormCustomizationConfig['fields'],
    }))
  }

  function updateSectionRows(section: string, nextCount: number) {
    const rowCount = Math.min(12, Math.max(1, Math.trunc(nextCount || 1)))
    setLayout((prev) => ({
      ...prev,
      sectionRows: {
        ...prev.sectionRows,
        [section]: rowCount,
      },
      fields: Object.fromEntries(
        fields.map((field) => {
          const fieldConfig = prev.fields[field.id]
          if (fieldConfig.section !== section) return [field.id, fieldConfig]
          return [
            field.id,
            {
              ...fieldConfig,
              order: Math.min(fieldConfig.order, rowCount - 1),
            },
          ]
        })
      ) as AccountingPeriodFormCustomizationConfig['fields'],
    }))
  }

  function toggleVisible(fieldId: AccountingPeriodFormFieldKey) {
    setLayout((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldId]: {
          ...prev.fields[fieldId],
          visible: !prev.fields[fieldId].visible,
        },
      },
    }))
  }

  function toggleRequired(fieldId: AccountingPeriodFormFieldKey) {
    setRequirements((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }))
  }

  function addSection() {
    const sectionName = newSectionName.trim()
    if (!sectionName) return
    if (layout.sections.includes(sectionName)) {
      setError('That section already exists.')
      return
    }

    setLayout((prev) => ({
      ...prev,
      sections: [...prev.sections, sectionName],
      sectionRows: {
        ...prev.sectionRows,
        [sectionName]: 2,
      },
    }))
    setNewSectionName('')
    setError('')
  }

  function startEditingSection(sectionName: string) {
    setEditingSectionName(sectionName)
    setEditingSectionValue(sectionName)
    setError('')
  }

  function saveSectionName(originalName: string) {
    const nextName = editingSectionValue.trim()
    if (!nextName) {
      setError('Section name cannot be blank.')
      return
    }
    if (nextName !== originalName && layout.sections.includes(nextName)) {
      setError('That section already exists.')
      return
    }

    setLayout((prev) => {
      const nextSections = prev.sections.map((section) => (section === originalName ? nextName : section))
      const nextSectionRows = Object.fromEntries(
        Object.entries(prev.sectionRows).map(([section, rows]) => [section === originalName ? nextName : section, rows])
      )

      return {
        ...prev,
        sections: nextSections,
        sectionRows: nextSectionRows,
        fields: Object.fromEntries(
          fields.map((field) => [
            field.id,
            prev.fields[field.id].section === originalName
              ? { ...prev.fields[field.id], section: nextName }
              : prev.fields[field.id],
          ])
        ) as AccountingPeriodFormCustomizationConfig['fields'],
      }
    })

    setEditingSectionName(null)
    setEditingSectionValue('')
    setError('')
  }

  function cancelEditingSection() {
    setEditingSectionName(null)
    setEditingSectionValue('')
  }

  function moveSection(sectionName: string, direction: -1 | 1) {
    setLayout((prev) => {
      const currentIndex = prev.sections.indexOf(sectionName)
      if (currentIndex === -1) return prev
      const targetIndex = currentIndex + direction
      if (targetIndex < 0 || targetIndex >= prev.sections.length) return prev
      const nextSections = [...prev.sections]
      const [moved] = nextSections.splice(currentIndex, 1)
      nextSections.splice(targetIndex, 0, moved)
      return { ...prev, sections: nextSections }
    })
  }

  function deleteSection(sectionName: string) {
    if (layout.sections.length <= 1) {
      setError('At least one section is required.')
      return
    }

    const sectionFieldCount = fields.filter((field) => layout.fields[field.id].section === sectionName).length
    if (sectionFieldCount > 0) {
      setError(`Section "${sectionName}" has fields in it. Move or hide those fields before deleting the section.`)
      return
    }

    setLayout((prev) => {
      const nextSections = prev.sections.filter((section) => section !== sectionName)
      const nextSectionRows = { ...prev.sectionRows }
      delete nextSectionRows[sectionName]
      return {
        ...prev,
        sections: nextSections,
        sectionRows: nextSectionRows,
      }
    })

    if (editingSectionName === sectionName) {
      cancelEditingSection()
    }

    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const [layoutResponse, requirementsResponse] = await Promise.all([
        fetch('/api/config/accounting-period-form-customization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: layout }),
        }),
        fetch('/api/config/form-requirements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: { accountingPeriodCreate: requirements } }),
        }),
      ])

      if (!layoutResponse.ok || !requirementsResponse.ok) {
        throw new Error('Unable to save customization')
      }

      window.location.href = detailHref
    } catch {
      setError('Unable to save customization')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customize Layout</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Arrange sections and fields so the accounting period page matches your preferred review flow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={detailHref}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save layout'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
              <label className="block text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Form Columns
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={layout.formColumns}
                onChange={(event) => updateFormColumns(Number(event.target.value))}
                className="mt-2 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Sections
              </h3>
              <div className="mt-3 space-y-3">
                {layout.sections.map((section, index) => (
                  <div key={section} className="rounded-md border p-3" style={{ borderColor: 'var(--border-muted)' }}>
                    {editingSectionName === section ? (
                      <div className="space-y-2">
                        <input
                          value={editingSectionValue}
                          onChange={(event) => setEditingSectionValue(event.target.value)}
                          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => saveSectionName(section)} className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
                            Save
                          </button>
                          <button type="button" onClick={cancelEditingSection} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-white">{section}</p>
                            {sectionDescriptions?.[section] ? (
                              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {sectionDescriptions[section]}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveSection(section, -1)} disabled={index === 0} className="rounded border px-2 py-1 text-xs disabled:opacity-40" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                              Up
                            </button>
                            <button type="button" onClick={() => moveSection(section, 1)} disabled={index === layout.sections.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-40" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                              Down
                            </button>
                            <button type="button" onClick={() => startEditingSection(section)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                              Rename
                            </button>
                            <button type="button" onClick={() => deleteSection(section)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--danger)' }}>
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            Rows in Section
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={layout.sectionRows[section] ?? 2}
                            onChange={(event) => updateSectionRows(section, Number(event.target.value))}
                            className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={newSectionName}
                  onChange={(event) => setNewSectionName(event.target.value)}
                  placeholder="New section name"
                  className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
                <button type="button" onClick={addSection} className="rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Fields
              </h3>
              <div className="mt-3 space-y-3">
                {fields.map((field) => (
                  <div key={field.id} className="rounded-md border p-3" style={{ borderColor: 'var(--border-muted)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{field.label}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{field.previewValue || '-'}</p>
                        {field.description ? (
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{field.description}</p>
                        ) : null}
                        {field.source ? (
                          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{field.source}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <input type="checkbox" checked={layout.fields[field.id].visible} onChange={() => toggleVisible(field.id)} />
                          Visible
                        </label>
                        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <input type="checkbox" checked={Boolean(requirements[field.id])} onChange={() => toggleRequired(field.id)} />
                          Required
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            {layout.sections.map((section) => {
              const rowCount = layout.sectionRows[section] ?? 2
              return (
                <div key={section} className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card)' }}>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white">{section}</h3>
                    {sectionDescriptions?.[section] ? (
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{sectionDescriptions[section]}</p>
                    ) : null}
                  </div>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${layout.formColumns}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: rowCount }).flatMap((_, rowIndex) =>
                      Array.from({ length: layout.formColumns }).map((__, columnIndex) => {
                        const column = columnIndex + 1
                        const field = findFieldAtCell(layout, section, column, rowIndex)
                        return (
                          <div
                            key={`${section}-${column}-${rowIndex}`}
                            onDragOver={handleDragOver}
                            onDrop={(event) => handleDropToCell(event, section, column, rowIndex)}
                            className="min-h-[88px] rounded-lg border border-dashed p-3"
                            style={{ borderColor: 'var(--border-muted)', backgroundColor: field ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                          >
                            <p className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                              Col {column} • Row {rowIndex + 1}
                            </p>
                            {field ? (
                              <div
                                draggable
                                onDragStart={(event) =>
                                  handleDragStart(event, {
                                    fieldId: field.id,
                                    section,
                                    column,
                                    row: rowIndex,
                                  })
                                }
                                onDragEnd={clearDragState}
                                className="cursor-move rounded-md border p-3"
                                style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}
                              >
                                <p className="text-sm font-medium text-white">{field.label}</p>
                                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {field.previewValue || '-'}
                                </p>
                              </div>
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                                Drop field here
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error ? <p className="mt-4 text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      </div>
    </div>
  )
}
