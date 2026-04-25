'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import {
  defaultAccountingPeriodFormCustomization,
  ACCOUNTING_PERIOD_FORM_FIELDS,
  type AccountingPeriodFormCustomizationConfig,
  type AccountingPeriodFormFieldKey,
} from '@/lib/accounting-period-form-customization'

type AccountingPeriodFormCustomizationResponse = {
  config?: AccountingPeriodFormCustomizationConfig
}

type SelectOption = {
  value: string
  label: string
}

export type AccountingPeriodCreateInitialValues = {
  name?: string
  startDate?: string
  endDate?: string
  subsidiaryId?: string | null
  status?: string
  closed?: boolean
  arLocked?: boolean
  apLocked?: boolean
  inventoryLocked?: boolean
}

export default function AccountingPeriodCreateForm({
  subsidiaryOptions,
  statusOptions,
  formId,
  showFooterActions = true,
  redirectBasePath,
  initialValues,
  onSuccess,
  onCancel,
}: {
  subsidiaryOptions: SelectOption[]
  statusOptions: SelectOption[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  initialValues?: AccountingPeriodCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? '')
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? '')
  const [subsidiaryId, setSubsidiaryId] = useState(initialValues?.subsidiaryId ?? '')
  const [status, setStatus] = useState(initialValues?.status ?? statusOptions[0]?.value ?? 'open')
  const [closed, setClosed] = useState(initialValues?.closed ?? false)
  const [arLocked, setArLocked] = useState(initialValues?.arLocked ?? false)
  const [apLocked, setApLocked] = useState(initialValues?.apLocked ?? false)
  const [inventoryLocked, setInventoryLocked] = useState(initialValues?.inventoryLocked ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<AccountingPeriodFormCustomizationConfig>(() => defaultAccountingPeriodFormCustomization())

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/accounting-period-form-customization', { cache: 'no-store' }),
        ])

        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as AccountingPeriodFormCustomizationResponse

        if (!mounted) return

        if (requirementsResponse.ok) {
          setRuntimeRequirements(requirementsBody?.config?.accountingPeriodCreate ?? null)
        }

        if (layoutResponse.ok && layoutBody.config) {
          setLayoutConfig(layoutBody.config)
        }
      } catch {
        // Keep static defaults when config APIs are unavailable.
      }
    }

    loadConfig()
    return () => {
      mounted = false
    }
  }, [])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('accountingPeriodCreate', field)
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
        fields: ACCOUNTING_PERIOD_FORM_FIELDS
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
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary period identity, dates, and scope.',
    Controls: 'Period-close and subledger control settings.',
  }

  function getSectionGridStyle(): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))` }
  }

  function getFieldPlacementStyle(fieldId: AccountingPeriodFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: AccountingPeriodFormFieldKey) {
    switch (fieldId) {
      case 'name':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Name', req('name'))}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'startDate':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Start Date', req('startDate'))}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required={req('startDate')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'endDate':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('End Date', req('endDate'))}</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required={req('endDate')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'subsidiaryId':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Subsidiary', req('subsidiaryId'))}</span>
            <select value={subsidiaryId} onChange={(e) => setSubsidiaryId(e.target.value)} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {subsidiaryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'status':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Status', req('status'))}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'closed':
        return (
          <label key={fieldId} className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} className="h-4 w-4 rounded" />
            {requiredLabel('Closed', req('closed'))}
          </label>
        )
      case 'arLocked':
        return (
          <label key={fieldId} className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={arLocked} onChange={(e) => setArLocked(e.target.checked)} className="h-4 w-4 rounded" />
            {requiredLabel('AR Locked', req('arLocked'))}
          </label>
        )
      case 'apLocked':
        return (
          <label key={fieldId} className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={apLocked} onChange={(e) => setApLocked(e.target.checked)} className="h-4 w-4 rounded" />
            {requiredLabel('AP Locked', req('apLocked'))}
          </label>
        )
      case 'inventoryLocked':
        return (
          <label key={fieldId} className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={inventoryLocked} onChange={(e) => setInventoryLocked(e.target.checked)} className="h-4 w-4 rounded" />
            {requiredLabel('Inventory Locked', req('inventoryLocked'))}
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
        ['name', name],
        ['startDate', startDate],
        ['endDate', endDate],
      ] as const

      for (const [fieldName, fieldValue] of requiredFields) {
        if (req(fieldName) && !String(fieldValue ?? '').trim()) {
          missing.push(fieldName)
        }
      }

      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`)
      }

      const response = await fetch('/api/accounting-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          subsidiaryId: subsidiaryId || null,
          status,
          closed,
          arLocked,
          apLocked,
          inventoryLocked,
        }),
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
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Accounting period details</h2>
      </div>

      <form id={formId} onSubmit={submitForm}>
        <div className="space-y-6">
          {groupedVisibleFields.map(({ section, fields }, index) => (
            <section
              key={section}
              className={index > 0 ? 'border-t pt-6' : ''}
              style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
            >
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">{section}</h3>
                {sectionDescriptions[section] ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{sectionDescriptions[section]}</p>
                ) : null}
              </div>
              <div className="grid gap-3" style={getSectionGridStyle()}>
                {fields.map((field) => (
                  <div key={field.id} style={getFieldPlacementStyle(field.id)}>
                    {renderField(field.id)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {error ? <p className="mt-4 text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        {showFooterActions ? (
          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
