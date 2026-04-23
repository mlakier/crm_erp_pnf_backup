import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type SubsidiaryFormFieldKey =
  | 'subsidiaryId'
  | 'name'
  | 'legalName'
  | 'entityType'
  | 'country'
  | 'address'
  | 'taxId'
  | 'registrationNumber'
  | 'parentSubsidiaryId'
  | 'defaultCurrencyId'
  | 'functionalCurrencyId'
  | 'reportingCurrencyId'
  | 'consolidationMethod'
  | 'ownershipPercent'
  | 'retainedEarningsAccountId'
  | 'ctaAccountId'
  | 'intercompanyClearingAccountId'
  | 'dueToAccountId'
  | 'dueFromAccountId'
  | 'inactive'

export type SubsidiaryFormFieldMeta = {
  id: SubsidiaryFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type SubsidiaryFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type SubsidiaryFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<SubsidiaryFormFieldKey, SubsidiaryFormFieldCustomization>
}

export const SUBSIDIARY_FORM_FIELDS: SubsidiaryFormFieldMeta[] = [
  { id: 'subsidiaryId', label: 'Subsidiary ID', fieldType: 'text', description: 'System-generated legal Subsidiary code.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Operating name of the subsidiary.' },
  { id: 'legalName', label: 'Legal Name', fieldType: 'text', description: 'Registered legal Subsidiary name.' },
  { id: 'entityType', label: 'Type', fieldType: 'text', description: 'Subsidiary classification such as corporation, LLC, or branch.' },
  { id: 'country', label: 'Country', fieldType: 'list', sourceType: 'system', sourceKey: 'countries', source: getListSourceText({ sourceType: 'system', sourceKey: 'countries' }), description: 'Country of registration or primary operation.' },
  { id: 'address', label: 'Address', fieldType: 'address', description: 'Mailing or registered office address.' },
  { id: 'taxId', label: 'Tax ID', fieldType: 'text', description: 'Primary tax registration or identification number.' },
  { id: 'registrationNumber', label: 'Registration Number', fieldType: 'text', description: 'Corporate registration number where applicable.' },
  { id: 'parentSubsidiaryId', label: 'Parent Subsidiary', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Parent Subsidiary used for hierarchy and consolidation.' },
  { id: 'defaultCurrencyId', label: 'Primary Currency', fieldType: 'list', sourceType: 'reference', sourceKey: 'currencies', source: getListSourceText({ sourceType: 'reference', sourceKey: 'currencies' }), description: 'Default transaction currency for the subsidiary.' },
  { id: 'functionalCurrencyId', label: 'Functional Currency', fieldType: 'list', sourceType: 'reference', sourceKey: 'currencies', source: getListSourceText({ sourceType: 'reference', sourceKey: 'currencies' }), description: 'Currency of the primary economic environment.' },
  { id: 'reportingCurrencyId', label: 'Reporting Currency', fieldType: 'list', sourceType: 'reference', sourceKey: 'currencies', source: getListSourceText({ sourceType: 'reference', sourceKey: 'currencies' }), description: 'Currency used for group or reporting presentation.' },
  { id: 'consolidationMethod', label: 'Consolidation Method', fieldType: 'text', description: 'How the Subsidiary is consolidated into group reporting.' },
  { id: 'ownershipPercent', label: 'Ownership Percent', fieldType: 'number', description: 'Ownership percentage held in the subsidiary.' },
  { id: 'retainedEarningsAccountId', label: 'Retained Earnings Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default retained earnings account for close activity.' },
  { id: 'ctaAccountId', label: 'CTA Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Cumulative translation adjustment account.' },
  { id: 'intercompanyClearingAccountId', label: 'Intercompany Clearing Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Clearing account for intercompany activity.' },
  { id: 'dueToAccountId', label: 'Due To Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default due-to intercompany account.' },
  { id: 'dueFromAccountId', label: 'Due From Account', fieldType: 'list', sourceType: 'reference', sourceKey: 'chartOfAccounts', source: getListSourceText({ sourceType: 'reference', sourceKey: 'chartOfAccounts' }), description: 'Default due-from intercompany account.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the subsidiary unavailable for new activity while preserving history.' },
]

export const DEFAULT_SUBSIDIARY_FORM_SECTIONS = [
  'Core',
  'Registration',
  'Hierarchy',
  'Currency',
  'Consolidation',
  'Accounting',
  'Status',
] as const

export function defaultSubsidiaryFormCustomization(): SubsidiaryFormCustomizationConfig {
  const sectionMap: Record<SubsidiaryFormFieldKey, string> = {
    subsidiaryId: 'Core',
    name: 'Core',
    legalName: 'Registration',
    entityType: 'Registration',
    country: 'Registration',
    address: 'Registration',
    taxId: 'Registration',
    registrationNumber: 'Registration',
    parentSubsidiaryId: 'Hierarchy',
    defaultCurrencyId: 'Currency',
    functionalCurrencyId: 'Currency',
    reportingCurrencyId: 'Currency',
    consolidationMethod: 'Consolidation',
    ownershipPercent: 'Consolidation',
    retainedEarningsAccountId: 'Accounting',
    ctaAccountId: 'Accounting',
    intercompanyClearingAccountId: 'Accounting',
    dueToAccountId: 'Accounting',
    dueFromAccountId: 'Accounting',
    inactive: 'Status',
  }

  const columnMap: Record<SubsidiaryFormFieldKey, number> = {
    subsidiaryId: 1,
    name: 2,
    legalName: 1,
    entityType: 2,
    country: 1,
    address: 2,
    taxId: 1,
    registrationNumber: 2,
    parentSubsidiaryId: 1,
    defaultCurrencyId: 1,
    functionalCurrencyId: 2,
    reportingCurrencyId: 1,
    consolidationMethod: 1,
    ownershipPercent: 2,
    retainedEarningsAccountId: 1,
    ctaAccountId: 2,
    intercompanyClearingAccountId: 1,
    dueToAccountId: 2,
    dueFromAccountId: 1,
    inactive: 1,
  }

  const rowMap: Record<SubsidiaryFormFieldKey, number> = {
    subsidiaryId: 0,
    name: 0,
    legalName: 0,
    entityType: 0,
    country: 1,
    address: 1,
    taxId: 2,
    registrationNumber: 2,
    parentSubsidiaryId: 0,
    defaultCurrencyId: 0,
    functionalCurrencyId: 0,
    reportingCurrencyId: 1,
    consolidationMethod: 0,
    ownershipPercent: 0,
    retainedEarningsAccountId: 0,
    ctaAccountId: 0,
    intercompanyClearingAccountId: 1,
    dueToAccountId: 1,
    dueFromAccountId: 2,
    inactive: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_SUBSIDIARY_FORM_SECTIONS],
    sectionRows: {
      Core: 1,
      Registration: 3,
      Hierarchy: 1,
      Currency: 2,
      Consolidation: 1,
      Accounting: 3,
      Status: 1,
    },
    fields: Object.fromEntries(
      SUBSIDIARY_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<SubsidiaryFormFieldKey, SubsidiaryFormFieldCustomization>,
  }
}
