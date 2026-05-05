import type {
  SavedSearchColumnOption,
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'

export const PURCHASE_REQUISITION_SAVED_SEARCH_FILTERS: SavedSearchFilterDefinition[] = [
  {
    id: 'keyword',
    label: 'Keyword Search',
    param: 'q',
    type: 'text',
    placeholder: 'Search business id, description, vendor, status',
    helpText: 'Uses the existing purchase requisitions page search box.',
  },
  {
    id: 'status',
    label: 'Status',
    param: 'status',
    type: 'select',
    options: [{ value: 'all', label: 'All' }],
    helpText: 'Maps to the current purchase requisitions page status tabs.',
  },
]

export function buildPurchaseRequisitionListColumns(): SavedSearchColumnOption[] {
  return [
    { id: 'number', label: 'Business Id' },
    { id: 'title', label: 'Description' },
    { id: 'status', label: 'Status' },
    { id: 'priority', label: 'Priority' },
    { id: 'department', label: 'Department' },
    { id: 'vendor', label: 'Preferred Vendor' },
    { id: 'total', label: 'Total' },
    { id: 'needed-by', label: 'Needed By' },
    { id: 'db-id', label: 'DB Id' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]
}

export function buildPurchaseRequisitionSavedSearchFields({
  statusOptions,
  priorityOptions,
  departments,
  vendors,
}: {
  statusOptions: { value: string; label: string }[]
  priorityOptions: { value: string; label: string }[]
  departments: { id: string; departmentId: string; name: string }[]
  vendors: { id: string; vendorNumber?: string | null; name: string }[]
}): SavedSearchFieldOption[] {
  return [
    { id: 'number', label: 'Business Id', source: 'Purchase Requisition', group: 'Base Record', defaultVisible: true, locked: true },
    { id: 'title', label: 'Description', source: 'Purchase Requisition', group: 'Base Record', defaultVisible: true },
    {
      id: 'status',
      label: 'Status',
      source: 'Purchase Requisition',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select status',
      options: statusOptions.filter((option) => option.value !== 'all'),
      defaultVisible: true,
    },
    {
      id: 'priority',
      label: 'Priority',
      source: 'Purchase Requisition',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select priority',
      options: priorityOptions,
      defaultVisible: true,
    },
    {
      id: 'department',
      label: 'Department',
      source: 'Purchase Requisition',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select department',
      options: departments.map((department) => ({
        value: department.id,
        label: `${department.departmentId} - ${department.name}`,
      })),
      defaultVisible: true,
    },
    {
      id: 'vendor',
      label: 'Preferred Vendor',
      source: 'Purchase Requisition',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select vendor',
      options: vendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.vendorNumber?.trim() || 'Vendor'} - ${vendor.name}`,
      })),
      defaultVisible: true,
    },
    { id: 'total', label: 'Total', source: 'Purchase Requisition', group: 'Base Record', defaultVisible: true },
    { id: 'needed-by', label: 'Needed By', source: 'Purchase Requisition', group: 'Base Record', defaultVisible: true },
    { id: 'db-id', label: 'DB Id', source: 'Purchase Requisition', group: 'Base Record', defaultVisible: true },
    { id: 'created', label: 'Created', source: 'Purchase Requisition', group: 'Base Record' },
    { id: 'last-modified', label: 'Last Modified', source: 'Purchase Requisition', group: 'Base Record' },
  ]
}

export function buildPurchaseRequisitionsSavedSearchMetadata(
  args: Parameters<typeof buildPurchaseRequisitionSavedSearchFields>[0],
): SavedSearchTableMetadata {
  const fields = buildPurchaseRequisitionSavedSearchFields(args)
  return {
    tableId: 'requisitions-list',
    title: 'Purchase Requisitions',
    basePath: '/purchase-requisitions',
    columns: buildPurchaseRequisitionListColumns(),
    filters: PURCHASE_REQUISITION_SAVED_SEARCH_FILTERS,
    criteriaFields: fields,
    resultFields: fields,
  }
}
