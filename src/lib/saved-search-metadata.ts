export type SavedSearchColumnOption = {
  id: string
  label: string
  defaultVisible?: boolean
  locked?: boolean
}

export type SavedSearchFieldOption = {
  id: string
  label: string
  source?: string
  group?: string
  type?: 'text' | 'select'
  placeholder?: string
  options?: SavedSearchFilterOption[]
  defaultVisible?: boolean
  locked?: boolean
}

export type SavedSearchFilterOption = {
  value: string
  label: string
}

export type SavedSearchFilterDefinition = {
  id: string
  label: string
  param: string
  type: 'text' | 'select'
  placeholder?: string
  helpText?: string
  options?: SavedSearchFilterOption[]
}

export type SavedSearchTableMetadata = {
  tableId: string
  title: string
  basePath: string
  columns: SavedSearchColumnOption[]
  filters: SavedSearchFilterDefinition[]
  criteriaFields?: SavedSearchFieldOption[]
  resultFields?: SavedSearchFieldOption[]
  linkedResultSources?: SavedSearchLinkedResultSource[]
}

export type SavedSearchLinkedResultSource = {
  id: string
  label: string
  fields: SavedSearchFieldOption[]
}

export type SavedSearchCriterion = {
  id: string
  fieldId: string
  operator: string
  value: string
  joiner: 'and' | 'or'
  openParens: number
  closeParens: number
  showInGlobalFilter: boolean
}

export type SavedSearchAudienceVisibility = 'private' | 'shared' | 'public'

export type SavedSearchRolePreference = {
  roleId: string
  list: boolean
  form: boolean
  results: boolean
  dashboard: boolean
  sublist: boolean
}

export type SavedSearchEmailSchedule = {
  id: string
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  fileType: 'excel' | 'csv' | 'pdf'
  recipients: string
  subject: string
}

export type SavedSearchDefinitionState = {
  filterValues: Record<string, string>
  globalFilterIds: string[]
  criteria: SavedSearchCriterion[]
  audience: {
    visibility: SavedSearchAudienceVisibility
    allowEdit: boolean
    userIds: string[]
    internalRoleIds: string[]
    departmentIds: string[]
    subsidiaryIds: string[]
    employeeIds: string[]
  }
  rolePreferences: {
    preferredSearchResults: boolean
    assignments: SavedSearchRolePreference[]
  }
  emailSchedules: SavedSearchEmailSchedule[]
  results: {
    columnLabels: Record<string, string>
    columnPinning: Record<string, number>
    addedLinkedFieldIds: string[]
  }
}

function parsePinningMap(input: unknown): Record<string, number> {
  void input
  return {}
}

function makeEmailSchedule(input?: Partial<SavedSearchEmailSchedule>, index = 0): SavedSearchEmailSchedule {
  return {
    id:
      typeof input?.id === 'string' && input.id.trim()
        ? input.id.trim()
        : `email-schedule-${index + 1}`,
    enabled: input?.enabled === true,
    frequency:
      input?.frequency === 'daily' || input?.frequency === 'monthly'
        ? input.frequency
        : 'weekly',
    fileType:
      input?.fileType === 'csv' || input?.fileType === 'pdf'
        ? input.fileType
        : 'excel',
    recipients: typeof input?.recipients === 'string' ? input.recipients : '',
    subject: typeof input?.subject === 'string' ? input.subject : '',
  }
}

function makeRolePreference(input: Partial<SavedSearchRolePreference>): SavedSearchRolePreference | null {
  const roleId = typeof input.roleId === 'string' ? input.roleId.trim() : ''
  if (!roleId) return null
  return {
    roleId,
    list: input.list === true,
    form: input.form === true,
    results: input.results === true,
    dashboard: input.dashboard === true,
    sublist: input.sublist === true,
  }
}

export function getSavedSearchMetadataStorageKey(tableId: string) {
  return `saved-search-meta:${tableId}`
}

function parseStringMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {}
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
      .map(([key, value]) => [key.trim(), value]),
  )
}

function parseStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const next: string[] = []
  for (const entry of input) {
    if (typeof entry !== 'string') continue
    const value = entry.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    next.push(value)
  }
  return next
}

function parseCriterion(input: unknown, index: number): SavedSearchCriterion | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const fieldId = typeof record.fieldId === 'string' ? record.fieldId.trim() : ''
  if (!fieldId) return null
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `criterion-${index + 1}`,
    fieldId,
    operator: typeof record.operator === 'string' && record.operator.trim() ? record.operator.trim() : 'contains',
    value: typeof record.value === 'string' ? record.value : '',
    joiner: record.joiner === 'or' ? 'or' : 'and',
    openParens:
      typeof record.openParens === 'number' && Number.isFinite(record.openParens)
        ? Math.max(0, Math.trunc(record.openParens))
        : 0,
    closeParens:
      typeof record.closeParens === 'number' && Number.isFinite(record.closeParens)
        ? Math.max(0, Math.trunc(record.closeParens))
        : 0,
    showInGlobalFilter: record.showInGlobalFilter === true,
  }
}

export function defaultSavedSearchDefinitionState(): SavedSearchDefinitionState {
  return {
    filterValues: {},
    globalFilterIds: [],
    criteria: [],
    audience: {
      visibility: 'private',
      allowEdit: false,
      userIds: [],
      internalRoleIds: [],
      departmentIds: [],
      subsidiaryIds: [],
      employeeIds: [],
    },
    rolePreferences: {
      preferredSearchResults: false,
      assignments: [],
    },
    emailSchedules: [],
    results: {
      columnLabels: {},
      columnPinning: {},
      addedLinkedFieldIds: [],
    },
  }
}

export function sanitizeSavedSearchDefinitionState(input: unknown): SavedSearchDefinitionState {
  const defaults = defaultSavedSearchDefinitionState()
  if (!input || typeof input !== 'object') return defaults
  const record = input as Record<string, unknown>

  const audience =
    record.audience && typeof record.audience === 'object'
      ? (record.audience as Record<string, unknown>)
      : {}
  const email =
    record.email && typeof record.email === 'object'
      ? (record.email as Record<string, unknown>)
      : {}
  const rolePreferences =
    record.rolePreferences && typeof record.rolePreferences === 'object'
      ? (record.rolePreferences as Record<string, unknown>)
      : {}
  const emailSchedules = Array.isArray(record.emailSchedules)
    ? record.emailSchedules
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry, index) => makeEmailSchedule(entry as Partial<SavedSearchEmailSchedule>, index))
    : []
  const results =
    record.results && typeof record.results === 'object'
      ? (record.results as Record<string, unknown>)
      : {}

  return {
    filterValues: parseStringMap(record.filterValues),
    globalFilterIds: parseStringList(record.globalFilterIds),
    criteria: Array.isArray(record.criteria)
      ? record.criteria
          .map((criterion, index) => parseCriterion(criterion, index))
          .filter((criterion): criterion is SavedSearchCriterion => Boolean(criterion))
      : [],
    audience: {
      visibility:
        audience.visibility === 'public' || audience.visibility === 'shared'
          ? audience.visibility
          : 'private',
      allowEdit: audience.allowEdit === true,
      userIds: parseStringList(audience.userIds),
      internalRoleIds: parseStringList(audience.internalRoleIds),
      departmentIds: parseStringList(audience.departmentIds),
      subsidiaryIds: parseStringList(audience.subsidiaryIds),
      employeeIds: parseStringList(audience.employeeIds),
    },
    rolePreferences: {
      preferredSearchResults: rolePreferences.preferredSearchResults === true,
      assignments: Array.isArray(rolePreferences.assignments)
        ? rolePreferences.assignments
            .map((entry) => makeRolePreference((entry ?? {}) as Partial<SavedSearchRolePreference>))
            .filter((entry): entry is SavedSearchRolePreference => Boolean(entry))
        : parseStringList(record.roleIds).map((roleId) => ({
            roleId,
            list: false,
            form: false,
            results: true,
            dashboard: false,
            sublist: false,
          })),
    },
    emailSchedules:
      emailSchedules.length > 0
        ? emailSchedules
        : (
            email.enabled === true
            || (typeof email.recipients === 'string' && email.recipients.trim() !== '')
            || (typeof email.subject === 'string' && email.subject.trim() !== '')
          )
          ? [makeEmailSchedule({
              enabled: email.enabled === true,
              frequency:
                email.frequency === 'daily' || email.frequency === 'monthly'
                  ? email.frequency
                  : 'weekly',
              fileType:
                email.fileType === 'csv' || email.fileType === 'pdf'
                  ? email.fileType
                  : 'excel',
              recipients: typeof email.recipients === 'string' ? email.recipients : '',
              subject: typeof email.subject === 'string' ? email.subject : '',
            })]
          : [],
    results: {
      columnLabels: parseStringMap(results.columnLabels),
      columnPinning: parsePinningMap(results.columnPinning),
      addedLinkedFieldIds: parseStringList(results.addedLinkedFieldIds),
    },
  }
}
