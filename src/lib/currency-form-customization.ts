import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type CurrencyFormFieldKey =
  | 'currencyId'
  | 'code'
  | 'name'
  | 'symbol'
  | 'decimals'
  | 'isBase'
  | 'inactive'

export type CurrencyFormFieldMeta = {
  id: CurrencyFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type CurrencyFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type CurrencyFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<CurrencyFormFieldKey, CurrencyFormFieldCustomization>
}

export const CURRENCY_FORM_FIELDS: CurrencyFormFieldMeta[] = [
  { id: 'currencyId', label: 'Currency ID', fieldType: 'text', description: 'System-generated currency master record identifier.' },
  { id: 'code', label: 'Code', fieldType: 'text', description: 'ISO currency code or operating currency code, such as USD, CAD, or AUD.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Display name for the currency.' },
  { id: 'symbol', label: 'Symbol', fieldType: 'text', description: 'Printed symbol used on forms and reports.' },
  { id: 'decimals', label: 'Decimal Places', fieldType: 'number', description: 'Number of decimal places used for amounts in this currency.' },
  { id: 'isBase', label: 'Base Currency', fieldType: 'boolean', description: 'Marks whether this is the primary company currency.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the currency unavailable for new records while preserving history.' },
]

export const DEFAULT_CURRENCY_FORM_SECTIONS = [
  'Core',
  'Settings',
] as const

export function defaultCurrencyFormCustomization(): CurrencyFormCustomizationConfig {
  const sectionMap: Record<CurrencyFormFieldKey, string> = {
    currencyId: 'Core',
    code: 'Core',
    name: 'Core',
    symbol: 'Core',
    decimals: 'Settings',
    isBase: 'Settings',
    inactive: 'Settings',
  }

  const columnMap: Record<CurrencyFormFieldKey, number> = {
    currencyId: 1,
    code: 2,
    name: 1,
    symbol: 2,
    decimals: 1,
    isBase: 2,
    inactive: 1,
  }

  const rowMap: Record<CurrencyFormFieldKey, number> = {
    currencyId: 0,
    code: 0,
    name: 1,
    symbol: 1,
    decimals: 0,
    isBase: 0,
    inactive: 1,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_CURRENCY_FORM_SECTIONS],
    sectionRows: {
      Core: 2,
      Settings: 2,
    },
    fields: Object.fromEntries(
      CURRENCY_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<CurrencyFormFieldKey, CurrencyFormFieldCustomization>,
  }
}
