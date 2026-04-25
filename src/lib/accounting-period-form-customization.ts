import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type AccountingPeriodFormFieldKey =
  | 'name'
  | 'startDate'
  | 'endDate'
  | 'subsidiaryId'
  | 'status'
  | 'closed'
  | 'arLocked'
  | 'apLocked'
  | 'inventoryLocked'

export type AccountingPeriodFormFieldMeta = {
  id: AccountingPeriodFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type AccountingPeriodFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type AccountingPeriodFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<AccountingPeriodFormFieldKey, AccountingPeriodFormFieldCustomization>
}

export const ACCOUNTING_PERIOD_FORM_FIELDS: AccountingPeriodFormFieldMeta[] = [
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Display name for the accounting period.' },
  { id: 'startDate', label: 'Start Date', fieldType: 'date', description: 'First date included in the accounting period.' },
  { id: 'endDate', label: 'End Date', fieldType: 'date', description: 'Last date included in the accounting period.' },
  {
    id: 'subsidiaryId',
    label: 'Subsidiary',
    fieldType: 'list',
    sourceType: 'reference',
    sourceKey: 'subsidiaries',
    source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }),
    description: 'Optional subsidiary scope for the accounting period.',
  },
  {
    id: 'status',
    label: 'Status',
    fieldType: 'list',
    sourceType: 'managed-list',
    sourceKey: 'LIST-ACCOUNTING-PERIOD-STATUS',
    source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-ACCOUNTING-PERIOD-STATUS' }),
    description: 'Operational status of the period.',
  },
  { id: 'closed', label: 'Closed', fieldType: 'boolean', sourceType: 'system', sourceKey: 'boolean', source: getListSourceText({ sourceType: 'system', sourceKey: 'boolean' }), description: 'Marks the period closed for posting.' },
  { id: 'arLocked', label: 'AR Locked', fieldType: 'boolean', sourceType: 'system', sourceKey: 'boolean', source: getListSourceText({ sourceType: 'system', sourceKey: 'boolean' }), description: 'Prevents new AR activity in the period.' },
  { id: 'apLocked', label: 'AP Locked', fieldType: 'boolean', sourceType: 'system', sourceKey: 'boolean', source: getListSourceText({ sourceType: 'system', sourceKey: 'boolean' }), description: 'Prevents new AP activity in the period.' },
  { id: 'inventoryLocked', label: 'Inventory Locked', fieldType: 'boolean', sourceType: 'system', sourceKey: 'boolean', source: getListSourceText({ sourceType: 'system', sourceKey: 'boolean' }), description: 'Prevents inventory postings in the period.' },
]

export const DEFAULT_ACCOUNTING_PERIOD_FORM_SECTIONS = [
  'Core',
  'Controls',
] as const

export function defaultAccountingPeriodFormCustomization(): AccountingPeriodFormCustomizationConfig {
  const sectionMap: Record<AccountingPeriodFormFieldKey, string> = {
    name: 'Core',
    startDate: 'Core',
    endDate: 'Core',
    subsidiaryId: 'Core',
    status: 'Controls',
    closed: 'Controls',
    arLocked: 'Controls',
    apLocked: 'Controls',
    inventoryLocked: 'Controls',
  }

  const columnMap: Record<AccountingPeriodFormFieldKey, number> = {
    name: 1,
    startDate: 1,
    endDate: 2,
    subsidiaryId: 1,
    status: 1,
    closed: 2,
    arLocked: 1,
    apLocked: 2,
    inventoryLocked: 1,
  }

  const rowMap: Record<AccountingPeriodFormFieldKey, number> = {
    name: 0,
    startDate: 1,
    endDate: 1,
    subsidiaryId: 2,
    status: 0,
    closed: 0,
    arLocked: 1,
    apLocked: 1,
    inventoryLocked: 2,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_ACCOUNTING_PERIOD_FORM_SECTIONS],
    sectionRows: {
      Core: 3,
      Controls: 3,
    },
    fields: Object.fromEntries(
      ACCOUNTING_PERIOD_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<AccountingPeriodFormFieldKey, AccountingPeriodFormFieldCustomization>,
  }
}
