import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type ItemFormFieldKey =
  | 'name'
  | 'itemId'
  | 'sku'
  | 'description'
  | 'salesDescription'
  | 'purchaseDescription'
  | 'inactive'
  | 'itemType'
  | 'itemCategory'
  | 'uom'
  | 'primaryPurchaseUnit'
  | 'primarySaleUnit'
  | 'primaryUnitsType'
  | 'listPrice'
  | 'revenueStream'
  | 'recognitionMethod'
  | 'recognitionTrigger'
  | 'defaultRevRecTemplateId'
  | 'defaultTermMonths'
  | 'createRevenueArrangementOn'
  | 'createForecastPlanOn'
  | 'createRevenuePlanOn'
  | 'allocationEligible'
  | 'performanceObligationType'
  | 'standaloneSellingPrice'
  | 'billingType'
  | 'standardCost'
  | 'averageCost'
  | 'subsidiaryIds'
  | 'includeChildren'
  | 'departmentId'
  | 'locationId'
  | 'currencyId'
  | 'line'
  | 'productLine'
  | 'dropShipItem'
  | 'specialOrderItem'
  | 'canBeFulfilled'
  | 'preferredVendorId'
  | 'incomeAccountId'
  | 'deferredRevenueAccountId'
  | 'inventoryAccountId'
  | 'cogsExpenseAccountId'
  | 'deferredCostAccountId'
  | 'directRevenuePosting'

export type ItemFormFieldMeta = {
  id: ItemFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type ItemFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type ItemFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<ItemFormFieldKey, ItemFormFieldCustomization>
}

export const ITEM_FORM_FIELDS: ItemFormFieldMeta[] = [
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Primary item name shown on transactions and reports.' },
  { id: 'itemId', label: 'Item ID', fieldType: 'text', description: 'Internal item identifier.' },
  { id: 'sku', label: 'SKU', fieldType: 'text', description: 'Stock keeping unit or external product code.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Longer description for operational context, purchasing, sales, or internal documentation.' },
  { id: 'salesDescription', label: 'Sales Description', fieldType: 'text', description: 'Customer-facing description used on sales transactions and commercial documents.' },
  { id: 'purchaseDescription', label: 'Purchase Description', fieldType: 'text', description: 'Vendor-facing description used on purchasing transactions and procurement documents.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the item as unavailable for new use while preserving historical transactions and reporting.' },
  { id: 'itemType', label: 'Item Type', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-TYPE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-TYPE' }), description: 'High-level item classification.' },
  { id: 'itemCategory', label: 'Item Category', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-CATEGORY', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-CATEGORY' }), description: 'Business-owned category grouping used for analysis, reporting, and operational classification.' },
  { id: 'uom', label: 'UOM', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-UOM', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-UOM' }), description: 'Default unit of measure.' },
  { id: 'primaryPurchaseUnit', label: 'Primary Purchase Unit', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PRIMARY-PURCHASE-UNIT', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PRIMARY-PURCHASE-UNIT' }), description: 'Default unit used when buying this item from vendors.' },
  { id: 'primarySaleUnit', label: 'Primary Sales Unit', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PRIMARY-SALE-UNIT', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PRIMARY-SALE-UNIT' }), description: 'Default unit used when selling this item to customers.' },
  { id: 'primaryUnitsType', label: 'Primary Units Type', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-UNITS-TYPE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-UNITS-TYPE' }), description: 'Grouping or classification of the item’s primary purchase and sales units.' },
  { id: 'listPrice', label: 'List Price', fieldType: 'number', description: 'Default commercial sales price.' },
  { id: 'revenueStream', label: 'Revenue Stream', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-REVENUE-STREAM', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-REVENUE-STREAM' }), description: 'Reporting bucket for item revenue.' },
  { id: 'recognitionMethod', label: 'Recognition Method', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-RECOGNITION-METHOD', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-RECOGNITION-METHOD' }), description: 'Point in time or over time revenue logic.' },
  { id: 'recognitionTrigger', label: 'Recognition Trigger', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-RECOGNITION-TRIGGER', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-RECOGNITION-TRIGGER' }), description: 'Operational event that triggers recognition.' },
  { id: 'defaultRevRecTemplateId', label: 'Revenue Recognition Template', fieldType: 'list', sourceType: 'reference', sourceKey: 'revRecTemplates', source: getListSourceText({ sourceType: 'reference', sourceKey: 'revRecTemplates' }), description: 'Default revenue schedule template.' },
  { id: 'defaultTermMonths', label: 'Default Term Months', fieldType: 'number', description: 'Default contract or service term.' },
  { id: 'createRevenueArrangementOn', label: 'Create Revenue Arrangement On', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-REV-ARRANGEMENT-TRIGGER', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-REV-ARRANGEMENT-TRIGGER' }), description: 'Event that creates the revenue arrangement container for this item.' },
  { id: 'createForecastPlanOn', label: 'Create Forecast Plan On', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-FORECAST-PLAN-TRIGGER', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-FORECAST-PLAN-TRIGGER' }), description: 'Event that creates forecast-only revenue plan lines for planning.' },
  { id: 'createRevenuePlanOn', label: 'Create Revenue Plan On', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-REVENUE-PLAN-TRIGGER', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-REVENUE-PLAN-TRIGGER' }), description: 'Event that creates actual accounting revenue plan lines.' },
  { id: 'allocationEligible', label: 'Allocation Eligible', fieldType: 'boolean', description: 'Controls whether this item participates in relative SSP contract allocation.' },
  { id: 'performanceObligationType', label: 'Performance Obligation Type', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PERFORMANCE-OBLIGATION-TYPE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PERFORMANCE-OBLIGATION-TYPE' }), description: 'Default performance obligation category used on revenue elements.' },
  { id: 'standaloneSellingPrice', label: 'Standalone Selling Price', fieldType: 'number', description: 'Used for bundle allocation logic.' },
  { id: 'billingType', label: 'Billing Type', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-BILLING-TYPE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-BILLING-TYPE' }), description: 'One-time, recurring, milestone, or usage pattern.' },
  { id: 'standardCost', label: 'Standard Cost', fieldType: 'number', description: 'Planned cost for analysis and reporting.' },
  { id: 'averageCost', label: 'Average Cost', fieldType: 'number', description: 'Average cost basis for the item.' },
  { id: 'subsidiaryIds', label: 'Subsidiaries', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Subsidiaries where the item is available for use.' },
  { id: 'includeChildren', label: 'Include Children', fieldType: 'boolean', description: 'If enabled, child subsidiaries under the selected subsidiaries also inherit item availability.' },
  { id: 'departmentId', label: 'Department Id', fieldType: 'list', sourceType: 'reference', sourceKey: 'departments', source: getListSourceText({ sourceType: 'reference', sourceKey: 'departments' }), description: 'Default department context used for item transactions and analysis.' },
  { id: 'locationId', label: 'Location Id', fieldType: 'list', sourceType: 'reference', sourceKey: 'locations', source: getListSourceText({ sourceType: 'reference', sourceKey: 'locations' }), description: 'Default location context for the item.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', sourceType: 'reference', sourceKey: 'currencies', source: getListSourceText({ sourceType: 'reference', sourceKey: 'currencies' }), description: 'Default item currency.' },
  { id: 'line', label: 'Line', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-LINE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-LINE' }), description: 'Higher-level commercial or catalog line classification.' },
  { id: 'productLine', label: 'Product Line', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PRODUCT-LINE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ITEM-PRODUCT-LINE' }), description: 'Product line used for merchandising and reporting.' },
  { id: 'dropShipItem', label: 'Drop Ship Item', fieldType: 'boolean', description: 'Indicates this item is typically sourced via direct vendor shipment and can drive auto-PO behavior.' },
  { id: 'specialOrderItem', label: 'Special Order Item', fieldType: 'boolean', description: 'Indicates the item is specially procured for demand and can be received through purchasing.' },
  { id: 'canBeFulfilled', label: 'Can Be Fulfilled', fieldType: 'boolean', description: 'Controls whether fulfillment flows treat this item as fulfillable.' },
  { id: 'preferredVendorId', label: 'Preferred Vendor Id', fieldType: 'list', sourceType: 'reference', sourceKey: 'vendors', source: getListSourceText({ sourceType: 'reference', sourceKey: 'vendors' }), description: 'Default preferred vendor for procurement and replenishment.' },
  { id: 'incomeAccountId', label: 'Income Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default revenue posting account.' },
  { id: 'deferredRevenueAccountId', label: 'Deferred Revenue Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default deferred revenue liability account.' },
  { id: 'inventoryAccountId', label: 'Asset Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default asset account used for inventory or capitalized item value.' },
  { id: 'cogsExpenseAccountId', label: 'COGS / Expense Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default cost or expense account.' },
  { id: 'deferredCostAccountId', label: 'Deferred Cost Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default deferred cost asset account.' },
  { id: 'directRevenuePosting', label: 'Direct Revenue Posting', fieldType: 'boolean', description: 'Determines whether deferred revenue and deferred cost logic should be bypassed.' },
]

export const DEFAULT_ITEM_FORM_SECTIONS = [
  'Core',
  'Operational',
  'Pricing And Costing',
  'Revenue Recognition',
  'Accounting',
] as const

export function defaultItemFormCustomization(): ItemFormCustomizationConfig {
  const sectionMap: Record<ItemFormFieldKey, string> = {
    name: 'Core',
    itemId: 'Core',
    sku: 'Core',
    description: 'Core',
    salesDescription: 'Core',
    purchaseDescription: 'Core',
    inactive: 'Core',
    itemType: 'Core',
    itemCategory: 'Core',
    uom: 'Pricing And Costing',
    primaryPurchaseUnit: 'Operational',
    primarySaleUnit: 'Operational',
    primaryUnitsType: 'Operational',
    listPrice: 'Pricing And Costing',
    revenueStream: 'Revenue Recognition',
    recognitionMethod: 'Revenue Recognition',
    recognitionTrigger: 'Revenue Recognition',
    defaultRevRecTemplateId: 'Revenue Recognition',
    defaultTermMonths: 'Revenue Recognition',
    createRevenueArrangementOn: 'Revenue Recognition',
    createForecastPlanOn: 'Revenue Recognition',
    createRevenuePlanOn: 'Revenue Recognition',
    allocationEligible: 'Revenue Recognition',
    performanceObligationType: 'Revenue Recognition',
    standaloneSellingPrice: 'Pricing And Costing',
    billingType: 'Revenue Recognition',
    standardCost: 'Pricing And Costing',
    averageCost: 'Pricing And Costing',
    subsidiaryIds: 'Operational',
    includeChildren: 'Operational',
    departmentId: 'Operational',
    locationId: 'Operational',
    currencyId: 'Pricing And Costing',
    line: 'Operational',
    productLine: 'Operational',
    dropShipItem: 'Operational',
    specialOrderItem: 'Operational',
    canBeFulfilled: 'Operational',
    preferredVendorId: 'Operational',
    incomeAccountId: 'Accounting',
    deferredRevenueAccountId: 'Accounting',
    inventoryAccountId: 'Accounting',
    cogsExpenseAccountId: 'Accounting',
    deferredCostAccountId: 'Accounting',
    directRevenuePosting: 'Accounting',
  }

  const columnMap: Record<ItemFormFieldKey, number> = {
    name: 1,
    itemId: 2,
    sku: 1,
    description: 1,
    salesDescription: 1,
    purchaseDescription: 2,
    inactive: 2,
    itemType: 2,
    itemCategory: 1,
    uom: 1,
    primaryPurchaseUnit: 1,
    primarySaleUnit: 2,
    primaryUnitsType: 1,
    listPrice: 2,
    revenueStream: 1,
    recognitionMethod: 2,
    recognitionTrigger: 1,
    defaultRevRecTemplateId: 2,
    defaultTermMonths: 1,
    createRevenueArrangementOn: 1,
    createForecastPlanOn: 2,
    createRevenuePlanOn: 1,
    allocationEligible: 2,
    performanceObligationType: 1,
    standaloneSellingPrice: 2,
    billingType: 1,
    standardCost: 1,
    averageCost: 2,
    subsidiaryIds: 1,
    includeChildren: 2,
    departmentId: 1,
    locationId: 2,
    currencyId: 2,
    line: 1,
    productLine: 2,
    dropShipItem: 1,
    specialOrderItem: 2,
    canBeFulfilled: 1,
    preferredVendorId: 2,
    incomeAccountId: 1,
    deferredRevenueAccountId: 2,
    inventoryAccountId: 1,
    cogsExpenseAccountId: 2,
    deferredCostAccountId: 1,
    directRevenuePosting: 1,
  }

  const rowMap: Record<ItemFormFieldKey, number> = {
    name: 0,
    itemId: 0,
    sku: 1,
    description: 1,
    salesDescription: 2,
    purchaseDescription: 2,
    inactive: 1,
    itemType: 0,
    itemCategory: 3,
    uom: 0,
    primaryPurchaseUnit: 0,
    primarySaleUnit: 0,
    primaryUnitsType: 1,
    listPrice: 1,
    revenueStream: 0,
    recognitionMethod: 0,
    recognitionTrigger: 1,
    defaultRevRecTemplateId: 1,
    defaultTermMonths: 2,
    createRevenueArrangementOn: 3,
    createForecastPlanOn: 3,
    createRevenuePlanOn: 4,
    allocationEligible: 4,
    performanceObligationType: 5,
    standaloneSellingPrice: 0,
    billingType: 2,
    standardCost: 1,
    averageCost: 1,
    subsidiaryIds: 2,
    includeChildren: 2,
    departmentId: 3,
    locationId: 3,
    currencyId: 2,
    line: 1,
    productLine: 1,
    dropShipItem: 4,
    specialOrderItem: 4,
    canBeFulfilled: 5,
    preferredVendorId: 5,
    incomeAccountId: 1,
    deferredRevenueAccountId: 1,
    inventoryAccountId: 2,
    cogsExpenseAccountId: 2,
    deferredCostAccountId: 2,
    directRevenuePosting: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_ITEM_FORM_SECTIONS],
    sectionRows: {
      Core: 4,
      Operational: 6,
      'Pricing And Costing': 3,
      'Revenue Recognition': 6,
      Accounting: 3,
    },
    fields: Object.fromEntries(
      ITEM_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<ItemFormFieldKey, ItemFormFieldCustomization>,
  }
}
