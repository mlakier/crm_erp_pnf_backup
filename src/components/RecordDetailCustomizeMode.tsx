'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import DetailStatCardsCustomizeSection, { DEFAULT_DETAIL_STAT_CARDS_TITLE } from '@/components/DetailStatCardsCustomizeSection'
import SearchableSelect, { type SearchableSelectOption } from '@/components/SearchableSelect'
import type { TransactionStatCardSize, TransactionVisualTone } from '@/lib/transaction-page-config'

type FieldKey = string

type FieldLayoutConfig = {
  visible: boolean
  section: string
  order: number
  column: number
}

type LayoutConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<FieldKey, FieldLayoutConfig>
  referenceLayouts?: Array<{
    id: string
    referenceId: string
    formColumns: number
    rows: number
    fields: Partial<Record<FieldKey, { visible: boolean; order: number; column: number }>>
  }>
  lineSettings?: Record<string, string>
  lineColumns?: Record<string, { visible: boolean; order: number; [key: string]: unknown }>
  secondarySettings?: Record<string, string>
  secondaryColumns?: Record<string, { visible: boolean; order: number; [key: string]: unknown }>
  statCards?: Array<{
    id: string
    metric: string
    visible: boolean
    order: number
    size?: TransactionStatCardSize
    colorized?: boolean
    linked?: boolean
  }>
}

type CustomizeField = {
  id: FieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

type StatCardDefinition = {
  id: string
  label: string
}

type StatPreviewCard = {
  id: string
  label: string
  value: string | number
  href?: string | null
  accent?: true | 'teal' | 'yellow'
  valueTone?: TransactionVisualTone
  cardTone?: TransactionVisualTone
  supportsColorized?: boolean
  supportsLink?: boolean
}

type ReferenceFieldDefinition = {
  id: string
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

type ReferenceSourceDefinition = {
  id: string
  label: string
  linkedFieldLabel: string
  description: string
  fields: ReferenceFieldDefinition[]
  defaultVisibleFieldIds: string[]
  defaultColumns?: number
  defaultRows?: number
}

type LineColumnDefinition = {
  id: string
  label: string
  description?: string
}

type LineColumnSettingDefinition = {
  id: string
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
}

type LineSectionSettingDefinition = {
  id: string
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
}

type DragState = {
  fieldId: FieldKey
  section: string
  column: number
  row: number
} | null

type ReferenceDragState = {
  layoutId: string
  fieldId: FieldKey
  column: number
  row: number
} | null

function InlineSearchableSelect({
  value,
  options,
  placeholder,
  disabled = false,
  textClassName = 'text-sm',
  onChange,
}: {
  value: string
  options: SearchableSelectOption[]
  placeholder: string
  disabled?: boolean
  textClassName?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="w-full">
      <SearchableSelect
        selectedValue={value}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={placeholder}
        disabled={disabled}
        textClassName={textClassName}
        onSelect={onChange}
      />
    </div>
  )
}

export default function RecordDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  saveEndpoint,
  emptyCellLabel = 'Select field...',
  recordLabel = 'record',
  lineColumnsLabel = 'Line Items',
  secondaryColumnsLabel = 'Secondary',
  introText,
  sectionDescriptions,
  statCardDefinitions,
  lineColumnDefinitions,
  lineColumnSettingDefinitions,
  lineColumnSettingAvailability,
  lineSectionSettingDefinitions,
  referenceSourceDefinitions,
  secondaryColumnDefinitions,
  secondaryColumnSettingDefinitions,
  secondaryColumnSettingAvailability,
  secondarySectionSettingDefinitions,
  statCardsTitle = DEFAULT_DETAIL_STAT_CARDS_TITLE,
  statCardsIntro,
  detailLayoutTitle,
  lineColumnsTitle,
  lineColumnsIntro,
  referenceLayoutsTitle,
  referenceLayoutsIntro,
  secondaryColumnsTitle,
  secondaryColumnsIntro,
  statPreviewCards,
  extraFieldCheckboxLabel,
  extraFieldCheckboxValues,
  extraFieldCheckboxDisabledValues,
  onToggleExtraFieldCheckbox,
  onSaveCustomization,
}: {
  detailHref: string
  initialLayout: LayoutConfig
  fields: CustomizeField[]
  saveEndpoint: string
  emptyCellLabel?: string
  recordLabel?: string
  lineColumnsLabel?: string
  secondaryColumnsLabel?: string
  introText?: string
  sectionDescriptions?: Record<string, string>
  statCardDefinitions?: StatCardDefinition[]
  lineColumnDefinitions?: LineColumnDefinition[]
  lineColumnSettingDefinitions?: LineColumnSettingDefinition[]
  lineColumnSettingAvailability?: Record<string, string[]>
  lineSectionSettingDefinitions?: LineSectionSettingDefinition[]
  referenceSourceDefinitions?: ReferenceSourceDefinition[]
  secondaryColumnDefinitions?: LineColumnDefinition[]
  secondaryColumnSettingDefinitions?: LineColumnSettingDefinition[]
  secondaryColumnSettingAvailability?: Record<string, string[]>
  secondarySectionSettingDefinitions?: LineSectionSettingDefinition[]
  statCardsTitle?: string
  statCardsIntro?: string
  detailLayoutTitle?: string
  lineColumnsTitle?: string
  lineColumnsIntro?: string
  referenceLayoutsTitle?: string
  referenceLayoutsIntro?: string
  secondaryColumnsTitle?: string
  secondaryColumnsIntro?: string
  statPreviewCards?: StatPreviewCard[]
  extraFieldCheckboxLabel?: string
  extraFieldCheckboxValues?: Record<string, boolean>
  extraFieldCheckboxDisabledValues?: Record<string, boolean>
  onToggleExtraFieldCheckbox?: (fieldId: string) => void
  onSaveCustomization?: (layout: LayoutConfig) => Promise<{ error?: string | null } | void>
}) {
  function normalizeDetailLayout(nextLayout: LayoutConfig) {
    const normalizedColumns = Math.min(4, Math.max(1, nextLayout.formColumns || 1))
    const normalizedFields = { ...nextLayout.fields }
    const normalizedSectionRows = { ...nextLayout.sectionRows }

    for (const section of nextLayout.sections) {
      let rows = Math.min(12, Math.max(1, Math.trunc(normalizedSectionRows[section] ?? 2)))
      const occupied = new Set<string>()
      let maxVisibleRow = -1

      for (const field of fields) {
        const current = normalizedFields[field.id]
        if (!current || current.section !== section) continue

        if (!current.visible) {
          normalizedFields[field.id] = {
            ...current,
            column: Math.min(normalizedColumns, Math.max(1, current.column)),
            order: Math.max(0, Math.trunc(current.order)),
          }
          continue
        }

        let column = Math.min(normalizedColumns, Math.max(1, current.column))
        let row = Math.max(0, Math.trunc(current.order))
        let key = `${column}:${row}`

        while (row >= rows || occupied.has(key)) {
          let placed = false
          for (let candidateRow = 0; candidateRow < rows; candidateRow += 1) {
            for (let candidateColumn = 1; candidateColumn <= normalizedColumns; candidateColumn += 1) {
              const candidateKey = `${candidateColumn}:${candidateRow}`
              if (!occupied.has(candidateKey)) {
                column = candidateColumn
                row = candidateRow
                key = candidateKey
                placed = true
                break
              }
            }
            if (placed) break
          }

          if (!placed) {
            row = rows
            column = 1
            rows += 1
            key = `${column}:${row}`
          }
        }

        occupied.add(key)
        maxVisibleRow = Math.max(maxVisibleRow, row)
        normalizedFields[field.id] = {
          ...current,
          column,
          order: row,
        }
      }

      normalizedSectionRows[section] = Math.min(12, Math.max(rows, maxVisibleRow + 1, 1))
    }

    const normalizedLayout = {
      ...nextLayout,
      formColumns: normalizedColumns,
      sectionRows: normalizedSectionRows,
      fields: normalizedFields,
    } as LayoutConfig & {
      glImpactSettings?: Record<string, string>
      glImpactColumns?: Record<string, { visible: boolean; order: number; [key: string]: unknown }>
    }

    if (nextLayout.secondarySettings) {
      normalizedLayout.glImpactSettings = {
        ...nextLayout.secondarySettings,
      }
    }

    if (nextLayout.secondaryColumns) {
      normalizedLayout.glImpactColumns = Object.fromEntries(
        Object.entries(nextLayout.secondaryColumns).map(([columnId, config]) => [
          columnId,
          { ...config },
        ]),
      ) as Record<string, { visible: boolean; order: number; [key: string]: unknown }>
    }

    return normalizedLayout
  }

  const [layout, setLayout] = useState<LayoutConfig>(() => normalizeDetailLayout(initialLayout))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newSectionName, setNewSectionName] = useState('')
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null)
  const [editingSectionValue, setEditingSectionValue] = useState('')
  const [dragging, setDragging] = useState<DragState>(null)
  const draggingRef = useRef<DragState>(null)
  const [referenceDragging, setReferenceDragging] = useState<ReferenceDragState>(null)
  const referenceDraggingRef = useRef<ReferenceDragState>(null)
  const referenceSourceById = Object.fromEntries(
    (referenceSourceDefinitions ?? []).map((definition) => [definition.id, definition]),
  ) as Record<string, ReferenceSourceDefinition>
  const normalizedRecordLabel = recordLabel.trim().toLowerCase() || 'record'
  const resolvedIntroText =
    introText ??
    `Edit the ${normalizedRecordLabel} detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells.`
  const resolvedStatCardsIntro =
    statCardsIntro ??
    `Control which summary cards appear at the top of the ${normalizedRecordLabel} detail page and their order.`
  const resolvedDetailLayoutTitle = detailLayoutTitle ?? 'Customize Detail Layout'
  const resolvedReferenceLayoutsTitle = referenceLayoutsTitle ?? 'Customize Reference Layout'
  const resolvedReferenceLayoutsIntro =
    referenceLayoutsIntro ??
    `Pick linked fields from the ${normalizedRecordLabel}, then choose the related record fields to display above the main detail layout.`
  const resolvedLineColumnsTitle = lineColumnsTitle ?? `${lineColumnsLabel} Columns`
  const resolvedLineColumnsIntro =
    lineColumnsIntro ??
    'Control whether a line-item column shows, its default order, and how lookup values appear in edit, view, and dropdown modes.'
  const resolvedSecondaryColumnsTitle = secondaryColumnsTitle ?? `${secondaryColumnsLabel} Columns`
  const resolvedSecondaryColumnsIntro =
    secondaryColumnsIntro ??
    'Control whether a secondary table column shows and how it appears in the preview table below.'

  function createReferenceLayout(referenceId: string, slotId = `reference-${Date.now()}`) {
    const source =
      referenceSourceDefinitions?.find((definition) => definition.id === referenceId) ??
      referenceSourceDefinitions?.[0]
    if (!source) return null

    const formColumns = Math.min(4, Math.max(1, source.defaultColumns ?? 2))
    const visibleFieldIds = new Set(source.defaultVisibleFieldIds)
    const fields = Object.fromEntries(
      source.fields.map((field, index) => [
        field.id,
        {
          visible: visibleFieldIds.has(field.id),
          order: Math.floor(index / formColumns),
          column: (index % formColumns) + 1,
        },
      ]),
    )

    return {
      id: slotId,
      referenceId: source.id,
      formColumns,
      rows: Math.max(1, source.defaultRows ?? (Math.ceil(source.defaultVisibleFieldIds.length / formColumns) || 1)),
      fields,
    }
  }

  function normalizeReferenceLayout(
    referenceLayout: NonNullable<LayoutConfig['referenceLayouts']>[number],
    nextFields: Partial<Record<string, { visible: boolean; order: number; column: number }>>,
    nextColumns = referenceLayout.formColumns,
    nextRows = referenceLayout.rows,
  ) {
    const source = referenceSourceById[referenceLayout.referenceId]
    if (!source) {
      return {
        ...referenceLayout,
        formColumns: Math.min(4, Math.max(1, nextColumns)),
        rows: Math.min(12, Math.max(1, nextRows)),
        fields: nextFields,
      }
    }

      const normalizedColumns = Math.min(4, Math.max(1, nextColumns))
      let rows = Math.min(12, Math.max(1, nextRows))
      const occupied = new Set<string>()
      let maxVisibleRow = -1
      const normalizedFields = Object.fromEntries(
        source.fields.map((field) => {
          const current = nextFields[field.id] ?? { visible: false, order: 0, column: 1 }
          if (current.visible === false) {
            return [field.id, { ...current, column: Math.min(normalizedColumns, Math.max(1, current.column)), order: Math.max(0, current.order) }]
        }

        let column = Math.min(normalizedColumns, Math.max(1, current.column))
        let row = Math.max(0, Math.trunc(current.order))
        let key = `${column}:${row}`

        while (row >= rows || occupied.has(key)) {
          let placed = false
          for (let candidateRow = 0; candidateRow < rows; candidateRow += 1) {
            for (let candidateColumn = 1; candidateColumn <= normalizedColumns; candidateColumn += 1) {
              const candidateKey = `${candidateColumn}:${candidateRow}`
              if (!occupied.has(candidateKey)) {
                column = candidateColumn
                row = candidateRow
                key = candidateKey
                placed = true
                break
              }
            }
            if (placed) break
          }

          if (!placed) {
            row = rows
            column = 1
            rows += 1
            key = `${column}:${row}`
          }
          }

          occupied.add(key)
          maxVisibleRow = Math.max(maxVisibleRow, row)
          return [field.id, { ...current, column, order: row }]
        }),
      )

      return {
        ...referenceLayout,
        formColumns: normalizedColumns,
        rows: Math.min(12, Math.max(1, maxVisibleRow + 2)),
        fields: normalizedFields,
      }
    }

  function getActiveDrag() {
    return draggingRef.current ?? dragging
  }

  function getActiveReferenceDrag() {
    return referenceDraggingRef.current ?? referenceDragging
  }

  function clearDragState() {
    draggingRef.current = null
    setDragging(null)
  }

  function clearReferenceDragState() {
    referenceDraggingRef.current = null
    setReferenceDragging(null)
  }

  function resolveDragPayload(event?: React.DragEvent<HTMLElement>) {
    if (event) {
      const rawPayload = event.dataTransfer.getData('application/x-transaction-field')
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as DragState
          if (parsed && typeof parsed.fieldId === 'string' && typeof parsed.section === 'string') {
            return parsed
          }
        } catch {
          // fall through to local state
        }
      }
    }

    return getActiveDrag()
  }

  function resolveReferenceDragPayload(event?: React.DragEvent<HTMLElement>) {
    if (event) {
      const rawPayload = event.dataTransfer.getData('application/x-transaction-reference-field')
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as ReferenceDragState
          if (parsed && typeof parsed.fieldId === 'string' && typeof parsed.layoutId === 'string') {
            return parsed
          }
        } catch {
          // fall through to local state
        }
      }
    }

    return getActiveReferenceDrag()
  }

  function findFieldAtCell(config: LayoutConfig, section: string, column: number, row: number) {
    return fields.find((field) => {
      const fieldConfig = config.fields[field.id]
      return fieldConfig.section === section && fieldConfig.column === column && fieldConfig.order === row
    })
  }

  function moveFieldToCell(prev: LayoutConfig, fieldId: FieldKey, nextSection: string, nextColumn: number, nextRow: number) {
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

  function moveFieldToEmptyCell(fieldId: FieldKey, section: string, column: number, row: number) {
    setLayout((prev) => {
      const moved = moveFieldToCell(prev, fieldId, section, column, row)
      return normalizeDetailLayout({
        ...moved,
        fields: {
          ...moved.fields,
          [fieldId]: {
            ...moved.fields[fieldId],
            visible: true,
          },
        },
      })
    })
    setError('')
  }

  function handleDragStart(event: React.DragEvent<HTMLElement>, payload: DragState) {
    if (!payload) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', payload.fieldId)
    event.dataTransfer.setData('application/x-transaction-field', JSON.stringify(payload))
    draggingRef.current = payload
    setDragging(payload)
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    const activeDrag = resolveDragPayload(event)
    if (!activeDrag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDropToCell(event: React.DragEvent<HTMLElement>, section: string, column: number, row: number) {
    const activeDrag = resolveDragPayload(event)
    if (!activeDrag) return
    event.preventDefault()
    setLayout((prev) => normalizeDetailLayout(moveFieldToCell(prev, activeDrag.fieldId, section, column, row)))
    clearDragState()
  }

  function updateFormColumns(nextCount: number) {
    const formColumns = Math.min(4, Math.max(1, nextCount))
    setLayout((prev) => normalizeDetailLayout({
      ...prev,
      formColumns,
      fields: Object.fromEntries(
        fields.map((field) => [
          field.id,
          {
            ...prev.fields[field.id],
            column: Math.min(formColumns, Math.max(1, prev.fields[field.id].column)),
          },
        ]),
      ),
    }))
  }

  function updateSectionRows(section: string, nextCount: number) {
    const rowCount = Math.min(12, Math.max(1, Math.trunc(nextCount || 1)))
    setLayout((prev) => normalizeDetailLayout({
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
        }),
      ),
    }))
  }

  function toggleVisible(fieldId: FieldKey) {
    setLayout((prev) => normalizeDetailLayout({
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

    setLayout((prev) => normalizeDetailLayout({
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
        Object.entries(prev.sectionRows).map(([section, rows]) => [section === originalName ? nextName : section, rows]),
      )

      return normalizeDetailLayout({
        ...prev,
        sections: nextSections,
        sectionRows: nextSectionRows,
        fields: Object.fromEntries(
          fields.map((field) => [
            field.id,
            prev.fields[field.id].section === originalName
              ? { ...prev.fields[field.id], section: nextName }
              : prev.fields[field.id],
          ]),
        ),
      })
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

      return normalizeDetailLayout({ ...prev, sections: nextSections })
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
      return normalizeDetailLayout({ ...prev, sections: nextSections, sectionRows: nextSectionRows })
    })

    if (editingSectionName === sectionName) cancelEditingSection()
    setError('')
  }

  function getSectionFieldOptions(section: string) {
    return fields
      .map((field) => {
        const config = layout.fields[field.id]
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
      .filter((field): field is { id: FieldKey; label: string; placement: string } => Boolean(field))
  }

  function findReferenceFieldAtCell(
    referenceLayout: NonNullable<LayoutConfig['referenceLayouts']>[number],
    column: number,
    row: number,
  ) {
    const source = referenceSourceById[referenceLayout.referenceId]
    if (!source) return null
    return source.fields.find((field) => {
      const config = referenceLayout.fields[field.id]
      return config?.visible && config.column === column && config.order === row
    })
  }

  function getReferenceFieldOptions(referenceLayout: NonNullable<LayoutConfig['referenceLayouts']>[number]) {
    const source = referenceSourceById[referenceLayout.referenceId]
    if (!source) return []
    return source.fields.filter((field) => referenceLayout.fields[field.id]?.visible !== true)
  }

  function moveReferenceFieldToCell(
    referenceLayout: NonNullable<LayoutConfig['referenceLayouts']>[number],
    fieldId: string,
    nextColumn: number,
    nextRow: number,
  ) {
    const current = referenceLayout.fields[fieldId] ?? { visible: true, column: 1, order: 0 }
    const normalizedColumn = Math.min(referenceLayout.formColumns, Math.max(1, nextColumn))
    const normalizedRow = Math.min(Math.max(0, Math.trunc(nextRow)), Math.max(0, referenceLayout.rows - 1))
    const occupant = findReferenceFieldAtCell(referenceLayout, normalizedColumn, normalizedRow)
    const nextFields = { ...referenceLayout.fields }

    if (occupant && occupant.id !== fieldId) {
      nextFields[occupant.id] = {
        ...(nextFields[occupant.id] ?? { visible: true, column: current.column, order: current.order }),
        visible: true,
        column: current.column,
        order: current.order,
      }
    }

    nextFields[fieldId] = {
      ...current,
      visible: true,
      column: normalizedColumn,
      order: normalizedRow,
    }

    return normalizeReferenceLayout(referenceLayout, nextFields)
  }

  function addReferenceLayout() {
    setLayout((prev) => {
      if (!referenceSourceDefinitions || referenceSourceDefinitions.length === 0) return prev
      const usedReferenceIds = new Set((prev.referenceLayouts ?? []).map((entry) => entry.referenceId))
      const fallbackReferenceId =
        referenceSourceDefinitions.find((definition) => !usedReferenceIds.has(definition.id))?.id ??
        referenceSourceDefinitions[0].id
      const nextLayout = createReferenceLayout(fallbackReferenceId)
      if (!nextLayout) return prev
      return {
        ...prev,
        referenceLayouts: [...(prev.referenceLayouts ?? []), nextLayout],
      }
    })
  }

  function updateReferenceSource(slotId: string, referenceId: string) {
    setLayout((prev) => {
      const nextReferenceLayout = createReferenceLayout(referenceId, slotId)
      if (!nextReferenceLayout) return prev
      return {
        ...prev,
        referenceLayouts: (prev.referenceLayouts ?? []).map((layout) =>
          layout.id === slotId ? nextReferenceLayout : layout,
        ),
      }
    })
  }

  function updateReferenceColumns(slotId: string, nextColumns: number) {
    setLayout((prev) => ({
      ...prev,
      referenceLayouts: (prev.referenceLayouts ?? []).map((referenceLayout) =>
        referenceLayout.id === slotId
          ? normalizeReferenceLayout(referenceLayout, referenceLayout.fields, nextColumns)
          : referenceLayout,
      ),
    }))
  }

  function updateReferenceRows(slotId: string, nextRows: number) {
    setLayout((prev) => ({
      ...prev,
      referenceLayouts: (prev.referenceLayouts ?? []).map((referenceLayout) =>
        referenceLayout.id === slotId
          ? normalizeReferenceLayout(referenceLayout, referenceLayout.fields, referenceLayout.formColumns, nextRows)
          : referenceLayout,
      ),
    }))
  }

  function toggleReferenceFieldVisible(slotId: string, fieldId: string) {
    setLayout((prev) => ({
      ...prev,
      referenceLayouts: (prev.referenceLayouts ?? []).map((referenceLayout) => {
        if (referenceLayout.id !== slotId) return referenceLayout
        const current = referenceLayout.fields[fieldId] ?? { visible: false, order: 0, column: 1 }
        return normalizeReferenceLayout(referenceLayout, {
          ...referenceLayout.fields,
          [fieldId]: {
            ...current,
            visible: !current.visible,
          },
        })
      }),
    }))
  }

  function moveReferenceFieldToEmptyCell(slotId: string, fieldId: string, column: number, row: number) {
    setLayout((prev) => ({
      ...prev,
      referenceLayouts: (prev.referenceLayouts ?? []).map((referenceLayout) =>
        referenceLayout.id === slotId
          ? moveReferenceFieldToCell(referenceLayout, fieldId, column, row)
          : referenceLayout,
      ),
    }))
    setError('')
  }

  function handleReferenceDragStart(event: React.DragEvent<HTMLElement>, payload: ReferenceDragState) {
    if (!payload) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', payload.fieldId)
    event.dataTransfer.setData('application/x-transaction-reference-field', JSON.stringify(payload))
    referenceDraggingRef.current = payload
    setReferenceDragging(payload)
  }

  function handleReferenceDragOver(event: React.DragEvent<HTMLElement>) {
    const activeDrag = resolveReferenceDragPayload(event)
    if (!activeDrag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleReferenceDropToCell(
    event: React.DragEvent<HTMLElement>,
    layoutId: string,
    column: number,
    row: number,
  ) {
    const activeDrag = resolveReferenceDragPayload(event)
    if (!activeDrag || activeDrag.layoutId !== layoutId) return
    event.preventDefault()
    setLayout((prev) => ({
      ...prev,
      referenceLayouts: (prev.referenceLayouts ?? []).map((referenceLayout) =>
        referenceLayout.id === layoutId
          ? moveReferenceFieldToCell(referenceLayout, activeDrag.fieldId, column, row)
          : referenceLayout,
      ),
    }))
    clearReferenceDragState()
  }

  function removeReferenceLayout(slotId: string) {
    setLayout((prev) => ({
      ...prev,
      referenceLayouts: (prev.referenceLayouts ?? []).filter((referenceLayout) => referenceLayout.id !== slotId),
    }))
  }

  function toggleLineColumnVisible(columnId: string) {
    setLayout((prev) => {
      if (!prev.lineColumns) return prev
      return {
        ...prev,
        lineColumns: {
          ...prev.lineColumns,
          [columnId]: {
            ...prev.lineColumns[columnId],
            visible: !prev.lineColumns[columnId].visible,
          },
        },
      }
    })
  }

  function moveLineColumn(columnId: string, direction: -1 | 1) {
    setLayout((prev) => {
      if (!prev.lineColumns || !lineColumnDefinitions) return prev

      const ordered = [...lineColumnDefinitions]
        .map((column) => ({
          id: column.id,
          config: prev.lineColumns?.[column.id],
        }))
        .filter((column): column is { id: string; config: { visible: boolean; order: number } } => Boolean(column.config))
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
              visible: prev.lineColumns?.[column.id]?.visible ?? true,
              order: index,
              ...Object.fromEntries(
                (lineColumnSettingDefinitions ?? []).map((definition) => [
                  definition.id,
                  prev.lineColumns?.[column.id]?.[definition.id],
                ]),
              ),
            },
          ]),
        ) as Record<string, { visible: boolean; order: number; [key: string]: unknown }>,
      }
    })
  }

  function updateLineColumnSetting(columnId: string, settingId: string, value: string) {
    setLayout((prev) => {
      if (!prev.lineColumns?.[columnId]) return prev
      return {
        ...prev,
        lineColumns: {
          ...prev.lineColumns,
          [columnId]: {
            ...prev.lineColumns[columnId],
            [settingId]: value,
          },
        },
      }
    })
  }

  function updateLineSectionSetting(settingId: string, value: string) {
    setLayout((prev) => ({
      ...prev,
      lineSettings: {
        ...(prev.lineSettings ?? {}),
        [settingId]: value,
      },
    }))
  }

  function toggleSecondaryColumnVisible(columnId: string) {
    setLayout((prev) => {
      if (!prev.secondaryColumns) return prev
      return {
        ...prev,
        secondaryColumns: {
          ...prev.secondaryColumns,
          [columnId]: {
            ...prev.secondaryColumns[columnId],
            visible: !prev.secondaryColumns[columnId].visible,
          },
        },
      }
    })
  }

  function moveSecondaryColumn(columnId: string, direction: -1 | 1) {
    setLayout((prev) => {
      if (!prev.secondaryColumns || !secondaryColumnDefinitions) return prev

      const ordered = [...secondaryColumnDefinitions]
        .map((column) => ({
          id: column.id,
          config: prev.secondaryColumns?.[column.id],
        }))
        .filter((column): column is { id: string; config: { visible: boolean; order: number; [key: string]: unknown } } => Boolean(column.config))
        .sort((left, right) => left.config.order - right.config.order)

      const currentIndex = ordered.findIndex((column) => column.id === columnId)
      const targetIndex = currentIndex + direction
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= ordered.length) return prev

      const nextOrdered = [...ordered]
      const [moved] = nextOrdered.splice(currentIndex, 1)
      nextOrdered.splice(targetIndex, 0, moved)

      return {
        ...prev,
        secondaryColumns: Object.fromEntries(
          nextOrdered.map((column, index) => [
            column.id,
            {
              visible: prev.secondaryColumns?.[column.id]?.visible ?? true,
              order: index,
              ...Object.fromEntries(
                (secondaryColumnSettingDefinitions ?? []).map((definition) => [
                  definition.id,
                  prev.secondaryColumns?.[column.id]?.[definition.id],
                ]),
              ),
            },
          ]),
        ) as Record<string, { visible: boolean; order: number; [key: string]: unknown }>,
      }
    })
  }

  function updateSecondaryColumnSetting(columnId: string, settingId: string, value: string) {
    setLayout((prev) => {
      if (!prev.secondaryColumns?.[columnId]) return prev
      return {
        ...prev,
        secondaryColumns: {
          ...prev.secondaryColumns,
          [columnId]: {
            ...prev.secondaryColumns[columnId],
            [settingId]: value,
          },
        },
      }
    })
  }

  function updateSecondarySectionSetting(settingId: string, value: string) {
    setLayout((prev) => ({
      ...prev,
      secondarySettings: {
        ...(prev.secondarySettings ?? {}),
        [settingId]: value,
      },
    }))
  }

  function toggleStatCardVisible(slotId: string) {
    setLayout((prev) => {
      if (!prev.statCards) return prev
      return {
        ...prev,
        statCards: prev.statCards.map((card) =>
          card.id === slotId ? { ...card, visible: !card.visible } : card,
        ),
      }
    })
  }

  function updateStatCardSetting(
    slotId: string,
    setting: 'size' | 'colorized' | 'linked',
    value: TransactionStatCardSize | boolean,
  ) {
    setLayout((prev) => {
      if (!prev.statCards) return prev
      return {
        ...prev,
        statCards: prev.statCards.map((card) =>
          card.id === slotId ? { ...card, [setting]: value } : card,
        ),
      }
    })
  }

  function moveStatCard(slotId: string, direction: -1 | 1) {
    setLayout((prev) => {
      if (!prev.statCards) return prev
      const ordered = [...prev.statCards].sort((left, right) => left.order - right.order)
      const currentIndex = ordered.findIndex((card) => card.id === slotId)
      const targetIndex = currentIndex + direction
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= ordered.length) return prev

      const nextOrdered = [...ordered]
      const [moved] = nextOrdered.splice(currentIndex, 1)
      nextOrdered.splice(targetIndex, 0, moved)

      return {
        ...prev,
        statCards: nextOrdered.map((card, index) => ({
          ...card,
          order: index,
        })),
      }
    })
  }

  function assignStatCardToSlot(slotId: string, nextMetric: string) {
    setLayout((prev) => {
      if (!prev.statCards) return prev
      return {
        ...prev,
        statCards: prev.statCards.map((card) =>
          card.id === slotId ? { ...card, metric: nextMetric } : card,
        ),
      }
    })
  }

  function addStatCard() {
    setLayout((prev) => {
      if (!prev.statCards || !statCardDefinitions || statCardDefinitions.length === 0) return prev
      const ordered = [...prev.statCards].sort((left, right) => left.order - right.order)
      const fallbackMetric =
        statCardDefinitions.find((card) => !ordered.some((slot) => slot.metric === card.id))?.id ??
        statCardDefinitions[0].id

      return {
        ...prev,
        statCards: [
          ...ordered,
          {
            id: `slot-${Date.now()}`,
            metric: fallbackMetric,
            visible: true,
            order: ordered.length,
            size: 'md',
            colorized: true,
            linked: true,
          },
        ],
      }
    })
  }

  function removeStatCard(slotId: string) {
    setLayout((prev) => {
      if (!prev.statCards || prev.statCards.length <= 1) return prev
      return {
        ...prev,
        statCards: prev.statCards
          .filter((card) => card.id !== slotId)
          .sort((left, right) => left.order - right.order)
          .map((card, index) => ({
            ...card,
            order: index,
          })),
      }
    })
  }

  async function saveCustomization() {
    setSaving(true)
    setError('')

    try {
      if (onSaveCustomization) {
        const result = await onSaveCustomization(normalizeDetailLayout(layout))
        if (result?.error) {
          setError(result.error)
          return
        }
        window.location.assign(detailHref)
        return
      }

      const response = await fetch(saveEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: normalizeDetailLayout(layout) }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? 'Unable to save customization')
        return
      }

      window.location.assign(detailHref)
    } catch {
      setError('Unable to save customization')
    } finally {
      setSaving(false)
    }
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

  function PageActionBar() {
    return (
      <div
        className="rounded-xl border px-4 py-3"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <div className="flex justify-end">
          <ActionButtons />
        </div>
      </div>
    )
  }

  const orderedLineColumns =
    lineColumnDefinitions && layout.lineColumns
      ? [...lineColumnDefinitions].sort(
          (left, right) => (layout.lineColumns?.[left.id]?.order ?? 0) - (layout.lineColumns?.[right.id]?.order ?? 0),
        )
      : []
  const orderedStatCards = layout.statCards ? [...layout.statCards].sort((left, right) => left.order - right.order) : []
  const orderedReferenceLayouts = layout.referenceLayouts ?? []
  const orderedSecondaryColumns =
    secondaryColumnDefinitions && layout.secondaryColumns
      ? [...secondaryColumnDefinitions].sort(
          (left, right) => (layout.secondaryColumns?.[left.id]?.order ?? 0) - (layout.secondaryColumns?.[right.id]?.order ?? 0),
        )
      : []

  return (
    <div className="space-y-6">
      <PageActionBar />

      {statCardDefinitions && layout.statCards ? (
        <DetailStatCardsCustomizeSection
          title={statCardsTitle}
          intro={resolvedStatCardsIntro}
          statCardDefinitions={statCardDefinitions}
          statPreviewCards={statPreviewCards}
          cards={orderedStatCards}
          onAddCard={addStatCard}
          onToggleVisible={toggleStatCardVisible}
          onUpdateSetting={updateStatCardSetting}
          onAssignMetric={assignStatCardToSlot}
          onMoveCard={moveStatCard}
          onRemoveCard={removeStatCard}
        />
      ) : null}

      {referenceSourceDefinitions && orderedReferenceLayouts.length >= 0 ? (
        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {resolvedReferenceLayoutsTitle}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {resolvedReferenceLayoutsIntro}
              </p>
            </div>
            <button
              type="button"
              onClick={addReferenceLayout}
              className="rounded-md px-3 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Add Reference Field
            </button>
          </div>

          <div className="space-y-4">
            {orderedReferenceLayouts.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-5 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                No reference layouts yet. Add a linked field above to configure expanded context panels.
              </div>
            ) : null}
            {orderedReferenceLayouts.map((referenceLayout, index) => {
              const source = referenceSourceById[referenceLayout.referenceId]
              if (!source) return null
              return (
                <section key={referenceLayout.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">{`Reference ${index + 1}`}</div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {source.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                          Linked Field
                        </span>
                        <div className="w-48">
                          <InlineSearchableSelect
                            value={referenceLayout.referenceId}
                            onChange={(value) => updateReferenceSource(referenceLayout.id, value)}
                            options={referenceSourceDefinitions.map((definition) => ({ value: definition.id, label: definition.label }))}
                            placeholder="Select linked field"
                          />
                        </div>
                      </label>
                      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                          Grid Columns
                        </span>
                        <div className="w-24">
                          <InlineSearchableSelect
                            value={String(referenceLayout.formColumns)}
                            onChange={(value) => updateReferenceColumns(referenceLayout.id, Number(value))}
                            options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))}
                            placeholder="Columns"
                          />
                        </div>
                      </label>
                      <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                          Grid Rows
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={referenceLayout.rows}
                          onChange={(event) => updateReferenceRows(referenceLayout.id, Number(event.target.value))}
                          className="w-24 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeReferenceLayout(referenceLayout.id)}
                        className="rounded-md border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {`Choose the linked ${source.label.toLowerCase()} fields you want to expose in this reference panel. Use the empty cells to place fields and drag cards to reorder them.`}
                  </p>

                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, referenceLayout.formColumns))}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: referenceLayout.rows }, (_, rowIndex) =>
                      Array.from({ length: referenceLayout.formColumns }, (_, columnIndex) => {
                        const column = columnIndex + 1
                        const row = rowIndex + 1
                        const occupant = findReferenceFieldAtCell(referenceLayout, column, rowIndex)

                        if (!occupant) {
                          const availableOptions = getReferenceFieldOptions(referenceLayout)
                          return (
                            <div
                              key={`${referenceLayout.id}-${column}-${row}`}
                              className="flex min-h-[5.5rem] flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center"
                              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
                              onDragOver={(event) => handleReferenceDragOver(event)}
                              onDrop={(event) => handleReferenceDropToCell(event, referenceLayout.id, column, rowIndex)}
                            >
                              <div className="mb-2 text-xs">{`Row ${row}, Column ${column}`}</div>
                              {availableOptions.length > 0 ? (
                                <InlineSearchableSelect
                                  value=""
                                  onChange={(fieldId) => {
                                    if (!fieldId) return
                                    moveReferenceFieldToEmptyCell(referenceLayout.id, fieldId, column, rowIndex)
                                  }}
                                  options={[
                                    { value: '', label: 'Select field...' },
                                    ...availableOptions.map((fieldOption) => ({ value: fieldOption.id, label: fieldOption.label })),
                                  ]}
                                  placeholder="Select field..."
                                  textClassName="text-xs"
                                />
                              ) : (
                                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  No more available fields
                                </div>
                              )}
                            </div>
                          )
                        }

                        const fieldConfig = referenceLayout.fields[occupant.id]
                        const dragPayload: ReferenceDragState = {
                          layoutId: referenceLayout.id,
                          fieldId: occupant.id,
                          column,
                          row: rowIndex,
                        }

                        return (
                          <div
                            key={`${referenceLayout.id}-${occupant.id}`}
                            className="relative min-h-[9rem] rounded-lg border p-3"
                            style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}
                            onDragOver={(event) => handleReferenceDragOver(event)}
                            onDrop={(event) => handleReferenceDropToCell(event, referenceLayout.id, column, rowIndex)}
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
                                  referenceDraggingRef.current = dragPayload
                                  setReferenceDragging(dragPayload)
                                }}
                                onDragStart={(event) => handleReferenceDragStart(event, dragPayload)}
                                onDragEnd={clearReferenceDragState}
                                className="inline-flex cursor-grab items-center rounded border px-2 py-1 text-xs active:cursor-grabbing"
                                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                                title="Drag to another reference cell"
                              >
                                <span aria-hidden="true">{'\u2630'}</span>
                              </div>
                            </div>
                            {occupant.description ? (
                              <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                {occupant.description}
                              </p>
                            ) : null}
                            <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              <span>{`Column ${fieldConfig?.column ?? column} · Row ${(fieldConfig?.order ?? rowIndex) + 1}`}</span>
                              <button
                                type="button"
                                onClick={() => toggleReferenceFieldVisible(referenceLayout.id, occupant.id)}
                                className="rounded-md border px-2 py-1 text-xs"
                                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      }),
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {resolvedDetailLayoutTitle}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {resolvedIntroText}
              </p>
            </div>
          </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Form Columns
            </span>
            <div className="w-24">
              <InlineSearchableSelect
                value={String(layout.formColumns)}
                onChange={(value) => updateFormColumns(Number(value))}
                options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))}
                placeholder="Columns"
              />
            </div>
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
              (field) => layout.fields[field.id].section === section && layout.fields[field.id].visible,
            ).length

            return (
              <section key={section} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
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
                        <button type="button" onClick={() => moveSection(section, -1)} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                          Up
                        </button>
                        <button type="button" onClick={() => moveSection(section, 1)} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                          Down
                        </button>
                        <button type="button" onClick={() => startEditingSection(section)} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteSection(section)} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
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
                              <InlineSearchableSelect
                                value=""
                                onChange={(fieldId) => {
                                  if (!fieldId) return
                                  moveFieldToEmptyCell(fieldId, section, column, rowIndex)
                                }}
                                options={[
                                  { value: '', label: emptyCellLabel },
                                  ...sectionFieldOptions.map((fieldOption) => ({
                                    value: fieldOption.id,
                                    label: `${fieldOption.label} (${fieldOption.placement})`,
                                  })),
                                ]}
                                placeholder={emptyCellLabel}
                                textClassName="text-xs"
                              />
                            ) : (
                              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                No more available fields
                              </div>
                            )}
                          </div>
                        )
                      }

                      const fieldConfig = layout.fields[occupant.id]
                      const dragPayload: DragState = { fieldId: occupant.id, section, column, row: rowIndex }

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
                            <input type="checkbox" checked={fieldConfig.visible} onChange={() => toggleVisible(occupant.id)} className="h-4 w-4" />
                            Show
                          </label>
                          {extraFieldCheckboxLabel && extraFieldCheckboxValues && onToggleExtraFieldCheckbox ? (
                            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(extraFieldCheckboxValues[occupant.id])}
                                onChange={() => onToggleExtraFieldCheckbox(occupant.id)}
                                disabled={Boolean(extraFieldCheckboxDisabledValues?.[occupant.id])}
                                className="h-4 w-4"
                              />
                              {extraFieldCheckboxLabel}
                            </label>
                          ) : null}
                        </div>

                          <div className="mt-auto pt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {fieldConfig.visible
                              ? `${occupant.fieldType} · ${section} · Column ${column} · Row ${row}`
                              : `Hidden · ${section} · Column ${column} · Row ${row}`}
                          </div>
                        </div>
                      )
                    }),
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {lineColumnDefinitions && layout.lineColumns ? (
        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {resolvedLineColumnsTitle}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {resolvedLineColumnsIntro}
              </p>
            </div>
          </div>

          {lineSectionSettingDefinitions && lineSectionSettingDefinitions.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-3 rounded-lg border px-3 py-3" style={{ borderColor: 'var(--border-muted)' }}>
              {lineSectionSettingDefinitions.map((definition) => (
                <label key={definition.id} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {definition.label}
                  </span>
                  <div className="w-32">
                    <InlineSearchableSelect
                      value={layout.lineSettings?.[definition.id] ?? definition.options[0]?.value ?? ''}
                      onChange={(value) => updateLineSectionSetting(definition.id, value)}
                      options={definition.options.map((option) => ({ value: option.value, label: option.label }))}
                      placeholder={`Select ${definition.label.toLowerCase()}`}
                      textClassName="text-xs"
                    />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

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
                      checked={layout.lineColumns?.[column.id]?.visible ?? false}
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
                  {lineColumnSettingDefinitions?.map((definition) => (
                    <label
                      key={`${column.id}-${definition.id}`}
                      className="space-y-1 text-xs"
                      style={{
                        color: 'var(--text-secondary)',
                        opacity:
                          lineColumnSettingAvailability?.[column.id] && !lineColumnSettingAvailability[column.id].includes(definition.id)
                            ? 0.45
                            : 1,
                      }}
                    >
                      <span className="block" style={{ color: 'var(--text-muted)' }}>
                        {definition.label}
                      </span>
                      <div className="w-28">
                        <InlineSearchableSelect
                          value={String(layout.lineColumns?.[column.id]?.[definition.id] ?? definition.options[0]?.value ?? '')}
                          onChange={(value) => updateLineColumnSetting(column.id, definition.id, value)}
                          disabled={Boolean(lineColumnSettingAvailability?.[column.id] && !lineColumnSettingAvailability[column.id].includes(definition.id))}
                          options={definition.options.map((option) => ({ value: option.value, label: option.label }))}
                          placeholder={`Select ${definition.label.toLowerCase()}`}
                          textClassName="text-xs"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {secondaryColumnDefinitions && layout.secondaryColumns ? (
        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {resolvedSecondaryColumnsTitle}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {resolvedSecondaryColumnsIntro}
              </p>
            </div>
          </div>

          {secondarySectionSettingDefinitions && secondarySectionSettingDefinitions.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-3 rounded-lg border px-3 py-3" style={{ borderColor: 'var(--border-muted)' }}>
              {secondarySectionSettingDefinitions.map((definition) => (
                <label key={definition.id} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {definition.label}
                  </span>
                  <div className="w-32">
                    <InlineSearchableSelect
                      value={layout.secondarySettings?.[definition.id] ?? definition.options[0]?.value ?? ''}
                      onChange={(value) => updateSecondarySectionSetting(definition.id, value)}
                      options={definition.options.map((option) => ({ value: option.value, label: option.label }))}
                      placeholder={`Select ${definition.label.toLowerCase()}`}
                      textClassName="text-xs"
                    />
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {orderedSecondaryColumns.map((column, index) => (
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
                      checked={layout.secondaryColumns?.[column.id]?.visible ?? false}
                      onChange={() => toggleSecondaryColumnVisible(column.id)}
                      className="h-4 w-4"
                    />
                    Show
                  </label>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Order {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveSecondaryColumn(column.id, -1)}
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSecondaryColumn(column.id, 1)}
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Down
                  </button>
                  {secondaryColumnSettingDefinitions?.map((definition) => (
                    <label
                      key={`${column.id}-${definition.id}`}
                      className="space-y-1 text-xs"
                      style={{
                        color: 'var(--text-secondary)',
                        opacity:
                          secondaryColumnSettingAvailability?.[column.id] && !secondaryColumnSettingAvailability[column.id].includes(definition.id)
                            ? 0.45
                            : 1,
                      }}
                    >
                      <span className="block" style={{ color: 'var(--text-muted)' }}>
                        {definition.label}
                      </span>
                      <div className="w-28">
                        <InlineSearchableSelect
                          value={String(layout.secondaryColumns?.[column.id]?.[definition.id] ?? definition.options[0]?.value ?? '')}
                          onChange={(value) => updateSecondaryColumnSetting(column.id, definition.id, value)}
                          disabled={Boolean(secondaryColumnSettingAvailability?.[column.id] && !secondaryColumnSettingAvailability[column.id].includes(definition.id))}
                          options={definition.options.map((option) => ({ value: option.value, label: option.label }))}
                          placeholder={`Select ${definition.label.toLowerCase()}`}
                          textClassName="text-xs"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        null
      )}

      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}

      <PageActionBar />
    </div>
  )
}
