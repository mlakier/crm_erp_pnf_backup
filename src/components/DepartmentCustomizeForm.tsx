'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DepartmentCustomizationConfig,
  DepartmentOptionalFieldKey,
} from '@/lib/department-customization'

const FIELD_LABELS: Record<DepartmentOptionalFieldKey, string> = {
  description: 'Description',
  division: 'Division',
  entityId: 'Subsidiary',
  managerId: 'Manager',
}

type CustomListOption = {
  id: string
  label: string
}

type FieldRow = {
  key: string
  label: string
  typeLabel: string
  fieldId: string
  settingsKey?: DepartmentOptionalFieldKey
  tableVisibilityKey?: keyof DepartmentCustomizationConfig['tableVisibility']
  showLocked?: boolean
  requiredLocked?: boolean
  requiredValue?: boolean
  allowsSourcing?: boolean
}

const FIELD_ROWS: FieldRow[] = [
  { key: 'code', label: 'Code', typeLabel: 'Text', fieldId: 'code', showLocked: true, requiredLocked: true, requiredValue: true },
  { key: 'name', label: 'Name', typeLabel: 'Text', fieldId: 'name', tableVisibilityKey: 'name', requiredLocked: true, requiredValue: true },
  { key: 'description', label: 'Description', typeLabel: 'Textarea', fieldId: 'description', settingsKey: 'description', tableVisibilityKey: 'description' },
  { key: 'division', label: 'Division', typeLabel: 'Text/Select', fieldId: 'division', settingsKey: 'division', tableVisibilityKey: 'division', allowsSourcing: true },
  { key: 'subsidiary', label: 'Subsidiary', typeLabel: 'Select', fieldId: 'entityId', settingsKey: 'entityId', tableVisibilityKey: 'subsidiary' },
  { key: 'manager', label: 'Manager', typeLabel: 'Select', fieldId: 'managerId', settingsKey: 'managerId', tableVisibilityKey: 'manager' },
  { key: 'status', label: 'Inactive', typeLabel: 'Boolean', fieldId: 'inactive', tableVisibilityKey: 'status' },
  { key: 'created', label: 'Created', typeLabel: 'Date', fieldId: 'createdAt', showLocked: true },
  { key: 'last-modified', label: 'Last Modified', typeLabel: 'Date', fieldId: 'updatedAt', showLocked: true },
]

export default function DepartmentCustomizeForm({
  initialConfig,
  customLists,
  onSuccess,
  onCancel,
}: {
  initialConfig: DepartmentCustomizationConfig
  customLists: CustomListOption[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [config, setConfig] = useState<DepartmentCustomizationConfig>(initialConfig)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const orderedRows = useMemo(() => {
    const byKey = new Map(FIELD_ROWS.map((row) => [row.key, row]))
    const ordered: FieldRow[] = []

    config.columnOrder.forEach((columnId) => {
      if (columnId === 'actions') return
      const row = byKey.get(columnId)
      if (!row) return
      ordered.push(row)
      byKey.delete(columnId)
    })

    for (const row of FIELD_ROWS) {
      if (byKey.has(row.key)) {
        ordered.push(row)
      }
    }

    return ordered
  }, [config.columnOrder])

  function isMovableColumn(columnId: string) {
    return columnId !== 'code' && columnId !== 'name' && columnId !== 'actions'
  }

  function toggleVisible(field: DepartmentOptionalFieldKey) {
    setConfig((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [field]: {
          ...prev.fields[field],
          visible: !prev.fields[field].visible,
        },
      },
    }))
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

  function toggleRowShow(row: FieldRow) {
    setConfig((prev) => {
      const next: DepartmentCustomizationConfig = {
        ...prev,
        fields: {
          ...prev.fields,
        },
        tableVisibility: {
          ...prev.tableVisibility,
        },
      }

      if (row.settingsKey) {
        next.fields[row.settingsKey] = {
          ...prev.fields[row.settingsKey],
          visible: !prev.fields[row.settingsKey].visible,
        }
      }

      if (row.tableVisibilityKey) {
        next.tableVisibility[row.tableVisibilityKey] = !prev.tableVisibility[row.tableVisibilityKey]
      }

      return next
    })
  }

  function reorderColumnsByDrag(sourceColumn: string, targetColumn: string) {
    if (!sourceColumn || !targetColumn || sourceColumn === targetColumn) return

    setConfig((prev) => {
      const fixedFirst = ['code', 'name']
      const movable = prev.columnOrder.filter((id) => id !== 'actions' && !fixedFirst.includes(id))

      const sourceIndex = movable.indexOf(sourceColumn)
      const targetIndex = movable.indexOf(targetColumn)
      if (sourceIndex < 0 || targetIndex < 0) return prev

      const next = [...movable]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)

      return {
        ...prev,
        columnOrder: ['code', 'name', ...next, 'actions'],
      }
    })
  }

  function toggleRequired(field: DepartmentOptionalFieldKey) {
    setConfig((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [field]: {
          ...prev.fields[field],
          required: !prev.fields[field].required,
        },
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
        <h3 className="text-sm font-semibold text-white">Department field customization</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Name</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Type</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Id</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Show</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Required</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sourcing (List fields)</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Column Order</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Drag</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((row) => {
                const fieldKey = row.settingsKey
                const columnId = row.key
                const isFixedFirst = columnId === 'code' || columnId === 'name'
                const isDraggableColumn = isMovableColumn(columnId)
                const isDropTarget = draggingColumnId !== null && draggingColumnId !== columnId && isDraggableColumn
                const currentRank = config.columnOrder.indexOf(columnId)
                const showValue = row.showLocked
                  ? true
                  : row.tableVisibilityKey
                    ? config.tableVisibility[row.tableVisibilityKey]
                    : fieldKey
                      ? config.fields[fieldKey].visible
                      : true
                const requiredValue = fieldKey
                  ? config.fields[fieldKey].required
                  : (row.requiredValue ?? false)

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
                      if (dragOverColumnId === columnId) {
                        setDragOverColumnId(null)
                      }
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
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fieldKey ? FIELD_LABELS[fieldKey] : row.label}
                    </td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.typeLabel}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.fieldId}</td>
                    <td className="px-2 py-2 text-sm">
                      <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={showValue}
                          disabled={row.showLocked}
                          onChange={() => {
                            toggleRowShow(row)
                          }}
                        />
                      </label>
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={requiredValue}
                          disabled={row.requiredLocked || !fieldKey}
                          onChange={() => {
                            if (fieldKey) toggleRequired(fieldKey)
                          }}
                        />
                      </label>
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {row.allowsSourcing ? (
                        <select
                          value={config.listBindings.divisionCustomListId ?? ''}
                          onChange={(event) => {
                            const next = event.target.value.trim()
                            setConfig((prev) => ({
                              ...prev,
                              listBindings: {
                                ...prev.listBindings,
                                divisionCustomListId: next || null,
                              },
                            }))
                          }}
                          className="w-full rounded-md border bg-transparent px-2 py-1 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        >
                          <option value="">None (free text)</option>
                          {customLists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.label}
                            </option>
                          ))}
                        </select>
                      ) : row.key === 'subsidiary' ? (
                        <span style={{ color: 'var(--text-secondary)' }}>Subsidiaries</span>
                      ) : row.key === 'manager' ? (
                        <span style={{ color: 'var(--text-secondary)' }}>Employees</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {currentRank > -1 ? currentRank + 1 : '-'}
                      </span>
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
                          <span aria-hidden="true">☰</span>
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
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Saving...' : 'Save customization'}
        </button>
      </div>
    </div>
  )
}
