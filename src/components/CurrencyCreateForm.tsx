'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import {
  defaultCurrencyFormCustomization,
  CURRENCY_FORM_FIELDS,
  type CurrencyFormCustomizationConfig,
  type CurrencyFormFieldKey,
} from '@/lib/currency-form-customization'

type CurrencyFormCustomizationResponse = {
  config?: CurrencyFormCustomizationConfig
}

type SelectOption = {
  value: string
  label: string
}

export type CurrencyCreateInitialValues = {
  currencyId?: string
  code?: string
  name?: string
  symbol?: string | null
  decimals?: string
  isBase?: boolean
  inactive?: boolean
}

export default function CurrencyCreateForm({
  baseOptions,
  inactiveOptions,
  formId,
  showFooterActions = true,
  redirectBasePath,
  initialCurrencyId,
  initialValues,
  onSuccess,
  onCancel,
}: {
  baseOptions: SelectOption[]
  inactiveOptions: SelectOption[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  initialCurrencyId?: string
  initialValues?: CurrencyCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [currencyId] = useState(initialValues?.currencyId ?? initialCurrencyId ?? '')
  const [code, setCode] = useState(initialValues?.code ?? '')
  const [name, setName] = useState(initialValues?.name ?? '')
  const [symbol, setSymbol] = useState(initialValues?.symbol ?? '')
  const [decimals, setDecimals] = useState(initialValues?.decimals ?? '2')
  const [isBase, setIsBase] = useState(initialValues?.isBase ?? false)
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<CurrencyFormCustomizationConfig>(() => defaultCurrencyFormCustomization())

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/currency-form-customization', { cache: 'no-store' }),
        ])

        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as CurrencyFormCustomizationResponse

        if (!mounted) return

        if (requirementsResponse.ok) {
          setRuntimeRequirements(requirementsBody?.config?.currencyCreate ?? null)
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
    return isFieldRequired('currencyCreate', field)
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
        fields: CURRENCY_FORM_FIELDS
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
    Core: 'Primary identity and presentation fields for the currency.',
    Settings: 'Rounding, status, and base-currency behavior.',
  }

  function getSectionGridStyle(): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))` }
  }

  function getFieldPlacementStyle(fieldId: CurrencyFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: CurrencyFormFieldKey) {
    switch (fieldId) {
      case 'currencyId':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Currency Id', req('currencyId'))}</span>
            <input value={currencyId || 'Generated automatically'} readOnly disabled className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white opacity-80" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'code':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Code', req('code'))}</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required={req('code')} maxLength={12} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'name':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Name', req('name'))}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'symbol':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Symbol', req('symbol'))}</span>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required={req('symbol')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'decimals':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Decimal Places', req('decimals'))}</span>
            <input type="number" min={0} value={decimals} onChange={(e) => setDecimals(e.target.value)} required={req('decimals')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'isBase':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Base Currency', req('isBase'))}</span>
            <select value={isBase ? 'true' : 'false'} onChange={(e) => setIsBase(e.target.value === 'true')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {baseOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'inactive':
        return (
          <label key={fieldId} className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{requiredLabel('Inactive', req('inactive'))}</span>
            <select value={inactive ? 'true' : 'false'} onChange={(e) => setInactive(e.target.value === 'true')} className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {inactiveOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
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
        ['currencyId', currencyId],
        ['code', code],
        ['name', name],
        ['symbol', symbol],
        ['decimals', decimals],
      ] as const

      for (const [fieldName, fieldValue] of requiredFields) {
        if (req(fieldName) && !String(fieldValue ?? '').trim()) {
          missing.push(fieldName)
        }
      }

      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`)
      }

      const response = await fetch('/api/currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyId,
          code,
          name,
          symbol,
          decimals: Number(decimals),
          isBase,
          inactive,
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
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Currency details</h2>
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
