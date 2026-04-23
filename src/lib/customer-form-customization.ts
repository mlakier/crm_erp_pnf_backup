import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type CustomerFormFieldKey =
  | 'customerId'
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'industry'
  | 'primarySubsidiaryId'
  | 'primaryCurrencyId'
  | 'inactive'

export type CustomerFormFieldMeta = {
  id: CustomerFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type CustomerFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type CustomerFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<CustomerFormFieldKey, CustomerFormFieldCustomization>
}

export const CUSTOMER_FORM_FIELDS: CustomerFormFieldMeta[] = [
  { id: 'customerId', label: 'Customer ID', fieldType: 'text', description: 'System-generated customer identifier.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Primary customer or account name.' },
  { id: 'email', label: 'Email', fieldType: 'text', description: 'Primary customer email address.' },
  { id: 'phone', label: 'Phone', fieldType: 'text', description: 'Primary customer phone number.' },
  { id: 'address', label: 'Billing Address', fieldType: 'address', description: 'Main billing address for the customer.' },
  { id: 'industry', label: 'Industry', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-CUST-INDUSTRY', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-CUST-INDUSTRY' }), description: 'Customer industry or segment classification.' },
  { id: 'primarySubsidiaryId', label: 'Primary Subsidiary', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Default subsidiary context for this customer.' },
  { id: 'primaryCurrencyId', label: 'Primary Currency', fieldType: 'list', sourceType: 'reference', sourceKey: 'currencies', source: getListSourceText({ sourceType: 'reference', sourceKey: 'currencies' }), description: 'Default transaction currency for this customer.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the customer unavailable for new activity while preserving history.' },
]

export const DEFAULT_CUSTOMER_FORM_SECTIONS = [
  'Core',
  'Contact',
  'Financial',
  'Status',
] as const

export function defaultCustomerFormCustomization(): CustomerFormCustomizationConfig {
  const sectionMap: Record<CustomerFormFieldKey, string> = {
    customerId: 'Core',
    name: 'Core',
    email: 'Contact',
    phone: 'Contact',
    address: 'Contact',
    industry: 'Financial',
    primarySubsidiaryId: 'Financial',
    primaryCurrencyId: 'Financial',
    inactive: 'Status',
  }

  const columnMap: Record<CustomerFormFieldKey, number> = {
    customerId: 1,
    name: 2,
    email: 1,
    phone: 2,
    address: 1,
    industry: 1,
    primarySubsidiaryId: 2,
    primaryCurrencyId: 1,
    inactive: 1,
  }

  const rowMap: Record<CustomerFormFieldKey, number> = {
    customerId: 0,
    name: 0,
    email: 0,
    phone: 0,
    address: 1,
    industry: 0,
    primarySubsidiaryId: 0,
    primaryCurrencyId: 1,
    inactive: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_CUSTOMER_FORM_SECTIONS],
    sectionRows: {
      Core: 1,
      Contact: 2,
      Financial: 2,
      Status: 1,
    },
    fields: Object.fromEntries(
      CUSTOMER_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<CustomerFormFieldKey, CustomerFormFieldCustomization>,
  }
}
