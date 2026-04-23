'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  PURCHASE_ORDER_LINE_COLUMNS,
  type PurchaseOrderDetailCustomizationConfig,
  type PurchaseOrderDetailFieldKey,
  type PurchaseOrderLineColumnKey,
} from '@/lib/purchase-order-detail-customization'

type CustomizeField = {
  id: PurchaseOrderDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

type DragState = {
  fieldId: PurchaseOrderDetailFieldKey
  section: string
  column: number
  row: number
} | null

const SECTION_FIELD_IDS: Record<string, PurchaseOrderDetailFieldKey[]> = {
  Vendor: [
    'vendorName',
    'vendorNumber',
    'vendorEmail',
    'vendorPhone',
    'vendorTaxId',
    'vendorAddress',
    'vendorPrimarySubsidiary',
    'vendorPrimaryCurrency',
    'vendorInactive',
  ],
  'Purchase Order Details': ['number', 'vendorId', 'status', 'total'],
}

export default function PurchaseOrderDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: PurchaseOrderDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  const [layout, setLayout] = useState<PurchaseOrderDetailCustomizationConfig>(initialLayout)
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
      const rawPayload = event.dataTransfer.getData('application/x-purchase-order-field')
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as DragState
          if (parsed && typeof parsed.fieldId === 'string' && typeof parsed.section === 'string') {
            return parsed
          }
        } catch {
          // fall back to local state
        }
      }
    }

    return getActiveDrag()
  }

  function findFieldAtCell(
    config: PurchaseOrderDetailCustomizationConfig,
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
    prev: PurchaseOrderDetailCustomizationConfig,
    fieldId: PurchaseOrderDetailFieldKey,
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
      ...current,
      section: nextSection,
      column: normalizedColumn,
      order: normalizedRow,
    }

    return {
      ...prev,
      fields: nextFields,
    }
  }

  function moveFieldToEmptyCell(
    fieldId: PurchaseOrderDetailFieldKey,
    section: string,
    column: number,
    row: number
  ) {
    setLayout((prev) => {
      const moved = moveFieldToCell(prev, fieldId, section, column, row)
      return {
        ...moved,
        fields: {
          ...moved.fields,
          [fieldId]: {
            ...moved.fields[fieldId],
            visible: true,
          },
        },
      }
    })
    setError('')
  }

  function handleDragStart(event: React.DragEvent<HTMLElement>, payload: DragState) {
    if (!payload) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', payload.fieldId)
    event.dataTransfer.setData('application/x-purchase-order-field', JSON.stringify(payload))
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
      ) as PurchaseOrderDetailCustomizationConfig['fields'],
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
      ) as PurchaseOrderDetailCustomizationConfig['fields'],
    }))
  }

  function toggleVisible(fieldId: PurchaseOrderDetailFieldKey) {
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
        ) as PurchaseOrderDetailCustomizationConfig['fields'],
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

  function moveLineColumn(columnId: PurchaseOrderLineColumnKey, direction: -1 | 1) {
    setLayout((prev) => {
      const ordered = [...PURCHASE_ORDER_LINE_COLUMNS]
        .map((column) => ({
          id: column.id,
          config: prev.lineColumns[column.id],
        }))
        .sort((left, right) => left.config.order - right.config.order)

      const currentIndex = ordered.findIndex((column) => column.id === columnId)
      const targetIndex = currentIndex + direction
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= ordered.length) return prev

      const nextOrdered = [...ordered]
      const [moved] = nextOrdered.splice(currentIndex, 1)
      nextOrdered.splice(targetIndex, 0, moved)

      return {
        ...prev,
        lineColumns: Object.fromEntries(
          nextOrdered.map((column, index) => [
            column.id,
            {
              ...prev.lineColumns[column.id],
              order: index,
            },
          ])
        ) as PurchaseOrderDetailCustomizationConfig['lineColumns'],
      }
    })
  }

  function toggleLineColumnVisible(columnId: PurchaseOrderLineColumnKey) {
    setLayout((prev) => ({
      ...prev,
      lineColumns: {
        ...prev.lineColumns,
        [columnId]: {
          ...prev.lineColumns[columnId],
          visible: !prev.lineColumns[columnId].visible,
        },
      },
    }))
  }

  async function saveCustomization() {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/config/purchase-order-detail-customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: layout }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? 'Unable to save purchase order customization')
        return
      }

      window.location.assign(detailHref)
    } catch {
      setError('Unable to save purchase order customization')
    } finally {
      setSaving(false)
    }
  }

  const orderedLineColumns = [...PURCHASE_ORDER_LINE_COLUMNS].sort(
    (left, right) => layout.lineColumns[left.id].order - layout.lineColumns[right.id].order
  )

  function getSectionFieldOptions(section: string) {
    if (section !== 'Vendor') return []

    const fieldIds = SECTION_FIELD_IDS[section] ?? []
    return fieldIds
      .map((fieldId) => {
        const field = fields.find((entry) => entry.id === fieldId)
        if (!field) return null
        const config = layout.fields[fieldId]
        const alreadyShownInSection = config.visible && config.section === section
        if (alreadyShownInSection) return null
        return {
          id: field.id,
          label: field.label,
          placement:
            config.section === section
              ? `Column ${config.column}, Row ${config.order + 1}`
              : `${config.section} · Column ${config.column}, Row ${config.order + 1}`,
        }
      })
      .filter((field): field is { id: PurchaseOrderDetailFieldKey; label: string; placement: string } => Boolean(field))
  }

  function ActionButtons() {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={detailHref}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={saveCustomization}
          disabled={saving}
          className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Saving...' : 'Save Layout'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Customize Layout
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Edit the purchase order header in context. Each filled box is a field placement, and empty boxes are open grid cells.
            </p>
          </div>
          <ActionButtons />
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Form Columns
            </span>
            <select
              value={layout.formColumns}
              onChange={(event) => updateFormColumns(Number(event.target.value))}
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={count} value={count} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              New Section
            </span>
            <input
              value={newSectionName}
              onChange={(event) => setNewSectionName(event.target.value)}
              placeholder="Section name"
              className="w-64 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
          </label>
          <button
            type="button"
            onClick={addSection}
            className="rounded-md px-3 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Add Section
          </button>
        </div>

        <div className="space-y-6">
          {layout.sections.map((section) => {
            const rowCount = layout.sectionRows[section] ?? 2
            const visibleFieldCount = fields.filter(
              (field) => layout.fields[field.id].section === section && layout.fields[field.id].visible
            ).length

            return (
              <section
                key={section}
                className="rounded-lg border p-4"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    {editingSectionName === section ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={editingSectionValue}
                          onChange={(event) => setEditingSectionValue(event.target.value)}
                          className="rounded-md border bg-transparent px-2 py-1 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                        <button
                          type="button"
                          onClick={() => saveSectionName(section)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="rounded-md border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{section}</h3>
                        <button
                          type="button"
                          onClick={() => moveSection(section, -1)}
                          className="rounded-md border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(section, 1)}
                          className="rounded-md border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingSection(section)}
                          className="rounded-md border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSection(section)}
                          className="rounded-md border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {sectionDescriptions?.[section] ? (
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {sectionDescriptions[section]}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {visibleFieldCount} visible fields
                    </p>
                  </div>
                  <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Section Rows
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={rowCount}
                      onChange={(event) => updateSectionRows(section, Number(event.target.value))}
                      className="w-24 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </label>
                </div>

                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${layout.formColumns}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rowCount }, (_, rowIndex) =>
                    Array.from({ length: layout.formColumns }, (_, columnIndex) => {
                      const column = columnIndex + 1
                      const row = rowIndex + 1
                      const occupant = findFieldAtCell(layout, section, column, rowIndex)

                      if (!occupant) {
                        const sectionFieldOptions = getSectionFieldOptions(section)
                        return (
                          <div
                            key={`${section}-${column}-${row}`}
                            className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center"
                            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
                            onDragOver={(event) => handleDragOver(event)}
                            onDrop={(event) => handleDropToCell(event, section, column, rowIndex)}
                          >
                            <div className="mb-2 text-xs">{`Row ${row}, Column ${column}`}</div>
                            {sectionFieldOptions.length > 0 ? (
                              <select
                                value=""
                                onChange={(event) => {
                                  const fieldId = event.target.value as PurchaseOrderDetailFieldKey
                                  if (!fieldId) return
                                  moveFieldToEmptyCell(fieldId, section, column, rowIndex)
                                }}
                                className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs text-white"
                                style={{ borderColor: 'var(--border-muted)' }}
                              >
                                <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                                  Select field...
                                </option>
                                {sectionFieldOptions.map((fieldOption) => (
                                  <option
                                    key={`${section}-${fieldOption.id}`}
                                    value={fieldOption.id}
                                    style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}
                                  >
                                    {`${fieldOption.label} (${fieldOption.placement})`}
                                  </option>
                                ))}
                              </select>
                            ) : section === 'Vendor' ? (
                              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                No more vendor fields
                              </div>
                            ) : null}
                          </div>
                        )
                      }

                      const fieldConfig = layout.fields[occupant.id]
                      const dragPayload: DragState = {
                        fieldId: occupant.id,
                        section,
                        column,
                        row: rowIndex,
                      }

                      return (
                        <div
                          key={occupant.id}
                          className="relative min-h-[9.5rem] rounded-lg border p-3"
                          style={{
                            borderColor: 'var(--border-muted)',
                            backgroundColor: fieldConfig.visible ? 'var(--card)' : 'rgba(255,255,255,0.02)',
                            opacity: fieldConfig.visible ? 1 : 0.72,
                          }}
                          onDragOver={(event) => handleDragOver(event)}
                          onDrop={(event) => handleDropToCell(event, section, column, rowIndex)}
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                {occupant.label}
                              </div>
                              <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {occupant.previewValue || '-'}
                              </div>
                            </div>
                            <div
                              draggable
                              onMouseDown={() => {
                                draggingRef.current = dragPayload
                                setDragging(dragPayload)
                              }}
                              onDragStart={(event) => handleDragStart(event, dragPayload)}
                              onDragEnd={clearDragState}
                              className="inline-flex cursor-grab items-center rounded border px-2 py-1 text-xs active:cursor-grabbing"
                              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                              title="Drag to another box in this live grid"
                            >
                              <span aria-hidden="true">{'\u2630'}</span>
                            </div>
                          </div>

                          <div className="mb-3 flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={fieldConfig.visible}
                                onChange={() => toggleVisible(occupant.id)}
                                className="h-4 w-4"
                              />
                              Show
                            </label>
                          </div>

                          <div className="mt-auto pt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {fieldConfig.visible
                              ? `${occupant.fieldType} · ${section} · Column ${column} · Row ${row}`
                              : `Hidden · ${section} · Column ${column} · Row ${row}`}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Line Items Columns
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              First pass for transaction lines: control whether a column shows and its default order.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {orderedLineColumns.map((column, index) => (
            <div
              key={column.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <div>
                <div className="text-sm font-medium text-white">{column.label}</div>
                {column.description ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {column.description}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={layout.lineColumns[column.id].visible}
                    onChange={() => toggleLineColumnVisible(column.id)}
                    className="h-4 w-4"
                  />
                  Show
                </label>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Order {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => moveLineColumn(column.id, -1)}
                  className="rounded-md border px-2 py-1 text-xs"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveLineColumn(column.id, 1)}
                  className="rounded-md border px-2 py-1 text-xs"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border-muted)' }}>
          {error ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : <div />}
          <ActionButtons />
        </div>
      </div>
    </div>
  )
}
