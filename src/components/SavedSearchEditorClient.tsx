'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import SavedSearchManagerDropdown from '@/components/SavedSearchManagerDropdown'
import SearchableSelect from '@/components/SearchableSelect'
import {
  defaultSavedSearchDefinitionState,
  getSavedSearchMetadataStorageKey,
  sanitizeSavedSearchDefinitionState,
  type SavedSearchCriterion,
  type SavedSearchDefinitionState,
  type SavedSearchEmailSchedule,
  type SavedSearchFieldOption,
  type SavedSearchFilterDefinition,
  type SavedSearchLinkedResultSource,
  type SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'
import type { SavedSearchBuiltInBaseline } from '@/lib/saved-search-builtins-store'

type SavedListView = {
  id: string
  tableId: string
  name: string
  columnIds: string[]
  columnOrder: string[]
  filterState?: SavedSearchDefinitionState
  availableFilterIds?: string[]
  isDefault: boolean
}

type DirectoryOption = {
  id: string
  label: string
}

type EditorTab = 'criteria' | 'results' | 'audience' | 'roles' | 'emails'
const EDITOR_TABS: Array<[EditorTab, string]> = [
  ['results', 'Results'],
  ['criteria', 'Criteria'],
  ['audience', 'Audience'],
  ['roles', 'Roles'],
  ['emails', 'Emails'],
]

const BUILT_IN_VIEW_ID = '__built-in-default'
const ADD_NEW_VIEW_ID = '__add-new-view'

const CRITERIA_OPERATOR_OPTIONS = [
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'is', label: 'is' },
  { value: 'isNot', label: 'is not' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
]

const EMAIL_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const EMAIL_FILE_TYPE_OPTIONS = [
  { value: 'excel', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
]

const BUILT_IN_DEFAULT_VISIBLE_COUNT = 8
function buildTopValueVisibleIds<T extends { id: string; locked?: boolean; defaultVisible?: boolean }>(fields: T[]) {
  const lockedIds = fields.filter((field) => field.locked).map((field) => field.id)
  const lockedIdsThatCountTowardBuiltIn = lockedIds.filter((id) => id !== 'actions')
  const maxUnlockedVisible = Math.max(0, BUILT_IN_DEFAULT_VISIBLE_COUNT - lockedIdsThatCountTowardBuiltIn.length)
  const unlockedVisibleIds = fields
    .filter((field) => !field.locked && field.id !== 'actions' && field.defaultVisible !== false)
    .slice(0, maxUnlockedVisible)
    .map((field) => field.id)
  return [...lockedIds, ...unlockedVisibleIds]
}

function buildDefaultColumnState(metadata: SavedSearchTableMetadata) {
  const visibleColumnIds = buildTopValueVisibleIds(metadata.columns)
  const lockedColumnIds = metadata.columns.filter((column) => column.locked).map((column) => column.id)
  const unlockedOrder = metadata.columns.filter((column) => !column.locked).map((column) => column.id)
  return {
    visibleColumnIds,
    lockedColumnIds,
    unlockedOrder,
  }
}

function buildDefaultResultFieldState(resultFields: SavedSearchFieldOption[]) {
  const lockedFieldIds = resultFields.filter((field) => field.locked).map((field) => field.id)
  const lockedIdsThatCountTowardBuiltIn = lockedFieldIds.filter((id) => id !== 'actions')
  const maxUnlockedVisible = Math.max(0, BUILT_IN_DEFAULT_VISIBLE_COUNT - lockedIdsThatCountTowardBuiltIn.length)
  const visibleFieldIds = [
    ...lockedFieldIds,
    ...resultFields
      .filter((field) => !field.locked && field.id !== 'actions' && field.defaultVisible === true)
      .slice(0, maxUnlockedVisible)
      .map((field) => field.id),
  ]
  const unlockedOrder = resultFields.filter((field) => !field.locked).map((field) => field.id)
  return {
    visibleFieldIds,
    lockedFieldIds,
    unlockedOrder,
  }
}

function ensureLockedResultVisibility(visibleColumnIds: string[], resultFields: SavedSearchFieldOption[]) {
  const lockedIds = resultFields.filter((field) => field.locked).map((field) => field.id)
  const seen = new Set<string>()
  const next: string[] = []

  for (const id of [...lockedIds, ...visibleColumnIds]) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }

  return next
}

function buildEditorMetadata(tableId: string, raw: Partial<SavedSearchTableMetadata> | null): SavedSearchTableMetadata {
  const columns = Array.isArray(raw?.columns) ? raw.columns : []
  const filters = Array.isArray(raw?.filters) ? raw.filters : []
  const linkedResultSources =
    Array.isArray(raw?.linkedResultSources) && raw.linkedResultSources.length > 0
      ? raw.linkedResultSources
      : []
  const linkedFieldIds = new Set(linkedResultSources.flatMap((source) => source.fields.map((field) => field.id)))
  const criteriaFields =
    Array.isArray(raw?.criteriaFields) && raw.criteriaFields.length > 0
      ? raw.criteriaFields
      : [
          ...filters.map((filter) => ({ id: filter.id, label: filter.label, source: 'Current Page', group: 'Page Filters' })),
          ...columns.map((column) => ({ id: column.id, label: column.label, source: 'Current Page', group: 'List Columns', defaultVisible: column.defaultVisible, locked: column.locked })),
        ]
  const resultFields =
    Array.isArray(raw?.resultFields) && raw.resultFields.length > 0
      ? raw.resultFields.filter((field) => !linkedFieldIds.has(field.id))
      : columns.map((column) => ({
          id: column.id,
          label: column.label,
          source: 'Current Page',
          group: 'List Columns',
          defaultVisible: column.defaultVisible,
          locked: column.locked,
        }))

  return {
    tableId,
    title: raw?.title || tableId,
    basePath: raw?.basePath || '/',
    columns,
    filters,
    criteriaFields,
    resultFields,
    linkedResultSources,
  }
}

function buildPreviewHref(basePath: string, filters: SavedSearchFilterDefinition[], definition: SavedSearchDefinitionState) {
  const search = new URLSearchParams()
  for (const filter of filters) {
    const value = definition.filterValues[filter.id]?.trim()
    if (!value) continue
    search.set(filter.param, value)
  }
  search.set('page', '1')
  const query = search.toString()
  return query ? `${basePath}?${query}` : basePath
}

function makeCriterion(fieldId = ''): SavedSearchCriterion {
  return {
    id: `criterion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fieldId,
    operator: 'contains',
    value: '',
    joiner: 'and',
    openParens: 0,
    closeParens: 0,
    showInGlobalFilter: false,
  }
}

function makeEmailScheduleRow(): SavedSearchEmailSchedule {
  return {
    id: `email-schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    frequency: 'weekly',
    fileType: 'excel',
    recipients: '',
    subject: '',
  }
}

export default function SavedSearchEditorClient({
  tableId,
  initialMetadata,
  builtInBaseline,
  canEditBuiltIn,
  roles,
  departments,
  subsidiaries,
  employees,
}: {
  tableId: string
  initialMetadata?: SavedSearchTableMetadata | null
  builtInBaseline?: SavedSearchBuiltInBaseline | null
  canEditBuiltIn: boolean
  roles: DirectoryOption[]
  departments: DirectoryOption[]
  subsidiaries: DirectoryOption[]
  employees: DirectoryOption[]
}) {
  const searchParams = useSearchParams()
  const [metadata, setMetadata] = useState<SavedSearchTableMetadata | null>(null)
  const [savedViews, setSavedViews] = useState<SavedListView[]>([])
  const [selectedViewId, setSelectedViewId] = useState(BUILT_IN_VIEW_ID)
  const [name, setName] = useState('')
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [availableFilterIds, setAvailableFilterIds] = useState<string[]>([])
  const [definition, setDefinition] = useState<SavedSearchDefinitionState>(defaultSavedSearchDefinitionState())
  const [defaultSelectionId, setDefaultSelectionId] = useState(BUILT_IN_VIEW_ID)
  const [activeTab, setActiveTab] = useState<EditorTab>('results')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)
  const [dragCriterionId, setDragCriterionId] = useState<string | null>(null)
  const [dragOverCriterionId, setDragOverCriterionId] = useState<string | null>(null)
  const [linkedSourceToAdd, setLinkedSourceToAdd] = useState('')
  const [linkedFieldToAdd, setLinkedFieldToAdd] = useState('')
  const initialMetadataRef = useRef(initialMetadata)
  const requestedViewId = searchParams.get('view')?.trim() ?? ''

  useEffect(() => {
    try {
      if (initialMetadataRef.current) {
        setMetadata(buildEditorMetadata(tableId, initialMetadataRef.current))
        window.localStorage.setItem(
          getSavedSearchMetadataStorageKey(tableId),
          JSON.stringify(initialMetadataRef.current),
        )
        return
      }
      const raw = window.localStorage.getItem(getSavedSearchMetadataStorageKey(tableId))
      if (!raw) {
        setMetadata(buildEditorMetadata(tableId, null))
      } else {
        const parsed = JSON.parse(raw) as Partial<SavedSearchTableMetadata>
        setMetadata(buildEditorMetadata(tableId, parsed))
      }
    } catch {
      setMetadata(buildEditorMetadata(tableId, null))
    }
  }, [tableId])

  useEffect(() => {
    if (!metadata) return
    const currentMetadata = metadata
    const explicitBuiltInRequested = requestedViewId === BUILT_IN_VIEW_ID

    let cancelled = false
    async function loadViews() {
      setLoading(true)
      setErrorMessage(null)
      try {
        const response = await fetch(`/api/list-views?tableId=${encodeURIComponent(tableId)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load saved searches')
        const body = await response.json() as { views?: SavedListView[]; builtInBaseline?: SavedSearchBuiltInBaseline | null }
        if (cancelled) return
        const views = Array.isArray(body.views) ? body.views : []
        setSavedViews(views)
        setDefaultSelectionId(views.find((view) => view.isDefault)?.id ?? BUILT_IN_VIEW_ID)
        if (explicitBuiltInRequested) {
          if (body.builtInBaseline) {
            applyBuiltInBaseline(body.builtInBaseline, currentMetadata)
          } else if (builtInBaseline) {
            applyBuiltInBaseline(builtInBaseline, currentMetadata)
          } else {
            applyBuiltInDefault(currentMetadata)
          }
          return
        }
        const requestedView = requestedViewId
          ? views.find((view) => view.id === requestedViewId) ?? null
          : null
        const defaultView = views.find((view) => view.isDefault) ?? null
        const activeView = requestedView ?? defaultView
        if (activeView) {
          applyView(activeView, currentMetadata)
        } else {
          applyBuiltInDefault(currentMetadata)
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to load saved searches.')
          applyBuiltInDefault(currentMetadata)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadViews()
    return () => {
      cancelled = true
    }
  }, [builtInBaseline, metadata, requestedViewId, tableId])

  const columns = useMemo(() => metadata?.columns ?? [], [metadata])
  const filters = useMemo(() => metadata?.filters ?? [], [metadata])
  const criteriaFields = useMemo(() => metadata?.criteriaFields ?? [], [metadata])
  const baseResultFields = useMemo(() => metadata?.resultFields ?? columns.map((column) => ({
    id: column.id,
    label: column.label,
    source: 'Current Page',
    group: 'List Columns',
    defaultVisible: column.defaultVisible,
    locked: column.locked,
  })), [columns, metadata])
  const linkedResultSources = useMemo<SavedSearchLinkedResultSource[]>(() => metadata?.linkedResultSources ?? [], [metadata])
  const linkedResultFieldMap = useMemo(() => new Map(
    linkedResultSources.flatMap((source) => source.fields.map((field) => [field.id, field] as const)),
  ), [linkedResultSources])
  const activeAddedLinkedFields = useMemo(
    () => definition.results.addedLinkedFieldIds.map((id) => linkedResultFieldMap.get(id)).filter((field): field is SavedSearchFieldOption => Boolean(field)),
    [definition.results.addedLinkedFieldIds, linkedResultFieldMap],
  )
  const resultFields = useMemo(() => {
    const seen = new Set<string>()
    return [...baseResultFields, ...activeAddedLinkedFields].filter((field) => {
      if (seen.has(field.id)) return false
      seen.add(field.id)
      return true
    })
  }, [activeAddedLinkedFields, baseResultFields])
  const defaultColumnState = useMemo(
    () => (metadata ? buildDefaultColumnState(metadata) : { visibleColumnIds: [], lockedColumnIds: [], unlockedOrder: [] }),
    [metadata],
  )
  const defaultResultFieldState = useMemo(
    () => buildDefaultResultFieldState(baseResultFields),
    [baseResultFields],
  )
  const lockedResultFields = useMemo(
    () => resultFields.filter((field) => defaultResultFieldState.lockedFieldIds.includes(field.id)),
    [defaultResultFieldState.lockedFieldIds, resultFields],
  )
  const reorderableResultFields = useMemo(() => {
    const byId = new Map(resultFields.filter((field) => !field.locked).map((field) => [field.id, field]))
    const ordered = columnOrder
      .map((id) => byId.get(id))
      .filter((field): field is NonNullable<typeof field> => Boolean(field))
    const remaining = resultFields.filter((field) => !field.locked && !ordered.some((entry) => entry.id === field.id))
    return [...ordered, ...remaining]
  }, [columnOrder, resultFields])
  const livePageResultFields = useMemo(
    () => resultFields.filter((field) => field.id !== 'actions'),
    [resultFields],
  )
  const effectiveVisibleColumnIds = useMemo(
    () => ensureLockedResultVisibility(visibleColumnIds, resultFields),
    [resultFields, visibleColumnIds],
  )
  const livePageVisibleResultCount = useMemo(
    () => livePageResultFields.filter((field) => effectiveVisibleColumnIds.includes(field.id)).length,
    [effectiveVisibleColumnIds, livePageResultFields],
  )
  const resultFieldSummaryTotal = livePageResultFields.length
  const resultFieldSummaryVisible = livePageVisibleResultCount
  const joinedOutputFieldCount = useMemo(
    () => activeAddedLinkedFields.length,
    [activeAddedLinkedFields],
  )
  const allAudienceInternalRolesSelected =
    roles.length > 0 && roles.every((role) => definition.audience.internalRoleIds.includes(role.id))
  const allAudienceDepartmentsSelected =
    departments.length > 0 && departments.every((department) => definition.audience.departmentIds.includes(department.id))
  const allAudienceSubsidiariesSelected =
    subsidiaries.length > 0 && subsidiaries.every((subsidiary) => definition.audience.subsidiaryIds.includes(subsidiary.id))
  const allAudienceEmployeesSelected =
    employees.length > 0 && employees.every((employee) => definition.audience.employeeIds.includes(employee.id))
  const rolePreferenceMap = useMemo(
    () => new Map(definition.rolePreferences.assignments.map((assignment) => [assignment.roleId, assignment])),
    [definition.rolePreferences.assignments],
  )
  const allRolesSelected =
    roles.length > 0
    && roles.every((role) => {
      const assignment = rolePreferenceMap.get(role.id)
      return assignment?.list && assignment.form && assignment.results && assignment.dashboard && assignment.sublist
    })

  const previewHref = useMemo(
    () => metadata ? buildPreviewHref(metadata.basePath, filters.filter((filter) => availableFilterIds.includes(filter.id)), definition) : '/',
    [availableFilterIds, definition, filters, metadata],
  )
  const isAddNewMode = selectedViewId === ADD_NEW_VIEW_ID
  const selectedLinkedSource = useMemo(
    () => linkedResultSources.find((source) => source.id === linkedSourceToAdd) ?? null,
    [linkedResultSources, linkedSourceToAdd],
  )
  const linkedFieldAddOptions = useMemo(
    () => (selectedLinkedSource?.fields ?? []).map((field) => ({
      value: field.id,
      label: field.label,
      searchText: `${field.label} ${field.source ?? ''} ${field.group ?? ''}`,
    })),
    [selectedLinkedSource],
  )
  const cancelHref = useMemo(() => {
    if (!metadata) return '/'
    const next = new URLSearchParams()
    const returnViewId =
      isAddNewMode
        ? (requestedViewId || (selectedViewId !== ADD_NEW_VIEW_ID ? selectedViewId : ''))
        : selectedViewId
    if (returnViewId) next.set('view', returnViewId)
    next.set('page', '1')
    const query = next.toString()
    return query ? `${metadata.basePath}?${query}` : metadata.basePath
  }, [isAddNewMode, metadata, requestedViewId, selectedViewId])

  const criteriaFieldOptions = useMemo(
    () => criteriaFields.map((field) => ({
      value: field.id,
      label: field.source ? `${field.label} (${field.source})` : field.label,
      menuLabel: field.group ? `${field.group} - ${field.label}${field.source ? ` (${field.source})` : ''}` : undefined,
      searchText: `${field.label} ${field.source ?? ''} ${field.group ?? ''}`,
    })),
    [criteriaFields],
  )

  function getCriteriaField(fieldId: string) {
    return criteriaFields.find((field) => field.id === fieldId) ?? null
  }

  const criteriaIntroText = linkedResultSources.length > 0
    ? 'Build the page-level saved-search logic here. These criteria sit above the page filter bar for this page and can target both current-page fields and linked-record fields.'
    : 'Build the page-level saved-search logic here. These criteria sit above the page filter bar for this page and target the current page fields.'

  const resultsIntroText = linkedResultSources.length > 0
    ? 'Current page fields live here by default. Added linked-record fields can also appear here once you bring them in below. Locked fields stay at the top, and you can drag the rest into the order you want.'
    : 'Current page fields live here. Locked fields stay at the top, and you can drag the remaining configurable fields into the order you want.'
  const showResultTypeColumn = linkedResultSources.length > 0
  const resultGridClassName = showResultTypeColumn
    ? 'grid gap-3 rounded-lg border px-4 py-3 md:grid-cols-[2rem_minmax(0,1fr)_12rem_10rem_16rem_8rem]'
    : 'grid gap-3 rounded-lg border px-4 py-3 md:grid-cols-[2rem_minmax(0,1fr)_12rem_10rem_16rem]'

  function getResultFieldSourceLabel(column: SavedSearchFieldOption) {
    const source = column.source?.trim()
    const group = column.group?.trim().toLowerCase()
    if (
      !source ||
      source === 'Current Page' ||
      source === metadata?.title ||
      group === 'base record' ||
      group?.startsWith('base record')
    ) {
      return 'Base'
    }
    return source
  }

  function applyBuiltInDefault(nextMetadata: SavedSearchTableMetadata) {
    const defaults = buildDefaultColumnState(nextMetadata)
    const defaultResults = buildDefaultResultFieldState(nextMetadata.resultFields ?? [])
    setSelectedViewId(BUILT_IN_VIEW_ID)
    setName('')
    setVisibleColumnIds(defaultResults.visibleFieldIds.length > 0 ? defaultResults.visibleFieldIds : defaults.visibleColumnIds)
    setColumnOrder(defaultResults.unlockedOrder.length > 0 ? defaultResults.unlockedOrder : defaults.unlockedOrder)
    setAvailableFilterIds(nextMetadata.filters.map((filter) => filter.id))
    setDefinition(defaultSavedSearchDefinitionState())
  }

  function applyBuiltInBaseline(baseline: SavedSearchBuiltInBaseline, nextMetadata: SavedSearchTableMetadata) {
    const defaults = buildDefaultColumnState(nextMetadata)
    const defaultResults = buildDefaultResultFieldState(nextMetadata.resultFields ?? [])
    setSelectedViewId(BUILT_IN_VIEW_ID)
    setName('')
    setVisibleColumnIds(
      baseline.columnIds.length > 0
        ? ensureLockedResultVisibility(baseline.columnIds, nextMetadata.resultFields ?? [])
        : (defaultResults.visibleFieldIds.length > 0 ? defaultResults.visibleFieldIds : defaults.visibleColumnIds),
    )
    setColumnOrder(
      baseline.columnOrder.length > 0
        ? baseline.columnOrder
        : (defaultResults.unlockedOrder.length > 0 ? defaultResults.unlockedOrder : defaults.unlockedOrder),
    )
    setAvailableFilterIds(
      baseline.availableFilterIds.length > 0
        ? baseline.availableFilterIds
        : nextMetadata.filters.map((filter) => filter.id),
    )
    setDefinition(sanitizeSavedSearchDefinitionState(baseline.filterState))
  }

  function applyView(view: SavedListView, nextMetadata: SavedSearchTableMetadata) {
    const defaults = buildDefaultColumnState(nextMetadata)
    const defaultResults = buildDefaultResultFieldState(nextMetadata.resultFields ?? [])
    setSelectedViewId(view.id)
    setName(view.name)
    setVisibleColumnIds(
      view.columnIds.length > 0
        ? ensureLockedResultVisibility(view.columnIds, nextMetadata.resultFields ?? [])
        : (defaultResults.visibleFieldIds.length > 0 ? defaultResults.visibleFieldIds : defaults.visibleColumnIds),
    )
    setColumnOrder(view.columnOrder.length > 0 ? view.columnOrder : (defaultResults.unlockedOrder.length > 0 ? defaultResults.unlockedOrder : defaults.unlockedOrder))
    setAvailableFilterIds(Array.isArray(view.availableFilterIds) ? view.availableFilterIds : nextMetadata.filters.map((filter) => filter.id))
    setDefinition(sanitizeSavedSearchDefinitionState(view.filterState))
  }

  function beginAddNew(nextMetadata: SavedSearchTableMetadata) {
    setSelectedViewId(ADD_NEW_VIEW_ID)
    setName('')
    setErrorMessage(null)
    setStatusMessage(null)

    if (visibleColumnIds.length === 0) {
      const defaults = buildDefaultColumnState(nextMetadata)
      const defaultResults = buildDefaultResultFieldState(nextMetadata.resultFields ?? [])
      setVisibleColumnIds(defaultResults.visibleFieldIds.length > 0 ? defaultResults.visibleFieldIds : defaults.visibleColumnIds)
      setColumnOrder(defaultResults.unlockedOrder.length > 0 ? defaultResults.unlockedOrder : defaults.unlockedOrder)
      setAvailableFilterIds(nextMetadata.filters.map((filter) => filter.id))
      setDefinition(defaultSavedSearchDefinitionState())
    }
  }

  function toggleColumn(columnId: string) {
    if (defaultColumnState.lockedColumnIds.includes(columnId)) return
    setVisibleColumnIds((current) => {
      return current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId]
    })
  }

  function showAllResultColumns() {
    setVisibleColumnIds(resultFields.map((field) => field.id))
  }

  function updateColumnLabel(columnId: string, value: string) {
    setDefinition((current) => ({
      ...current,
      results: {
        ...current.results,
        columnLabels: {
          ...current.results.columnLabels,
          [columnId]: value,
        },
      },
    }))
  }

  function addLinkedResultField() {
    if (!linkedFieldToAdd) return
    const linkedField = linkedResultFieldMap.get(linkedFieldToAdd)
    if (!linkedField) return
    setDefinition((current) => ({
      ...current,
      results: {
        ...current.results,
        addedLinkedFieldIds: current.results.addedLinkedFieldIds.includes(linkedField.id)
          ? current.results.addedLinkedFieldIds
          : [...current.results.addedLinkedFieldIds, linkedField.id],
      },
    }))
    setVisibleColumnIds((current) => (current.includes(linkedField.id) ? current : [...current, linkedField.id]))
    setColumnOrder((current) => (current.includes(linkedField.id) ? current : [...current, linkedField.id]))
    setLinkedSourceToAdd('')
    setLinkedFieldToAdd('')
  }

  function removeLinkedResultField(fieldId: string) {
    setDefinition((current) => ({
      ...current,
      results: {
        ...current.results,
        addedLinkedFieldIds: current.results.addedLinkedFieldIds.filter((id) => id !== fieldId),
        columnLabels: Object.fromEntries(Object.entries(current.results.columnLabels).filter(([id]) => id !== fieldId)),
        columnPinning: {},
      },
    }))
    setVisibleColumnIds((current) => current.filter((id) => id !== fieldId))
    setColumnOrder((current) => current.filter((id) => id !== fieldId))
  }

  function addCriterion() {
    const defaultField = criteriaFieldOptions[0]?.value ?? ''
    setDefinition((current) => ({
      ...current,
      criteria: [...current.criteria, makeCriterion(defaultField)],
    }))
  }

  function updateCriterion(id: string, updates: Partial<SavedSearchCriterion>) {
    setDefinition((current) => ({
      ...current,
      criteria: current.criteria.map((criterion) => (
        criterion.id === id ? { ...criterion, ...updates } : criterion
      )),
    }))
  }

  function removeCriterion(id: string) {
    setDefinition((current) => ({
      ...current,
      criteria: current.criteria.filter((criterion) => criterion.id !== id),
    }))
  }

  function handleCriterionDrop(targetId: string) {
    if (!dragCriterionId || dragCriterionId === targetId) {
      setDragCriterionId(null)
      setDragOverCriterionId(null)
      return
    }
    setDefinition((current) => {
      const sourceIndex = current.criteria.findIndex((criterion) => criterion.id === dragCriterionId)
      const targetIndex = current.criteria.findIndex((criterion) => criterion.id === targetId)
      if (sourceIndex === -1 || targetIndex === -1) return current
      const nextCriteria = [...current.criteria]
      const [moved] = nextCriteria.splice(sourceIndex, 1)
      nextCriteria.splice(targetIndex, 0, moved)
      return {
        ...current,
        criteria: nextCriteria,
      }
    })
    setDragCriterionId(null)
    setDragOverCriterionId(null)
  }

  function toggleAudienceAllowEdit(checked: boolean) {
    setDefinition((current) => ({
      ...current,
      audience: {
        ...current.audience,
        allowEdit: checked,
      },
    }))
  }

  function toggleAudienceListValue(
    key: 'internalRoleIds' | 'departmentIds' | 'subsidiaryIds' | 'employeeIds',
    id: string,
  ) {
    setDefinition((current) => ({
      ...current,
      audience: {
        ...current.audience,
        [key]: current.audience[key].includes(id)
          ? current.audience[key].filter((entry) => entry !== id)
          : [...current.audience[key], id],
      },
    }))
  }

  function toggleAllAudienceListValues(
    key: 'internalRoleIds' | 'departmentIds' | 'subsidiaryIds' | 'employeeIds',
    checked: boolean,
    options: DirectoryOption[],
  ) {
    setDefinition((current) => ({
      ...current,
      audience: {
        ...current.audience,
        [key]: checked ? options.map((option) => option.id) : [],
      },
    }))
  }

  function updateRolePreference(
    roleId: string,
    updates: Partial<{ list: boolean; form: boolean; results: boolean; dashboard: boolean; sublist: boolean }>,
  ) {
    setDefinition((current) => {
      const existing = current.rolePreferences.assignments.find((assignment) => assignment.roleId === roleId)
      const nextAssignment = {
        roleId,
        list: existing?.list ?? false,
        form: existing?.form ?? false,
        results: existing?.results ?? false,
        dashboard: existing?.dashboard ?? false,
        sublist: existing?.sublist ?? false,
        ...updates,
      }
      const remaining = current.rolePreferences.assignments.filter((assignment) => assignment.roleId !== roleId)
      return {
        ...current,
        rolePreferences: {
          ...current.rolePreferences,
          assignments: [...remaining, nextAssignment],
        },
      }
    })
  }

  function toggleAllRoles(checked: boolean) {
    setDefinition((current) => ({
      ...current,
      rolePreferences: {
        ...current.rolePreferences,
        assignments: checked
          ? roles.map((role) => ({
              roleId: role.id,
              list: true,
              form: true,
              results: true,
              dashboard: true,
              sublist: true,
            }))
          : roles.map((role) => ({
              roleId: role.id,
              list: false,
              form: false,
              results: false,
              dashboard: false,
              sublist: false,
            })),
      },
    }))
  }

  function addEmailSchedule() {
    setDefinition((current) => ({
      ...current,
      emailSchedules: [...current.emailSchedules, makeEmailScheduleRow()],
    }))
  }

  function updateEmailSchedule(id: string, updates: Partial<SavedSearchEmailSchedule>) {
    setDefinition((current) => ({
      ...current,
      emailSchedules: current.emailSchedules.map((schedule) => (
        schedule.id === id ? { ...schedule, ...updates } : schedule
      )),
    }))
  }

  function removeEmailSchedule(id: string) {
    setDefinition((current) => ({
      ...current,
      emailSchedules: current.emailSchedules.filter((schedule) => schedule.id !== id),
    }))
  }

  function handleColumnDragStart(columnId: string) {
    setDragColumnId(columnId)
  }

  function handleColumnDrop(targetId: string) {
    if (!dragColumnId || dragColumnId === targetId) {
      setDragColumnId(null)
      setDragOverColumnId(null)
      return
    }
    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(dragColumnId)
      const targetIndex = current.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1) return current
      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDragColumnId(null)
    setDragOverColumnId(null)
  }

  async function handleSave() {
    if (!metadata) return
    const existingView = savedViews.find((view) => view.id === selectedViewId) ?? null
    const nextName =
      selectedViewId === BUILT_IN_VIEW_ID
        ? 'Page Default'
        : isAddNewMode
          ? name.trim()
          : existingView?.name?.trim() ?? ''
    if (!nextName) {
      setErrorMessage(
        isAddNewMode
          ? 'Search title is required.'
          : 'Choose an existing saved search to edit, or select Add New to create one.',
      )
      return
    }

    setSaving(true)
    setErrorMessage(null)
    setStatusMessage('Saving...')
    try {
      const normalizedDefinition: SavedSearchDefinitionState = {
        ...definition,
        results: {
          ...definition.results,
          columnPinning: {},
        },
      }
      setDefinition(normalizedDefinition)
      if (selectedViewId === BUILT_IN_VIEW_ID && !canEditBuiltIn) {
        throw new Error('Only administrators can update Page Default.')
      }
      const nextIsDefault =
        isAddNewMode
          ? defaultSelectionId === ADD_NEW_VIEW_ID
          : selectedViewId !== BUILT_IN_VIEW_ID && defaultSelectionId === selectedViewId
      const response = await fetch('/api/list-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveBuiltIn: selectedViewId === BUILT_IN_VIEW_ID,
          id: !isAddNewMode && selectedViewId !== BUILT_IN_VIEW_ID ? selectedViewId : undefined,
          tableId,
          name: nextName,
          columnIds: effectiveVisibleColumnIds,
          columnOrder,
          filterState: normalizedDefinition,
          availableFilterIds,
          isDefault: nextIsDefault,
        }),
      })
      const body = await response.json().catch(() => null) as { error?: string; view?: SavedListView; builtInBaseline?: SavedSearchBuiltInBaseline } | null
      if (!response.ok) {
        throw new Error(body?.error?.trim() || 'Failed to save saved search')
      }
      if (body?.builtInBaseline && metadata) {
        await fetch('/api/list-views', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            id: defaultSelectionId === BUILT_IN_VIEW_ID ? '' : defaultSelectionId,
          }),
        })
        applyBuiltInBaseline(body.builtInBaseline, metadata)
        setStatusMessage('Saved.')
        window.dispatchEvent(new CustomEvent('column-selector:updated', { detail: { tableId } }))
        window.location.href = `${metadata.basePath}?view=${encodeURIComponent(BUILT_IN_VIEW_ID)}&page=1`
        return
      }
      const savedView = body?.view
      let redirectHref = previewHref
      if (savedView) {
        setSavedViews((current) => {
          const withoutSaved = current.filter((view) => view.id !== savedView.id && view.name !== savedView.name)
          return [...withoutSaved, savedView].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name))
        })
        setSelectedViewId(savedView.id)
        const resolvedDefaultId =
          isAddNewMode && defaultSelectionId === ADD_NEW_VIEW_ID
            ? savedView.id
            : defaultSelectionId
        if (!nextIsDefault) {
          await fetch('/api/list-views', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tableId,
              id: resolvedDefaultId === BUILT_IN_VIEW_ID ? '' : resolvedDefaultId,
            }),
          })
        }
        redirectHref = `${metadata.basePath}?view=${encodeURIComponent(savedView.id)}&page=1`
      }
      setStatusMessage('Saved.')
      window.dispatchEvent(new CustomEvent('column-selector:updated', { detail: { tableId } }))
      window.location.href = redirectHref
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save this search.')
      setStatusMessage(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteView() {
    if (!metadata || selectedViewId === BUILT_IN_VIEW_ID) return

    setSaving(true)
    setErrorMessage(null)
    setStatusMessage('Deleting...')
    try {
      const response = await fetch('/api/list-views', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedViewId,
          tableId,
        }),
      })
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(body?.error?.trim() || 'Failed to delete saved search')
      }

      setSavedViews((current) => current.filter((view) => view.id !== selectedViewId))
      if (defaultSelectionId === selectedViewId) {
        setDefaultSelectionId(BUILT_IN_VIEW_ID)
      }
      applyBuiltInDefault(metadata)
      setStatusMessage('Deleted.')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('column-selector:updated', { detail: { tableId } }))
        window.location.href = `${metadata.basePath}?view=${encodeURIComponent(BUILT_IN_VIEW_ID)}&page=1`
      }, 0)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete this search.')
      setStatusMessage(null)
    } finally {
      setSaving(false)
    }
  }

  if (!metadata) return null

  const viewOptions = [
    { value: ADD_NEW_VIEW_ID, label: 'Add New' },
    { value: BUILT_IN_VIEW_ID, label: 'Page Default' },
    ...savedViews.map((view) => ({ value: view.id, label: view.name })),
  ]

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">{metadata.title} Saved Search</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Same list-page chrome, new shared engine underneath it. Define criteria, results, audience, roles, and email delivery here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void handleSave() }}
              disabled={saving}
              className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <Link
              href={cancelHref}
              className="rounded-md border px-3 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
            {selectedViewId !== BUILT_IN_VIEW_ID && selectedViewId !== ADD_NEW_VIEW_ID ? (
              <button
                type="button"
                onClick={() => { void handleDeleteView() }}
                disabled={saving}
                className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--danger)' }}
              >
                Delete View
              </button>
            ) : null}
          </div>
        </div>

        <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Base Page</span>
                <input
                  value={metadata.basePath}
                  readOnly
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
                />
              </div>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Saved Search</span>
                <SavedSearchManagerDropdown
                  selectedValue={selectedViewId}
                  defaultValue={defaultSelectionId}
                  options={viewOptions}
                  placeholder="Select saved search"
                  onSelect={(value) => {
                    if (value === BUILT_IN_VIEW_ID) {
                      applyBuiltInDefault(metadata)
                      return
                    }
                    if (value === ADD_NEW_VIEW_ID) {
                      beginAddNew(metadata)
                      return
                    }
                    const nextView = savedViews.find((view) => view.id === value)
                    if (nextView) applyView(nextView, metadata)
                  }}
                  onDefaultChange={(value, checked) => {
                    if (checked) {
                      setDefaultSelectionId(value)
                    } else if (defaultSelectionId === value) {
                      setDefaultSelectionId(BUILT_IN_VIEW_ID)
                    }
                  }}
                />
              </div>
              {isAddNewMode ? (
                <div className="space-y-1 text-sm md:col-span-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="block text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Search Title</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Search Summary
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Result Fields</dt>
                  <dd className="text-white">{resultFieldSummaryVisible} of {resultFieldSummaryTotal}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Live Page Columns</dt>
                  <dd className="text-white">{livePageVisibleResultCount} of {livePageResultFields.length}</dd>
                </div>
                {joinedOutputFieldCount > 0 ? (
                  <div className="flex items-center justify-between">
                    <dt style={{ color: 'var(--text-secondary)' }}>Joined Output Fields</dt>
                    <dd className="text-white">{joinedOutputFieldCount}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Criteria Rows</dt>
                  <dd className="text-white">{definition.criteria.length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Criteria Sources</dt>
                  <dd className="text-white">{criteriaFields.length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Email Schedules</dt>
                  <dd className="text-white">{definition.emailSchedules.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <div className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
          <nav className="flex flex-wrap items-center gap-2">
            {EDITOR_TABS.map(([id, label]) => {
              const tabId = id as EditorTab
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className="rounded-t-lg px-4 py-2 text-sm font-medium"
                  style={activeTab === tabId ? { backgroundColor: 'var(--card)', color: '#fff' } : { color: 'var(--text-secondary)' }}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        </div>

        {loading ? (
          <div className="rounded-2xl border px-6 py-10 text-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
            Loading saved search definition...
          </div>
        ) : null}

        {!loading && activeTab === 'criteria' ? (
          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Criteria</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {criteriaIntroText}
                </p>
              </div>
              <button
                type="button"
                onClick={addCriterion}
                className="rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Add Criterion
              </button>
            </div>

            {definition.criteria.length === 0 ? (
              <div className="rounded-lg border px-4 py-6 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                No criteria rows yet. Add one to define saved-search logic for this page and its live filter region.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <div className="min-w-[1080px] space-y-3">
                {definition.criteria.map((criterion, index) => (
                  <div
                    key={criterion.id}
                    draggable
                    onDragStart={() => setDragCriterionId(criterion.id)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOverCriterionId(criterion.id)
                    }}
                    onDrop={() => handleCriterionDrop(criterion.id)}
                    onDragEnd={() => {
                      setDragCriterionId(null)
                      setDragOverCriterionId(null)
                    }}
                    className="rounded-lg border px-4 py-4"
                    style={{
                      borderColor: dragOverCriterionId === criterion.id && dragCriterionId !== criterion.id
                        ? 'var(--accent-primary-strong)'
                        : 'var(--border-muted)',
                      opacity: dragCriterionId === criterion.id ? 0.55 : 1,
                    }}
                  >
                    <div className="flex items-end gap-3">
                      <div className="w-8 shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Move</div>
                        <div
                          className="flex h-[42px] cursor-grab items-center justify-center text-sm"
                          style={{ color: 'var(--text-muted)' }}
                          aria-label={`Drag criterion ${index + 1}`}
                          title={`Drag criterion ${index + 1}`}
                        >
                          ::
                        </div>
                      </div>
                      <div className="w-20 shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Open (</div>
                        <input
                          type="number"
                          min={0}
                          value={criterion.openParens}
                          onChange={(event) => updateCriterion(criterion.id, { openParens: Math.max(0, Number(event.target.value) || 0) })}
                          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Joiner</div>
                        <SearchableSelect
                          selectedValue={criterion.joiner}
                          options={[
                            { value: 'and', label: 'AND' },
                            { value: 'or', label: 'OR' },
                          ]}
                          placeholder="Joiner"
                          dropdownWidthMode="trigger"
                          onSelect={(value) => updateCriterion(criterion.id, { joiner: value === 'or' ? 'or' : 'and' })}
                        />
                      </div>
                      <div className="w-[240px] shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field</div>
                        <SearchableSelect
                          selectedValue={criterion.fieldId}
                          options={criteriaFieldOptions}
                          placeholder="Select field"
                          dropdownWidthMode="trigger"
                          onSelect={(value) => updateCriterion(criterion.id, { fieldId: value })}
                        />
                      </div>
                      <div className="w-40 shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Operator</div>
                        <SearchableSelect
                          selectedValue={criterion.operator}
                          options={CRITERIA_OPERATOR_OPTIONS}
                          placeholder="Operator"
                          dropdownWidthMode="trigger"
                          onSelect={(value) => updateCriterion(criterion.id, { operator: value })}
                        />
                      </div>
                      <div className="w-[180px] shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Value</div>
                        {getCriteriaField(criterion.fieldId)?.type === 'select' ? (
                          <SearchableSelect
                            selectedValue={criterion.value}
                            options={[{ value: '', label: 'Select value' }, ...(getCriteriaField(criterion.fieldId)?.options ?? [])]}
                            placeholder={getCriteriaField(criterion.fieldId)?.placeholder ?? 'Select value'}
                            dropdownWidthMode="trigger"
                            onSelect={(value) => updateCriterion(criterion.id, { value })}
                          />
                        ) : (
                          <input
                            value={criterion.value}
                            onChange={(event) => updateCriterion(criterion.id, { value: event.target.value })}
                            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        )}
                      </div>
                      <div className="w-20 shrink-0">
                        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Close )</div>
                        <input
                          type="number"
                          min={0}
                          value={criterion.closeParens}
                          onChange={(event) => updateCriterion(criterion.id, { closeParens: Math.max(0, Number(event.target.value) || 0) })}
                          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                      </div>
                      <div className="w-[96px] shrink-0">
                        <div className="h-[18px]" aria-hidden="true" />
                        <div className="flex h-[42px] items-center justify-start">
                          <button type="button" onClick={() => removeCriterion(criterion.id)} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--danger)' }}>Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}
          </section>
        ) : null}

        {!loading && activeTab === 'results' ? (
          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Results</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {resultsIntroText}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="w-56">
                  <button
                    type="button"
                    onClick={showAllResultColumns}
                    className="w-full rounded-md border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Show All
                  </button>
                </div>
              </div>

              <div className="rounded-xl border" style={{ borderColor: 'var(--border-muted)' }}>
                <div className={showResultTypeColumn ? 'grid gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide md:grid-cols-[2rem_minmax(0,1fr)_12rem_10rem_16rem_8rem]' : 'grid gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide md:grid-cols-[2rem_minmax(0,1fr)_12rem_10rem_16rem]'} style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>
                  <span />
                  <span>Result Field</span>
                  <span>Source</span>
                  <span>Visible</span>
                  <span>Custom Label</span>
                  {showResultTypeColumn ? <span>Remove</span> : null}
                </div>

                <div className="space-y-2 p-3">
                  {lockedResultFields.map((column) => (
                    <div
                      key={column.id}
                      className={resultGridClassName}
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <span className="text-center text-xs" style={{ color: 'var(--text-muted)' }} aria-hidden>•</span>
                      <div>
                        <div className="text-sm font-medium text-white">{column.label}</div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{column.group ?? 'Pinned field'}</div>
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getResultFieldSourceLabel(column)}</div>
                      <div className="flex items-center text-sm" style={{ color: 'var(--text-secondary)' }}>Always visible</div>
                      <input
                        value={definition.results.columnLabels[column.id] ?? ''}
                        onChange={(event) => updateColumnLabel(column.id, event.target.value)}
                        placeholder={column.label}
                        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                        style={{ borderColor: 'var(--border-muted)' }}
                      />
                      {showResultTypeColumn ? (
                        <div className="flex items-center text-sm" style={{ color: 'var(--text-muted)' }}>
                          Locked
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {reorderableResultFields.map((column) => {
                    const visible = effectiveVisibleColumnIds.includes(column.id)
                    const labelOverride = definition.results.columnLabels[column.id] ?? ''
                    const isDragging = dragColumnId === column.id
                    const isDragOver = dragOverColumnId === column.id && dragColumnId !== column.id
                    return (
                      <div
                        key={column.id}
                        draggable
                        onDragStart={() => handleColumnDragStart(column.id)}
                        onDragOver={(event) => {
                          event.preventDefault()
                          if (dragOverColumnId !== column.id) {
                            setDragOverColumnId(column.id)
                          }
                        }}
                        onDrop={() => handleColumnDrop(column.id)}
                        onDragEnd={() => {
                          setDragColumnId(null)
                          setDragOverColumnId(null)
                        }}
                        className={resultGridClassName}
                        style={{
                          borderColor: isDragOver ? 'var(--accent-primary-strong)' : 'var(--border-muted)',
                          opacity: isDragging ? 0.55 : 1,
                        }}
                      >
                        <span className="cursor-grab text-center text-xs" style={{ color: 'var(--text-muted)' }} aria-hidden>::</span>
                        <div>
                          <div className="text-sm font-medium text-white">{column.label}</div>
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{column.group ?? 'Result field'} · {column.id}</div>
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getResultFieldSourceLabel(column)}</div>
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => toggleColumn(column.id)}
                            className="h-4 w-4"
                          />
                          Show
                        </label>
                        <input
                          value={labelOverride}
                          onChange={(event) => updateColumnLabel(column.id, event.target.value)}
                          placeholder={column.label}
                          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                          style={{ borderColor: 'var(--border-muted)' }}
                        />
                        {showResultTypeColumn ? (
                          <div className="flex items-center">
                            {definition.results.addedLinkedFieldIds.includes(column.id) ? (
                              <button
                                type="button"
                                onClick={() => removeLinkedResultField(column.id)}
                                className="rounded-md border px-2 py-1 text-xs"
                                style={{ borderColor: 'var(--border-muted)', color: 'var(--danger)' }}
                              >
                                Remove
                              </button>
                            ) : (
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Base</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}

                  {linkedResultSources.length > 0 ? (
                    <div
                      className="grid gap-4 rounded-lg border px-4 py-3 md:grid-cols-[2rem_8rem_minmax(280px,1fr)_minmax(320px,1.2fr)_minmax(0,1fr)]"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <span />
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={addLinkedResultField}
                          disabled={!linkedFieldToAdd}
                          className="w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Add
                        </button>
                      </div>
                      <div className="min-w-[280px]">
                        <SearchableSelect
                          selectedValue={linkedSourceToAdd}
                          options={linkedResultSources.map((source) => ({ value: source.id, label: source.label }))}
                          placeholder="Linked record"
                          dropdownWidthMode="trigger"
                          onSelect={(value) => {
                            setLinkedSourceToAdd(value)
                            setLinkedFieldToAdd('')
                          }}
                        />
                      </div>
                      <div className="min-w-[320px]">
                        <SearchableSelect
                          selectedValue={linkedFieldToAdd}
                          options={linkedFieldAddOptions}
                          placeholder="Linked field"
                          dropdownWidthMode="trigger"
                          onSelect={setLinkedFieldToAdd}
                        />
                      </div>
                      <div className="flex items-center text-sm" style={{ color: linkedFieldToAdd ? 'var(--text-muted)' : 'transparent' }}>
                        {linkedFieldToAdd ? 'Added at end. Drag after add.' : ' '}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && activeTab === 'audience' ? (
          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Audience</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Control who can access and maintain the saved search by audience dimensions.
              </p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={definition.audience.allowEdit}
                  onChange={(event) => toggleAudienceAllowEdit(event.target.checked)}
                  className="h-4 w-4"
                />
                Allow audience to edit
              </label>
            </div>

            <div className="grid gap-6 xl:grid-cols-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Internal Roles</div>
                  <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={allAudienceInternalRolesSelected}
                      onChange={(event) => toggleAllAudienceListValues('internalRoleIds', event.target.checked, roles)}
                      className="h-4 w-4"
                    />
                    Select All
                  </label>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={definition.audience.internalRoleIds.includes(role.id)}
                        onChange={() => toggleAudienceListValue('internalRoleIds', role.id)}
                        className="h-4 w-4"
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Departments</div>
                  <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={allAudienceDepartmentsSelected}
                      onChange={(event) => toggleAllAudienceListValues('departmentIds', event.target.checked, departments)}
                      className="h-4 w-4"
                    />
                    Select All
                  </label>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {departments.map((department) => (
                    <label key={department.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={definition.audience.departmentIds.includes(department.id)}
                        onChange={() => toggleAudienceListValue('departmentIds', department.id)}
                        className="h-4 w-4"
                      />
                      {department.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Subsidiaries</div>
                  <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={allAudienceSubsidiariesSelected}
                      onChange={(event) => toggleAllAudienceListValues('subsidiaryIds', event.target.checked, subsidiaries)}
                      className="h-4 w-4"
                    />
                    Select All
                  </label>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {subsidiaries.map((subsidiary) => (
                    <label key={subsidiary.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={definition.audience.subsidiaryIds.includes(subsidiary.id)}
                        onChange={() => toggleAudienceListValue('subsidiaryIds', subsidiary.id)}
                        className="h-4 w-4"
                      />
                      {subsidiary.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Employees</div>
                  <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={allAudienceEmployeesSelected}
                      onChange={(event) => toggleAllAudienceListValues('employeeIds', event.target.checked, employees)}
                      className="h-4 w-4"
                    />
                    Select All
                  </label>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {employees.map((employee) => (
                    <label key={employee.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={definition.audience.employeeIds.includes(employee.id)}
                        onChange={() => toggleAudienceListValue('employeeIds', employee.id)}
                        className="h-4 w-4"
                      />
                      {employee.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && activeTab === 'roles' ? (
          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Roles</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Control which roles use this saved search as list, form, results, dashboard, or sublist defaults.
              </p>
            </div>
            <div className="mb-4 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={allRolesSelected}
                  onChange={(event) => toggleAllRoles(event.target.checked)}
                  className="h-4 w-4"
                />
                All
              </label>
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={definition.rolePreferences.preferredSearchResults}
                  onChange={(event) =>
                    setDefinition((current) => ({
                      ...current,
                      rolePreferences: {
                        ...current.rolePreferences,
                        preferredSearchResults: event.target.checked,
                      },
                    }))
                  }
                  className="h-4 w-4"
                />
                Preferred Search Results
              </label>
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="min-w-[860px]">
                <div
                  className="grid gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{
                    gridTemplateColumns: 'repeat(5, 80px) minmax(0,1fr)',
                    borderColor: 'var(--border-muted)',
                    backgroundColor: 'var(--card-elevated)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>List</span>
                  <span>Form</span>
                  <span>Results</span>
                  <span>Dashboard</span>
                  <span>Sublist</span>
                  <span>Role</span>
                </div>
                <div className="space-y-1 p-3">
                  {roles.map((role) => {
                    const assignment = rolePreferenceMap.get(role.id) ?? {
                      roleId: role.id,
                      list: false,
                      form: false,
                      results: false,
                      dashboard: false,
                      sublist: false,
                    }
                    return (
                      <div
                        key={role.id}
                        className="grid items-center gap-3 rounded-lg border px-4 py-3 text-sm"
                        style={{
                          gridTemplateColumns: 'repeat(5, 80px) minmax(0,1fr)',
                          borderColor: 'var(--border-muted)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {(['list', 'form', 'results', 'dashboard', 'sublist'] as const).map((key) => (
                          <label key={key} className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={assignment[key]}
                              onChange={(event) => updateRolePreference(role.id, { [key]: event.target.checked })}
                              className="h-4 w-4"
                            />
                          </label>
                        ))}
                        <span>{role.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && activeTab === 'emails' ? (
          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Emails</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Define one or more scheduled email deliveries for this saved search.
                </p>
              </div>
              <button
                type="button"
                onClick={addEmailSchedule}
                className="rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Add Email Schedule
              </button>
            </div>
            {definition.emailSchedules.length === 0 ? (
              <div className="rounded-lg border px-4 py-6 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
                No email schedules configured yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[1040px] space-y-3">
                  {definition.emailSchedules.map((schedule, index) => (
                    <div
                      key={schedule.id}
                      className="rounded-lg border px-4 py-4"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <div className="flex items-end gap-3">
                        <div className="w-24 shrink-0">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Enabled</div>
                          <label className="flex h-[42px] items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <input
                              type="checkbox"
                              checked={schedule.enabled}
                              onChange={(event) => updateEmailSchedule(schedule.id, { enabled: event.target.checked })}
                              className="h-4 w-4"
                            />
                            On
                          </label>
                        </div>
                        <div className="w-36 shrink-0">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Frequency</div>
                          <SearchableSelect
                            selectedValue={schedule.frequency}
                            options={EMAIL_FREQUENCY_OPTIONS}
                            placeholder="Select frequency"
                            dropdownWidthMode="trigger"
                            onSelect={(value) => updateEmailSchedule(schedule.id, { frequency: value === 'daily' || value === 'monthly' ? value : 'weekly' })}
                          />
                        </div>
                        <div className="w-32 shrink-0">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>File Type</div>
                          <SearchableSelect
                            selectedValue={schedule.fileType}
                            options={EMAIL_FILE_TYPE_OPTIONS}
                            placeholder="Select file type"
                            dropdownWidthMode="trigger"
                            onSelect={(value) => updateEmailSchedule(schedule.id, { fileType: value === 'csv' || value === 'pdf' ? value : 'excel' })}
                          />
                        </div>
                        <div className="min-w-[260px] flex-1">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Recipients</div>
                          <input
                            value={schedule.recipients}
                            onChange={(event) => updateEmailSchedule(schedule.id, { recipients: event.target.value })}
                            placeholder="comma-separated emails"
                            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        </div>
                        <div className="min-w-[260px] flex-1">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Email Subject</div>
                          <input
                            value={schedule.subject}
                            onChange={(event) => updateEmailSchedule(schedule.id, { subject: event.target.value })}
                            placeholder={`${metadata.title} search results`}
                            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        </div>
                        <div className="w-[96px] shrink-0">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Remove</div>
                          <div className="flex h-[42px] items-center">
                            <button
                              type="button"
                              onClick={() => removeEmailSchedule(schedule.id)}
                              className="rounded-md border px-2 py-1 text-xs"
                              style={{ borderColor: 'var(--border-muted)', color: 'var(--danger)' }}
                              title={`Remove email schedule ${index + 1}`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {statusMessage ? <p className="text-sm text-emerald-300">{statusMessage}</p> : null}
        {errorMessage ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{errorMessage}</p> : null}
      </div>
    </div>
  )
}
