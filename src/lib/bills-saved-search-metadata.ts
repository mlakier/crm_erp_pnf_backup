import type {
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchColumnOption,
  SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'

export const BILL_SAVED_SEARCH_FILTERS: SavedSearchFilterDefinition[] = [
  {
    id: 'keyword',
    label: 'Keyword Search',
    param: 'q',
    type: 'text',
    placeholder: 'Search business id, vendor bill no, vendor, status, notes',
    helpText: 'Uses the existing bills page search box.',
  },
  {
    id: 'status',
    label: 'Status',
    param: 'status',
    type: 'select',
    options: [{ value: 'all', label: 'All' }],
    helpText: 'Maps to the current bills page status tabs.',
  },
]

export function buildBillSavedSearchFields({
  vendors,
  statusOptions,
}: {
  vendors: { id: string; name: string; vendorNumber?: string | null }[]
  statusOptions: { value: string; label: string }[]
}): SavedSearchFieldOption[] {
  return [
    { id: 'bill-number', label: 'Business Id', source: 'Bill', group: 'Base Record', defaultVisible: true, locked: true },
    { id: 'vendor-bill-number', label: 'Vendor Bill No', source: 'Bill', group: 'Base Record', defaultVisible: true },
    { id: 'vendor-bill-date', label: 'Vendor Bill Date', source: 'Bill', group: 'Base Record', type: 'text', defaultVisible: true },
    {
      id: 'vendor',
      label: 'Vendor',
      source: 'Bill',
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
      source: 'Bill',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select status',
      options: statusOptions.filter((option) => option.value !== 'all'),
      defaultVisible: true,
    },
    { id: 'notes', label: 'Description', source: 'Bill', group: 'Base Record' },
    { id: 'total', label: 'Total', source: 'Bill', group: 'Base Record', defaultVisible: true },
    { id: 'bill-date', label: 'Bill Date', source: 'Bill', group: 'Base Record', defaultVisible: true },
    { id: 'due-date', label: 'Due Date', source: 'Bill', group: 'Base Record', defaultVisible: true },
    { id: 'db-id', label: 'DB Id', source: 'Bill', group: 'Base Record', defaultVisible: true },
    { id: 'created', label: 'Created', source: 'Bill', group: 'Base Record' },
    { id: 'last-modified', label: 'Last Modified', source: 'Bill', group: 'Base Record' },
  ]
}

export function buildBillListColumns(): SavedSearchColumnOption[] {
  return [
    { id: 'bill-number', label: 'Business Id' },
    { id: 'vendor-bill-number', label: 'Vendor Bill No' },
    { id: 'vendor-bill-date', label: 'Vendor Bill Date' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'status', label: 'Status' },
    { id: 'notes', label: 'Description' },
    { id: 'total', label: 'Total' },
    { id: 'bill-date', label: 'Bill Date' },
    { id: 'due-date', label: 'Due Date' },
    { id: 'db-id', label: 'DB Id' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]
}

export function buildBillsSavedSearchMetadata(args: Parameters<typeof buildBillSavedSearchFields>[0]): SavedSearchTableMetadata {
  const fields = buildBillSavedSearchFields(args)
  return {
    tableId: 'bills-list',
    title: 'Bills',
    basePath: '/bills',
    columns: buildBillListColumns(),
    filters: BILL_SAVED_SEARCH_FILTERS,
    criteriaFields: fields,
    resultFields: fields,
  }
}
