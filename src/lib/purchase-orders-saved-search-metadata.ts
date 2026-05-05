import type {
  SavedSearchColumnOption,
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'

export const PURCHASE_ORDER_SAVED_SEARCH_FILTERS: SavedSearchFilterDefinition[] = [
  {
    id: 'keyword',
    label: 'Keyword Search',
    param: 'q',
    type: 'text',
    placeholder: 'Search business id, vendor, requisition, status',
    helpText: 'Uses the existing purchase orders page search box.',
  },
  {
    id: 'status',
    label: 'Status',
    param: 'status',
    type: 'select',
    options: [{ value: 'all', label: 'All' }],
    helpText: 'Maps to the current purchase orders page status tabs.',
  },
]

export function buildPurchaseOrderListColumns(): SavedSearchColumnOption[] {
  return [
    { id: 'number', label: 'Business Id' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'status', label: 'Status' },
    { id: 'total', label: 'Total' },
    { id: 'subsidiary', label: 'Subsidiary' },
    { id: 'currency', label: 'Currency' },
    { id: 'requisition', label: 'Requisition' },
    { id: 'db-id', label: 'DB Id' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]
}

export function buildPurchaseOrderSavedSearchFields({
  vendors,
  statusOptions,
  subsidiaries,
  currencies,
  requisitions,
}: {
  vendors: { id: string; name: string; vendorNumber?: string | null }[]
  statusOptions: { value: string; label: string }[]
  subsidiaries: { id: string; subsidiaryId: string; name: string }[]
  currencies: { id: string; code: string; name: string }[]
  requisitions: { id: string; number: string; title?: string | null }[]
}): SavedSearchFieldOption[] {
  return [
    { id: 'number', label: 'Business Id', source: 'Purchase Order', group: 'Base Record', defaultVisible: true, locked: true },
    {
      id: 'vendor',
      label: 'Vendor',
      source: 'Purchase Order',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select vendor',
      options: vendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.vendorNumber?.trim() || 'Vendor'} - ${vendor.name}`,
      })),
      defaultVisible: true,
    },
    {
      id: 'status',
      label: 'Status',
      source: 'Purchase Order',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select status',
      options: statusOptions.filter((option) => option.value !== 'all'),
      defaultVisible: true,
    },
    { id: 'total', label: 'Total', source: 'Purchase Order', group: 'Base Record', defaultVisible: true },
    {
      id: 'subsidiary',
      label: 'Subsidiary',
      source: 'Purchase Order',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select subsidiary',
      options: subsidiaries.map((subsidiary) => ({
        value: subsidiary.id,
        label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
      })),
      defaultVisible: true,
    },
    {
      id: 'currency',
      label: 'Currency',
      source: 'Purchase Order',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select currency',
      options: currencies.map((currency) => ({
        value: currency.id,
        label: `${currency.code} - ${currency.name}`,
      })),
      defaultVisible: true,
    },
    {
      id: 'requisition',
      label: 'Requisition',
      source: 'Purchase Order',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select requisition',
      options: requisitions.map((requisition) => ({
        value: requisition.id,
        label: requisition.title?.trim() ? `${requisition.number} - ${requisition.title.trim()}` : requisition.number,
      })),
      defaultVisible: true,
    },
    { id: 'db-id', label: 'DB Id', source: 'Purchase Order', group: 'Base Record', defaultVisible: true },
    { id: 'created', label: 'Created', source: 'Purchase Order', group: 'Base Record' },
    { id: 'last-modified', label: 'Last Modified', source: 'Purchase Order', group: 'Base Record' },
  ]
}

export function buildPurchaseOrdersSavedSearchMetadata(
  args: Parameters<typeof buildPurchaseOrderSavedSearchFields>[0],
): SavedSearchTableMetadata {
  const fields = buildPurchaseOrderSavedSearchFields(args)
  return {
    tableId: 'purchase-orders-list',
    title: 'Purchase Orders',
    basePath: '/purchase-orders',
    columns: buildPurchaseOrderListColumns(),
    filters: PURCHASE_ORDER_SAVED_SEARCH_FILTERS,
    criteriaFields: fields,
    resultFields: fields,
  }
}
