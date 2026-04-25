'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import { isInventoryItemType, validateItemInventoryRules, validateItemRevenueTriggerSequence } from '@/lib/item-business-rules'
import {
  defaultItemFormCustomization,
  ITEM_FORM_FIELDS,
  type ItemFormCustomizationConfig,
  type ItemFormFieldKey,
} from '@/lib/item-form-customization'

type LookupOption = {
  id: string
  label: string
}

type SelectOption = {
  value: string
  label: string
}

type ItemFormCustomizationResponse = {
  config?: ItemFormCustomizationConfig
}

export type ItemCreateInitialValues = {
  name?: string
  externalId?: string | null
  sku?: string | null
  description?: string | null
  salesDescription?: string | null
  purchaseDescription?: string | null
  inactive?: boolean
  itemType?: string | null
  itemCategory?: string | null
  uom?: string | null
  primaryPurchaseUnit?: string | null
  primarySaleUnit?: string | null
  primaryUnitsType?: string | null
  listPrice?: string
  revenueStream?: string | null
  recognitionMethod?: string | null
  recognitionTrigger?: string | null
  defaultRevRecTemplateId?: string | null
  defaultTermMonths?: string
  createRevenueArrangementOn?: string | null
  createForecastPlanOn?: string | null
  createRevenuePlanOn?: string | null
  allocationEligible?: boolean
  performanceObligationType?: string | null
  standaloneSellingPrice?: string
  billingType?: string | null
  billingTrigger?: string | null
  standardCost?: string
  averageCost?: string
  subsidiaryIds?: string[]
  includeChildren?: boolean
  departmentId?: string | null
  locationId?: string | null
  currencyId?: string | null
  line?: string | null
  productLine?: string | null
  dropShipItem?: boolean
  specialOrderItem?: boolean
  canBeFulfilled?: boolean
  preferredVendorId?: string | null
  incomeAccountId?: string | null
  deferredRevenueAccountId?: string | null
  inventoryAccountId?: string | null
  cogsExpenseAccountId?: string | null
  deferredCostAccountId?: string | null
  directRevenuePosting?: boolean
}

export default function ItemCreateForm({
  formId,
  showFooterActions = true,
  entities,
  departments,
  locations,
  vendors,
  currencies,
  glAccounts,
  revRecTemplates,
  itemTypeOptions,
  itemCategoryOptions,
  recognitionMethodOptions,
  fieldOptions = {},
  inactiveOptions,
  redirectBasePath,
  initialValues,
  onSuccess,
  onCancel,
}: {
  formId?: string
  showFooterActions?: boolean
  entities: Array<{ id: string; subsidiaryId: string; name: string }>
  departments: Array<{ id: string; departmentId: string; name: string }>
  locations: Array<{ id: string; code: string; name: string }>
  vendors: Array<{ id: string; vendorNumber: string | null; name: string }>
  currencies: Array<{ id: string; currencyId: string; code?: string; name: string }>
  glAccounts: Array<{ id: string; accountId: string; name: string }>
  revRecTemplates: Array<{ id: string; templateId: string; name: string }>
  itemTypeOptions: SelectOption[]
  itemCategoryOptions: SelectOption[]
  recognitionMethodOptions: SelectOption[]
  fieldOptions?: Partial<Record<ItemFormFieldKey, SelectOption[]>>
  inactiveOptions: SelectOption[]
  redirectBasePath?: string
  initialValues?: ItemCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [itemId, setItemId] = useState('')
  const [externalId, setExternalId] = useState(initialValues?.externalId ?? '')
  const [sku, setSku] = useState(initialValues?.sku ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [salesDescription, setSalesDescription] = useState(initialValues?.salesDescription ?? '')
  const [purchaseDescription, setPurchaseDescription] = useState(initialValues?.purchaseDescription ?? '')
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [itemType, setItemType] = useState(initialValues?.itemType ?? 'service')
  const [itemCategory, setItemCategory] = useState(initialValues?.itemCategory ?? '')
  const [uom, setUom] = useState(initialValues?.uom ?? '')
  const [primaryPurchaseUnit, setPrimaryPurchaseUnit] = useState(initialValues?.primaryPurchaseUnit ?? '')
  const [primarySaleUnit, setPrimarySaleUnit] = useState(initialValues?.primarySaleUnit ?? '')
  const [primaryUnitsType, setPrimaryUnitsType] = useState(initialValues?.primaryUnitsType ?? '')
  const [listPrice, setListPrice] = useState(initialValues?.listPrice ?? '0')
  const [revenueStream, setRevenueStream] = useState(initialValues?.revenueStream ?? '')
  const [recognitionMethod, setRecognitionMethod] = useState(initialValues?.recognitionMethod ?? '')
  const [recognitionTrigger, setRecognitionTrigger] = useState(initialValues?.recognitionTrigger ?? '')
  const [defaultRevRecTemplateId, setDefaultRevRecTemplateId] = useState(initialValues?.defaultRevRecTemplateId ?? '')
  const [defaultTermMonths, setDefaultTermMonths] = useState(initialValues?.defaultTermMonths ?? '')
  const [createRevenueArrangementOn, setCreateRevenueArrangementOn] = useState(initialValues?.createRevenueArrangementOn ?? '')
  const [createForecastPlanOn, setCreateForecastPlanOn] = useState(initialValues?.createForecastPlanOn ?? '')
  const [createRevenuePlanOn, setCreateRevenuePlanOn] = useState(initialValues?.createRevenuePlanOn ?? '')
  const [allocationEligible, setAllocationEligible] = useState(initialValues?.allocationEligible ?? true)
  const [performanceObligationType, setPerformanceObligationType] = useState(initialValues?.performanceObligationType ?? '')
  const [standaloneSellingPrice, setStandaloneSellingPrice] = useState(initialValues?.standaloneSellingPrice ?? '')
  const [billingType, setBillingType] = useState(initialValues?.billingType ?? '')
  const [billingTrigger, setBillingTrigger] = useState(initialValues?.billingTrigger ?? '')
  const [standardCost, setStandardCost] = useState(initialValues?.standardCost ?? '')
  const [averageCost, setAverageCost] = useState(initialValues?.averageCost ?? '')
  const [subsidiaryIds, setSubsidiaryIds] = useState<string[]>(initialValues?.subsidiaryIds ?? [])
  const [includeChildren, setIncludeChildren] = useState(initialValues?.includeChildren ?? false)
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? '')
  const [locationId, setLocationId] = useState(initialValues?.locationId ?? '')
  const [currencyId, setCurrencyId] = useState(initialValues?.currencyId ?? '')
  const [line, setLine] = useState(initialValues?.line ?? '')
  const [productLine, setProductLine] = useState(initialValues?.productLine ?? '')
  const [dropShipItem, setDropShipItem] = useState(initialValues?.dropShipItem ?? false)
  const [specialOrderItem, setSpecialOrderItem] = useState(initialValues?.specialOrderItem ?? false)
  const [canBeFulfilled, setCanBeFulfilled] = useState(initialValues?.canBeFulfilled ?? false)
  const [preferredVendorId, setPreferredVendorId] = useState(initialValues?.preferredVendorId ?? '')
  const [incomeAccountId, setIncomeAccountId] = useState(initialValues?.incomeAccountId ?? '')
  const [deferredRevenueAccountId, setDeferredRevenueAccountId] = useState(initialValues?.deferredRevenueAccountId ?? '')
  const [inventoryAccountId, setInventoryAccountId] = useState(initialValues?.inventoryAccountId ?? '')
  const [cogsExpenseAccountId, setCogsExpenseAccountId] = useState(initialValues?.cogsExpenseAccountId ?? '')
  const [deferredCostAccountId, setDeferredCostAccountId] = useState(initialValues?.deferredCostAccountId ?? '')
  const [directRevenuePosting, setDirectRevenuePosting] = useState(initialValues?.directRevenuePosting ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<ItemFormCustomizationConfig>(() => defaultItemFormCustomization())
  const deferredAccountsDisabled = directRevenuePosting
  const revenueRecognitionDisabled = directRevenuePosting
  const inventoryItemType = isInventoryItemType(itemType)
  const dropShipDisabled = specialOrderItem || inventoryItemType
  const specialOrderDisabled = dropShipItem || !inventoryItemType

  const glOptions: LookupOption[] = glAccounts.map((account) => ({
    id: account.id,
    label: `${account.accountId} - ${account.name}`,
  }))
  const subsidiaryOptions: SelectOption[] = entities.map((entity) => ({
    value: entity.id,
    label: `${entity.subsidiaryId} - ${entity.name}`,
  }))
  const departmentOptions: LookupOption[] = departments.map((department) => ({
    id: department.id,
    label: `${department.departmentId} - ${department.name}`,
  }))
  const locationOptions: LookupOption[] = locations.map((location) => ({
    id: location.id,
    label: `${location.code} - ${location.name}`,
  }))
  const vendorOptions: LookupOption[] = vendors.map((vendor) => ({
    id: vendor.id,
    label: vendor.vendorNumber ? `${vendor.vendorNumber} - ${vendor.name}` : vendor.name,
  }))
  const optionsFor = (fieldId: ItemFormFieldKey) => fieldOptions[fieldId] ?? []

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/item-form-customization', { cache: 'no-store' }),
        ])

        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as ItemFormCustomizationResponse

        if (!mounted) return

        if (requirementsResponse.ok) {
          setRuntimeRequirements(requirementsBody?.config?.itemCreate ?? null)
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
    return isFieldRequired('itemCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return (
      <>
        {text} <span style={{ color: 'var(--danger)' }}>*</span>
      </>
    )
  }

  function directRevenuePostingDisabledNote() {
    if (!revenueRecognitionDisabled) return null
    return <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Direct Revenue Posting is enabled.</span>
  }

  const groupedVisibleFields = useMemo(() => {
    return layoutConfig.sections
      .map((section) => ({
        section,
        fields: ITEM_FORM_FIELDS
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
    Core: 'The primary identity and commercial classification for the item.',
    Operational: 'Availability, purchasing, fulfillment, and operational defaults for the item.',
    'Pricing And Costing': 'Fields used for pricing, valuation, and margin analysis.',
    Billing: 'Defaults that drive how and when this item is billed.',
    'Revenue Recognition': 'Defaults that drive revenue timing and performance-obligation behavior.',
    Accounting: 'Accounting defaults and posting behavior for this item.',
  }

  function getSectionGridClasses() {
    return 'grid gap-3'
  }

  function getFieldClasses() {
    return 'space-y-1 text-sm'
  }

  function getSectionGridStyle(): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))` }
  }

  function getFieldPlacementStyle(fieldId: ItemFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: ItemFormFieldKey) {
    switch (fieldId) {
      case 'name':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Name', req('name'))}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'itemId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Item Id', req('itemId'))}</span>
            <input value={itemId} onChange={(e) => setItemId(e.target.value)} required={req('itemId')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'externalId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('External ID', req('externalId'))}</span>
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} required={req('externalId')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'sku':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('SKU', req('sku'))}</span>
            <input value={sku} onChange={(e) => setSku(e.target.value)} required={req('sku')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'description':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Description', req('description'))}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required={req('description')} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'salesDescription':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Sales Description', req('salesDescription'))}</span>
            <textarea value={salesDescription} onChange={(e) => setSalesDescription(e.target.value)} required={req('salesDescription')} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'purchaseDescription':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Purchase Description', req('purchaseDescription'))}</span>
            <textarea value={purchaseDescription} onChange={(e) => setPurchaseDescription(e.target.value)} required={req('purchaseDescription')} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'inactive':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Inactive', req('inactive'))}</span>
            <select value={inactive ? 'true' : 'false'} required={req('inactive')} onChange={(e) => setInactive(e.target.value === 'true')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {inactiveOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'itemType':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Item Type', req('itemType'))}</span>
            <select
              value={itemType}
              required={req('itemType')}
              onChange={(e) => {
                const nextValue = e.target.value
                setItemType(nextValue)
                if (isInventoryItemType(nextValue)) {
                  setDropShipItem(false)
                } else {
                  setSpecialOrderItem(false)
                  setInventoryAccountId('')
                }
              }}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              {itemTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'itemCategory':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Item Category', req('itemCategory'))}</span>
            <select value={itemCategory} required={req('itemCategory')} onChange={(e) => setItemCategory(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {itemCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'uom':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('UOM', req('uom'))}</span>
            <select value={uom} required={req('uom')} onChange={(e) => setUom(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('uom').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'primaryPurchaseUnit':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Primary Purchase Unit', req('primaryPurchaseUnit'))}</span>
            <select value={primaryPurchaseUnit} required={req('primaryPurchaseUnit')} onChange={(e) => setPrimaryPurchaseUnit(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('primaryPurchaseUnit').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'primarySaleUnit':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Primary Sales Unit', req('primarySaleUnit'))}</span>
            <select value={primarySaleUnit} required={req('primarySaleUnit')} onChange={(e) => setPrimarySaleUnit(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('primarySaleUnit').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'primaryUnitsType':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Primary Units Type', req('primaryUnitsType'))}</span>
            <select value={primaryUnitsType} required={req('primaryUnitsType')} onChange={(e) => setPrimaryUnitsType(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('primaryUnitsType').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'listPrice':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('List Price', req('listPrice'))}</span>
            <input type="number" step="0.01" value={listPrice} onChange={(e) => setListPrice(e.target.value)} required={req('listPrice')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'revenueStream':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Revenue Stream', req('revenueStream'))}</span>
            <select value={revenueStream} required={req('revenueStream') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setRevenueStream(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('revenueStream').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'recognitionMethod':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Recognition Method', req('recognitionMethod'))}</span>
            <select value={recognitionMethod} required={req('recognitionMethod') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setRecognitionMethod(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {recognitionMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'recognitionTrigger':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Recognition Trigger', req('recognitionTrigger'))}</span>
            <select value={recognitionTrigger} required={req('recognitionTrigger') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setRecognitionTrigger(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('recognitionTrigger').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'defaultRevRecTemplateId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Rev Rec Template', req('defaultRevRecTemplateId'))}</span>
            <select value={defaultRevRecTemplateId} required={req('defaultRevRecTemplateId') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setDefaultRevRecTemplateId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {revRecTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.templateId} - {template.name}
                </option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'defaultTermMonths':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Default Term Months', req('defaultTermMonths'))}</span>
            <input type="number" value={defaultTermMonths} onChange={(e) => setDefaultTermMonths(e.target.value)} required={req('defaultTermMonths') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }} />
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'createRevenueArrangementOn':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Create Revenue Arrangement On', req('createRevenueArrangementOn'))}</span>
            <select value={createRevenueArrangementOn} required={req('createRevenueArrangementOn') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setCreateRevenueArrangementOn(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('createRevenueArrangementOn').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'createForecastPlanOn':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Create Forecast Plan On', req('createForecastPlanOn'))}</span>
            <select value={createForecastPlanOn} required={req('createForecastPlanOn') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setCreateForecastPlanOn(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('createForecastPlanOn').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'createRevenuePlanOn':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Create Revenue Plan On', req('createRevenuePlanOn'))}</span>
            <select value={createRevenuePlanOn} required={req('createRevenuePlanOn') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setCreateRevenuePlanOn(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('createRevenuePlanOn').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'allocationEligible':
        return (
          <label key={fieldId} className={`${getFieldClasses()} flex items-center gap-2 pt-7`} style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={allocationEligible} disabled={revenueRecognitionDisabled} onChange={(e) => setAllocationEligible(e.target.checked)} className="h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-50" />
            <span>{requiredLabel('Allocation Eligible', req('allocationEligible'))}</span>
            {revenueRecognitionDisabled ? <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Direct Revenue Posting is enabled.</span> : null}
          </label>
        )
      case 'performanceObligationType':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Performance Obligation Type', req('performanceObligationType'))}</span>
            <select value={performanceObligationType} required={req('performanceObligationType') && !revenueRecognitionDisabled} disabled={revenueRecognitionDisabled} onChange={(e) => setPerformanceObligationType(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('performanceObligationType').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {directRevenuePostingDisabledNote()}
          </label>
        )
      case 'standaloneSellingPrice':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Standalone Selling Price', req('standaloneSellingPrice'))}</span>
            <input type="number" step="0.01" value={standaloneSellingPrice} onChange={(e) => setStandaloneSellingPrice(e.target.value)} required={req('standaloneSellingPrice')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'billingType':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Billing Type', req('billingType'))}</span>
            <select value={billingType} required={req('billingType')} onChange={(e) => setBillingType(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('billingType').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'billingTrigger':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Billing Trigger', req('billingTrigger'))}</span>
            <select value={billingTrigger} required={req('billingTrigger')} onChange={(e) => setBillingTrigger(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('billingTrigger').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'standardCost':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Standard Cost', req('standardCost'))}</span>
            <input type="number" step="0.01" value={standardCost} onChange={(e) => setStandardCost(e.target.value)} required={req('standardCost')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'averageCost':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Average Cost', req('averageCost'))}</span>
            <input type="number" step="0.01" value={averageCost} onChange={(e) => setAverageCost(e.target.value)} required={req('averageCost')} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
        )
      case 'subsidiaryIds':
        return (
          <div key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Subsidiaries', req('subsidiaryIds'))}</span>
            <div className="mt-1">
              <MultiSelectDropdown
                value={subsidiaryIds}
                options={subsidiaryOptions}
                placeholder="Select Subsidiaries"
                onChange={setSubsidiaryIds}
              />
            </div>
          </div>
        )
      case 'includeChildren':
        return (
          <label key={fieldId} className={`${getFieldClasses()} flex items-center gap-2 pt-7`} style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={includeChildren} onChange={(e) => setIncludeChildren(e.target.checked)} className="h-4 w-4 rounded" />
            <span>{requiredLabel('Include Children', req('includeChildren'))}</span>
          </label>
        )
      case 'departmentId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Department Id', req('departmentId'))}</span>
            <select value={departmentId} required={req('departmentId')} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {departmentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'locationId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Location Id', req('locationId'))}</span>
            <select value={locationId} required={req('locationId')} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {locationOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'currencyId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Currency', req('currencyId'))}</span>
            <select value={currencyId} required={req('currencyId')} onChange={(e) => setCurrencyId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code ?? currency.currencyId} - {currency.name}
                </option>
              ))}
            </select>
          </label>
        )
      case 'line':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Business Line', req('line'))}</span>
            <select value={line} required={req('line')} onChange={(e) => setLine(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('line').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'productLine':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Product Line', req('productLine'))}</span>
            <select value={productLine} required={req('productLine')} onChange={(e) => setProductLine(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {optionsFor('productLine').map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )
      case 'dropShipItem':
        return (
          <label key={fieldId} className={`${getFieldClasses()} flex items-center gap-2 pt-7`} style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={dropShipItem}
              disabled={dropShipDisabled}
              onChange={(e) => {
                const checked = e.target.checked
                setDropShipItem(checked)
                if (checked) setSpecialOrderItem(false)
              }}
              className="h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span>
              {requiredLabel('Drop Ship Item', req('dropShipItem'))}
              {specialOrderItem ? <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Special Order Item is enabled.</span> : null}
              {!specialOrderItem && inventoryItemType ? <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled for inventory items.</span> : null}
            </span>
          </label>
        )
      case 'specialOrderItem':
        return (
          <label key={fieldId} className={`${getFieldClasses()} flex items-center gap-2 pt-7`} style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={specialOrderItem}
              disabled={specialOrderDisabled}
              onChange={(e) => {
                const checked = e.target.checked
                setSpecialOrderItem(checked)
                if (checked) setDropShipItem(false)
              }}
              className="h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span>
              {requiredLabel('Special Order Item', req('specialOrderItem'))}
              {dropShipItem ? <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Drop Ship Item is enabled.</span> : null}
              {!dropShipItem && !inventoryItemType ? <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Inventory items only.</span> : null}
            </span>
          </label>
        )
      case 'canBeFulfilled':
        return (
          <label key={fieldId} className={`${getFieldClasses()} flex items-center gap-2 pt-7`} style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={canBeFulfilled} onChange={(e) => setCanBeFulfilled(e.target.checked)} className="h-4 w-4 rounded" />
            <span>{requiredLabel('Can Be Fulfilled', req('canBeFulfilled'))}</span>
          </label>
        )
      case 'preferredVendorId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Preferred Vendor Id', req('preferredVendorId'))}</span>
            <select value={preferredVendorId} required={req('preferredVendorId')} onChange={(e) => setPreferredVendorId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {vendorOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'incomeAccountId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Income Account', req('incomeAccountId'))}</span>
            <select value={incomeAccountId} required={req('incomeAccountId')} onChange={(e) => setIncomeAccountId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {glOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'deferredRevenueAccountId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Deferred Revenue Account', req('deferredRevenueAccountId'))}</span>
            <select value={deferredRevenueAccountId} required={req('deferredRevenueAccountId') && !deferredAccountsDisabled} disabled={deferredAccountsDisabled} onChange={(e) => setDeferredRevenueAccountId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {glOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {deferredAccountsDisabled ? <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Direct Revenue Posting is enabled.</span> : null}
          </label>
        )
      case 'inventoryAccountId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Asset Account', req('inventoryAccountId') || inventoryItemType)}</span>
            <select value={inventoryAccountId} required={req('inventoryAccountId') || inventoryItemType} disabled={!inventoryItemType} onChange={(e) => setInventoryAccountId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {glOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {inventoryItemType ? <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Required because Item Type is Inventory.</span> : <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Item Type is not Inventory.</span>}
          </label>
        )
      case 'cogsExpenseAccountId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('COGS / Expense Account', req('cogsExpenseAccountId'))}</span>
            <select value={cogsExpenseAccountId} required={req('cogsExpenseAccountId')} onChange={(e) => setCogsExpenseAccountId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {glOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )
      case 'deferredCostAccountId':
        return (
          <label key={fieldId} className={getFieldClasses()} style={{ color: 'var(--text-secondary)' }}>
            <span>{requiredLabel('Deferred Cost Account', req('deferredCostAccountId'))}</span>
            <select value={deferredCostAccountId} required={req('deferredCostAccountId') && !deferredAccountsDisabled} disabled={deferredAccountsDisabled} onChange={(e) => setDeferredCostAccountId(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="">None</option>
              {glOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {deferredAccountsDisabled ? <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Disabled because Direct Revenue Posting is enabled.</span> : null}
          </label>
        )
      case 'directRevenuePosting':
        return (
          <label key={fieldId} className={`${getFieldClasses()} flex items-center gap-2 pt-7`} style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={directRevenuePosting}
              onChange={(e) => {
                const checked = e.target.checked
                setDirectRevenuePosting(checked)
                if (checked) {
                  setDeferredRevenueAccountId('')
                  setDeferredCostAccountId('')
                }
              }}
              className="h-4 w-4 rounded"
            />
            <span>{requiredLabel('Direct Revenue Posting', req('directRevenuePosting'))}</span>
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
      const revenueRecognitionFieldNames = new Set([
        'revenueStream',
        'recognitionMethod',
        'recognitionTrigger',
        'defaultRevRecTemplateId',
        'defaultTermMonths',
        'createRevenueArrangementOn',
        'createForecastPlanOn',
        'createRevenuePlanOn',
        'allocationEligible',
        'performanceObligationType',
      ])

      const requiredFields = [
        ['name', name],
        ['itemId', itemId],
        ['externalId', externalId],
        ['sku', sku],
        ['description', description],
        ['salesDescription', salesDescription],
        ['purchaseDescription', purchaseDescription],
        ['inactive', inactive ? 'true' : 'false'],
        ['itemType', itemType],
        ['itemCategory', itemCategory],
        ['uom', uom],
        ['primaryPurchaseUnit', primaryPurchaseUnit],
        ['primarySaleUnit', primarySaleUnit],
        ['primaryUnitsType', primaryUnitsType],
        ['listPrice', listPrice],
        ['revenueStream', revenueStream],
        ['recognitionMethod', recognitionMethod],
        ['recognitionTrigger', recognitionTrigger],
        ['defaultRevRecTemplateId', defaultRevRecTemplateId],
        ['defaultTermMonths', defaultTermMonths],
        ['createRevenueArrangementOn', createRevenueArrangementOn],
        ['createForecastPlanOn', createForecastPlanOn],
        ['createRevenuePlanOn', createRevenuePlanOn],
        ['allocationEligible', allocationEligible ? 'true' : 'false'],
        ['performanceObligationType', performanceObligationType],
        ['standaloneSellingPrice', standaloneSellingPrice],
        ['billingType', billingType],
        ['billingTrigger', billingTrigger],
        ['standardCost', standardCost],
        ['averageCost', averageCost],
        ['subsidiaryIds', subsidiaryIds.join(',')],
        ['includeChildren', includeChildren ? 'true' : 'false'],
        ['departmentId', departmentId],
        ['locationId', locationId],
        ['currencyId', currencyId],
        ['line', line],
        ['productLine', productLine],
        ['dropShipItem', dropShipItem ? 'true' : 'false'],
        ['specialOrderItem', specialOrderItem ? 'true' : 'false'],
        ['canBeFulfilled', canBeFulfilled ? 'true' : 'false'],
        ['preferredVendorId', preferredVendorId],
        ['incomeAccountId', incomeAccountId],
        ['inventoryAccountId', inventoryAccountId],
        ['cogsExpenseAccountId', cogsExpenseAccountId],
      ] as const

      for (const [fieldName, fieldValue] of requiredFields) {
        if (directRevenuePosting && revenueRecognitionFieldNames.has(fieldName)) {
          continue
        }
        if (req(fieldName) && !String(fieldValue ?? '').trim()) {
          missing.push(fieldName)
        }
      }

      if (req('deferredRevenueAccountId') && !directRevenuePosting && !deferredRevenueAccountId.trim()) {
        missing.push('deferredRevenueAccountId')
      }

      if (req('deferredCostAccountId') && !directRevenuePosting && !deferredCostAccountId.trim()) {
        missing.push('deferredCostAccountId')
      }

      if (inventoryItemType && !inventoryAccountId.trim()) {
        missing.push('inventoryAccountId')
      }

      if (dropShipItem && specialOrderItem) {
        throw new Error('Drop Ship Item and Special Order Item cannot both be checked.')
      }

      const inventoryRuleError = validateItemInventoryRules({
        itemType,
        dropShipItem,
        specialOrderItem,
        inventoryAccountId,
      })
      if (inventoryRuleError) {
        throw new Error(inventoryRuleError)
      }

      const revenueTriggerError = validateItemRevenueTriggerSequence({
        directRevenuePosting,
        recognitionTrigger,
        createRevenueArrangementOn,
        createForecastPlanOn,
        createRevenuePlanOn,
      })
      if (revenueTriggerError) {
        throw new Error(revenueTriggerError)
      }

      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`)
      }

      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          itemId,
          externalId,
          sku,
          description,
          salesDescription,
          purchaseDescription,
          itemType,
          itemCategory,
          uom,
          primaryPurchaseUnit,
          primarySaleUnit,
          primaryUnitsType,
          listPrice: Number(listPrice),
          revenueStream,
          recognitionMethod,
          recognitionTrigger,
          defaultRevRecTemplateId,
          defaultTermMonths,
          createRevenueArrangementOn,
          createForecastPlanOn,
          createRevenuePlanOn,
          allocationEligible,
          performanceObligationType,
          standaloneSellingPrice,
          billingType,
          billingTrigger,
          standardCost,
          averageCost,
          subsidiaryIds,
          includeChildren,
          departmentId,
          locationId,
          currencyId,
          line,
          productLine,
          dropShipItem,
          specialOrderItem,
          canBeFulfilled,
          preferredVendorId,
          incomeAccountId,
          deferredRevenueAccountId: directRevenuePosting ? '' : deferredRevenueAccountId,
          inventoryAccountId,
          cogsExpenseAccountId,
          deferredCostAccountId: directRevenuePosting ? '' : deferredCostAccountId,
          directRevenuePosting,
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
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Item details</h2>
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
              <div className={getSectionGridClasses()} style={getSectionGridStyle()}>
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
