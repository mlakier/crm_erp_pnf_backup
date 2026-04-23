'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import { DEFAULT_COUNTRY_CODE } from '@/lib/address-country-config'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultSubsidiaryFormCustomization,
  SUBSIDIARY_FORM_FIELDS,
  type SubsidiaryFormCustomizationConfig,
  type SubsidiaryFormFieldKey,
} from '@/lib/subsidiary-form-customization'

type SubsidiaryFormCustomizationResponse = {
  config?: SubsidiaryFormCustomizationConfig
}

const fieldMetaById = Object.fromEntries(SUBSIDIARY_FORM_FIELDS.map((field) => [field.id, field])) as Record<
  SubsidiaryFormFieldKey,
  (typeof SUBSIDIARY_FORM_FIELDS)[number]
>

export type EntityCreateInitialValues = {
  name?: string
  legalName?: string | null
  entityType?: string | null
  country?: string | null
  taxId?: string | null
  registrationNumber?: string | null
  address?: string | null
  defaultCurrencyId?: string | null
  functionalCurrencyId?: string | null
  reportingCurrencyId?: string | null
  parentSubsidiaryId?: string | null
  consolidationMethod?: string | null
  ownershipPercent?: string
  retainedEarningsAccountId?: string | null
  ctaAccountId?: string | null
  intercompanyClearingAccountId?: string | null
  dueToAccountId?: string | null
  dueFromAccountId?: string | null
  inactive?: boolean
}

export default function SubsidiaryCreateForm({
  currencies,
  glAccounts,
  parentEntities,
  countryOptions,
  inactiveOptions,
  initialSubsidiaryId,
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
  currencies: Array<{ id: string; currencyId: string; code?: string; name: string }>
  glAccounts: Array<{ id: string; accountId: string; name: string }>
  parentEntities?: Array<{ id: string; subsidiaryId: string; name: string }>
  countryOptions: SelectOption[]
  inactiveOptions: SelectOption[]
  initialSubsidiaryId: string
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  initialLayoutConfig?: SubsidiaryFormCustomizationConfig
  initialRequirements?: Record<string, boolean>
  sectionDescriptions?: Record<string, string>
  initialValues?: EntityCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [currencyOptions, setCurrencyOptions] = useState(currencies)
  const [layoutConfig, setLayoutConfig] = useState<SubsidiaryFormCustomizationConfig>(() => initialLayoutConfig ?? defaultSubsidiaryFormCustomization())
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(initialRequirements ?? null)

  const [name, setName] = useState(initialValues?.name ?? '')
  const [legalName, setLegalName] = useState(initialValues?.legalName ?? '')
  const [entityType, setEntityType] = useState(initialValues?.entityType ?? '')
  const [country, setCountry] = useState(initialValues?.country ?? DEFAULT_COUNTRY_CODE)
  const [taxId, setTaxId] = useState(initialValues?.taxId ?? '')
  const [registrationNumber, setRegistrationNumber] = useState(initialValues?.registrationNumber ?? '')
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [defaultCurrencyId, setDefaultCurrencyId] = useState(initialValues?.defaultCurrencyId ?? '')
  const [functionalCurrencyId, setFunctionalCurrencyId] = useState(initialValues?.functionalCurrencyId ?? '')
  const [reportingCurrencyId, setReportingCurrencyId] = useState(initialValues?.reportingCurrencyId ?? '')
  const [parentSubsidiaryId, setparentSubsidiaryId] = useState(initialValues?.parentSubsidiaryId ?? '')
  const [consolidationMethod, setConsolidationMethod] = useState(initialValues?.consolidationMethod ?? '')
  const [ownershipPercent, setOwnershipPercent] = useState(initialValues?.ownershipPercent ?? '')
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState(initialValues?.retainedEarningsAccountId ?? '')
  const [ctaAccountId, setCtaAccountId] = useState(initialValues?.ctaAccountId ?? '')
  const [intercompanyClearingAccountId, setIntercompanyClearingAccountId] = useState(initialValues?.intercompanyClearingAccountId ?? '')
  const [dueToAccountId, setDueToAccountId] = useState(initialValues?.dueToAccountId ?? '')
  const [dueFromAccountId, setDueFromAccountId] = useState(initialValues?.dueFromAccountId ?? '')
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCurrencyOptions(currencies)
  }, [currencies])

  useEffect(() => {
    if (initialLayoutConfig && initialRequirements) return
    let mounted = true
    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/subsidiary-form-customization', { cache: 'no-store' }),
        ])
        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as SubsidiaryFormCustomizationResponse
        if (!mounted) return
        if (requirementsResponse.ok) setRuntimeRequirements(requirementsBody?.config?.subsidiaryCreate ?? null)
        if (layoutResponse.ok && layoutBody.config) setLayoutConfig(layoutBody.config)
      } catch {
        // Keep defaults.
      }
    }
    loadConfig()
    return () => { mounted = false }
  }, [initialLayoutConfig, initialRequirements])

  useEffect(() => {
    let mounted = true
    async function loadCurrencies() {
      if (currencies.length > 0) return
      try {
        const response = await fetch('/api/currencies', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body) || !mounted) return
        setCurrencyOptions(
          body
            .filter((item: unknown): item is { id: string; currencyId: string; code?: string; name: string } => {
              if (!item || typeof item !== 'object') return false
              const row = item as { id?: unknown; currencyId?: unknown; code?: unknown; name?: unknown }
              return typeof row.id === 'string' && typeof row.currencyId === 'string' && typeof row.name === 'string'
            })
            .sort((a, b) => (a.code ?? a.currencyId).localeCompare(b.code ?? b.currencyId))
        )
      } catch {
        // Keep form usable even if the fetch fails.
      }
    }
    loadCurrencies()
    return () => {
      mounted = false
    }
  }, [currencies])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('subsidiaryCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return <>{text} <span style={{ color: 'var(--danger)' }}>*</span></>
  }

  const groupedVisibleFields = useMemo(() => {
    return layoutConfig.sections
      .map((section) => ({
        section,
        fields: SUBSIDIARY_FORM_FIELDS
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

  function getFieldPlacementStyle(fieldId: SubsidiaryFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  const hasCurrencies = currencyOptions.length > 0

  function renderField(fieldId: SubsidiaryFormFieldKey) {
    switch (fieldId) {
      case 'subsidiaryId':
        return (
          <FieldInput label={requiredLabel('Subsidiary ID', req('subsidiaryId'))} helpText={fieldMetaById.subsidiaryId.description} fieldId="subsidiaryId">
            <input value={initialSubsidiaryId} readOnly disabled className={`${inputClass} opacity-80`} style={inputStyle} />
          </FieldInput>
        )
      case 'name':
        return <FieldInput label={requiredLabel('Name', req('name'))} helpText={fieldMetaById.name.description} fieldId="name"><input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'legalName':
        return <FieldInput label={requiredLabel('Legal Name', req('legalName'))} helpText={fieldMetaById.legalName.description} fieldId="legalName"><input value={legalName} onChange={(e) => setLegalName(e.target.value)} required={req('legalName')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'entityType':
        return <FieldInput label={requiredLabel('Type', req('entityType'))} helpText={fieldMetaById.entityType.description} fieldId="entityType"><input value={entityType} onChange={(e) => setEntityType(e.target.value)} required={req('entityType')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'country':
        return (
          <FieldInput label={requiredLabel('Country', req('country'))} helpText={fieldMetaById.country.description} fieldId="country" sourceText={fieldMetaById.country.source}>
            <select value={country} onChange={(e) => setCountry(e.target.value)} required={req('country')} className={selectClass} style={selectStyle}>
              {countryOptions.map((option) => (
                <option key={option.value} value={option.value} style={optionStyle}>{option.label}</option>
              ))}
            </select>
          </FieldInput>
        )
      case 'address':
        return (
          <FieldInput label={requiredLabel('Address', req('address'))} helpText={fieldMetaById.address.description} fieldId="address">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="rounded-md border px-3 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                {address ? 'Edit Address' : 'Enter Address'}
              </button>
              <p className="text-xs" style={{ color: address ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {address || 'No address saved yet'}
              </p>
            </div>
          </FieldInput>
        )
      case 'taxId':
        return <FieldInput label={requiredLabel('Tax ID', req('taxId'))} helpText={fieldMetaById.taxId.description} fieldId="taxId"><input value={taxId} onChange={(e) => setTaxId(e.target.value)} required={req('taxId')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'registrationNumber':
        return <FieldInput label={requiredLabel('Registration Number', req('registrationNumber'))} helpText={fieldMetaById.registrationNumber.description} fieldId="registrationNumber"><input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required={req('registrationNumber')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'parentSubsidiaryId':
        return (
          <FieldInput label={requiredLabel('Parent Subsidiary', req('parentSubsidiaryId'))} helpText={fieldMetaById.parentSubsidiaryId.description} fieldId="parentSubsidiaryId" sourceText={fieldMetaById.parentSubsidiaryId.source}>
            <select value={parentSubsidiaryId} onChange={(e) => setparentSubsidiaryId(e.target.value)} required={req('parentSubsidiaryId')} className={selectClass} style={selectStyle}>
              <option value="" style={optionStyle}>None</option>
              {(parentEntities ?? []).map((entity) => (
                <option key={entity.id} value={entity.id} style={optionStyle}>{entity.subsidiaryId} - {entity.name}</option>
              ))}
            </select>
          </FieldInput>
        )
      case 'defaultCurrencyId':
        return (
          <FieldInput label={requiredLabel('Primary Currency', req('defaultCurrencyId'))} helpText={fieldMetaById.defaultCurrencyId.description} fieldId="defaultCurrencyId" sourceText={fieldMetaById.defaultCurrencyId.source}>
            <select value={defaultCurrencyId} onChange={(e) => setDefaultCurrencyId(e.target.value)} required={req('defaultCurrencyId')} disabled={!hasCurrencies} className={selectClass} style={selectStyle}>
              <option value="" style={optionStyle}>{hasCurrencies ? 'None' : 'No currencies available'}</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.id} style={optionStyle}>{currency.code ?? currency.currencyId} - {currency.name}</option>
              ))}
            </select>
          </FieldInput>
        )
      case 'functionalCurrencyId':
        return (
          <FieldInput label={requiredLabel('Functional Currency', req('functionalCurrencyId'))} helpText={fieldMetaById.functionalCurrencyId.description} fieldId="functionalCurrencyId" sourceText={fieldMetaById.functionalCurrencyId.source}>
            <select value={functionalCurrencyId} onChange={(e) => setFunctionalCurrencyId(e.target.value)} required={req('functionalCurrencyId')} className={selectClass} style={selectStyle}>
              <option value="" style={optionStyle}>None</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.id} style={optionStyle}>{currency.code ?? currency.currencyId} - {currency.name}</option>
              ))}
            </select>
          </FieldInput>
        )
      case 'reportingCurrencyId':
        return (
          <FieldInput label={requiredLabel('Reporting Currency', req('reportingCurrencyId'))} helpText={fieldMetaById.reportingCurrencyId.description} fieldId="reportingCurrencyId" sourceText={fieldMetaById.reportingCurrencyId.source}>
            <select value={reportingCurrencyId} onChange={(e) => setReportingCurrencyId(e.target.value)} required={req('reportingCurrencyId')} className={selectClass} style={selectStyle}>
              <option value="" style={optionStyle}>None</option>
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.id} style={optionStyle}>{currency.code ?? currency.currencyId} - {currency.name}</option>
              ))}
            </select>
          </FieldInput>
        )
      case 'consolidationMethod':
        return <FieldInput label={requiredLabel('Consolidation Method', req('consolidationMethod'))} helpText={fieldMetaById.consolidationMethod.description} fieldId="consolidationMethod"><input value={consolidationMethod} onChange={(e) => setConsolidationMethod(e.target.value)} required={req('consolidationMethod')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'ownershipPercent':
        return <FieldInput label={requiredLabel('Ownership Percent', req('ownershipPercent'))} helpText={fieldMetaById.ownershipPercent.description} fieldId="ownershipPercent"><input type="number" step="0.01" value={ownershipPercent} onChange={(e) => setOwnershipPercent(e.target.value)} required={req('ownershipPercent')} className={inputClass} style={inputStyle} /></FieldInput>
      case 'retainedEarningsAccountId':
        return <GlSelect fieldId="retainedEarningsAccountId" helpText={fieldMetaById.retainedEarningsAccountId.description} sourceText={fieldMetaById.retainedEarningsAccountId.source} label={requiredLabel('Retained Earnings Account', req('retainedEarningsAccountId'))} value={retainedEarningsAccountId} onChange={setRetainedEarningsAccountId} glAccounts={glAccounts} required={req('retainedEarningsAccountId')} />
      case 'ctaAccountId':
        return <GlSelect fieldId="ctaAccountId" helpText={fieldMetaById.ctaAccountId.description} sourceText={fieldMetaById.ctaAccountId.source} label={requiredLabel('CTA Account', req('ctaAccountId'))} value={ctaAccountId} onChange={setCtaAccountId} glAccounts={glAccounts} required={req('ctaAccountId')} />
      case 'intercompanyClearingAccountId':
        return <GlSelect fieldId="intercompanyClearingAccountId" helpText={fieldMetaById.intercompanyClearingAccountId.description} sourceText={fieldMetaById.intercompanyClearingAccountId.source} label={requiredLabel('Intercompany Clearing Account', req('intercompanyClearingAccountId'))} value={intercompanyClearingAccountId} onChange={setIntercompanyClearingAccountId} glAccounts={glAccounts} required={req('intercompanyClearingAccountId')} />
      case 'dueToAccountId':
        return <GlSelect fieldId="dueToAccountId" helpText={fieldMetaById.dueToAccountId.description} sourceText={fieldMetaById.dueToAccountId.source} label={requiredLabel('Due To Account', req('dueToAccountId'))} value={dueToAccountId} onChange={setDueToAccountId} glAccounts={glAccounts} required={req('dueToAccountId')} />
      case 'dueFromAccountId':
        return <GlSelect fieldId="dueFromAccountId" helpText={fieldMetaById.dueFromAccountId.description} sourceText={fieldMetaById.dueFromAccountId.source} label={requiredLabel('Due From Account', req('dueFromAccountId'))} value={dueFromAccountId} onChange={setDueFromAccountId} glAccounts={glAccounts} required={req('dueFromAccountId')} />
      case 'inactive':
        return (
          <FieldInput label={requiredLabel('Inactive', req('inactive'))} helpText={fieldMetaById.inactive.description} fieldId="inactive" sourceText={fieldMetaById.inactive.source}>
            <select value={inactive ? 'true' : 'false'} onChange={(e) => setInactive(e.target.value === 'true')} className={selectClass} style={selectStyle}>
              {inactiveOptions.map((option) => (
                <option key={option.value} value={option.value} style={optionStyle}>{option.label}</option>
              ))}
            </select>
          </FieldInput>
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
        ['legalName', legalName],
        ['entityType', entityType],
        ['country', country],
        ['address', address],
        ['taxId', taxId],
        ['registrationNumber', registrationNumber],
        ['parentSubsidiaryId', parentSubsidiaryId],
        ['defaultCurrencyId', defaultCurrencyId],
        ['functionalCurrencyId', functionalCurrencyId],
        ['reportingCurrencyId', reportingCurrencyId],
        ['consolidationMethod', consolidationMethod],
        ['ownershipPercent', ownershipPercent],
        ['retainedEarningsAccountId', retainedEarningsAccountId],
        ['ctaAccountId', ctaAccountId],
        ['intercompanyClearingAccountId', intercompanyClearingAccountId],
        ['dueToAccountId', dueToAccountId],
        ['dueFromAccountId', dueFromAccountId],
      ] as const

      for (const [fieldName, fieldValue] of requiredFields) {
        if (req(fieldName) && !String(fieldValue ?? '').trim()) missing.push(fieldName)
      }
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`)

      const response = await fetch('/api/subsidiaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          legalName,
          entityType,
          country,
          taxId,
          registrationNumber,
          address,
          defaultCurrencyId,
          functionalCurrencyId,
          reportingCurrencyId,
          parentSubsidiaryId,
          consolidationMethod,
          ownershipPercent,
          retainedEarningsAccountId,
          ctaAccountId,
          intercompanyClearingAccountId,
          dueToAccountId,
          dueFromAccountId,
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
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Subsidiary details</h2>
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

        <AddressModal
          open={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          onSave={(formattedAddress) => {
            setAddress(formattedAddress)
            setCountry(parseAddress(formattedAddress).country)
            setAddressModalOpen(false)
          }}
          initialFields={{ ...parseAddress(address), country }}
        />

        {error ? <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        {showFooterActions ? (
          <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--border-muted)' }}>
            <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Subsidiary'}</button>
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

function GlSelect({
  label,
  helpText,
  fieldId,
  sourceText,
  value,
  onChange,
  glAccounts,
  required,
}: {
  label: React.ReactNode
  helpText?: string
  fieldId?: string
  sourceText?: string
  value: string
  onChange: (value: string) => void
  glAccounts: Array<{ id: string; accountId: string; name: string }>
  required?: boolean
}) {
  return (
    <FieldInput label={label} helpText={helpText} fieldId={fieldId} sourceText={sourceText}>
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required} className={selectClass} style={selectStyle}>
        <option value="" style={optionStyle}>None</option>
        {glAccounts.map((account) => (
          <option key={account.id} value={account.id} style={optionStyle}>{account.accountId} - {account.name}</option>
        ))}
      </select>
    </FieldInput>
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
const selectClass = inputClass
const selectStyle = { borderColor: 'var(--border-muted)', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' } as const
const optionStyle = { color: 'var(--text-secondary)', backgroundColor: 'var(--card)' } as const
