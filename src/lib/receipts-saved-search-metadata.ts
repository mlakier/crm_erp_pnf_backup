import type {
  SavedSearchColumnOption,
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'

export const RECEIPT_SAVED_SEARCH_FILTERS: SavedSearchFilterDefinition[] = [
  {
    id: 'keyword',
    label: 'Keyword Search',
    param: 'q',
    type: 'text',
    placeholder: 'Search business id, purchase order, status, description',
    helpText: 'Uses the existing receipts page search box.',
  },
  {
    id: 'status',
    label: 'Status',
    param: 'status',
    type: 'select',
    options: [{ value: 'all', label: 'All' }],
    helpText: 'Maps to the current receipts page status tabs.',
  },
]

export function buildReceiptListColumns(): SavedSearchColumnOption[] {
  return [
    { id: 'receipt-number', label: 'Business Id' },
    { id: 'purchase-order', label: 'Purchase Order' },
    { id: 'quantity', label: 'Quantity' },
    { id: 'date', label: 'Date' },
    { id: 'status', label: 'Status' },
    { id: 'notes', label: 'Description' },
    { id: 'db-id', label: 'DB Id' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]
}

export function buildReceiptSavedSearchFields({
  statusOptions,
  purchaseOrders,
}: {
  statusOptions: { value: string; label: string }[]
  purchaseOrders: { id: string; number: string }[]
}): SavedSearchFieldOption[] {
  return [
    { id: 'receipt-number', label: 'Business Id', source: 'Receipt', group: 'Base Record', defaultVisible: true, locked: true },
    {
      id: 'purchase-order',
      label: 'Purchase Order',
      source: 'Receipt',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select purchase order',
      options: purchaseOrders.map((purchaseOrder) => ({
        value: purchaseOrder.id,
        label: purchaseOrder.number,
      })),
      defaultVisible: true,
    },
    { id: 'quantity', label: 'Quantity', source: 'Receipt', group: 'Base Record', defaultVisible: true },
    { id: 'date', label: 'Date', source: 'Receipt', group: 'Base Record', defaultVisible: true },
    {
      id: 'status',
      label: 'Status',
      source: 'Receipt',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select status',
      options: statusOptions.filter((option) => option.value !== 'all'),
      defaultVisible: true,
    },
    { id: 'notes', label: 'Description', source: 'Receipt', group: 'Base Record', defaultVisible: true },
    { id: 'db-id', label: 'DB Id', source: 'Receipt', group: 'Base Record', defaultVisible: true },
    { id: 'created', label: 'Created', source: 'Receipt', group: 'Base Record' },
    { id: 'last-modified', label: 'Last Modified', source: 'Receipt', group: 'Base Record' },
  ]
}

export function buildReceiptsSavedSearchMetadata(
  args: Parameters<typeof buildReceiptSavedSearchFields>[0],
): SavedSearchTableMetadata {
  const fields = buildReceiptSavedSearchFields(args)
  return {
    tableId: 'receipts-list',
    title: 'Receipts',
    basePath: '/receipts',
    columns: buildReceiptListColumns(),
    filters: RECEIPT_SAVED_SEARCH_FILTERS,
    criteriaFields: fields,
    resultFields: fields,
  }
}
