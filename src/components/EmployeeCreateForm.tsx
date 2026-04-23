'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultEmployeeFormCustomization,
  EMPLOYEE_FORM_FIELDS,
  type EmployeeFormCustomizationConfig,
  type EmployeeFormFieldKey,
} from '@/lib/employee-form-customization'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'

type EmployeeFormCustomizationResponse = {
  config?: EmployeeFormCustomizationConfig
}

export type EmployeeCreateInitialValues = {
  employeeId?: string | null
  eid?: string | null
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  title?: string | null
  laborType?: string | null
  departmentId?: string | null
  subsidiaryIds?: string[]
  includeChildren?: boolean
  entityId?: string | null
  managerId?: string | null
  hireDate?: string
  terminationDate?: string
  inactive?: boolean
}

export default function EmployeeCreateForm({
  entities,
  departments,
  managers,
  users,
  inactiveOptions,
  laborTypeOptions,
  formId,
  showFooterActions = true,
  redirectBasePath,
  initialValues,
  sectionDescriptions,
  onSuccess,
  onCancel,
}: {
  entities: Array<{ id: string; subsidiaryId: string; name: string }>
  departments: Array<{ id: string; departmentId: string; name: string }>
  managers?: Array<{ id: string; firstName: string; lastName: string; employeeId?: string | null }>
  users?: Array<{ id: string; name?: string | null; email: string; userId?: string | null }>
  inactiveOptions: SelectOption[]
  laborTypeOptions: SelectOption[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  initialValues?: EmployeeCreateInitialValues
  sectionDescriptions?: Record<string, string>
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState(initialValues?.employeeId ?? '')
  const [eid, setEid] = useState(initialValues?.eid ?? '')
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '')
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [phone, setPhone] = useState(initialValues?.phone ?? '')
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [laborType, setLaborType] = useState(initialValues?.laborType ?? '')
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? '')
  const [subsidiaryIds, setSubsidiaryIds] = useState<string[]>(initialValues?.subsidiaryIds ?? (initialValues?.entityId ? [initialValues.entityId] : []))
  const [includeChildren, setIncludeChildren] = useState(initialValues?.includeChildren ?? false)
  const [managerId, setManagerId] = useState(initialValues?.managerId ?? '')
  const [userId, setUserId] = useState('')
  const [hireDate, setHireDate] = useState(initialValues?.hireDate ?? '')
  const [terminationDate, setTerminationDate] = useState(initialValues?.terminationDate ?? '')
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<EmployeeFormCustomizationConfig>(() => defaultEmployeeFormCustomization())

  useEffect(() => {
    let mounted = true
    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/employee-form-customization', { cache: 'no-store' }),
        ])
        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as EmployeeFormCustomizationResponse
        if (!mounted) return
        if (requirementsResponse.ok) setRuntimeRequirements(requirementsBody?.config?.employeeCreate ?? null)
        if (layoutResponse.ok && layoutBody.config) setLayoutConfig(layoutBody.config)
      } catch {
        // Keep defaults.
      }
    }
    loadConfig()
    return () => { mounted = false }
  }, [])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('employeeCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return <>{text} <span style={{ color: 'var(--danger)' }}>*</span></>
  }

  const groupedVisibleFields = useMemo(() => {
    return layoutConfig.sections
      .map((section) => ({
        section,
        fields: EMPLOYEE_FORM_FIELDS
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

  function getFieldPlacementStyle(fieldId: EmployeeFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: EmployeeFormFieldKey) {
    switch (fieldId) {
      case 'employeeId':
        return <FieldInput fieldId="employeeId" label={requiredLabel('Employee ID', req('employeeId'))} helpText="Unique employee number or code."><input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required={req('employeeId')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'eid':
        return <FieldInput fieldId="eid" label={requiredLabel('EID', req('eid'))} helpText="External or enterprise employee identifier."><input value={eid} onChange={(e) => setEid(e.target.value)} required={req('eid')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'firstName':
        return <FieldInput fieldId="firstName" label={requiredLabel('First Name', req('firstName'))} helpText="Given name of the employee."><input value={firstName} onChange={(e) => setFirstName(e.target.value)} required={req('firstName')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'lastName':
        return <FieldInput fieldId="lastName" label={requiredLabel('Last Name', req('lastName'))} helpText="Family name of the employee."><input value={lastName} onChange={(e) => setLastName(e.target.value)} required={req('lastName')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'email':
        return <FieldInput fieldId="email" label={requiredLabel('Email', req('email'))} helpText="Primary work email address."><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={req('email')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'phone':
        return <FieldInput fieldId="phone" label={requiredLabel('Phone', req('phone'))} helpText="Primary work phone number."><input value={phone} onChange={(e) => setPhone(e.target.value)} required={req('phone')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'title':
        return <FieldInput fieldId="title" label={requiredLabel('Title', req('title'))} helpText="Job title or role label."><input value={title} onChange={(e) => setTitle(e.target.value)} required={req('title')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'laborType':
        return <FieldInput fieldId="laborType" label={requiredLabel('Labor Type', req('laborType'))} helpText="Labor classification used for staffing, costing, or billing." sourceText="Manage Lists -> Labor Type"><select value={laborType} onChange={(e) => setLaborType(e.target.value)} required={req('laborType')} className={inputClass} style={inputStyle}><option value="">None</option>{laborTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldInput>
      case 'departmentId':
        return <FieldInput fieldId="departmentId" label={requiredLabel('Department', req('departmentId'))} helpText="Department the employee belongs to." sourceText="Departments"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required={req('departmentId')} className={inputClass} style={inputStyle}><option value="">None</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.departmentId} - {department.name}</option>)}</select></FieldInput>
      case 'subsidiaryIds':
        return (
          <div>
            <span className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              <span>{requiredLabel('Subsidiaries', req('subsidiaryIds'))}</span>
              <FieldTooltip content={buildTooltipContent('Subsidiaries where the employee is available.', 'subsidiaryIds', 'Subsidiaries')} />
            </span>
            <MultiSelectDropdown
              value={subsidiaryIds}
              options={entities.map((entity) => ({ value: entity.id, label: `${entity.subsidiaryId} - ${entity.name}` }))}
              onChange={setSubsidiaryIds}
              placeholder="Select subsidiaries"
            />
          </div>
        )
      case 'includeChildren':
        return (
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={includeChildren} onChange={(e) => setIncludeChildren(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="flex items-center gap-1">
              <span>{requiredLabel('Include Children', req('includeChildren'))}</span>
              <FieldTooltip content={buildTooltipContent('If enabled, child subsidiaries under selected subsidiaries also inherit employee availability.', 'includeChildren')} />
            </span>
          </label>
        )
      case 'managerId':
        return <FieldInput fieldId="managerId" label={requiredLabel('Manager', req('managerId'))} helpText="Direct manager of the employee." sourceText="Employees"><select value={managerId} onChange={(e) => setManagerId(e.target.value)} required={req('managerId')} className={inputClass} style={inputStyle}><option value="">None</option>{(managers ?? []).map((manager) => <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName}{manager.employeeId ? ` (${manager.employeeId})` : ''}</option>)}</select></FieldInput>
      case 'userId':
        return <FieldInput fieldId="userId" label={requiredLabel('Linked User', req('userId'))} helpText="User account linked to this employee." sourceText="Users"><select value={userId} onChange={(e) => setUserId(e.target.value)} required={req('userId')} className={inputClass} style={inputStyle}><option value="">None</option>{(users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name ?? user.email}{user.userId ? ` (${user.userId})` : ''}</option>)}</select></FieldInput>
      case 'hireDate':
        return <FieldInput fieldId="hireDate" label={requiredLabel('Hire Date', req('hireDate'))} helpText="Date the employee joined the company."><input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} required={req('hireDate')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'terminationDate':
        return <FieldInput fieldId="terminationDate" label={requiredLabel('Termination Date', req('terminationDate'))} helpText="Date the employee left the company, if applicable."><input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} required={req('terminationDate')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'inactive':
        return <FieldInput fieldId="inactive" label={requiredLabel('Inactive', req('inactive'))} helpText="Marks the employee unavailable for new activity while preserving history." sourceText="Active/Inactive"><select value={inactive ? 'true' : 'false'} onChange={(e) => setInactive(e.target.value === 'true')} className={inputClass} style={inputStyle}>{inactiveOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldInput>
      default:
        return null
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    if (email.trim() && !isValidEmail(email)) {
      setError('Please enter a valid email address')
      setSaving(false)
      return
    }

    try {
      const missing: string[] = []
      const requiredFields = [
        ['employeeId', employeeId],
        ['eid', eid],
        ['firstName', firstName],
        ['lastName', lastName],
        ['email', email],
        ['phone', phone],
        ['title', title],
        ['laborType', laborType],
        ['departmentId', departmentId],
        ['subsidiaryIds', subsidiaryIds.join(',')],
        ['includeChildren', includeChildren ? 'true' : 'false'],
        ['managerId', managerId],
        ['userId', userId],
        ['hireDate', hireDate],
        ['terminationDate', terminationDate],
      ] as const

      for (const [fieldName, fieldValue] of requiredFields) {
        if (req(fieldName) && !String(fieldValue ?? '').trim()) {
          missing.push(fieldName)
        }
      }
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`)

      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, eid, firstName, lastName, email, phone, title, laborType, departmentId, subsidiaryIds, includeChildren, managerId, userId, hireDate, terminationDate, inactive }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? 'Create failed')
      const createdId = String(json?.id ?? '')
      if (redirectBasePath && createdId) {
        router.push(`${redirectBasePath}/${createdId}`)
        router.refresh()
        return
      }
      onSuccess?.()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Employee details</h2>
      </div>
      <form id={formId} onSubmit={submitForm}>
        <div className="space-y-6">
          {error ? <div className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</div> : null}
          {groupedVisibleFields.map(({ section, fields }, index) => (
            <section key={section} className={index > 0 ? 'border-t pt-6' : ''} style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">{section}</h3>
                {sectionDescriptions?.[section] ? <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{sectionDescriptions[section]}</p> : null}
              </div>
              <div className="grid gap-3" style={getSectionGridStyle()}>
                {fields.map((field) => <div key={field.id} style={getFieldPlacementStyle(field.id)}>{renderField(field.id)}</div>)}
              </div>
            </section>
          ))}
        </div>
        {showFooterActions ? (
          <div className="mt-6 flex justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--border-muted)' }}>
            <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Creating...' : 'Create Employee'}</button>
          </div>
        ) : null}
      </form>
    </div>
  )
}

function FieldInput({
  label,
  children,
  helpText,
  fieldId,
  sourceText,
}: {
  label: React.ReactNode
  children: React.ReactNode
  helpText?: string
  fieldId?: string
  sourceText?: string
}) {
  return (
    <label>
      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        <span>{label}</span>
        {helpText && fieldId ? <FieldTooltip content={buildTooltipContent(helpText, fieldId, sourceText)} /> : null}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function buildTooltipContent(helpText: string, fieldId: string, sourceText?: string) {
  const sourceLine = sourceText ? `\nField Source: ${sourceText}` : ''
  return `${helpText}\n\nField ID: ${fieldId}\nField Type: ${sourceText ? 'list' : 'text'}${sourceLine}`
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

const inputClass = 'block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50'
const inputStyle = { borderColor: 'var(--border-muted)' } as const
