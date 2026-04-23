import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type ContactFormFieldKey =
  | 'contactNumber'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'address'
  | 'position'
  | 'customerId'
  | 'vendorId'
  | 'inactive'

export type ContactFormFieldMeta = {
  id: ContactFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type ContactFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type ContactFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<ContactFormFieldKey, ContactFormFieldCustomization>
}

export const CONTACT_FORM_FIELDS: ContactFormFieldMeta[] = [
  { id: 'contactNumber', label: 'Contact ID', fieldType: 'text', description: 'System-generated contact identifier.' },
  { id: 'firstName', label: 'First Name', fieldType: 'text', description: 'Contact given name.' },
  { id: 'lastName', label: 'Last Name', fieldType: 'text', description: 'Contact family name.' },
  { id: 'email', label: 'Email', fieldType: 'text', description: 'Primary contact email address.' },
  { id: 'phone', label: 'Phone', fieldType: 'text', description: 'Primary contact phone number.' },
  { id: 'address', label: 'Address', fieldType: 'address', description: 'Mailing or business address for the contact.' },
  { id: 'position', label: 'Position', fieldType: 'text', description: 'Job title or role for the contact.' },
  { id: 'customerId', label: 'Customer', fieldType: 'list', sourceType: 'reference', sourceKey: 'customers', source: getListSourceText({ sourceType: 'reference', sourceKey: 'customers' }), description: 'Customer account this contact belongs to.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', sourceType: 'reference', sourceKey: 'vendors', source: getListSourceText({ sourceType: 'reference', sourceKey: 'vendors' }), description: 'Vendor account this contact belongs to.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the contact unavailable for new activity while preserving history.' },
]

export const DEFAULT_CONTACT_FORM_SECTIONS = [
  'Core',
  'Contact',
  'Relationship',
  'Status',
] as const

export function defaultContactFormCustomization(): ContactFormCustomizationConfig {
  const sectionMap: Record<ContactFormFieldKey, string> = {
    contactNumber: 'Core',
    firstName: 'Core',
    lastName: 'Core',
    email: 'Contact',
    phone: 'Contact',
    address: 'Contact',
    position: 'Relationship',
    customerId: 'Relationship',
    vendorId: 'Relationship',
    inactive: 'Status',
  }

  const columnMap: Record<ContactFormFieldKey, number> = {
    contactNumber: 1,
    firstName: 2,
    lastName: 1,
    email: 1,
    phone: 2,
    address: 1,
    position: 1,
    customerId: 2,
    vendorId: 1,
    inactive: 1,
  }

  const rowMap: Record<ContactFormFieldKey, number> = {
    contactNumber: 0,
    firstName: 0,
    lastName: 1,
    email: 0,
    phone: 0,
    address: 1,
    position: 0,
    customerId: 0,
    vendorId: 1,
    inactive: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_CONTACT_FORM_SECTIONS],
    sectionRows: {
      Core: 2,
      Contact: 2,
      Relationship: 2,
      Status: 1,
    },
    fields: Object.fromEntries(
      CONTACT_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<ContactFormFieldKey, ContactFormFieldCustomization>,
  }
}
