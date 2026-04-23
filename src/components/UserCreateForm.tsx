'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { isValidEmail } from '@/lib/validation'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultUserFormCustomization,
  USER_FORM_FIELDS,
  type UserFormCustomizationConfig,
  type UserFormFieldKey,
} from '@/lib/user-form-customization'

type UserFormCustomizationResponse = {
  config?: UserFormCustomizationConfig
}

export type UserCreateInitialValues = {
  name?: string | null
  email?: string | null
  password?: string | null
  roleId?: string | null
  departmentId?: string | null
  employeeId?: string | null
  defaultSubsidiaryId?: string | null
  subsidiaryIds?: string[]
  includeChildren?: boolean
  approvalLimit?: string | number | null
  approvalCurrencyId?: string | null
  delegatedApproverUserId?: string | null
  delegationStartDate?: string | null
  delegationEndDate?: string | null
  locked?: boolean
  mustChangePassword?: boolean
  failedLoginAttempts?: string | number | null
  lastLoginAt?: string | null
  passwordChangedAt?: string | null
  inactive?: boolean
}

export default function UserCreateForm({
  roles,
  departments,
  employees,
  subsidiaries,
  currencies,
  approverUsers,
  inactiveOptions,
  formId,
  showFooterActions = true,
  redirectBasePath,
  initialLayoutConfig,
  initialRequirements,
  sectionDescriptions,
  initialValues,
  onSuccess,
  onCancel,
}: {
  roles: Array<{ id: string; name: string }>
  departments: Array<{ id: string; departmentId: string; name: string }>
  employees: Array<{ id: string; firstName: string; lastName: string; employeeId?: string | null }>
  subsidiaries: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; code: string; name: string }>
  approverUsers: Array<{ id: string; userId?: string | null; name?: string | null; email: string }>
  inactiveOptions: SelectOption[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  initialLayoutConfig?: UserFormCustomizationConfig
  initialRequirements?: Record<string, boolean>
  sectionDescriptions?: Record<string, string>
  initialValues?: UserCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [password, setPassword] = useState(initialValues?.password ?? '')
  const [roleId, setRoleId] = useState(initialValues?.roleId ?? '')
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? '')
  const [employeeId, setEmployeeId] = useState(initialValues?.employeeId ?? '')
  const [defaultSubsidiaryId, setDefaultSubsidiaryId] = useState(initialValues?.defaultSubsidiaryId ?? '')
  const [subsidiaryIds, setSubsidiaryIds] = useState<string[]>(initialValues?.subsidiaryIds ?? [])
  const [includeChildren, setIncludeChildren] = useState(initialValues?.includeChildren ?? false)
  const [approvalLimit, setApprovalLimit] = useState(String(initialValues?.approvalLimit ?? ''))
  const [approvalCurrencyId, setApprovalCurrencyId] = useState(initialValues?.approvalCurrencyId ?? '')
  const [delegatedApproverUserId, setDelegatedApproverUserId] = useState(initialValues?.delegatedApproverUserId ?? '')
  const [delegationStartDate, setDelegationStartDate] = useState(initialValues?.delegationStartDate ?? '')
  const [delegationEndDate, setDelegationEndDate] = useState(initialValues?.delegationEndDate ?? '')
  const [locked, setLocked] = useState(initialValues?.locked ?? false)
  const [mustChangePassword, setMustChangePassword] = useState(initialValues?.mustChangePassword ?? false)
  const [failedLoginAttempts, setFailedLoginAttempts] = useState(String(initialValues?.failedLoginAttempts ?? '0'))
  const [lastLoginAt, setLastLoginAt] = useState(initialValues?.lastLoginAt ?? '')
  const [passwordChangedAt, setPasswordChangedAt] = useState(initialValues?.passwordChangedAt ?? '')
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(initialRequirements ?? null)
  const [layoutConfig, setLayoutConfig] = useState<UserFormCustomizationConfig>(() => initialLayoutConfig ?? defaultUserFormCustomization())

  useEffect(() => {
    if (initialLayoutConfig && initialRequirements) return
    let mounted = true
    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/user-form-customization', { cache: 'no-store' }),
        ])
        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as UserFormCustomizationResponse
        if (!mounted) return
        if (requirementsResponse.ok) setRuntimeRequirements(requirementsBody?.config?.userCreate ?? null)
        if (layoutResponse.ok && layoutBody.config) setLayoutConfig(layoutBody.config)
      } catch {
        // Keep defaults when config APIs are unavailable.
      }
    }
    loadConfig()
    return () => { mounted = false }
  }, [initialLayoutConfig, initialRequirements])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('userCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return <>{text} <span style={{ color: 'var(--danger)' }}>*</span></>
  }

  const groupedVisibleFields = useMemo(() => {
    return layoutConfig.sections
      .map((section) => ({
        section,
        fields: USER_FORM_FIELDS
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

  function getFieldPlacementStyle(fieldId: UserFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: UserFormFieldKey) {
    switch (fieldId) {
      case 'userId':
        return <FieldInput label={requiredLabel('User ID', req('userId'))} helpText="System-generated user identifier." fieldId="userId"><input value="Generated automatically" readOnly disabled className={inputClass} style={inputStyle} /></FieldInput>
      case 'name':
        return <FieldInput label={requiredLabel('Name', req('name'))} helpText="Display name for the user account." fieldId="name"><input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'email':
        return <FieldInput label={requiredLabel('Email', req('email'))} helpText="Login email address for the user." fieldId="email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={req('email')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'roleId':
        return <FieldInput label={requiredLabel('Role', req('roleId'))} helpText="Primary system role assigned to the user." fieldId="roleId" sourceText="Roles"><select value={roleId} onChange={(e) => setRoleId(e.target.value)} required={req('roleId')} className={inputClass} style={inputStyle}><option value="">None</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></FieldInput>
      case 'departmentId':
        return <FieldInput label={requiredLabel('Department', req('departmentId'))} helpText="Department context used for workflow and reporting." fieldId="departmentId" sourceText="Departments"><select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required={req('departmentId')} className={inputClass} style={inputStyle}><option value="">None</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.departmentId} - {department.name}</option>)}</select></FieldInput>
      case 'defaultSubsidiaryId':
        return <FieldInput label={requiredLabel('Default Subsidiary', req('defaultSubsidiaryId'))} helpText="Default subsidiary context for new user activity." fieldId="defaultSubsidiaryId" sourceText="Subsidiaries"><select value={defaultSubsidiaryId} onChange={(e) => setDefaultSubsidiaryId(e.target.value)} required={req('defaultSubsidiaryId')} className={inputClass} style={inputStyle}><option value="">None</option>{subsidiaries.map((subsidiary) => <option key={subsidiary.id} value={subsidiary.id}>{subsidiary.subsidiaryId} - {subsidiary.name}</option>)}</select></FieldInput>
      case 'subsidiaryIds':
        return <FieldInput label={requiredLabel('Subsidiaries', req('subsidiaryIds'))} helpText="Subsidiaries this user can access." fieldId="subsidiaryIds" sourceText="Subsidiaries"><MultiSelectDropdown value={subsidiaryIds} options={subsidiaries.map((subsidiary) => ({ value: subsidiary.id, label: `${subsidiary.subsidiaryId} - ${subsidiary.name}` }))} onChange={setSubsidiaryIds} placeholder="Select subsidiaries" /></FieldInput>
      case 'includeChildren':
        return <CheckboxInput label={requiredLabel('Include Children', req('includeChildren'))} checked={includeChildren} onChange={setIncludeChildren} helpText="If enabled, child subsidiaries under selected subsidiaries are included in access scope." fieldId="includeChildren" />
      case 'approvalLimit':
        return <FieldInput label={requiredLabel('Approval Limit', req('approvalLimit'))} helpText="Maximum approval amount for routed workflows." fieldId="approvalLimit"><input type="number" min={0} step="0.01" value={approvalLimit} onChange={(e) => setApprovalLimit(e.target.value)} required={req('approvalLimit')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'approvalCurrencyId':
        return <FieldInput label={requiredLabel('Approval Currency', req('approvalCurrencyId'))} helpText="Currency used for the approval limit." fieldId="approvalCurrencyId" sourceText="Currencies"><select value={approvalCurrencyId} onChange={(e) => setApprovalCurrencyId(e.target.value)} required={req('approvalCurrencyId')} className={inputClass} style={inputStyle}><option value="">None</option>{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code} - {currency.name}</option>)}</select></FieldInput>
      case 'delegatedApproverUserId':
        return <FieldInput label={requiredLabel('Delegated Approver', req('delegatedApproverUserId'))} helpText="User who can approve on this user's behalf during delegation." fieldId="delegatedApproverUserId" sourceText="Users"><select value={delegatedApproverUserId} onChange={(e) => setDelegatedApproverUserId(e.target.value)} required={req('delegatedApproverUserId')} className={inputClass} style={inputStyle}><option value="">None</option>{approverUsers.map((user) => <option key={user.id} value={user.id}>{user.userId ? `${user.userId} - ` : ''}{user.name ?? user.email}</option>)}</select></FieldInput>
      case 'delegationStartDate':
        return <FieldInput label={requiredLabel('Delegation Start Date', req('delegationStartDate'))} helpText="Date delegation starts." fieldId="delegationStartDate"><input type="date" value={delegationStartDate} onChange={(e) => setDelegationStartDate(e.target.value)} required={req('delegationStartDate')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'delegationEndDate':
        return <FieldInput label={requiredLabel('Delegation End Date', req('delegationEndDate'))} helpText="Date delegation ends." fieldId="delegationEndDate"><input type="date" value={delegationEndDate} onChange={(e) => setDelegationEndDate(e.target.value)} required={req('delegationEndDate')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'employeeId':
        return <FieldInput label={requiredLabel('Linked Employee', req('employeeId'))} helpText="Employee record linked to this user account." fieldId="employeeId" sourceText="Employees"><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required={req('employeeId')} className={inputClass} style={inputStyle}><option value="">None</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}{employee.employeeId ? ` (${employee.employeeId})` : ''}</option>)}</select></FieldInput>
      case 'locked':
        return <CheckboxInput label={requiredLabel('Locked', req('locked'))} checked={locked} onChange={setLocked} helpText="Prevents account access until unlocked." fieldId="locked" />
      case 'mustChangePassword':
        return <CheckboxInput label={requiredLabel('Must Change Password', req('mustChangePassword'))} checked={mustChangePassword} onChange={setMustChangePassword} helpText="Requires password change at next login." fieldId="mustChangePassword" />
      case 'failedLoginAttempts':
        return <FieldInput label={requiredLabel('Failed Login Attempts', req('failedLoginAttempts'))} helpText="Count of failed login attempts." fieldId="failedLoginAttempts"><input type="number" min={0} value={failedLoginAttempts} onChange={(e) => setFailedLoginAttempts(e.target.value)} required={req('failedLoginAttempts')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'lastLoginAt':
        return <FieldInput label={requiredLabel('Last Login', req('lastLoginAt'))} helpText="Most recent successful login date." fieldId="lastLoginAt"><input type="date" value={lastLoginAt} onChange={(e) => setLastLoginAt(e.target.value)} required={req('lastLoginAt')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'passwordChangedAt':
        return <FieldInput label={requiredLabel('Password Changed', req('passwordChangedAt'))} helpText="Most recent password change date." fieldId="passwordChangedAt"><input type="date" value={passwordChangedAt} onChange={(e) => setPasswordChangedAt(e.target.value)} required={req('passwordChangedAt')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'inactive':
        return <FieldInput label={requiredLabel('Inactive', req('inactive'))} helpText="Disables the user account while preserving history." fieldId="inactive" sourceText="Active/Inactive"><select value={inactive ? 'true' : 'false'} onChange={(e) => setInactive(e.target.value === 'true')} className={inputClass} style={inputStyle}>{inactiveOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldInput>
      default:
        return null
    }
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
        ['name', name],
        ['email', email],
        ['password', password],
        ['roleId', roleId],
        ['departmentId', departmentId],
        ['defaultSubsidiaryId', defaultSubsidiaryId],
        ['subsidiaryIds', subsidiaryIds.join(',')],
        ['approvalLimit', approvalLimit],
        ['approvalCurrencyId', approvalCurrencyId],
        ['delegatedApproverUserId', delegatedApproverUserId],
        ['delegationStartDate', delegationStartDate],
        ['delegationEndDate', delegationEndDate],
        ['employeeId', employeeId],
      ] as const
      for (const [fieldName, fieldValue] of requiredFields) {
        if (req(fieldName) && !String(fieldValue ?? '').trim()) missing.push(fieldName)
      }
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`)

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          roleId: roleId || null,
          departmentId: departmentId || null,
          employeeId: employeeId || null,
          defaultSubsidiaryId: defaultSubsidiaryId || null,
          subsidiaryIds,
          includeChildren,
          approvalLimit,
          approvalCurrencyId: approvalCurrencyId || null,
          delegatedApproverUserId: delegatedApproverUserId || null,
          delegationStartDate,
          delegationEndDate,
          locked,
          mustChangePassword,
          failedLoginAttempts,
          lastLoginAt,
          passwordChangedAt,
          inactive,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Create failed')
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
    } finally { setSaving(false) }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>User details</h2>
      </div>

      <form id={formId} onSubmit={submitForm}>
        <div className="space-y-6">
          {error ? <div className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</div> : null}
          {groupedVisibleFields.map(({ section, fields }, index) => (
            <section
              key={section}
              className={index > 0 ? 'border-t pt-6' : ''}
              style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
            >
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">{section}</h3>
                {sectionDescriptions?.[section] ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{sectionDescriptions[section]}</p>
                ) : null}
              </div>
              <div className="grid gap-3" style={getSectionGridStyle()}>
                {fields.map((field) => <div key={field.id} style={getFieldPlacementStyle(field.id)}>{renderField(field.id)}</div>)}
              </div>
            </section>
          ))}
          <section className="border-t pt-6" style={{ borderColor: 'var(--border-muted)' }}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">Security</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Credentials required to create the user account.</p>
            </div>
            <div className="grid gap-3" style={getSectionGridStyle()}>
              <FieldInput label={requiredLabel('Password', req('password'))} helpText="Initial password for this user account." fieldId="password">
                <input required={req('password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} style={inputStyle} />
              </FieldInput>
            </div>
          </section>
        </div>
        {showFooterActions ? (
          <div className="mt-6 flex justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--border-muted)' }}>
            <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Creating...' : 'Create User'}</button>
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

function CheckboxInput({
  label,
  checked,
  onChange,
  helpText,
  fieldId,
}: {
  label: React.ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  helpText: string
  fieldId: string
}) {
  return (
    <label>
      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        <span>{label}</span>
        <FieldTooltip content={buildTooltipContent(helpText, fieldId)} />
      </span>
      <span className="mt-2 flex items-center gap-2 text-sm text-white">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded" />
        Yes
      </span>
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
