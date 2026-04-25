import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import ItemDetailCustomizeMode from '@/components/ItemDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadItemFormCustomization } from '@/lib/item-form-customization-store'
import { ITEM_FORM_FIELDS, type ItemFormFieldKey } from '@/lib/item-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const fieldMetaById = buildFieldMetaById(ITEM_FORM_FIELDS)
  const [item, fieldOptions, itemFormCustomization, formRequirements, companyDisplaySettings] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: {
        currency: true,
        subsidiary: true,
        itemSubsidiaries: { include: { subsidiary: true }, orderBy: { subsidiary: { subsidiaryId: 'asc' } } },
        department: true,
        location: true,
        preferredVendor: true,
        defaultRevRecTemplate: true,
        incomeAccount: true,
        deferredRevenueAccount: true,
        inventoryAccount: true,
        cogsExpenseAccount: true,
        deferredCostAccount: true,
        purchaseOrderLineItems: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { purchaseOrder: { select: { id: true, number: true, status: true, createdAt: true } } },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, [
      'inactive',
      'itemType',
      'itemCategory',
      'uom',
      'primaryPurchaseUnit',
      'primarySaleUnit',
      'primaryUnitsType',
      'revenueStream',
      'recognitionMethod',
      'recognitionTrigger',
      'createRevenueArrangementOn',
      'createForecastPlanOn',
      'createRevenuePlanOn',
      'performanceObligationType',
      'billingType',
      'billingTrigger',
      'line',
      'productLine',
      'defaultRevRecTemplateId',
      'subsidiaryIds',
      'departmentId',
      'locationId',
      'preferredVendorId',
      'currencyId',
      'incomeAccountId',
      'deferredRevenueAccountId',
      'inventoryAccountId',
      'cogsExpenseAccountId',
      'deferredCostAccountId',
    ]),
    loadItemFormCustomization(),
    loadFormRequirements(),
    loadCompanyDisplaySettings(),
  ])
  const { moneySettings } = companyDisplaySettings

  if (!item) notFound()

  const detailHref = `/items/${item.id}`
  const itemCurrencyCode = item.currency?.code ?? item.currency?.currencyId ?? undefined
  const sectionDescriptions: Record<string, string> = {
    Core: 'The primary identity and commercial classification for the item.',
    Operational: 'Availability, purchasing, fulfillment, and operational defaults for the item.',
    'Pricing And Costing': 'Fields used for pricing, valuation, and margin analysis.',
    Billing: 'Defaults that drive how and when this item is billed.',
    'Revenue Recognition': 'Defaults that drive revenue timing and performance-obligation behavior.',
    Accounting: 'Accounting defaults and posting behavior for this item.',
  }
  const itemFieldDefinitions: Record<ItemFormFieldKey, InlineRecordSection['fields'][number]> = {
    name: { name: 'name', label: 'Name', value: item.name, helpText: 'Primary user-facing item name shown on records and reports.' },
    itemId: { name: 'itemId', label: 'Item Id', value: item.itemId ?? '', helpText: 'Unique internal identifier used to reference this item across transactions, reports, and integrations.' },
    externalId: { name: 'externalId', label: 'External ID', value: item.externalId ?? '', helpText: 'Optional integration identifier used to match this item to another system.' },
    sku: { name: 'sku', label: 'SKU', value: item.sku ?? '', helpText: 'Stock keeping unit or commercial code used for ordering, stocking, and external product references.' },
    description: { name: 'description', label: 'Description', value: item.description ?? '', helpText: 'Longer description for operational context, purchasing, sales, or internal documentation.' },
    salesDescription: { name: 'salesDescription', label: 'Sales Description', value: item.salesDescription ?? '', helpText: 'Customer-facing description used on sales quotes, orders, invoices, and related documents.' },
    purchaseDescription: { name: 'purchaseDescription', label: 'Purchase Description', value: item.purchaseDescription ?? '', helpText: 'Vendor-facing description used on requisitions, purchase orders, bills, and other procurement documents.' },
    inactive: { name: 'inactive', label: 'Inactive', value: String(!item.active), type: 'select', options: fieldOptions.inactive ?? [], helpText: 'Marks the item as unavailable for new use while preserving historical transactions and reporting.', sourceText: getFieldSourceText(fieldMetaById, 'inactive') },
    itemType: {
      name: 'itemType',
      label: 'Type',
      value: item.itemType ?? '',
      type: 'select',
      placeholder: 'Select item type',
      options: fieldOptions.itemType ?? [],
      helpText: 'High-level classification of the item, such as inventory, service, non-inventory, or other internal categories used by your process.',
      sourceText: getFieldSourceText(fieldMetaById, 'itemType'),
    },
    itemCategory: {
      name: 'itemCategory',
      label: 'Item Category',
      value: item.itemCategory ?? '',
      type: 'select',
      placeholder: 'Select item category',
      options: fieldOptions.itemCategory ?? [],
      helpText: 'Business-owned category used to group similar items for reporting, planning, and operational control.',
      sourceText: getFieldSourceText(fieldMetaById, 'itemCategory'),
    },
    uom: { name: 'uom', label: 'Unit of Measure', value: item.uom ?? '', type: 'select', options: fieldOptions.uom ?? [], helpText: 'Default selling or stocking unit used to interpret price, quantity, and cost values.', sourceText: getFieldSourceText(fieldMetaById, 'uom') },
    primaryPurchaseUnit: { name: 'primaryPurchaseUnit', label: 'Primary Purchase Unit', value: item.primaryPurchaseUnit ?? '', type: 'select', options: fieldOptions.primaryPurchaseUnit ?? [], helpText: 'Default unit used when this item is bought from vendors.', sourceText: getFieldSourceText(fieldMetaById, 'primaryPurchaseUnit') },
    primarySaleUnit: { name: 'primarySaleUnit', label: 'Primary Sales Unit', value: item.primarySaleUnit ?? '', type: 'select', options: fieldOptions.primarySaleUnit ?? [], helpText: 'Default unit used when this item is sold to customers.', sourceText: getFieldSourceText(fieldMetaById, 'primarySaleUnit') },
    primaryUnitsType: { name: 'primaryUnitsType', label: 'Primary Units Type', value: item.primaryUnitsType ?? '', type: 'select', options: fieldOptions.primaryUnitsType ?? [], helpText: 'Classification of the item’s primary purchase and sales units.', sourceText: getFieldSourceText(fieldMetaById, 'primaryUnitsType') },
    listPrice: { name: 'listPrice', label: 'List Price', value: String(item.listPrice), displayValue: fmtCurrency(item.listPrice, itemCurrencyCode, moneySettings), type: 'number', helpText: 'Default sales price before discounts, allocations, or customer-specific pricing rules.' },
    revenueStream: { name: 'revenueStream', label: 'Revenue Stream', value: item.revenueStream ?? '', type: 'select', options: fieldOptions.revenueStream ?? [], helpText: 'Business-facing revenue category used to group similar products or services for reporting and disclosure.', sourceText: getFieldSourceText(fieldMetaById, 'revenueStream'), disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' }, disabledReason: 'Disabled because Direct Revenue Posting is enabled.' },
    recognitionMethod: {
      name: 'recognitionMethod',
      label: 'Recognition Method',
      value: item.recognitionMethod ?? '',
      type: 'select',
      options: fieldOptions.recognitionMethod ?? [],
      helpText: 'Defines whether revenue is typically recognized at a single event or ratably over a service period.',
      sourceText: getFieldSourceText(fieldMetaById, 'recognitionMethod'),
      disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' },
      disabledReason: 'Disabled because Direct Revenue Posting is enabled.',
    },
    recognitionTrigger: { name: 'recognitionTrigger', label: 'Recognition Trigger', value: item.recognitionTrigger ?? '', type: 'select', options: fieldOptions.recognitionTrigger ?? [], helpText: 'Operational event that normally drives recognition, such as delivery, fulfillment, activation, or service completion.', sourceText: getFieldSourceText(fieldMetaById, 'recognitionTrigger'), disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' }, disabledReason: 'Disabled because Direct Revenue Posting is enabled.' },
    defaultRevRecTemplateId: {
      name: 'defaultRevRecTemplateId',
      label: 'Rev Rec Template',
      value: item.defaultRevRecTemplateId ?? '',
      type: 'select',
      placeholder: 'Select rev rec template',
      options: fieldOptions.defaultRevRecTemplateId ?? [],
      helpText: 'Default scheduling template used to generate revenue recognition timing for this item.',
      sourceText: getFieldSourceText(fieldMetaById, 'defaultRevRecTemplateId'),
      disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' },
      disabledReason: 'Disabled because Direct Revenue Posting is enabled.',
    },
    defaultTermMonths: { name: 'defaultTermMonths', label: 'Default Term Months', value: item.defaultTermMonths != null ? String(item.defaultTermMonths) : '', type: 'number', helpText: 'Default contract or service term used when generating schedules for recurring or time-based revenue.', disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' }, disabledReason: 'Disabled because Direct Revenue Posting is enabled.' },
    createRevenueArrangementOn: {
      name: 'createRevenueArrangementOn',
      label: 'Create Revenue Arrangement On',
      value: item.createRevenueArrangementOn ?? '',
      type: 'select',
      options: fieldOptions.createRevenueArrangementOn ?? [],
      helpText: 'Event that creates the revenue arrangement container for this item.',
      sourceText: getFieldSourceText(fieldMetaById, 'createRevenueArrangementOn'),
      disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' },
      disabledReason: 'Disabled because Direct Revenue Posting is enabled.',
    },
    createForecastPlanOn: {
      name: 'createForecastPlanOn',
      label: 'Create Forecast Plan On',
      value: item.createForecastPlanOn ?? '',
      type: 'select',
      options: fieldOptions.createForecastPlanOn ?? [],
      helpText: 'Event that creates forecast-only schedule lines for planning.',
      sourceText: getFieldSourceText(fieldMetaById, 'createForecastPlanOn'),
      disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' },
      disabledReason: 'Disabled because Direct Revenue Posting is enabled.',
    },
    createRevenuePlanOn: {
      name: 'createRevenuePlanOn',
      label: 'Create Revenue Plan On',
      value: item.createRevenuePlanOn ?? '',
      type: 'select',
      options: fieldOptions.createRevenuePlanOn ?? [],
      helpText: 'Event that creates actual accounting revenue plan lines.',
      sourceText: getFieldSourceText(fieldMetaById, 'createRevenuePlanOn'),
      disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' },
      disabledReason: 'Disabled because Direct Revenue Posting is enabled.',
    },
    allocationEligible: { name: 'allocationEligible', label: 'Allocation Eligible', value: String(item.allocationEligible), type: 'checkbox', placeholder: 'Allocation Eligible', helpText: 'Controls whether this item participates in relative SSP contract allocation.', disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' }, disabledReason: 'Disabled because Direct Revenue Posting is enabled.' },
    performanceObligationType: {
      name: 'performanceObligationType',
      label: 'Performance Obligation Type',
      value: item.performanceObligationType ?? '',
      type: 'select',
      options: fieldOptions.performanceObligationType ?? [],
      helpText: 'Default performance obligation category copied to revenue elements.',
      sourceText: getFieldSourceText(fieldMetaById, 'performanceObligationType'),
      disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' },
      disabledReason: 'Disabled because Direct Revenue Posting is enabled.',
    },
    standaloneSellingPrice: { name: 'standaloneSellingPrice', label: 'Standalone Selling Price', value: item.standaloneSellingPrice != null ? String(item.standaloneSellingPrice) : '', displayValue: item.standaloneSellingPrice != null ? fmtCurrency(item.standaloneSellingPrice, itemCurrencyCode, moneySettings) : '-', type: 'number', helpText: 'Estimated standalone selling price used for revenue allocation when this item is sold in a bundle.' },
    billingType: { name: 'billingType', label: 'Billing Type', value: item.billingType ?? '', type: 'select', options: fieldOptions.billingType ?? [], helpText: 'How this item is normally billed, such as one-time, recurring, milestone, or usage-based.', sourceText: getFieldSourceText(fieldMetaById, 'billingType') },
    billingTrigger: { name: 'billingTrigger', label: 'Billing Trigger', value: item.billingTrigger ?? '', type: 'select', options: fieldOptions.billingTrigger ?? [], helpText: 'Operational event that allows or creates billing for this item, such as fulfillment, acceptance, or milestone completion.', sourceText: getFieldSourceText(fieldMetaById, 'billingTrigger') },
    standardCost: { name: 'standardCost', label: 'Standard Cost', value: item.standardCost != null ? String(item.standardCost) : '', displayValue: item.standardCost != null ? fmtCurrency(item.standardCost, itemCurrencyCode, moneySettings) : '-', type: 'number', helpText: 'Planned or budgeted cost used for variance analysis and margin reporting.' },
    averageCost: { name: 'averageCost', label: 'Average Cost', value: item.averageCost != null ? String(item.averageCost) : '', displayValue: item.averageCost != null ? fmtCurrency(item.averageCost, itemCurrencyCode, moneySettings) : '-', type: 'number', helpText: 'Blended cost basis used for operational reporting or inventory valuation where average costing applies.' },
    subsidiaryIds: { name: 'subsidiaryIds', label: 'Subsidiaries', value: item.itemSubsidiaries.map((assignment) => assignment.subsidiaryId).join(','), type: 'select', multiple: true, placeholder: 'Select Subsidiaries', options: fieldOptions.subsidiaryIds ?? [], helpText: 'Subsidiaries where this item is available.', sourceText: getFieldSourceText(fieldMetaById, 'subsidiaryIds') },
    includeChildren: { name: 'includeChildren', label: 'Include Children', value: String(item.includeChildren), type: 'checkbox', placeholder: 'Include Children', helpText: 'If enabled, child subsidiaries under the selected subsidiaries also inherit item availability.' },
    departmentId: { name: 'departmentId', label: 'Department Id', value: item.departmentId ?? '', type: 'select', placeholder: 'Select department', options: fieldOptions.departmentId ?? [], helpText: 'Default department context for this item.', sourceText: getFieldSourceText(fieldMetaById, 'departmentId') },
    locationId: { name: 'locationId', label: 'Location Id', value: item.locationId ?? '', type: 'select', placeholder: 'Select location', options: fieldOptions.locationId ?? [], helpText: 'Default location context for this item.', sourceText: getFieldSourceText(fieldMetaById, 'locationId') },
    currencyId: { name: 'currencyId', label: 'Currency', value: item.currencyId ?? '', type: 'select', placeholder: 'Select currency', options: fieldOptions.currencyId ?? [], helpText: 'Default currency for pricing and item-level monetary values.', sourceText: getFieldSourceText(fieldMetaById, 'currencyId') },
    line: { name: 'line', label: 'Business Line', value: item.line ?? '', type: 'select', options: fieldOptions.line ?? [], helpText: 'Higher-level business line classification used for commercial reporting and operational grouping.', sourceText: getFieldSourceText(fieldMetaById, 'line') },
    productLine: { name: 'productLine', label: 'Product Line', value: item.productLine ?? '', type: 'select', options: fieldOptions.productLine ?? [], helpText: 'Product line used for merchandising and reporting.', sourceText: getFieldSourceText(fieldMetaById, 'productLine') },
    dropShipItem: {
      name: 'dropShipItem',
      label: 'Drop Ship Item',
      value: String(item.dropShipItem),
      type: 'checkbox',
      placeholder: 'Drop Ship Item',
      helpText: 'Indicates this item is normally sourced via vendor direct shipment and cannot be received against a purchase order.',
      disabledWhenAny: [
        { fieldName: 'specialOrderItem', equals: 'true' },
        { fieldName: 'itemType', equals: 'inventory' },
      ],
      disabledReason: 'Disabled because Special Order Item is enabled or Item Type is Inventory.',
    },
    specialOrderItem: {
      name: 'specialOrderItem',
      label: 'Special Order Item',
      value: String(item.specialOrderItem),
      type: 'checkbox',
      placeholder: 'Special Order Item',
      helpText: 'Indicates an inventory item is specially procured to be received, staged, or packaged before shipment to the customer.',
      disabledWhenAny: [
        { fieldName: 'dropShipItem', equals: 'true' },
        { fieldName: 'itemType', notEquals: 'inventory' },
      ],
      disabledReason: 'Disabled because Drop Ship Item is enabled or Item Type is not Inventory.',
    },
    canBeFulfilled: { name: 'canBeFulfilled', label: 'Can Be Fulfilled', value: String(item.canBeFulfilled), type: 'checkbox', placeholder: 'Can Be Fulfilled', helpText: 'Controls whether fulfillment flows treat this item as fulfillable.' },
    preferredVendorId: { name: 'preferredVendorId', label: 'Preferred Vendor Id', value: item.preferredVendorId ?? '', type: 'select', placeholder: 'Select preferred vendor', options: fieldOptions.preferredVendorId ?? [], helpText: 'Default preferred vendor for procurement and replenishment.', sourceText: getFieldSourceText(fieldMetaById, 'preferredVendorId') },
    incomeAccountId: { name: 'incomeAccountId', label: 'Income Account', value: item.incomeAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: fieldOptions.incomeAccountId ?? [], helpText: 'Primary revenue account credited when this item generates recognized revenue.', sourceText: getFieldSourceText(fieldMetaById, 'incomeAccountId') },
    deferredRevenueAccountId: { name: 'deferredRevenueAccountId', label: 'Deferred Revenue Account', value: item.deferredRevenueAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: fieldOptions.deferredRevenueAccountId ?? [], helpText: 'Liability account used when billed amounts must be deferred before revenue is recognized.', sourceText: getFieldSourceText(fieldMetaById, 'deferredRevenueAccountId'), disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' }, disabledReason: 'Disabled because Direct Revenue Posting is enabled.' },
    inventoryAccountId: {
      name: 'inventoryAccountId',
      label: 'Asset Account',
      value: item.inventoryAccountId ?? '',
      type: 'select',
      placeholder: 'Select GL account',
      options: fieldOptions.inventoryAccountId ?? [],
      helpText: 'Asset account that carries inventory or capitalized item value. Required when Item Type is Inventory.',
      sourceText: getFieldSourceText(fieldMetaById, 'inventoryAccountId'),
      disabledWhenAny: [{ fieldName: 'itemType', notEquals: 'inventory' }],
      disabledReason: 'Disabled because Item Type is not Inventory.',
    },
    cogsExpenseAccountId: { name: 'cogsExpenseAccountId', label: 'COGS / Expense Account', value: item.cogsExpenseAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: fieldOptions.cogsExpenseAccountId ?? [], helpText: 'Expense account used when the item cost is relieved to cost of goods sold or operating expense.', sourceText: getFieldSourceText(fieldMetaById, 'cogsExpenseAccountId') },
    deferredCostAccountId: { name: 'deferredCostAccountId', label: 'Deferred Cost Account', value: item.deferredCostAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: fieldOptions.deferredCostAccountId ?? [], helpText: 'Asset account used to temporarily hold capitalized or deferred fulfillment costs before amortization.', sourceText: getFieldSourceText(fieldMetaById, 'deferredCostAccountId'), disabledWhen: { fieldName: 'directRevenuePosting', equals: 'true' }, disabledReason: 'Disabled because Direct Revenue Posting is enabled.' },
    directRevenuePosting: { name: 'directRevenuePosting', label: 'Direct Revenue Posting', value: String(item.directRevenuePosting), type: 'checkbox', placeholder: 'Direct Revenue Posting', helpText: 'If enabled, revenue can post directly at billing or fulfillment instead of first routing through deferred revenue logic.' },
  }
  const customizeFields = buildCustomizePreviewFields(ITEM_FORM_FIELDS, itemFieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: ITEM_FORM_FIELDS,
    layout: itemFormCustomization,
    fieldDefinitions: itemFieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'item',
    entityId: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'item', entityId: item.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/items'}
      backLabel={isCustomizing ? '<- Back to Item Detail' : '<- Back to Items'}
      meta={item.itemId ?? 'No Item Id'}
      title={item.name}
      badge={
        item.itemType ? (
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm capitalize"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            {item.itemType}
          </span>
        ) : null
      }
      actions={
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${item.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/items/new" duplicateHref={`/items/new?duplicateFrom=${item.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={item.name} fileName={`item-${item.itemId ?? item.id}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? (
            <Link
              href={`${detailHref}?customize=1`}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Customize
            </Link>
          ) : null}
          {!isEditing && !isCustomizing ? (
            <Link
              href={`${detailHref}?edit=1`}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Edit
            </Link>
          ) : null}
          {!isCustomizing ? <DeleteButton resource="items" id={item.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <ItemDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={itemFormCustomization}
            initialRequirements={{ ...formRequirements.itemCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="items"
            id={item.id}
            title="Item details"
            sections={detailSections}
            editing={isEditing}
            columns={itemFormCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} internalId={item.id} /> : null}

        <RecordDetailSection title="Purchase Order Lines" count={item.purchaseOrderLineItems.length}>
          {item.purchaseOrderLineItems.length === 0 ? (
            <RecordDetailEmptyState message="No purchase order lines for this item" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>PO #</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>PO Line</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Qty</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Unit Price</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {item.purchaseOrderLineItems.map((line) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/purchase-orders/${line.purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {line.purchaseOrder.number}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{line.displayOrder + 1}</RecordDetailCell>
                    <RecordDetailCell>{line.purchaseOrder.status}</RecordDetailCell>
                    <RecordDetailCell>{line.quantity}</RecordDetailCell>
                    <RecordDetailCell>{fmtCurrency(line.unitPrice, undefined, moneySettings)}</RecordDetailCell>
                    <RecordDetailCell>{fmtDocumentDate(line.purchaseOrder.createdAt)}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
