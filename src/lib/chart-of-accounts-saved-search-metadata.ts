import { chartOfAccountsListDefinition } from '@/lib/master-data-list-definitions'
import type {
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'

export const CHART_OF_ACCOUNTS_SAVED_SEARCH_FILTERS: SavedSearchFilterDefinition[] = [
  {
    id: 'keyword',
    label: 'Keyword Search',
    param: 'q',
    type: 'text',
    placeholder: 'Search Account Id, Account Number, name, type, or role',
    helpText: 'Uses the existing chart of accounts page search box.',
  },
  {
    id: 'sort',
    label: 'Sort Order',
    param: 'sort',
    type: 'select',
    options: [
      { value: 'id', label: 'Id' },
      { value: 'newest', label: 'Newest' },
      { value: 'oldest', label: 'Oldest' },
      { value: 'name', label: 'Name A-Z' },
    ],
    helpText: 'Maps to the current chart of accounts list sort behavior.',
  },
]

export function buildChartOfAccountsSavedSearchFields({
  accountTypeOptions,
  normalBalanceOptions,
  financialStatementCategoryOptions,
  accountRoleOptions,
  rollforwardCategoryOptions,
  parentAccountOptions,
  subsidiaryOptions,
}: {
  accountTypeOptions: { value: string; label: string }[]
  normalBalanceOptions: { value: string; label: string }[]
  financialStatementCategoryOptions: { value: string; label: string }[]
  accountRoleOptions: { value: string; label: string }[]
  rollforwardCategoryOptions: { value: string; label: string }[]
  parentAccountOptions: { value: string; label: string }[]
  subsidiaryOptions: { value: string; label: string }[]
}): SavedSearchFieldOption[] {
  const booleanOptions = [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
  ]

  return [
    { id: 'account-id', label: 'Account Id', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true, locked: true },
    { id: 'account-number', label: 'Account Number', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true },
    { id: 'name', label: 'Name', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true },
    { id: 'description', label: 'Description', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true },
    {
      id: 'type',
      label: 'Account Type',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select account type',
      options: accountTypeOptions,
      defaultVisible: true,
    },
    {
      id: 'normal-balance',
      label: 'Normal Balance',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select normal balance',
      options: normalBalanceOptions,
      defaultVisible: true,
    },
    { id: 'fs-section', label: 'FS Section', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true },
    { id: 'fs-group', label: 'FS Group', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true },
    {
      id: 'fs-category',
      label: 'FS Category',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select FS category',
      options: financialStatementCategoryOptions,
      defaultVisible: true,
    },
    {
      id: 'account-role',
      label: 'Account Role',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select account role',
      options: accountRoleOptions,
      defaultVisible: true,
    },
    {
      id: 'rollforward-category',
      label: 'Rollforward Category',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select rollforward category',
      options: rollforwardCategoryOptions,
      defaultVisible: true,
    },
    {
      id: 'parent-account',
      label: 'Parent Account',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select parent account',
      options: parentAccountOptions,
      defaultVisible: true,
    },
    { id: 'posting', label: 'Posting', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    { id: 'control', label: 'Control', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    { id: 'inventory', label: 'Inventory', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    { id: 'revalue-open-balance', label: 'Revalue Open Balance', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    { id: 'summary', label: 'Summary', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    {
      id: 'subsidiaries',
      label: 'Subsidiaries',
      source: 'Chart of Accounts',
      group: 'Base Record',
      type: 'select',
      placeholder: 'Select subsidiary',
      options: subsidiaryOptions,
      defaultVisible: true,
    },
    { id: 'include-children', label: 'Include Children', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    { id: 'active', label: 'Active', source: 'Chart of Accounts', group: 'Base Record', type: 'select', placeholder: 'Select option', options: booleanOptions, defaultVisible: true },
    { id: 'db-id', label: 'DB Id', source: 'Chart of Accounts', group: 'Base Record', defaultVisible: true },
    { id: 'created', label: 'Created', source: 'Chart of Accounts', group: 'Base Record' },
    { id: 'last-modified', label: 'Last Modified', source: 'Chart of Accounts', group: 'Base Record' },
  ]
}

export function buildChartOfAccountsSavedSearchMetadata(
  args: Parameters<typeof buildChartOfAccountsSavedSearchFields>[0],
): SavedSearchTableMetadata {
  const fields = buildChartOfAccountsSavedSearchFields(args)
  return {
    tableId: chartOfAccountsListDefinition.tableId,
    title: 'Chart of Accounts',
    basePath: '/chart-of-accounts',
    columns: chartOfAccountsListDefinition.columns,
    filters: CHART_OF_ACCOUNTS_SAVED_SEARCH_FILTERS,
    criteriaFields: fields,
    resultFields: fields,
  }
}
