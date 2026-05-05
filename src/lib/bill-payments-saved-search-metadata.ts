import type {
  SavedSearchColumnOption,
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'

export const BILL_PAYMENT_SAVED_SEARCH_FILTERS: SavedSearchFilterDefinition[] = [
  {
    id: 'keyword',
    label: 'Keyword Search',
    param: 'q',
    type: 'text',
    placeholder: 'Search business id, bill, vendor, status, reference',
    helpText: 'Uses the existing bill payments page search box.',
  },
  {
    id: 'status',
    label: 'Status',
    param: 'status',
    type: 'select',
    options: [{ value: 'all', label: 'All' }],
    helpText: 'Maps to the current bill payments page status tabs.',
  },
]

export function buildBillPaymentListColumns(): SavedSearchColumnOption[] {
  return [
    { id: 'number', label: 'Business Id' },
    { id: 'bill', label: 'Bill' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'amount', label: 'Amount' },
    { id: 'date', label: 'Date' },
    { id: 'method', label: 'Method' },
    { id: 'reference', label: 'Reference' },
    { id: 'status', label: 'Status' },
    { id: 'notes', label: 'Description' },
    { id: 'db-id', label: 'DB Id' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]
}

export function buildBillPaymentSavedSearchFields({
  vendors,
  statusOptions,
}: {
  vendors: { id: string; name: string; vendorNumber?: string | null }[]
  statusOptions: { value: string; label: string }[]
}): SavedSearchFieldOption[] {
  return [
    { id: 'number', label: 'Business Id', source: 'Bill Payment', group: 'Base Record', defaultVisible: true, locked: true },
    { id: 'bill', label: 'Bill', source: 'Bill Payment', group: 'Base Record', defaultVisible: true },
    {
      id: 'vendor',
      label: 'Vendor',
      source: 'Bill Payment',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select vendor',
      options: vendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.vendorNumber?.trim() || 'Vendor'} - ${vendor.name}`,
      })),
      defaultVisible: true,
    },
    { id: 'amount', label: 'Amount', source: 'Bill Payment', group: 'Base Record', defaultVisible: true },
    { id: 'date', label: 'Date', source: 'Bill Payment', group: 'Base Record', defaultVisible: true },
    { id: 'method', label: 'Method', source: 'Bill Payment', group: 'Base Record', defaultVisible: true },
    { id: 'reference', label: 'Reference', source: 'Bill Payment', group: 'Base Record', defaultVisible: true },
    {
      id: 'status',
      label: 'Status',
      source: 'Bill Payment',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select status',
      options: statusOptions.filter((option) => option.value !== 'all'),
      defaultVisible: true,
    },
    { id: 'notes', label: 'Description', source: 'Bill Payment', group: 'Base Record' },
    { id: 'db-id', label: 'DB Id', source: 'Bill Payment', group: 'Base Record', defaultVisible: true },
    { id: 'created', label: 'Created', source: 'Bill Payment', group: 'Base Record' },
    { id: 'last-modified', label: 'Last Modified', source: 'Bill Payment', group: 'Base Record' },
  ]
}

export function buildBillPaymentsSavedSearchMetadata(
  args: Parameters<typeof buildBillPaymentSavedSearchFields>[0],
): SavedSearchTableMetadata {
  const fields = buildBillPaymentSavedSearchFields(args)
  return {
    tableId: 'bill-payments-list',
    title: 'Bill Payments',
    basePath: '/bill-payments',
    columns: buildBillPaymentListColumns(),
    filters: BILL_PAYMENT_SAVED_SEARCH_FILTERS,
    criteriaFields: fields,
    resultFields: fields,
  }
}
