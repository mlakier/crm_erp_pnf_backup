import type { MasterDataListSortOption } from '@/components/MasterDataListToolbar'
import {
  buildMasterDataColumns,
  type MasterDataColumn,
  withMasterDataDefaults,
} from '@/lib/master-data-columns'
import { ITEM_FORM_FIELDS } from '@/lib/item-form-customization'
import { ID_NEWEST_OLDEST_NAME_SORT_OPTIONS } from '@/lib/record-list-sort'

export type MasterDataListDefinition = {
  columns: MasterDataColumn[]
  searchPlaceholder: string
  tableId: string
  exportFileName: string
  sortOptions: MasterDataListSortOption[]
  compactExport?: boolean
}

export const currencyListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'currency-id', label: 'Currency Id' },
    { id: 'code', label: 'Code' },
    { id: 'name', label: 'Name' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'decimals', label: 'Decimals' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created', defaultVisible: false },
    { id: 'last-modified', label: 'Last Modified', defaultVisible: false },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search Currency Id, code, or name',
  tableId: 'currencies-list',
  exportFileName: 'currencies',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const locationListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'location-id', label: 'Location Id' },
    { id: 'code', label: 'Code' },
    { id: 'name', label: 'Name' },
    { id: 'subsidiary', label: 'Subsidiary' },
    { id: 'parent-location', label: 'Parent Location' },
    { id: 'location-type', label: 'Location Type' },
    { id: 'make-inventory-available', label: 'Make Inventory Available' },
    { id: 'address', label: 'Address' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created', defaultVisible: false },
    { id: 'last-modified', label: 'Last Modified', defaultVisible: false },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search Location Id, code, name, subsidiary, type, or address',
  tableId: 'locations-list',
  exportFileName: 'locations',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const managedListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'list-key', label: 'List Key' },
    { id: 'list-name', label: 'Name' },
    { id: 'where-used', label: 'Where Used' },
    { id: 'values', label: 'Values' },
    { id: 'display-order', label: 'Display Order' },
    { id: 'type', label: 'Type' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search list key, name, or where used',
  tableId: 'managed-lists-list',
  exportFileName: 'managed_lists',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const itemListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'itemId', label: 'Item Id', defaultVisible: true },
    { id: 'name', label: 'Name', defaultVisible: true },
    ...ITEM_FORM_FIELDS.filter((field) => field.id !== 'itemId' && field.id !== 'name').map((field) => ({
      id: field.id,
      label: field.id === 'defaultRevRecTemplateId' ? 'Rev Rec Template' : field.label,
      defaultVisible: [
        'sku',
        'itemType',
        'listPrice',
        'subsidiaryIds',
        'currencyId',
        'itemCategory',
        'revenueStream',
        'incomeAccountId',
        'standardCost',
        'directRevenuePosting',
      ].includes(field.id),
    })),
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search name, Item Id, SKU',
  tableId: 'items-list',
  exportFileName: 'items',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const chartOfAccountsListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'account-id', label: 'Account Id' },
    { id: 'account-number', label: 'Account Number' },
    { id: 'name', label: 'Name' },
    { id: 'description', label: 'Description' },
    { id: 'type', label: 'Account Type' },
    { id: 'normal-balance', label: 'Normal Balance' },
    { id: 'fs-section', label: 'FS Section' },
    { id: 'fs-group', label: 'FS Group' },
    { id: 'posting', label: 'Posting' },
    { id: 'control', label: 'Control' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'summary', label: 'Summary' },
    { id: 'subsidiaries', label: 'Subsidiaries' },
    { id: 'include-children', label: 'Include Children' },
    { id: 'created', label: 'Created' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search Account Id, Account Number, name, type',
  tableId: 'chart-of-accounts-list',
  exportFileName: 'chart_of_accounts',
  sortOptions: [
    { value: 'id', label: 'Id' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'name', label: 'Name A-Z' },
  ],
}

export const departmentListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'department-id', label: 'Department Id' },
    { id: 'department-number', label: 'Department Number' },
    { id: 'name', label: 'Name' },
    { id: 'description', label: 'Description' },
    { id: 'division', label: 'Division' },
    { id: 'subsidiaries', label: 'Subsidiaries' },
    { id: 'include-children', label: 'Include Children' },
    { id: 'planning-category', label: 'Planning Category' },
    { id: 'manager', label: 'Manager' },
    { id: 'approver', label: 'Approver' },
    { id: 'status', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search Department Id, Department Number, name, description, or division',
  tableId: 'departments-list',
  exportFileName: 'departments',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const departmentColumnLabels: Record<string, string> = {
  'department-id': 'Department Id',
  'department-number': 'Department Number',
  name: 'Name',
  description: 'Description',
  division: 'Division',
  subsidiaries: 'Subsidiaries',
  'include-children': 'Include Children',
  'planning-category': 'Planning Category',
  manager: 'Manager',
  approver: 'Approver',
  status: 'Inactive',
  created: 'Created',
  'last-modified': 'Last Modified',
  actions: 'Actions',
}

export const subsidiaryListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'subsidiary-id', label: 'Subsidiary Id' },
    { id: 'name', label: 'Name' },
    { id: 'country', label: 'Country' },
    { id: 'address', label: 'Address' },
    { id: 'tax-id', label: 'Tax ID' },
    { id: 'parent-subsidiary', label: 'Parent Subsidiary' },
    { id: 'legal-name', label: 'Legal Name' },
    { id: 'type', label: 'Type' },
    { id: 'default-currency', label: 'Primary Currency' },
    { id: 'functional-currency', label: 'Functional Currency' },
    { id: 'reporting-currency', label: 'Reporting Currency' },
    { id: 'consolidation-method', label: 'Consolidation Method' },
    { id: 'ownership-percent', label: 'Ownership %' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search subsidiary id or name',
  tableId: 'subsidiaries-list',
  exportFileName: 'subsidiaries',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
  compactExport: true,
}

export const employeeListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'employee-id', label: 'Employee Id' },
    { id: 'eid', label: 'EID' },
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'title', label: 'Title' },
    { id: 'labor-type', label: 'Labor Type' },
    { id: 'department', label: 'Department' },
    { id: 'subsidiaries', label: 'Subsidiaries' },
    { id: 'include-children', label: 'Include Children' },
    { id: 'linked-user', label: 'Linked User' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search employee id, EID, name or email',
  tableId: 'employees-list',
  exportFileName: 'employees',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const userListDefinition: MasterDataListDefinition = {
  columns: withMasterDataDefaults([
    { id: 'id', label: 'User ID' },
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'role', label: 'Role' },
    { id: 'department', label: 'Department' },
    { id: 'default-subsidiary', label: 'Default Subsidiary' },
    { id: 'subsidiaries', label: 'Subsidiaries' },
    { id: 'include-children', label: 'Include Children' },
    { id: 'approval-limit', label: 'Approval Limit', defaultVisible: false },
    { id: 'delegated-approver', label: 'Delegated Approver', defaultVisible: false },
    { id: 'locked', label: 'Locked', defaultVisible: false },
    { id: 'employee', label: 'Linked Employee' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]),
  searchPlaceholder: 'Search user #, name, email, role, or subsidiary',
  tableId: 'users-list',
  exportFileName: 'users',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const roleListDefinition: MasterDataListDefinition = {
  columns: withMasterDataDefaults([
    { id: 'role-id', label: 'Role Id' },
    { id: 'name', label: 'Name' },
    { id: 'description', label: 'Description' },
    { id: 'users', label: 'Users' },
    { id: 'inactive-users', label: 'Inactive Users' },
    { id: 'active-users', label: 'Active Users' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]),
  searchPlaceholder: 'Search role',
  tableId: 'roles-list',
  exportFileName: 'roles',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const contactListDefinition: MasterDataListDefinition = {
  columns: buildMasterDataColumns({
    idColumnId: 'contact-number',
    idLabel: 'Contact Id',
    extraColumns: [
      { id: 'account-type', label: 'Account Type' },
      { id: 'account', label: 'Account' },
      { id: 'email', label: 'Email' },
      { id: 'phone', label: 'Phone' },
      { id: 'address', label: 'Address' },
      { id: 'position', label: 'Position' },
    ],
    includeActionsColumn: true,
  }),
  searchPlaceholder: 'Search contact ID, name, customer, vendor, email, phone',
  tableId: 'contacts-list',
  exportFileName: 'contacts',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const customerListDefinition: MasterDataListDefinition = {
  columns: withMasterDataDefaults([
    { id: 'number', label: 'Customer Id' },
    { id: 'name', label: 'Name' },
    { id: 'subsidiary', label: 'Primary Subsidiary' },
    { id: 'currency', label: 'Primary Currency' },
    { id: 'address', label: 'Billing Address' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ]),
  searchPlaceholder: 'Search customer #, name, email, industry',
  tableId: 'customers-list',
  exportFileName: 'customers',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}

export const vendorListDefinition: MasterDataListDefinition = {
  columns: [
    { id: 'vendor-number', label: 'Vendor Id' },
    { id: 'name', label: 'Name' },
    { id: 'subsidiary', label: 'Primary Subsidiary' },
    { id: 'currency', label: 'Primary Currency' },
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Phone' },
    { id: 'address', label: 'Address' },
    { id: 'tax-id', label: 'Tax ID' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'created', label: 'Created' },
    { id: 'last-modified', label: 'Last Modified' },
    { id: 'actions', label: 'Actions', locked: true },
  ],
  searchPlaceholder: 'Search vendor id, name, email, phone, tax id',
  tableId: 'vendors-list',
  exportFileName: 'vendors',
  sortOptions: ID_NEWEST_OLDEST_NAME_SORT_OPTIONS,
}
