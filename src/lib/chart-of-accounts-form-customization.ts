import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type ChartOfAccountsFormFieldKey =
  | 'accountId'
  | 'accountNumber'
  | 'name'
  | 'description'
  | 'accountType'
  | 'normalBalance'
  | 'financialStatementSection'
  | 'financialStatementGroup'
  | 'financialStatementCategory'
  | 'subsidiaryIds'
  | 'includeChildren'
  | 'parentAccountId'
  | 'closeToAccountId'
  | 'isPosting'
  | 'isControlAccount'
  | 'allowsManualPosting'
  | 'requiresSubledgerType'
  | 'cashFlowCategory'
  | 'inventory'
  | 'revalueOpenBalance'
  | 'eliminateIntercoTransactions'
  | 'summary'

export type ChartOfAccountsFormFieldMeta = {
  id: ChartOfAccountsFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type ChartOfAccountsFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type ChartOfAccountsFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<ChartOfAccountsFormFieldKey, ChartOfAccountsFormFieldCustomization>
}

export const CHART_OF_ACCOUNTS_FORM_FIELDS: ChartOfAccountsFormFieldMeta[] = [
  { id: 'accountId', label: 'Account Id', fieldType: 'text', description: 'System-generated GL account identifier used throughout the platform.' },
  { id: 'accountNumber', label: 'Account Number', fieldType: 'text', description: 'Business-facing GL account number such as 1000 or 760.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Reporting name for the account.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Longer explanation of the account purpose or usage guidance.' },
  { id: 'accountType', label: 'Account Type', fieldType: 'list', sourceType: 'system', sourceKey: 'accountType', source: getListSourceText({ sourceType: 'system', sourceKey: 'accountType' }), description: 'Broad accounting classification for the account.' },
  { id: 'normalBalance', label: 'Normal Balance', fieldType: 'list', sourceType: 'system', sourceKey: 'normalBalance', source: getListSourceText({ sourceType: 'system', sourceKey: 'normalBalance' }), description: 'Default debit or credit orientation for the account.' },
  { id: 'financialStatementSection', label: 'FS Section', fieldType: 'text', description: 'Financial statement section used for rollups and presentation.' },
  { id: 'financialStatementGroup', label: 'FS Group', fieldType: 'text', description: 'More granular reporting group under the statement section.' },
  { id: 'financialStatementCategory', label: 'FS Category', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-COA-FS-CATEGORY', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-COA-FS-CATEGORY' }), description: 'Detailed reporting category such as Cash, AR, Inventory, AP, or FX.' },
  { id: 'subsidiaryIds', label: 'Subsidiaries', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Subsidiaries where this GL account is available.' },
  { id: 'includeChildren', label: 'Include Children', fieldType: 'boolean', description: 'If enabled, child subsidiaries under selected subsidiaries also inherit account availability.' },
  { id: 'parentAccountId', label: 'Parent Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Rollup parent for hierarchical reporting.' },
  { id: 'closeToAccountId', label: 'Close To Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Target account used when closing temporary balances.' },
  { id: 'isPosting', label: 'Posting Account', fieldType: 'boolean', description: 'Controls whether journals can post directly to this account.' },
  { id: 'isControlAccount', label: 'Control Account', fieldType: 'boolean', description: 'Marks accounts managed primarily by subledgers or protected processes.' },
  { id: 'allowsManualPosting', label: 'Allow Manual Posting', fieldType: 'boolean', description: 'Determines whether users can manually post journals to this account.' },
  { id: 'requiresSubledgerType', label: 'Requires Subledger Type', fieldType: 'text', description: 'Optional validation hint for the related subledger dimension.' },
  { id: 'cashFlowCategory', label: 'Cash Flow Category', fieldType: 'text', description: 'Classification used for operating, investing, or financing cash flow reporting.' },
  { id: 'inventory', label: 'Inventory', fieldType: 'boolean', description: 'Flags the account as inventory-related for downstream logic and reporting.' },
  { id: 'revalueOpenBalance', label: 'Revalue Open Balance', fieldType: 'boolean', description: 'Controls whether open balances are revalued for FX processes.' },
  { id: 'eliminateIntercoTransactions', label: 'Eliminate Interco Transactions', fieldType: 'boolean', description: 'Marks the account for intercompany elimination handling.' },
  { id: 'summary', label: 'Summary', fieldType: 'boolean', description: 'Indicates a header or summary account rather than a direct posting account.' },
]

export const DEFAULT_CHART_OF_ACCOUNTS_FORM_SECTIONS = [
  'Core',
  'Reporting',
  'Structure',
  'Controls',
] as const

export function defaultChartOfAccountsFormCustomization(): ChartOfAccountsFormCustomizationConfig {
  const sectionMap: Record<ChartOfAccountsFormFieldKey, string> = {
    accountId: 'Core',
    accountNumber: 'Core',
    name: 'Core',
    description: 'Core',
    accountType: 'Core',
    normalBalance: 'Reporting',
    financialStatementSection: 'Reporting',
    financialStatementGroup: 'Reporting',
    financialStatementCategory: 'Reporting',
    cashFlowCategory: 'Reporting',
    subsidiaryIds: 'Structure',
    includeChildren: 'Structure',
    parentAccountId: 'Structure',
    closeToAccountId: 'Structure',
    requiresSubledgerType: 'Structure',
    isPosting: 'Controls',
    isControlAccount: 'Controls',
    allowsManualPosting: 'Controls',
    inventory: 'Controls',
    revalueOpenBalance: 'Controls',
    eliminateIntercoTransactions: 'Controls',
    summary: 'Controls',
  }

  const columnMap: Record<ChartOfAccountsFormFieldKey, number> = {
    accountId: 1,
    accountNumber: 2,
    name: 1,
    description: 2,
    accountType: 1,
    normalBalance: 1,
    financialStatementSection: 2,
    financialStatementGroup: 1,
    financialStatementCategory: 2,
    cashFlowCategory: 1,
    subsidiaryIds: 1,
    includeChildren: 2,
    parentAccountId: 1,
    closeToAccountId: 2,
    requiresSubledgerType: 1,
    isPosting: 1,
    isControlAccount: 2,
    allowsManualPosting: 1,
    inventory: 2,
    revalueOpenBalance: 1,
    eliminateIntercoTransactions: 2,
    summary: 1,
  }

  const rowMap: Record<ChartOfAccountsFormFieldKey, number> = {
    accountId: 0,
    accountNumber: 0,
    name: 1,
    description: 1,
    accountType: 2,
    normalBalance: 0,
    financialStatementSection: 0,
    financialStatementGroup: 1,
    financialStatementCategory: 1,
    cashFlowCategory: 2,
    subsidiaryIds: 0,
    includeChildren: 0,
    parentAccountId: 1,
    closeToAccountId: 1,
    requiresSubledgerType: 2,
    isPosting: 0,
    isControlAccount: 0,
    allowsManualPosting: 1,
    inventory: 1,
    revalueOpenBalance: 2,
    eliminateIntercoTransactions: 2,
    summary: 3,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_CHART_OF_ACCOUNTS_FORM_SECTIONS],
    sectionRows: {
      Core: 3,
      Reporting: 3,
      Structure: 3,
      Controls: 4,
    },
    fields: Object.fromEntries(
      CHART_OF_ACCOUNTS_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<ChartOfAccountsFormFieldKey, ChartOfAccountsFormFieldCustomization>,
  }
}
