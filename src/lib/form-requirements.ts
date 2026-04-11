export type FormKey = 'customerCreate' | 'contactCreate' | 'vendorCreate' | 'opportunityCreate'

export type FormRequirements = Record<string, boolean>
export type FormRequirementsMap = Record<FormKey, FormRequirements>

/**
 * Centralized required-field configuration by form.
 * Toggle booleans here to change required fields per company preference.
 */
export const FORM_REQUIREMENTS: FormRequirementsMap = {
  customerCreate: {
    name: true,
    email: true,
    phone: true,
    address: true,
    primaryContact: true,
    contactFirstName: true,
    contactLastName: true,
    addressStreet1: true,
    addressCity: true,
    addressStateProvince: true,
    addressPostalCode: true,
    addressCountry: true,
  },
  contactCreate: {
    firstName: true,
    lastName: true,
    customerId: true,
    email: false,
    phone: false,
    position: false,
  },
  vendorCreate: {
    name: true,
    email: false,
    phone: false,
    address: false,
    taxId: false,
  },
  opportunityCreate: {
    name: true,
    customerId: true,
    amount: false,
    stage: false,
    closeDate: false,
  },
}

export const FORM_LABELS: Record<FormKey, string> = {
  customerCreate: 'Customer',
  contactCreate: 'Contact',
  vendorCreate: 'Vendor',
  opportunityCreate: 'Opportunity',
}

export const FORM_FIELD_LABELS: Record<FormKey, Record<string, string>> = {
  customerCreate: {
    name: 'Customer name',
    email: 'Customer email',
    phone: 'Customer phone',
    address: 'Address',
    primaryContact: 'At least one primary contact',
    contactFirstName: 'Primary contact first name',
    contactLastName: 'Primary contact last name',
    addressStreet1: 'Address street line 1',
    addressCity: 'Address city',
    addressStateProvince: 'Address state/province',
    addressPostalCode: 'Address postal code',
    addressCountry: 'Address country',
  },
  contactCreate: {
    firstName: 'First name',
    lastName: 'Last name',
    customerId: 'Customer',
    email: 'Email',
    phone: 'Phone',
    position: 'Position',
  },
  vendorCreate: {
    name: 'Vendor name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    taxId: 'Tax ID',
  },
  opportunityCreate: {
    name: 'Opportunity name',
    customerId: 'Customer',
    amount: 'Amount',
    stage: 'Stage',
    closeDate: 'Close date',
  },
}

export function isFieldRequired(form: FormKey, field: string): boolean {
  return Boolean(FORM_REQUIREMENTS[form]?.[field])
}
