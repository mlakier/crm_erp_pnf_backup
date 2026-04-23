'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DepartmentCustomFieldForm from '@/components/DepartmentCustomFieldForm'
import { DepartmentCustomizationConfig } from '@/lib/department-customization'
import {
  CustomFieldDefinitionSummary,
  formatCustomFieldValue,
} from '@/lib/custom-fields'

type CustomListOption = {
  id: string
  label: string
}

type CustomListRow = {
  id: string
  value: string
}

type ColumnRow = {
  key: string
  label: string
  source: string
  tableVisibilityKey?: keyof DepartmentCustomizationConfig['tableVisibility']
}

const COLUMN_ROWS: ColumnRow[] = [
  { key: 'department-id', label: 'Department Id', source: 'System field' },
  { key: 'department-number', label: 'Department Number', source: 'Department form layout', tableVisibilityKey: 'departmentNumber' },
  { key: 'name', label: 'Name', source: 'System field', tableVisibilityKey: 'name' },
  { key: 'description', label: 'Description', source: 'Department form layout', tableVisibilityKey: 'description' },
  { key: 'division', label: 'Division', source: 'Department form layout', tableVisibilityKey: 'division' },
  { key: 'subsidiaries', label: 'Subsidiaries', source: 'Department form layout', tableVisibilityKey: 'subsidiaries' },
  { key: 'include-children', label: 'Include Children', source: 'Department form layout', tableVisibilityKey: 'includeChildren' },
  { key: 'planning-category', label: 'Planning Category', source: 'Department form layout', tableVisibilityKey: 'planningCategory' },
  { key: 'manager', label: 'Manager', source: 'Department form layout', tableVisibilityKey: 'manager' },
  { key: 'approver', label: 'Approver', source: 'Department form layout', tableVisibilityKey: 'approver' },
  { key: 'status', label: 'Inactive', source: 'Department form layout', tableVisibilityKey: 'status' },
  { key: 'created', label: 'Created', source: 'System field' },
  { key: 'last-modified', label: 'Last Modified', source: 'System field' },
]

export default function DepartmentCustomizeForm({
  initialConfig,
  customLists,
  customListRows,
  customFields,
  onSuccess,
  onCancel,
}: {
  initialConfig: DepartmentCustomizationConfig
  customLists: CustomListOption[]
  customListRows: Record<string, CustomListRow[]>
  customFields: CustomFieldDefinitionSummary[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [config, setConfig] = useState<DepartmentCustomizationConfig>(initialConfig)
  const [departmentCustomFields, setDepartmentCustomFields] = useState(customFields)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customFieldModalOpen, setCustomFieldModalOpen] = useState(false)
  const [customFieldPrompt, setCustomFieldPrompt] = useState('')

  const divisionDefaultOptions = useMemo(() => {
    const listId = config.listBindings.divisionCustomListId
    if (!listId) return []
    return (customListRows[listId] ?? []).map((row) => row.value).filter(Boolean)
  }, [config.listBindings.divisionCustomListId, customListRows])

  const orderedRows = useMemo(() => {
    const byKey = new Map(COLUMN_ROWS.map((row) => [row.key, row]))
    const ordered: ColumnRow[] = []

    config.columnOrder.forEach((columnId) => {
      if (columnId === 'actions') return
      const row = byKey.get(columnId)
      if (!row) return
      ordered.push(row)
      byKey.delete(columnId)
    })

    for (const row of COLUMN_ROWS) {
      if (byKey.has(row.key)) ordered.push(row)
    }

    return ordered
  }, [config.columnOrder])

  function isMovableColumn(columnId: string) {
    return columnId !== 'department-id' && columnId !== 'name' && columnId !== 'actions'
  }

  function reorderColumnsByDrag(sourceColumn: string, targetColumn: string) {
    if (!sourceColumn || !targetColumn || sourceColumn === targetColumn) return

    setConfig((prev) => {
      const fixedFirst = ['department-id', 'name']
      const movable = prev.columnOrder.filter((id) => id !== 'actions' && !fixedFirst.includes(id))
      const sourceIndex = movable.indexOf(sourceColumn)
      const targetIndex = movable.indexOf(targetColumn)
      if (sourceIndex < 0 || targetIndex < 0) return prev

      const next = [...movable]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)

      return {
        ...prev,
        columnOrder: ['department-id', 'name', ...next, 'actions'],
      }
    })
  }

  function toggleTableVisible(field: keyof DepartmentCustomizationConfig['tableVisibility']) {
    setConfig((prev) => ({
      ...prev,
      tableVisibility: {
        ...prev.tableVisibility,
        [field]: !prev.tableVisibility[field],
      },
    }))
  }

  async function save() {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/config/department-customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(body?.error ?? 'Unable to save customization')
        setSaving(false)
        return
      }

      router.refresh()
      onSuccess?.()
    } catch {
      setError('Unable to save customization')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
        <h3 className="text-sm font-semibold text-white">Department custom fields</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Custom fields created here are stored in the shared custom field schema and appear on department create and detail screens.
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setCustomFieldPrompt('')
              setCustomFieldModalOpen(true)
            }}
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>Custom Field
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Name</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Type</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Id</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Required</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Default Value</th>
              </tr>
            </thead>
            <tbody>
              {departmentCustomFields.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No custom fields defined yet.
                  </td>
                </tr>
              ) : (
                departmentCustomFields.map((field) => (
                  <tr key={field.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{field.label}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{field.type}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{field.name}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{field.required ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: field.defaultValue ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {formatCustomFieldValue(field.type, field.defaultValue) ?? '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
        <h3 className="text-sm font-semibold text-white">Division sourcing</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          The live detail-page customize mode now controls department form layout and required fields. This area only controls how `Division` is sourced.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Division Source</span>
            <select
              value={config.listBindings.divisionCustomListId ?? ''}
              onChange={(event) => {
                const next = event.target.value.trim()
                const nextOptions = next ? (customListRows[next] ?? []).map((row) => row.value).filter(Boolean) : []
                setConfig((prev) => ({
                  ...prev,
                  listBindings: {
                    ...prev.listBindings,
                    divisionCustomListId: next || null,
                    divisionDefaultValue: nextOptions.includes(prev.listBindings.divisionDefaultValue ?? '')
                      ? prev.listBindings.divisionDefaultValue
                      : null,
                  },
                }))
              }}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <option value="">Free text</option>
              {customLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Division Default Value</span>
            <select
              value={config.listBindings.divisionDefaultValue ?? ''}
              disabled={!config.listBindings.divisionCustomListId}
              onChange={(event) => {
                const next = event.target.value.trim()
                setConfig((prev) => ({
                  ...prev,
                  listBindings: {
                    ...prev.listBindings,
                    divisionDefaultValue: next || null,
                  },
                }))
              }}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <option value="">None</option>
              {divisionDefaultOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
        <h3 className="text-sm font-semibold text-white">Department list columns</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Controls only the department list page. Drag rows to reorder columns and hide list-only columns where useful.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Column</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Source</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Show On List</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Column Order</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Drag</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((row) => {
                const columnId = row.key
                const isFixedFirst = columnId === 'department-id' || columnId === 'name'
                const isDraggableColumn = isMovableColumn(columnId)
                const isDropTarget = draggingColumnId !== null && draggingColumnId !== columnId && isDraggableColumn
                const currentRank = config.columnOrder.indexOf(columnId)
                const showValue = row.tableVisibilityKey ? config.tableVisibility[row.tableVisibilityKey] : true

                return (
                  <tr
                    key={row.key}
                    draggable={isDraggableColumn}
                    style={{
                      borderBottom: '1px solid var(--border-muted)',
                      cursor: isDraggableColumn ? 'grab' : 'default',
                      backgroundColor: isDropTarget && dragOverColumnId === columnId ? 'rgba(59, 130, 246, 0.12)' : undefined,
                    }}
                    onDragStart={(event) => {
                      if (!isDraggableColumn) return
                      event.dataTransfer.effectAllowed = 'move'
                      setDraggingColumnId(columnId)
                      setDragOverColumnId(null)
                    }}
                    onDragEnter={(event) => {
                      if (!isDropTarget || !draggingColumnId) return
                      event.preventDefault()
                      setDragOverColumnId(columnId)
                      reorderColumnsByDrag(draggingColumnId, columnId)
                    }}
                    onDragOver={(event) => {
                      if (!isDropTarget) return
                      event.preventDefault()
                      setDragOverColumnId(columnId)
                    }}
                    onDragLeave={() => {
                      if (dragOverColumnId === columnId) setDragOverColumnId(null)
                    }}
                    onDrop={(event) => {
                      if (!isDropTarget) return
                      event.preventDefault()
                      setDragOverColumnId(null)
                      setDraggingColumnId(null)
                    }}
                    onDragEnd={() => {
                      setDragOverColumnId(null)
                      setDraggingColumnId(null)
                    }}
                  >
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.label}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.source}</td>
                    <td className="px-2 py-2 text-sm">
                      {row.tableVisibilityKey ? (
                        <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                          <input type="checkbox" checked={showValue} onChange={() => toggleTableVisible(row.tableVisibilityKey as keyof DepartmentCustomizationConfig['tableVisibility'])} />
                        </label>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Always shown</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {currentRank > -1 ? currentRank + 1 : '-'}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {isFixedFirst ? (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      ) : (
                        <div
                          className="inline-flex select-none items-center rounded border px-2 py-1 text-xs"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                          title="Drag the row to reorder"
                          aria-label="Drag handle"
                        >
                          <span aria-hidden="true">::</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
          {saving ? 'Saving...' : 'Save customization'}
        </button>
      </div>

      {customFieldModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setCustomFieldPrompt('Use Create field or Cancel to close this window.')
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">New Department Custom Field</h2>
              <button
                type="button"
                onClick={() => {
                  setCustomFieldPrompt('')
                  setCustomFieldModalOpen(false)
                }}
                className="rounded-md px-2 py-1 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
            {customFieldPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{customFieldPrompt}</p> : null}
            <DepartmentCustomFieldForm
              existingFields={departmentCustomFields}
              onCancel={() => {
                setCustomFieldPrompt('')
                setCustomFieldModalOpen(false)
              }}
              onCreated={(field) => {
                setDepartmentCustomFields((prev) => [...prev, field].sort((a, b) => a.label.localeCompare(b.label)))
                setCustomFieldPrompt('')
                setCustomFieldModalOpen(false)
                router.refresh()
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
