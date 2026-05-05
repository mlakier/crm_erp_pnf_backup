import type { RecordHeaderField } from '@/components/RecordHeaderDetails'
import type { TransactionReferenceSourceMeta } from '@/lib/transaction-reference-layouts'

type LinkedRecordFieldCatalogEntry = {
  id: string
  label: string
  fieldType: string
  source?: string
  description?: string
  path: string[]
  linksToSourceRecord?: boolean
}

export type LinkedRecordReferenceSource = Omit<TransactionReferenceSourceMeta, 'fields'> & {
  fields: LinkedRecordFieldCatalogEntry[]
}

function normalizeLinkedRecordFieldType(
  fieldType: LinkedRecordFieldCatalogEntry['fieldType'],
): RecordHeaderField['fieldType'] {
  switch (fieldType) {
    case 'boolean':
      return 'checkbox'
    case 'currency':
    case 'date':
    case 'email':
    case 'list':
    case 'number':
    case 'checkbox':
    case 'text':
      return fieldType
    default:
      return 'text'
  }
}

function formatReferenceValue(
  value: unknown,
  fieldType: LinkedRecordFieldCatalogEntry['fieldType'],
  options?: {
    formatDate?: (value: Date) => string
    formatCurrency?: (value: unknown, currencyCode?: string | null) => string
    currencyCode?: string | null
  },
): string {
  if (value == null) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (fieldType === 'date') {
    if (value instanceof Date) {
      return options?.formatDate ? options.formatDate(value) : value.toISOString()
    }
    return String(value)
  }
  if (fieldType === 'currency') {
    return options?.formatCurrency
      ? options.formatCurrency(value, options.currencyCode)
      : String(value)
  }
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function serializeReferenceValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function readPath(record: unknown, path: string[]): unknown {
  let current = record as Record<string, unknown> | null | undefined
  for (const segment of path) {
    if (!current || typeof current !== 'object') return null
    current = current[segment] as Record<string, unknown> | null | undefined
  }
  return current
}

export function buildLinkedReferencePreviewSources(
  sources: LinkedRecordReferenceSource[],
  recordsBySourceId: Record<string, unknown>,
  formattingBySourceId?: Record<
    string,
    {
      formatDate?: (value: Date) => string
      formatCurrency?: (value: unknown, currencyCode?: string | null) => string
      currencyCode?: string | null
    }
  >,
) {
  return sources.map((source) => ({
    ...source,
    fields: source.fields.map((field) => ({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      source: field.source,
      description: field.description,
      previewValue: formatReferenceValue(
        readPath(recordsBySourceId[source.id], field.path),
        field.fieldType,
        formattingBySourceId?.[source.id],
      ),
    })),
  }))
}

export function buildLinkedReferenceFieldDefinitions(
  sources: LinkedRecordReferenceSource[],
  recordsBySourceId: Record<string, unknown>,
  recordHrefBySourceId?: Record<string, string | null | undefined>,
  formattingBySourceId?: Record<
    string,
    {
      formatDate?: (value: Date) => string
      formatCurrency?: (value: unknown, currencyCode?: string | null) => string
      currencyCode?: string | null
    }
  >,
): Record<string, RecordHeaderField> {
  return Object.fromEntries(
    sources.flatMap((source) =>
      source.fields.map((field) => {
        const rawValue = readPath(recordsBySourceId[source.id], field.path)
        return [
          field.id,
          {
            key: field.id,
            label: field.label,
            value: serializeReferenceValue(rawValue),
            displayValue: formatReferenceValue(
              rawValue,
              field.fieldType,
              formattingBySourceId?.[source.id],
            ),
            helpText: field.description,
            fieldType: normalizeLinkedRecordFieldType(field.fieldType),
            sourceText: field.source,
            href: field.linksToSourceRecord ? (recordHrefBySourceId?.[source.id] ?? null) : null,
          } satisfies RecordHeaderField,
        ] as const
      }),
    ),
  )
}

export const CUSTOMER_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'customerDbId', label: 'DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal database identifier for the linked customer record.', path: ['id'] },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked customer record.', path: ['customerId'], linksToSourceRecord: true },
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.', path: ['name'], linksToSourceRecord: true },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.', path: ['email'] },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.', path: ['phone'] },
  { id: 'customerAddress', label: 'Address', fieldType: 'text', source: 'Customers master data', description: 'Primary address from the linked customer record.', path: ['address'] },
  { id: 'customerIndustry', label: 'Industry', fieldType: 'text', source: 'Customers master data', description: 'Industry captured on the linked customer record.', path: ['industry'] },
  { id: 'customerUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal owner user identifier from the linked customer record.', path: ['userId'] },
  { id: 'customerSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal subsidiary identifier from the linked customer record.', path: ['subsidiaryId'] },
  { id: 'customerCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal currency identifier from the linked customer record.', path: ['currencyId'] },
  { id: 'customerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Customers master data', description: 'Indicates whether the linked customer is inactive.', path: ['inactive'] },
  { id: 'customerCreatedAt', label: 'Created', fieldType: 'date', source: 'Customers master data', description: 'Date/time the linked customer record was created.', path: ['createdAt'] },
  { id: 'customerUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Customers master data', description: 'Date/time the linked customer record was last modified.', path: ['updatedAt'] },
]

export const VENDOR_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'vendorDbId', label: 'DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal database identifier for the linked vendor record.', path: ['id'] },
  { id: 'vendorNumber', label: 'Vendor #', fieldType: 'text', source: 'Vendors master data', description: 'Internal vendor identifier from the linked vendor record.', path: ['vendorNumber'], linksToSourceRecord: true },
  { id: 'vendorName', label: 'Vendor Name', fieldType: 'text', source: 'Vendors master data', description: 'Display name from the linked vendor record.', path: ['name'], linksToSourceRecord: true },
  { id: 'vendorEmail', label: 'Email', fieldType: 'email', source: 'Vendors master data', description: 'Primary vendor email address.', path: ['email'] },
  { id: 'vendorPhone', label: 'Phone', fieldType: 'text', source: 'Vendors master data', description: 'Primary vendor phone number.', path: ['phone'] },
  { id: 'vendorAddress', label: 'Address', fieldType: 'text', source: 'Vendors master data', description: 'Primary address from the linked vendor record.', path: ['address'] },
  { id: 'vendorTaxId', label: 'Tax Id', fieldType: 'text', source: 'Vendors master data', description: 'Tax identifier from the linked vendor record.', path: ['taxId'] },
  { id: 'vendorUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal owner user identifier from the linked vendor record.', path: ['userId'] },
  { id: 'vendorSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal subsidiary identifier from the linked vendor record.', path: ['subsidiaryId'] },
  { id: 'vendorCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal currency identifier from the linked vendor record.', path: ['currencyId'] },
  { id: 'vendorInactive', label: 'Inactive', fieldType: 'boolean', source: 'Vendors master data', description: 'Indicates whether the linked vendor is inactive.', path: ['inactive'] },
  { id: 'vendorCreatedAt', label: 'Created', fieldType: 'date', source: 'Vendors master data', description: 'Date/time the linked vendor record was created.', path: ['createdAt'] },
  { id: 'vendorUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Vendors master data', description: 'Date/time the linked vendor record was last modified.', path: ['updatedAt'] },
]

export const CONTACT_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'contactDbId', label: 'DB Id', fieldType: 'text', source: 'Contacts master data', description: 'Internal database identifier for the linked contact.', path: ['id'] },
  { id: 'contactNumber', label: 'Contact #', fieldType: 'text', source: 'Contacts master data', description: 'Internal contact identifier from the linked contact record.', path: ['contactNumber'], linksToSourceRecord: true },
  { id: 'contactFirstName', label: 'First Name', fieldType: 'text', source: 'Contacts master data', description: 'First name from the linked contact record.', path: ['firstName'] },
  { id: 'contactLastName', label: 'Last Name', fieldType: 'text', source: 'Contacts master data', description: 'Last name from the linked contact record.', path: ['lastName'] },
  { id: 'contactName', label: 'Contact Name', fieldType: 'text', source: 'Contacts master data', description: 'Display name from the linked contact record.', path: ['firstName'], linksToSourceRecord: true },
  { id: 'contactEmail', label: 'Email', fieldType: 'email', source: 'Contacts master data', description: 'Primary contact email address.', path: ['email'] },
  { id: 'contactPhone', label: 'Phone', fieldType: 'text', source: 'Contacts master data', description: 'Primary contact phone number.', path: ['phone'] },
  { id: 'contactAddress', label: 'Address', fieldType: 'text', source: 'Contacts master data', description: 'Address from the linked contact record.', path: ['address'] },
  { id: 'contactPosition', label: 'Position', fieldType: 'text', source: 'Contacts master data', description: 'Position from the linked contact record.', path: ['position'] },
  { id: 'contactIsPrimaryForCustomer', label: 'Primary For Customer', fieldType: 'boolean', source: 'Contacts master data', description: 'Whether the linked contact is primary for the customer.', path: ['isPrimaryForCustomer'] },
  { id: 'contactReceivesQuotesSalesOrders', label: 'Receives Quotes / Sales Orders', fieldType: 'boolean', source: 'Contacts master data', description: 'Whether the linked contact receives quotes and sales orders.', path: ['receivesQuotesSalesOrders'] },
  { id: 'contactReceivesInvoices', label: 'Receives Invoices', fieldType: 'boolean', source: 'Contacts master data', description: 'Whether the linked contact receives invoices.', path: ['receivesInvoices'] },
  { id: 'contactReceivesInvoiceCc', label: 'Receives Invoice CC', fieldType: 'boolean', source: 'Contacts master data', description: 'Whether the linked contact receives invoice CC copies.', path: ['receivesInvoiceCc'] },
  { id: 'contactActive', label: 'Active', fieldType: 'boolean', source: 'Contacts master data', description: 'Whether the linked contact is active.', path: ['active'] },
  { id: 'contactCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Contacts master data', description: 'Internal customer identifier from the linked contact record.', path: ['customerId'] },
  { id: 'contactVendorDbId', label: 'Vendor DB Id', fieldType: 'text', source: 'Contacts master data', description: 'Internal vendor identifier from the linked contact record.', path: ['vendorId'] },
  { id: 'contactUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Contacts master data', description: 'Internal owner user identifier from the linked contact record.', path: ['userId'] },
  { id: 'contactCreatedAt', label: 'Created', fieldType: 'date', source: 'Contacts master data', description: 'Date/time the linked contact record was created.', path: ['createdAt'] },
  { id: 'contactUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Contacts master data', description: 'Date/time the linked contact record was last modified.', path: ['updatedAt'] },
]

export const USER_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'ownerDbId', label: 'DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal database identifier for the linked user.', path: ['id'] },
  { id: 'ownerUserId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'Internal user identifier from the linked user record.', path: ['userId'], linksToSourceRecord: true },
  { id: 'ownerEmail', label: 'Email', fieldType: 'email', source: 'Users master data', description: 'Email address from the linked user record.', path: ['email'] },
  { id: 'ownerName', label: 'Name', fieldType: 'text', source: 'Users master data', description: 'Display name from the linked user record.', path: ['name'], linksToSourceRecord: true },
  { id: 'ownerRoleDbId', label: 'Role DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal role identifier from the linked user record.', path: ['roleId'] },
  { id: 'ownerDepartmentDbId', label: 'Department DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal department identifier from the linked user record.', path: ['departmentId'] },
  { id: 'ownerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Users master data', description: 'Indicates whether the linked user is inactive.', path: ['inactive'] },
  { id: 'ownerLocked', label: 'Locked', fieldType: 'boolean', source: 'Users master data', description: 'Indicates whether the linked user is locked.', path: ['locked'] },
  { id: 'ownerLockedAt', label: 'Locked At', fieldType: 'date', source: 'Users master data', description: 'Timestamp when the linked user was locked.', path: ['lockedAt'] },
  { id: 'ownerLastLoginAt', label: 'Last Login', fieldType: 'date', source: 'Users master data', description: 'Last login timestamp for the linked user.', path: ['lastLoginAt'] },
  { id: 'ownerPasswordChangedAt', label: 'Password Changed', fieldType: 'date', source: 'Users master data', description: 'Password change timestamp for the linked user.', path: ['passwordChangedAt'] },
  { id: 'ownerMustChangePassword', label: 'Must Change Password', fieldType: 'boolean', source: 'Users master data', description: 'Whether the linked user must change password.', path: ['mustChangePassword'] },
  { id: 'ownerFailedLoginAttempts', label: 'Failed Login Attempts', fieldType: 'number', source: 'Users master data', description: 'Failed login attempt count for the linked user.', path: ['failedLoginAttempts'] },
  { id: 'ownerDefaultSubsidiaryDbId', label: 'Default Subsidiary DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal default subsidiary identifier from the linked user.', path: ['defaultSubsidiaryId'] },
  { id: 'ownerIncludeChildren', label: 'Include Children', fieldType: 'boolean', source: 'Users master data', description: 'Whether child subsidiaries are included by default.', path: ['includeChildren'] },
  { id: 'ownerApprovalLimit', label: 'Approval Limit', fieldType: 'currency', source: 'Users master data', description: 'Approval limit from the linked user record.', path: ['approvalLimit'] },
  { id: 'ownerApprovalCurrencyDbId', label: 'Approval Currency DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal approval currency identifier from the linked user.', path: ['approvalCurrencyId'] },
  { id: 'ownerDelegatedApproverDbId', label: 'Delegated Approver DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal delegated approver user identifier.', path: ['delegatedApproverUserId'] },
  { id: 'ownerDelegationStartDate', label: 'Delegation Start', fieldType: 'date', source: 'Users master data', description: 'Delegation start date for the linked user.', path: ['delegationStartDate'] },
  { id: 'ownerDelegationEndDate', label: 'Delegation End', fieldType: 'date', source: 'Users master data', description: 'Delegation end date for the linked user.', path: ['delegationEndDate'] },
  { id: 'ownerCreatedAt', label: 'Created', fieldType: 'date', source: 'Users master data', description: 'Date/time the linked user record was created.', path: ['createdAt'] },
  { id: 'ownerUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Users master data', description: 'Date/time the linked user record was last modified.', path: ['updatedAt'] },
]

export const OPPORTUNITY_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'opportunityDbId', label: 'DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal database identifier for the linked opportunity.', path: ['id'] },
  { id: 'opportunityNumber', label: 'Opportunity #', fieldType: 'text', source: 'Opportunities', description: 'Identifier for the linked opportunity.', path: ['opportunityNumber'], linksToSourceRecord: true },
  { id: 'opportunityName', label: 'Opportunity Name', fieldType: 'text', source: 'Opportunities', description: 'Display name from the linked opportunity.', path: ['name'], linksToSourceRecord: true },
  { id: 'opportunityAmount', label: 'Amount', fieldType: 'currency', source: 'Opportunities', description: 'Amount from the linked opportunity.', path: ['amount'] },
  { id: 'opportunityStage', label: 'Stage', fieldType: 'list', source: 'Opportunities', description: 'Stage from the linked opportunity.', path: ['stage'] },
  { id: 'opportunityCloseDate', label: 'Close Date', fieldType: 'date', source: 'Opportunities', description: 'Close date from the linked opportunity.', path: ['closeDate'] },
  { id: 'opportunityProbability', label: 'Probability', fieldType: 'number', source: 'Opportunities', description: 'Probability from the linked opportunity.', path: ['probability'] },
  { id: 'opportunityCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal customer identifier from the linked opportunity.', path: ['customerId'] },
  { id: 'opportunityUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal user identifier from the linked opportunity.', path: ['userId'] },
  { id: 'opportunitySubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal subsidiary identifier from the linked opportunity.', path: ['subsidiaryId'] },
  { id: 'opportunityCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal currency identifier from the linked opportunity.', path: ['currencyId'] },
  { id: 'opportunityInactive', label: 'Inactive', fieldType: 'boolean', source: 'Opportunities', description: 'Indicates whether the linked opportunity is inactive.', path: ['inactive'] },
  { id: 'opportunityCreatedAt', label: 'Created', fieldType: 'date', source: 'Opportunities', description: 'Date/time the linked opportunity record was created.', path: ['createdAt'] },
  { id: 'opportunityUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Opportunities', description: 'Date/time the linked opportunity record was last modified.', path: ['updatedAt'] },
]

export const QUOTE_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'quoteDbId', label: 'DB Id', fieldType: 'text', source: 'Quote transaction', description: 'Internal database identifier for the linked quote.', path: ['id'] },
  { id: 'quoteNumber', label: 'Quote #', fieldType: 'text', source: 'Quote transaction', description: 'Identifier for the linked quote.', path: ['number'], linksToSourceRecord: true },
  { id: 'quoteStatus', label: 'Status', fieldType: 'list', source: 'Quote transaction', description: 'Status from the linked quote.', path: ['status'] },
  { id: 'quoteTotal', label: 'Total', fieldType: 'currency', source: 'Quote transaction', description: 'Total from the linked quote.', path: ['total'] },
  { id: 'quoteValidUntil', label: 'Valid Until', fieldType: 'date', source: 'Quote transaction', description: 'Valid-until date from the linked quote.', path: ['validUntil'] },
  { id: 'quoteNotes', label: 'Notes', fieldType: 'text', source: 'Quote transaction', description: 'Notes from the linked quote.', path: ['notes'] },
  { id: 'quoteCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Quote transaction', description: 'Internal customer identifier from the linked quote.', path: ['customerId'] },
  { id: 'quoteUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Quote transaction', description: 'Internal user identifier from the linked quote.', path: ['userId'] },
  { id: 'quoteOpportunityDbId', label: 'Opportunity DB Id', fieldType: 'text', source: 'Quote transaction', description: 'Internal opportunity identifier from the linked quote.', path: ['opportunityId'] },
  { id: 'quoteSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Quote transaction', description: 'Internal subsidiary identifier from the linked quote.', path: ['subsidiaryId'] },
  { id: 'quoteCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Quote transaction', description: 'Internal currency identifier from the linked quote.', path: ['currencyId'] },
  { id: 'quoteCreatedAt', label: 'Created', fieldType: 'date', source: 'Quote transaction', description: 'Date/time the linked quote record was created.', path: ['createdAt'] },
  { id: 'quoteUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Quote transaction', description: 'Date/time the linked quote record was last modified.', path: ['updatedAt'] },
]

export const SUBSIDIARY_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'subsidiaryDbId', label: 'DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal database identifier for the linked subsidiary.', path: ['id'] },
  { id: 'subsidiaryNumber', label: 'Subsidiary #', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal subsidiary identifier.', path: ['subsidiaryId'], linksToSourceRecord: true },
  { id: 'subsidiaryName', label: 'Subsidiary Name', fieldType: 'text', source: 'Subsidiaries master data', description: 'Display name from the linked subsidiary.', path: ['name'], linksToSourceRecord: true },
  { id: 'subsidiaryLegalName', label: 'Legal Name', fieldType: 'text', source: 'Subsidiaries master data', description: 'Legal name from the linked subsidiary.', path: ['legalName'] },
  { id: 'subsidiaryEntityType', label: 'Entity Type', fieldType: 'text', source: 'Subsidiaries master data', description: 'Entity type from the linked subsidiary.', path: ['entityType'] },
  { id: 'subsidiaryCountry', label: 'Country', fieldType: 'text', source: 'Subsidiaries master data', description: 'Country from the linked subsidiary.', path: ['country'] },
  { id: 'subsidiaryAddress', label: 'Address', fieldType: 'text', source: 'Subsidiaries master data', description: 'Address from the linked subsidiary.', path: ['address'] },
  { id: 'subsidiaryTaxId', label: 'Tax Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Tax id from the linked subsidiary.', path: ['taxId'] },
  { id: 'subsidiaryRegistrationNumber', label: 'Registration Number', fieldType: 'text', source: 'Subsidiaries master data', description: 'Registration number from the linked subsidiary.', path: ['registrationNumber'] },
  { id: 'subsidiaryParentDbId', label: 'Parent Subsidiary DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Parent subsidiary identifier from the linked subsidiary.', path: ['parentSubsidiaryId'] },
  { id: 'subsidiaryLocalCurrencyDbId', label: 'Local Currency DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Local currency identifier from the linked subsidiary.', path: ['localCurrencyId'] },
  { id: 'subsidiaryFunctionalCurrencyDbId', label: 'Functional Currency DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Functional currency identifier from the linked subsidiary.', path: ['functionalCurrencyId'] },
  { id: 'subsidiaryGroupCurrencyDbId', label: 'Group Currency DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Group currency identifier from the linked subsidiary.', path: ['groupCurrencyId'] },
  { id: 'subsidiaryFiscalCalendarDbId', label: 'Fiscal Calendar DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Fiscal calendar identifier from the linked subsidiary.', path: ['fiscalCalendarId'] },
  { id: 'subsidiaryConsolidationMethod', label: 'Consolidation Method', fieldType: 'text', source: 'Subsidiaries master data', description: 'Consolidation method from the linked subsidiary.', path: ['consolidationMethod'] },
  { id: 'subsidiaryOwnershipPercent', label: 'Ownership %', fieldType: 'number', source: 'Subsidiaries master data', description: 'Ownership percentage from the linked subsidiary.', path: ['ownershipPercent'] },
  { id: 'subsidiaryRetainedEarningsAccountDbId', label: 'Retained Earnings Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Retained earnings account identifier from the linked subsidiary.', path: ['retainedEarningsAccountId'] },
  { id: 'subsidiaryCtaAccountDbId', label: 'CTA Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'CTA account identifier from the linked subsidiary.', path: ['ctaAccountId'] },
  { id: 'subsidiaryIntercompanyClearingAccountDbId', label: 'Intercompany Clearing Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Intercompany clearing account identifier from the linked subsidiary.', path: ['intercompanyClearingAccountId'] },
  { id: 'subsidiaryDueToAccountDbId', label: 'Due To Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Due-to account identifier from the linked subsidiary.', path: ['dueToAccountId'] },
  { id: 'subsidiaryDueFromAccountDbId', label: 'Due From Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Due-from account identifier from the linked subsidiary.', path: ['dueFromAccountId'] },
  { id: 'subsidiaryPeriodLockDate', label: 'Period Lock Date', fieldType: 'date', source: 'Subsidiaries master data', description: 'Period lock date from the linked subsidiary.', path: ['periodLockDate'] },
  { id: 'subsidiaryActive', label: 'Active', fieldType: 'boolean', source: 'Subsidiaries master data', description: 'Active flag from the linked subsidiary.', path: ['active'] },
  { id: 'subsidiaryCreatedAt', label: 'Created', fieldType: 'date', source: 'Subsidiaries master data', description: 'Date/time the linked subsidiary record was created.', path: ['createdAt'] },
  { id: 'subsidiaryUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Subsidiaries master data', description: 'Date/time the linked subsidiary record was last modified.', path: ['updatedAt'] },
]

export const CURRENCY_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'currencyDbId', label: 'DB Id', fieldType: 'text', source: 'Currencies master data', description: 'Internal database identifier for the linked currency.', path: ['id'] },
  { id: 'currencyNumber', label: 'Currency Id', fieldType: 'text', source: 'Currencies master data', description: 'Internal currency identifier.', path: ['currencyId'], linksToSourceRecord: true },
  { id: 'currencyCode', label: 'Currency Code', fieldType: 'text', source: 'Currencies master data', description: 'Currency code from the linked currency.', path: ['code'], linksToSourceRecord: true },
  { id: 'currencyName', label: 'Currency Name', fieldType: 'text', source: 'Currencies master data', description: 'Display name from the linked currency.', path: ['name'], linksToSourceRecord: true },
  { id: 'currencySymbol', label: 'Symbol', fieldType: 'text', source: 'Currencies master data', description: 'Currency symbol from the linked currency.', path: ['symbol'] },
  { id: 'currencyDecimals', label: 'Decimals', fieldType: 'number', source: 'Currencies master data', description: 'Decimal precision from the linked currency.', path: ['decimals'] },
  { id: 'currencyIsBase', label: 'Is Base', fieldType: 'boolean', source: 'Currencies master data', description: 'Whether the linked currency is the base currency.', path: ['isBase'] },
  { id: 'currencyActive', label: 'Active', fieldType: 'boolean', source: 'Currencies master data', description: 'Whether the linked currency is active.', path: ['active'] },
  { id: 'currencyCreatedAt', label: 'Created', fieldType: 'date', source: 'Currencies master data', description: 'Date/time the linked currency record was created.', path: ['createdAt'] },
  { id: 'currencyUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Currencies master data', description: 'Date/time the linked currency record was last modified.', path: ['updatedAt'] },
]

export const PURCHASE_ORDER_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'purchaseOrderDbId', label: 'DB Id', fieldType: 'text', source: 'Purchase order transaction', description: 'Internal database identifier for the linked purchase order.', path: ['id'] },
  { id: 'purchaseOrderNumber', label: 'Purchase Order #', fieldType: 'text', source: 'Purchase order transaction', description: 'Identifier for the linked purchase order.', path: ['number'], linksToSourceRecord: true },
  { id: 'purchaseOrderStatus', label: 'Status', fieldType: 'list', source: 'Purchase order transaction', description: 'Status from the linked purchase order.', path: ['status'] },
  { id: 'purchaseOrderTotal', label: 'Total', fieldType: 'currency', source: 'Purchase order transaction', description: 'Total from the linked purchase order.', path: ['total'] },
  { id: 'purchaseOrderVendorDbId', label: 'Vendor DB Id', fieldType: 'text', source: 'Purchase order transaction', description: 'Internal vendor identifier from the linked purchase order.', path: ['vendorId'] },
  { id: 'purchaseOrderUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Purchase order transaction', description: 'Internal creator/owner user identifier from the linked purchase order.', path: ['userId'] },
  { id: 'purchaseOrderRequisitionDbId', label: 'Purchase Requisition DB Id', fieldType: 'text', source: 'Purchase order transaction', description: 'Internal requisition identifier linked to the purchase order.', path: ['requisitionId'] },
  { id: 'purchaseOrderSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Purchase order transaction', description: 'Internal subsidiary identifier from the linked purchase order.', path: ['subsidiaryId'] },
  { id: 'purchaseOrderCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Purchase order transaction', description: 'Internal currency identifier from the linked purchase order.', path: ['currencyId'] },
  { id: 'purchaseOrderCreatedAt', label: 'Created', fieldType: 'date', source: 'Purchase order transaction', description: 'Date/time the linked purchase order was created.', path: ['createdAt'] },
  { id: 'purchaseOrderUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Purchase order transaction', description: 'Date/time the linked purchase order was last modified.', path: ['updatedAt'] },
]

export const BILL_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'billDbId', label: 'DB Id', fieldType: 'text', source: 'Bill transaction', description: 'Internal database identifier for the linked bill.', path: ['id'] },
  { id: 'billNumber', label: 'Bill #', fieldType: 'text', source: 'Bill transaction', description: 'Identifier for the linked bill.', path: ['number'], linksToSourceRecord: true },
  { id: 'billStatus', label: 'Status', fieldType: 'list', source: 'Bill transaction', description: 'Status from the linked bill.', path: ['status'] },
  { id: 'billTotal', label: 'Total', fieldType: 'currency', source: 'Bill transaction', description: 'Total from the linked bill.', path: ['total'] },
  { id: 'billDate', label: 'Bill Date', fieldType: 'date', source: 'Bill transaction', description: 'Bill date from the linked bill.', path: ['date'] },
  { id: 'billDueDate', label: 'Due Date', fieldType: 'date', source: 'Bill transaction', description: 'Due date from the linked bill.', path: ['dueDate'] },
  { id: 'billNotes', label: 'Notes', fieldType: 'text', source: 'Bill transaction', description: 'Notes from the linked bill.', path: ['notes'] },
  { id: 'billOcrData', label: 'OCR Data', fieldType: 'text', source: 'Bill transaction', description: 'OCR payload stored on the linked bill.', path: ['ocrData'] },
  { id: 'billVendorDbId', label: 'Vendor DB Id', fieldType: 'text', source: 'Bill transaction', description: 'Internal vendor identifier from the linked bill.', path: ['vendorId'] },
  { id: 'billPurchaseOrderDbId', label: 'Purchase Order DB Id', fieldType: 'text', source: 'Bill transaction', description: 'Internal purchase order identifier from the linked bill.', path: ['purchaseOrderId'] },
  { id: 'billUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Bill transaction', description: 'Internal user identifier from the linked bill.', path: ['userId'] },
  { id: 'billSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Bill transaction', description: 'Internal subsidiary identifier from the linked bill.', path: ['subsidiaryId'] },
  { id: 'billCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Bill transaction', description: 'Internal currency identifier from the linked bill.', path: ['currencyId'] },
  { id: 'billCreatedAt', label: 'Created', fieldType: 'date', source: 'Bill transaction', description: 'Date/time the linked bill was created.', path: ['createdAt'] },
  { id: 'billUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Bill transaction', description: 'Date/time the linked bill was last modified.', path: ['updatedAt'] },
]

export const SALES_ORDER_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'salesOrderDbId', label: 'DB Id', fieldType: 'text', source: 'Sales order transaction', description: 'Internal database identifier for the linked sales order.', path: ['id'] },
  { id: 'salesOrderNumber', label: 'Sales Order #', fieldType: 'text', source: 'Sales order transaction', description: 'Linked sales order identifier.', path: ['number'], linksToSourceRecord: true },
  { id: 'salesOrderStatus', label: 'Status', fieldType: 'list', source: 'Sales order transaction', description: 'Status from the linked sales order.', path: ['status'] },
  { id: 'salesOrderTotal', label: 'Total', fieldType: 'currency', source: 'Sales order transaction', description: 'Total from the linked sales order.', path: ['total'] },
  { id: 'salesOrderCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Sales order transaction', description: 'Internal customer identifier from the linked sales order.', path: ['customerId'] },
  { id: 'salesOrderUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Sales order transaction', description: 'Internal user identifier from the linked sales order.', path: ['userId'] },
  { id: 'salesOrderQuoteDbId', label: 'Quote DB Id', fieldType: 'text', source: 'Sales order transaction', description: 'Internal quote identifier from the linked sales order.', path: ['quoteId'] },
  { id: 'salesOrderSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Sales order transaction', description: 'Internal subsidiary identifier from the linked sales order.', path: ['subsidiaryId'] },
  { id: 'salesOrderCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Sales order transaction', description: 'Internal currency identifier from the linked sales order.', path: ['currencyId'] },
  { id: 'salesOrderCreatedAt', label: 'Created', fieldType: 'date', source: 'Sales order transaction', description: 'Date/time the linked sales order record was created.', path: ['createdAt'] },
  { id: 'salesOrderUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Sales order transaction', description: 'Date/time the linked sales order record was last modified.', path: ['updatedAt'] },
]

export const INVOICE_FULL_REFERENCE_FIELDS: LinkedRecordFieldCatalogEntry[] = [
  { id: 'invoiceDbId', label: 'DB Id', fieldType: 'text', source: 'Invoice transaction', description: 'Internal database identifier for the linked invoice.', path: ['id'] },
  { id: 'invoiceNumber', label: 'Invoice #', fieldType: 'text', source: 'Invoice transaction', description: 'Linked invoice identifier.', path: ['number'], linksToSourceRecord: true },
  { id: 'invoiceStatus', label: 'Status', fieldType: 'list', source: 'Invoice transaction', description: 'Status from the linked invoice.', path: ['status'] },
  { id: 'invoiceTotal', label: 'Total', fieldType: 'currency', source: 'Invoice transaction', description: 'Total from the linked invoice.', path: ['total'] },
  { id: 'invoiceDueDate', label: 'Due Date', fieldType: 'date', source: 'Invoice transaction', description: 'Due date from the linked invoice.', path: ['dueDate'] },
  { id: 'invoicePaidDate', label: 'Paid Date', fieldType: 'date', source: 'Invoice transaction', description: 'Paid date from the linked invoice.', path: ['paidDate'] },
  { id: 'invoiceCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Invoice transaction', description: 'Internal customer identifier from the linked invoice.', path: ['customerId'] },
  { id: 'invoiceSalesOrderDbId', label: 'Sales Order DB Id', fieldType: 'text', source: 'Invoice transaction', description: 'Internal sales order identifier from the linked invoice.', path: ['salesOrderId'] },
  { id: 'invoiceUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Invoice transaction', description: 'Internal user identifier from the linked invoice.', path: ['userId'] },
  { id: 'invoiceSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Invoice transaction', description: 'Internal subsidiary identifier from the linked invoice.', path: ['subsidiaryId'] },
  { id: 'invoiceCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Invoice transaction', description: 'Internal currency identifier from the linked invoice.', path: ['currencyId'] },
  { id: 'invoiceCreatedAt', label: 'Created', fieldType: 'date', source: 'Invoice transaction', description: 'Date/time the linked invoice record was created.', path: ['createdAt'] },
  { id: 'invoiceUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Invoice transaction', description: 'Date/time the linked invoice record was last modified.', path: ['updatedAt'] },
]
