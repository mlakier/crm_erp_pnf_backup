'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DepartmentCustomizationConfig } from '@/lib/department-customization'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultDepartmentFormCustomization,
  DEPARTMENT_FORM_FIELDS,
  type DepartmentFormCustomizationConfig,
  type DepartmentFormFieldKey,
} from '@/lib/department-form-customization'
import {
  CustomFieldDefinitionSummary,
  parseCustomFieldOptions,
} from '@/lib/custom-fields'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'

type DepartmentFormCustomizationResponse = {
  config?: DepartmentFormCustomizationConfig
}

export type DepartmentCreateInitialValues = {
  departmentNumber?: string | null
  name?: string
  description?: string | null
  division?: string | null
  subsidiaryIds?: string[]
  includeChildren?: boolean
  planningCategory?: string | null
  managerEmployeeId?: string | null
  approverEmployeeId?: string | null
  inactive?: boolean
}

export default function DepartmentCreateForm({
  nextDepartmentId,
  employees,
  subsidiaries,
  customization,
  divisionOptions,
  planningCategoryOptions,
  inactiveOptions,
  customFields,
  formId,
  showFooterActions = true,
  redirectBasePath,
  initialValues,
  onSuccess,
  onCancel,
}: {
  nextDepartmentId?: string
  employees?: Array<{ id: string; firstName: string; lastName: string; employeeId?: string | null }>
  subsidiaries?: Array<{ id: string; subsidiaryId: string; name: string }>
  customization?: DepartmentCustomizationConfig
  divisionOptions?: string[]
  planningCategoryOptions?: string[]
  inactiveOptions: SelectOption[]
  customFields?: CustomFieldDefinitionSummary[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  initialValues?: DepartmentCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [departmentId, setDepartmentId] = useState(nextDepartmentId ?? '')
  const [departmentNumber, setDepartmentNumber] = useState(initialValues?.departmentNumber ?? '')
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [division, setDivision] = useState(() => initialValues?.division ?? customization?.listBindings.divisionDefaultValue ?? '')
  const [subsidiaryIds, setSubsidiaryIds] = useState<string[]>(initialValues?.subsidiaryIds ?? [])
  const [includeChildren, setIncludeChildren] = useState(initialValues?.includeChildren ?? false)
  const [planningCategory, setPlanningCategory] = useState(initialValues?.planningCategory ?? '')
  const [managerEmployeeId, setManagerEmployeeId] = useState(initialValues?.managerEmployeeId ?? '')
  const [approverEmployeeId, setApproverEmployeeId] = useState(initialValues?.approverEmployeeId ?? '')
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (customFields ?? []).map((field) => [field.id, field.defaultValue ?? (field.type === 'checkbox' ? 'false' : '')]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<DepartmentFormCustomizationConfig>(() => defaultDepartmentFormCustomization())

  const useDivisionDropdown = Boolean(customization?.listBindings.divisionCustomListId && (divisionOptions?.length ?? 0) > 0)
  const usePlanningCategoryDropdown = (planningCategoryOptions?.length ?? 0) > 0

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/department-form-customization', { cache: 'no-store' }),
        ])

        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as DepartmentFormCustomizationResponse

        if (!mounted) return

        if (requirementsResponse.ok) {
          setRuntimeRequirements(requirementsBody?.config?.departmentCreate ?? null)
        }

        if (layoutResponse.ok && layoutBody.config) {
          setLayoutConfig(layoutBody.config)
        }
      } catch {
        // Keep static defaults when config APIs are unavailable.
      }
    }

    void loadConfig()
    return () => {
      mounted = false
    }
  }, [])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('departmentCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return (
      <>
        {text} <span style={{ color: 'var(--danger)' }}>*</span>
      </>
    )
  }

  const groupedVisibleFields = useMemo(() => {
    return layoutConfig.sections
      .map((section) => ({
        section,
        fields: DEPARTMENT_FORM_FIELDS
          .filter((field) => {
            const config = layoutConfig.fields[field.id]
            return config?.visible !== false && config?.section === section
          })
          .sort((a, b) => {
            const left = layoutConfig.fields[a.id]
            const right = layoutConfig.fields[b.id]
            if ((left?.column ?? 1) !== (right?.column ?? 1)) return (left?.column ?? 1) - (right?.column ?? 1)
            return (left?.order ?? 0) - (right?.order ?? 0)
          }),
      }))
      .filter((group) => group.fields.length > 0)
  }, [layoutConfig])

  const formColumns = Math.min(4, Math.max(1, layoutConfig.formColumns || 2))

  function getSectionGridStyle(): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))` }
  }

  function getFieldPlacementStyle(fieldId: DepartmentFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderEmployeeOptions() {
    return (employees ?? []).map((employee) => (
      <option key={employee.id} value={employee.id}>
        {employee.firstName} {employee.lastName}
        {employee.employeeId ? ` (${employee.employeeId})` : ''}
      </option>
    ))
  }

  function renderField(fieldId: DepartmentFormFieldKey) {
    switch (fieldId) {
      case 'departmentId':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Department Id', req('departmentId'))}</span>
            <input value={departmentId} onChange={(e) => setDepartmentId(e.target.value.toUpperCase())} required={req('departmentId')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'departmentNumber':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Department Number', req('departmentNumber'))}</span>
            <input value={departmentNumber} onChange={(e) => setDepartmentNumber(e.target.value)} required={req('departmentNumber')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'name':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Name', req('name'))}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'description':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Description', req('description'))}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required={req('description')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'division':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Division', req('division'))}</span>
            {useDivisionDropdown ? (
              <select value={division} onChange={(e) => setDivision(e.target.value)} required={req('division')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="">Select division</option>
                {(divisionOptions ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input value={division} onChange={(e) => setDivision(e.target.value)} required={req('division')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
            )}
          </label>
        )
      case 'subsidiaryIds':
        return (
          <div key={fieldId} className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Subsidiaries', req('subsidiaryIds'))}</span>
            <MultiSelectDropdown
              value={subsidiaryIds}
              options={(subsidiaries ?? []).map((subsidiary) => ({
                value: subsidiary.id,
                label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
              }))}
              placeholder="Select Subsidiaries"
              onChange={setSubsidiaryIds}
            />
          </div>
        )
      case 'includeChildren':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Include Children', req('includeChildren'))}</span>
            <select value={includeChildren ? 'true' : 'false'} onChange={(e) => setIncludeChildren(e.target.value === 'true')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
        )
      case 'planningCategory':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Department Planning Category', req('planningCategory'))}</span>
            {usePlanningCategoryDropdown ? (
              <select value={planningCategory} onChange={(e) => setPlanningCategory(e.target.value)} required={req('planningCategory')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
                <option value="">Select planning category</option>
                {(planningCategoryOptions ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input value={planningCategory} onChange={(e) => setPlanningCategory(e.target.value)} required={req('planningCategory')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }} />
            )}
          </label>
        )
      case 'managerEmployeeId':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Department Manager', req('managerEmployeeId'))}</span>
            <select value={managerEmployeeId} onChange={(e) => setManagerEmployeeId(e.target.value)} required={req('managerEmployeeId')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {renderEmployeeOptions()}
            </select>
          </label>
        )
      case 'approverEmployeeId':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Department Approver', req('approverEmployeeId'))}</span>
            <select value={approverEmployeeId} onChange={(e) => setApproverEmployeeId(e.target.value)} required={req('approverEmployeeId')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {renderEmployeeOptions()}
            </select>
          </label>
        )
      case 'inactive':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Inactive', req('inactive'))}</span>
            <select value={inactive ? 'true' : 'false'} onChange={(e) => setInactive(e.target.value === 'true')} className="w-full rounded-md border px-3 py-2 text-white bg-transparent" style={{ borderColor: 'var(--border-muted)' }}>
              {inactiveOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      default:
        return null
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const missing: string[] = []
      const requiredFields = [
        ['departmentId', departmentId],
        ['departmentNumber', departmentNumber],
        ['name', name],
        ['description', description],
        ['division', division],
        ['subsidiaryIds', subsidiaryIds.join(',')],
        ['planningCategory', planningCategory],
        ['managerEmployeeId', managerEmployeeId],
        ['approverEmployeeId', approverEmployeeId],
      ] as const

      for (const [fieldName, fieldValue] of requiredFields) {
        if (req(fieldName) && !String(fieldValue ?? '').trim()) {
          missing.push(fieldName)
        }
      }

      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`)
      }

      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          departmentNumber,
          name,
          description,
          division,
          subsidiaryIds,
          includeChildren,
          planningCategory,
          managerEmployeeId,
          approverEmployeeId,
          inactive,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Create failed')

      const createdDepartmentId = String(json?.id ?? '')
      if (createdDepartmentId) {
        const valueRequests = (customFields ?? [])
          .map((field) => ({
            fieldId: field.id,
            type: field.type,
            value: customFieldValues[field.id] ?? '',
          }))
          .filter(({ type, value }) => type === 'checkbox' || value.trim() !== '')
          .map(async ({ fieldId, value }) => {
            const saveResponse = await fetch('/api/custom-field-values', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fieldId,
                entityType: 'department',
                recordId: createdDepartmentId,
                value,
              }),
            })

            if (!saveResponse.ok) {
              const body = await saveResponse.json().catch(() => null)
              throw new Error(body?.error ?? 'Failed to save custom field values')
            }
          })

        await Promise.all(valueRequests)
      }

      if (redirectBasePath && createdDepartmentId) {
        router.push(`${redirectBasePath}/${createdDepartmentId}`)
        router.refresh()
        return
      }
      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id={formId} className="space-y-5" onSubmit={submitForm}>
      {groupedVisibleFields.map(({ section, fields }) => (
        <section key={section} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">{section}</h3>
          </div>
          <div className="grid gap-4" style={getSectionGridStyle()}>
            {fields.map((field) => (
              <div key={field.id} style={getFieldPlacementStyle(field.id)}>
                {renderField(field.id)}
              </div>
            ))}
          </div>
        </section>
      ))}

      {(customFields?.length ?? 0) > 0 ? (
        <section className="space-y-4 rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
          <div>
            <h3 className="text-sm font-semibold text-white">Custom Fields</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Department-specific fields configured in the customization window.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(customFields ?? []).map((field) => {
              const value = customFieldValues[field.id] ?? ''
              const options = parseCustomFieldOptions(field.options)

              if (field.type === 'textarea') {
                return (
                  <label key={field.id} className="space-y-1 text-sm md:col-span-2" style={{ color: 'var(--text-secondary)' }}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    <textarea
                      value={value}
                      onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      rows={3}
                      required={field.required}
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </label>
                )
              }

              if (field.type === 'select') {
                return (
                  <label key={field.id} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    <select
                      value={value}
                      onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      required={field.required}
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value="">Select {field.label}</option>
                      {options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                )
              }

              if (field.type === 'checkbox') {
                return (
                  <label key={field.id} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-muted)' }}>
                    <input
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.checked ? 'true' : 'false' }))}
                    />
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                  </label>
                )
              }

              return (
                <label key={field.id} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={value}
                    onChange={(event) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: event.target.value }))}
                    required={field.required}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </label>
              )
            })}
          </div>
        </section>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {showFooterActions ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Department'}</button>
        </div>
      ) : null}
    </form>
  )
}
