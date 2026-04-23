'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultRoleFormCustomization,
  ROLE_FORM_FIELDS,
  type RoleFormCustomizationConfig,
  type RoleFormFieldKey,
} from '@/lib/role-form-customization'

type RoleFormCustomizationResponse = {
  config?: RoleFormCustomizationConfig
}

export type RoleCreateInitialValues = {
  name?: string
  description?: string | null
}

export default function RoleCreateForm({
  formId,
  showFooterActions = true,
  redirectBasePath,
  inactiveOptions = [{ value: 'false', label: 'No' }],
  initialLayoutConfig,
  initialRequirements,
  sectionDescriptions,
  initialValues,
  onSuccess,
  onCancel,
}: {
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  inactiveOptions?: SelectOption[]
  initialLayoutConfig?: RoleFormCustomizationConfig
  initialRequirements?: Record<string, boolean>
  sectionDescriptions?: Record<string, string>
  initialValues?: RoleCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(initialRequirements ?? null)
  const [layoutConfig, setLayoutConfig] = useState<RoleFormCustomizationConfig>(() => initialLayoutConfig ?? defaultRoleFormCustomization())

  useEffect(() => {
    if (initialLayoutConfig && initialRequirements) return
    let mounted = true
    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/role-form-customization', { cache: 'no-store' }),
        ])
        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as RoleFormCustomizationResponse
        if (!mounted) return
        if (requirementsResponse.ok) setRuntimeRequirements(requirementsBody?.config?.roleCreate ?? null)
        if (layoutResponse.ok && layoutBody.config) setLayoutConfig(layoutBody.config)
      } catch {
        // Keep defaults when config APIs are unavailable.
      }
    }
    loadConfig()
    return () => {
      mounted = false
    }
  }, [initialLayoutConfig, initialRequirements])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('roleCreate', field)
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
        fields: ROLE_FORM_FIELDS
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

  function getFieldPlacementStyle(fieldId: RoleFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: RoleFormFieldKey) {
    switch (fieldId) {
      case 'roleId':
        return (
          <FieldInput label={requiredLabel('Role ID', req('roleId'))} helpText="System-generated role identifier." fieldId="roleId">
            <input value="Generated automatically" readOnly disabled className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'name':
        return (
          <FieldInput label={requiredLabel('Name', req('name'))} helpText="Role name shown to admins and users." fieldId="name">
            <input required={req('name')} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'description':
        return (
          <FieldInput label={requiredLabel('Description', req('description'))} helpText="Short explanation of the role purpose." fieldId="description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'inactive':
        return (
          <FieldInput label={requiredLabel('Inactive', req('inactive'))} helpText="Marks the role unavailable for new assignments while preserving history." fieldId="inactive" sourceText="Active/Inactive">
            <select value="false" disabled className={inputClass} style={inputStyle}>
              {inactiveOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FieldInput>
        )
      default:
        return null
    }
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, inactive: false }),
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Role details</h2>
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
        </div>
        {showFooterActions ? (
          <div className="mt-6 flex justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--border-muted)' }}>
            <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Creating...' : 'Create Role'}</button>
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
