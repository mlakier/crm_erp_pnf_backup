'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultChartOfAccountsFormCustomization,
  CHART_OF_ACCOUNTS_FORM_FIELDS,
  type ChartOfAccountsFormCustomizationConfig,
  type ChartOfAccountsFormFieldKey,
} from '@/lib/chart-of-accounts-form-customization'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'

type Subsidiary = {
  id: string
  subsidiaryId: string
  name: string
}

type ChartOfAccountsFormCustomizationResponse = {
  config?: ChartOfAccountsFormCustomizationConfig
}

export type ChartOfAccountCreateInitialValues = {
  accountNumber?: string
  name?: string
  description?: string | null
  accountType?: string
  inventory?: boolean
  revalueOpenBalance?: boolean
  eliminateIntercoTransactions?: boolean
  summary?: boolean
  normalBalance?: string | null
  financialStatementSection?: string | null
  financialStatementGroup?: string | null
  isPosting?: boolean
  isControlAccount?: boolean
  allowsManualPosting?: boolean
  requiresSubledgerType?: string | null
  cashFlowCategory?: string | null
  parentAccountId?: string | null
  closeToAccountId?: string | null
  scopeMode?: 'selected' | 'parent'
  selectedSubsidiaryIds?: string[]
  parentSubsidiaryId?: string | null
  includeChildren?: boolean
}

export default function ChartOfAccountCreateForm({
  formId,
  showFooterActions = true,
  subsidiaries,
  accountOptions,
  accountTypeOptions,
  normalBalanceOptions,
  nextAccountId,
  redirectBasePath,
  initialValues,
  onSuccess,
  onCancel,
}: {
  formId?: string
  showFooterActions?: boolean
  subsidiaries: Subsidiary[]
  accountOptions: Array<{ id: string; accountId: string; accountNumber: string; name: string }>
  accountTypeOptions: SelectOption[]
  normalBalanceOptions: SelectOption[]
  nextAccountId?: string
  redirectBasePath?: string
  initialValues?: ChartOfAccountCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [accountId, setAccountId] = useState(nextAccountId ?? '')
  const [accountNumber, setAccountNumber] = useState(initialValues?.accountNumber ?? '')
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [accountType, setAccountType] = useState(initialValues?.accountType ?? accountTypeOptions[0]?.value ?? '')
  const [inventory, setInventory] = useState(initialValues?.inventory ?? false)
  const [revalueOpenBalance, setRevalueOpenBalance] = useState(initialValues?.revalueOpenBalance ?? false)
  const [eliminateIntercoTransactions, setEliminateIntercoTransactions] = useState(initialValues?.eliminateIntercoTransactions ?? false)
  const [summary, setSummary] = useState(initialValues?.summary ?? false)
  const [normalBalance, setNormalBalance] = useState(initialValues?.normalBalance ?? '')
  const [financialStatementSection, setFinancialStatementSection] = useState(initialValues?.financialStatementSection ?? '')
  const [financialStatementGroup, setFinancialStatementGroup] = useState(initialValues?.financialStatementGroup ?? '')
  const [isPosting, setIsPosting] = useState(initialValues?.isPosting ?? true)
  const [isControlAccount, setIsControlAccount] = useState(initialValues?.isControlAccount ?? false)
  const [allowsManualPosting, setAllowsManualPosting] = useState(initialValues?.allowsManualPosting ?? true)
  const [requiresSubledgerType, setRequiresSubledgerType] = useState(initialValues?.requiresSubledgerType ?? '')
  const [cashFlowCategory, setCashFlowCategory] = useState(initialValues?.cashFlowCategory ?? '')
  const [parentAccountId, setParentAccountId] = useState(initialValues?.parentAccountId ?? '')
  const [closeToAccountId, setCloseToAccountId] = useState(initialValues?.closeToAccountId ?? '')
  const [selectedSubsidiaryIds, setSelectedSubsidiaryIds] = useState<string[]>(initialValues?.selectedSubsidiaryIds ?? [])
  const [includeChildren, setIncludeChildren] = useState(initialValues?.includeChildren ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<ChartOfAccountsFormCustomizationConfig>(() => defaultChartOfAccountsFormCustomization())
  const router = useRouter()

  const sortedSubsidiaries = useMemo(
    () => [...subsidiaries].sort((a, b) => a.subsidiaryId.localeCompare(b.subsidiaryId)),
    [subsidiaries]
  )

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/chart-of-accounts-form-customization', { cache: 'no-store' }),
        ])

        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as ChartOfAccountsFormCustomizationResponse

        if (!mounted) return

        if (requirementsResponse.ok) {
          setRuntimeRequirements(requirementsBody?.config?.chartOfAccountCreate ?? null)
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
    return isFieldRequired('chartOfAccountCreate', field)
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
        fields: CHART_OF_ACCOUNTS_FORM_FIELDS
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
  const fieldMetaById = useMemo(
    () => Object.fromEntries(CHART_OF_ACCOUNTS_FORM_FIELDS.map((field) => [field.id, field])),
    []
  ) as Record<ChartOfAccountsFormFieldKey, (typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]>
  const sectionDescriptions: Record<string, string> = {
    Core: 'Identity and primary classification for the GL account.',
    Reporting: 'Statement mapping and reporting defaults used for financial presentation.',
    Structure: 'Rollup and relationship fields that shape how the account behaves in hierarchies and close logic.',
    Controls: 'Posting, control, inventory, and elimination behavior for operational accounting.',
  }

  function getSectionGridStyle(): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))` }
  }

  function getFieldPlacementStyle(fieldId: ChartOfAccountsFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function fieldLabel(fieldId: ChartOfAccountsFormFieldKey, text: string) {
    const meta = fieldMetaById[fieldId]
    return (
      <span className="inline-flex items-center gap-1">
        <span>{requiredLabel(text, req(fieldId))}</span>
        {meta.description ? <FieldTooltip content={buildTooltipContent(fieldId, meta)} /> : null}
      </span>
    )
  }

  function renderField(fieldId: ChartOfAccountsFormFieldKey) {
    switch (fieldId) {
      case 'accountId':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('accountId', 'Account Id')}</span>
            <input value={accountId} onChange={(event) => setAccountId(event.target.value)} required={req('accountId')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} placeholder="GL-00001" />
          </label>
        )
      case 'accountNumber':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('accountNumber', 'Account Number')}</span>
            <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required={req('accountNumber')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} placeholder="1000" />
          </label>
        )
      case 'name':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('name', 'Name')}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required={req('name')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} placeholder="Cash" />
          </label>
        )
      case 'description':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('description', 'Description')}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} required={req('description')} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'accountType':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('accountType', 'Account Type')}</span>
            <select value={accountType} onChange={(event) => setAccountType(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'normalBalance':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('normalBalance', 'Normal Balance')}</span>
            <select value={normalBalance} onChange={(event) => setNormalBalance(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {normalBalanceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'financialStatementSection':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('financialStatementSection', 'FS Section')}</span>
            <input value={financialStatementSection} onChange={(event) => setFinancialStatementSection(event.target.value)} required={req('financialStatementSection')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'financialStatementGroup':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('financialStatementGroup', 'FS Group')}</span>
            <input value={financialStatementGroup} onChange={(event) => setFinancialStatementGroup(event.target.value)} required={req('financialStatementGroup')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'parentAccountId':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('parentAccountId', 'Parent Account')}</span>
            <select value={parentAccountId} onChange={(event) => setParentAccountId(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {accountOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.accountId} - {option.accountNumber} - {option.name}</option>
              ))}
            </select>
          </label>
        )
      case 'subsidiaryIds':
        return (
          <div key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('subsidiaryIds', 'Subsidiaries')}</span>
            <div className="mt-1">
              <MultiSelectDropdown
                value={selectedSubsidiaryIds}
                options={sortedSubsidiaries.map((subsidiary) => ({
                  value: subsidiary.id,
                  label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
                }))}
                placeholder="Select Subsidiaries"
                onChange={setSelectedSubsidiaryIds}
              />
            </div>
          </div>
        )
      case 'includeChildren':
        return <CheckboxField key={fieldId} label={fieldLabel('includeChildren', 'Include Children')} checked={includeChildren} onChange={setIncludeChildren} />
      case 'closeToAccountId':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('closeToAccountId', 'Close To Account')}</span>
            <select value={closeToAccountId} onChange={(event) => setCloseToAccountId(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {accountOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.accountId} - {option.accountNumber} - {option.name}</option>
              ))}
            </select>
          </label>
        )
      case 'requiresSubledgerType':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('requiresSubledgerType', 'Requires Subledger Type')}</span>
            <input value={requiresSubledgerType} onChange={(event) => setRequiresSubledgerType(event.target.value)} required={req('requiresSubledgerType')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'cashFlowCategory':
        return (
          <label key={fieldId} className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{fieldLabel('cashFlowCategory', 'Cash Flow Category')}</span>
            <input value={cashFlowCategory} onChange={(event) => setCashFlowCategory(event.target.value)} required={req('cashFlowCategory')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'isPosting':
        return <CheckboxField key={fieldId} label={fieldLabel('isPosting', 'Posting Account')} checked={isPosting} onChange={setIsPosting} />
      case 'isControlAccount':
        return <CheckboxField key={fieldId} label={fieldLabel('isControlAccount', 'Control Account')} checked={isControlAccount} onChange={setIsControlAccount} />
      case 'allowsManualPosting':
        return <CheckboxField key={fieldId} label={fieldLabel('allowsManualPosting', 'Allow Manual Posting')} checked={allowsManualPosting} onChange={setAllowsManualPosting} />
      case 'inventory':
        return <CheckboxField key={fieldId} label={fieldLabel('inventory', 'Inventory')} checked={inventory} onChange={setInventory} />
      case 'revalueOpenBalance':
        return <CheckboxField key={fieldId} label={fieldLabel('revalueOpenBalance', 'Revalue Open Balance')} checked={revalueOpenBalance} onChange={setRevalueOpenBalance} />
      case 'eliminateIntercoTransactions':
        return <CheckboxField key={fieldId} label={fieldLabel('eliminateIntercoTransactions', 'Eliminate Interco Transactions')} checked={eliminateIntercoTransactions} onChange={setEliminateIntercoTransactions} />
      case 'summary':
        return <CheckboxField key={fieldId} label={fieldLabel('summary', 'Summary')} checked={summary} onChange={setSummary} />
      default:
        return null
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    if (selectedSubsidiaryIds.length === 0) {
      setError('Select at least one subsidiary.')
      setSaving(false)
      return
    }

    const missing: string[] = []
    const requiredFields = [
      ['accountId', accountId],
      ['accountNumber', accountNumber],
      ['name', name],
      ['description', description],
      ['accountType', accountType],
      ['normalBalance', normalBalance],
      ['financialStatementSection', financialStatementSection],
      ['financialStatementGroup', financialStatementGroup],
      ['subsidiaryIds', selectedSubsidiaryIds.join(',')],
      ['includeChildren', includeChildren ? 'true' : 'false'],
      ['parentAccountId', parentAccountId],
      ['closeToAccountId', closeToAccountId],
      ['requiresSubledgerType', requiresSubledgerType],
      ['cashFlowCategory', cashFlowCategory],
    ] as const

    for (const [fieldName, fieldValue] of requiredFields) {
      if (req(fieldName) && !String(fieldValue ?? '').trim()) {
        missing.push(fieldName)
      }
    }

    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.join(', ')}`)
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          accountNumber,
          name,
          description,
          accountType,
          inventory,
          revalueOpenBalance,
          eliminateIntercoTransactions,
          summary,
          normalBalance,
          financialStatementSection,
          financialStatementGroup,
          isPosting,
          isControlAccount,
          allowsManualPosting,
          requiresSubledgerType,
          cashFlowCategory,
          parentAccountId,
          closeToAccountId,
          scopeMode: 'selected',
          subsidiaryIds: selectedSubsidiaryIds,
          parentSubsidiaryId: null,
          includeChildren,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create chart account')
        setSaving(false)
        return
      }
      const createdId = String(body?.id ?? '')

      setAccountId(nextAccountId ?? '')
      setAccountNumber('')
      setName('')
      setDescription('')
      setAccountType(accountTypeOptions[0]?.value ?? '')
      setInventory(false)
      setRevalueOpenBalance(false)
      setEliminateIntercoTransactions(false)
      setSummary(false)
      setNormalBalance('')
      setFinancialStatementSection('')
      setFinancialStatementGroup('')
      setIsPosting(true)
      setIsControlAccount(false)
      setAllowsManualPosting(true)
      setRequiresSubledgerType('')
      setCashFlowCategory('')
      setParentAccountId('')
      setCloseToAccountId('')
      setSelectedSubsidiaryIds([])
      setIncludeChildren(true)
      setSaving(false)
      if (redirectBasePath && createdId) {
        router.push(`${redirectBasePath}/${createdId}`)
        router.refresh()
        return
      }
      router.refresh()
      onSuccess?.()
    } catch {
      setError('Unable to create chart account')
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Account details</h2>
      </div>

      <form id={formId} onSubmit={handleSubmit}>
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
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed"
              style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: React.ReactNode
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 pt-7 text-sm" style={{ color: 'var(--text-secondary)' }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function buildTooltipContent(
  fieldId: ChartOfAccountsFormFieldKey,
  field: (typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]
) {
  const fieldType = mapFieldTypeLabel(field.fieldType)
  const sourceLine = field.fieldType === 'list' && field.source ? `\nField Source: ${field.source}` : ''
  return `${field.description}\n\nField ID: ${fieldId}\nField Type: ${fieldType}${sourceLine}`
}

function mapFieldTypeLabel(fieldType: string) {
  if (fieldType === 'boolean') return 'checkbox'
  return fieldType
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
