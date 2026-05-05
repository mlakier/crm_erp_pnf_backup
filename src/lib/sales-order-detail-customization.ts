import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'

export type SalesOrderDetailFieldKey =
  | 'id'
  | 'customerId'
  | 'number'
  | 'userId'
  | 'quoteId'
  | 'createdBy'
  | 'createdFrom'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'total'
  | 'createdAt'
  | 'updatedAt'

export type SalesOrderReferenceSourceKey =
  | 'customer'
  | 'quote'
  | 'opportunity'
  | 'owner'
  | 'subsidiary'
  | 'currency'

export type SalesOrderReferenceFieldKey = string

export type SalesOrderLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'fulfilled-qty'
  | 'open-qty'
  | 'unit-price'
  | 'line-total'

export type SalesOrderLineFontSize = 'xs' | 'sm'

export type SalesOrderLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type SalesOrderLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type SalesOrderLineDropdownSortMode = 'id' | 'label'

export type SalesOrderStatCardKey =
  | 'total'
  | 'createdFrom'
  | 'lineCount'
  | 'status'
  | 'customerId'
  | 'userId'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'createdAt'
  | 'updatedAt'
  | 'dbId'

export type SalesOrderDetailFieldMeta = {
  id: SalesOrderDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type SalesOrderReferenceFieldMeta = {
  id: SalesOrderReferenceFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type SalesOrderReferenceSourceMeta = {
  id: SalesOrderReferenceSourceKey
  label: string
  linkedFieldLabel: string
  description: string
  fields: SalesOrderReferenceFieldMeta[]
  defaultVisibleFieldIds: SalesOrderReferenceFieldKey[]
  defaultColumns?: number
  defaultRows?: number
}

export type SalesOrderLineColumnMeta = {
  id: SalesOrderLineColumnKey
  label: string
  description?: string
}

export type SalesOrderDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type SalesOrderReferenceFieldCustomization = {
  visible: boolean
  order: number
  column: number
}

export type SalesOrderReferenceLayout = {
  id: string
  referenceId: SalesOrderReferenceSourceKey
  formColumns: number
  rows: number
  fields: Partial<Record<SalesOrderReferenceFieldKey, SalesOrderReferenceFieldCustomization>>
}

export type SalesOrderLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: SalesOrderLineWidthMode
  editDisplay: SalesOrderLineDisplayMode
  viewDisplay: SalesOrderLineDisplayMode
  dropdownDisplay: SalesOrderLineDisplayMode
  dropdownSort: SalesOrderLineDropdownSortMode
}

export type SalesOrderLineSettings = {
  fontSize: SalesOrderLineFontSize
}

export type SalesOrderStatCardSlot = TransactionStatCardSlot<SalesOrderStatCardKey>

export type SalesOrderDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<SalesOrderDetailFieldKey, SalesOrderDetailFieldCustomization>
  referenceLayouts: SalesOrderReferenceLayout[]
  lineSettings: SalesOrderLineSettings
  lineColumns: Record<SalesOrderLineColumnKey, SalesOrderLineColumnCustomization>
  statCards: SalesOrderStatCardSlot[]
}

export const SALES_ORDER_DETAIL_FIELDS: SalesOrderDetailFieldMeta[] = [
  {
    id: 'id',
    label: 'DB Id',
    fieldType: 'text',
    description: 'Internal database identifier for the sales order record.',
  },
  {
    id: 'customerId',
    label: 'Customer Id',
    fieldType: 'text',
    source: 'Customers master data',
    description: 'Customer identifier linked to this sales order.',
  },
  {
    id: 'number',
    label: 'Sales Order #',
    fieldType: 'text',
    description: 'Unique sales order number used across OTC workflows.',
  },
  {
    id: 'userId',
    label: 'User Id',
    fieldType: 'text',
    source: 'Users master data',
    description: 'User identifier for the creator/owner of the sales order.',
  },
  {
    id: 'quoteId',
    label: 'Quote Id',
    fieldType: 'text',
    source: 'Source transaction',
    description: 'Quote identifier linked to this sales order.',
  },
  {
    id: 'createdBy',
    label: 'Created By',
    fieldType: 'text',
    source: 'Users master data',
    description: 'User who created the sales order.',
  },
  {
    id: 'createdFrom',
    label: 'Created From',
    fieldType: 'text',
    source: 'Source transaction',
    description: 'Source transaction that created this sales order.',
  },
  {
    id: 'opportunityId',
    label: 'Opportunity Id',
    fieldType: 'text',
    source: 'Opportunities',
    description: 'Opportunity identifier linked through the source quote.',
  },
  {
    id: 'subsidiaryId',
    label: 'Subsidiary',
    fieldType: 'list',
    source: 'Subsidiaries master data',
    description: 'Subsidiary that owns the sales order.',
  },
  {
    id: 'currencyId',
    label: 'Currency',
    fieldType: 'list',
    source: 'Currencies master data',
    description: 'Transaction currency for the sales order.',
  },
  {
    id: 'status',
    label: 'Status',
    fieldType: 'list',
    source: 'System sales order statuses',
    description: 'Current lifecycle stage of the sales order.',
  },
  {
    id: 'total',
    label: 'Total',
    fieldType: 'currency',
    description: 'Document total based on all sales order line amounts.',
  },
  {
    id: 'createdAt',
    label: 'Created',
    fieldType: 'date',
    description: 'Date/time the sales order record was created.',
  },
  {
    id: 'updatedAt',
    label: 'Last Modified',
    fieldType: 'date',
    description: 'Date/time the sales order record was last modified.',
  },
]

const CUSTOMER_REFERENCE_FIELDS: SalesOrderReferenceFieldMeta[] = [
  { id: 'customerDbId', label: 'DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal database identifier for the linked customer record.' },
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked customer record.' },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.' },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.' },
  { id: 'customerAddress', label: 'Billing Address', fieldType: 'text', source: 'Customers master data', description: 'Main billing address from the linked customer record.' },
  { id: 'customerIndustry', label: 'Industry', fieldType: 'list', source: 'Customers master data', description: 'Customer industry or segment classification.' },
  { id: 'customerUserDbId', label: 'Owner User DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal user record linked to the customer.' },
  { id: 'customerSubsidiaryDbId', label: 'Primary Subsidiary DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal subsidiary record linked to the customer.' },
  { id: 'customerPrimarySubsidiary', label: 'Primary Subsidiary', fieldType: 'list', source: 'Customers master data', description: 'Default subsidiary context from the linked customer record.' },
  { id: 'customerCurrencyDbId', label: 'Primary Currency DB Id', fieldType: 'text', source: 'Customers master data', description: 'Internal currency record linked to the customer.' },
  { id: 'customerPrimaryCurrency', label: 'Primary Currency', fieldType: 'list', source: 'Customers master data', description: 'Default transaction currency from the linked customer record.' },
  { id: 'customerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Customers master data', description: 'Indicates whether the linked customer is inactive for new activity.' },
  { id: 'customerCreatedAt', label: 'Created', fieldType: 'date', source: 'Customers master data', description: 'Date/time the linked customer record was created.' },
  { id: 'customerUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Customers master data', description: 'Date/time the linked customer record was last modified.' },
]

const QUOTE_REFERENCE_FIELDS: SalesOrderReferenceFieldMeta[] = [
  { id: 'quoteDbId', label: 'DB Id', fieldType: 'text', source: 'Source transaction', description: 'Internal database identifier for the linked quote.' },
  { id: 'quoteNumber', label: 'Quote Id', fieldType: 'text', source: 'Source transaction', description: 'Quote number linked to this sales order.' },
  { id: 'quoteStatus', label: 'Quote Status', fieldType: 'list', source: 'Quote status list', description: 'Current status of the linked quote.' },
  { id: 'quoteTotal', label: 'Quote Total', fieldType: 'currency', source: 'Source transaction', description: 'Current total on the linked quote.' },
  { id: 'quoteValidUntil', label: 'Valid Until', fieldType: 'date', source: 'Source transaction', description: 'Expiration date on the linked quote.' },
  { id: 'quoteNotes', label: 'Notes', fieldType: 'text', source: 'Source transaction', description: 'Internal notes captured on the linked quote.' },
  { id: 'quoteCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Source transaction', description: 'Internal customer record linked to the quote.' },
  { id: 'quoteUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Source transaction', description: 'Internal owner user record linked to the quote.' },
  { id: 'quoteOpportunityDbId', label: 'Opportunity DB Id', fieldType: 'text', source: 'Source transaction', description: 'Internal opportunity record linked to the quote.' },
  { id: 'quoteSubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Source transaction', description: 'Internal subsidiary record linked to the quote.' },
  { id: 'quoteCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Source transaction', description: 'Internal currency record linked to the quote.' },
  { id: 'quoteCreatedAt', label: 'Created', fieldType: 'date', source: 'Source transaction', description: 'Date/time the linked quote record was created.' },
  { id: 'quoteUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Source transaction', description: 'Date/time the linked quote record was last modified.' },
]

const OPPORTUNITY_REFERENCE_FIELDS: SalesOrderReferenceFieldMeta[] = [
  { id: 'opportunityDbId', label: 'DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal database identifier for the linked opportunity.' },
  { id: 'opportunityNumber', label: 'Opportunity Id', fieldType: 'text', source: 'Opportunities', description: 'Identifier for the linked opportunity.' },
  { id: 'opportunityName', label: 'Opportunity Name', fieldType: 'text', source: 'Opportunities', description: 'Display name from the linked opportunity.' },
  { id: 'opportunityAmount', label: 'Amount', fieldType: 'currency', source: 'Opportunities', description: 'Opportunity amount captured on the linked opportunity.' },
  { id: 'opportunityStage', label: 'Stage', fieldType: 'list', source: 'Opportunity stages', description: 'Current sales stage of the linked opportunity.' },
  { id: 'opportunityCloseDate', label: 'Close Date', fieldType: 'date', source: 'Opportunities', description: 'Expected close date for the linked opportunity.' },
  { id: 'opportunityProbability', label: 'Probability', fieldType: 'number', source: 'Opportunities', description: 'Win probability captured on the linked opportunity.' },
  { id: 'opportunityExpectedValue', label: 'Expected Value', fieldType: 'currency', source: 'Opportunities', description: 'Expected value captured on the linked opportunity.' },
  { id: 'opportunityCustomerDbId', label: 'Customer DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal customer record linked to the opportunity.' },
  { id: 'opportunityUserDbId', label: 'User DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal owner user record linked to the opportunity.' },
  { id: 'opportunitySubsidiaryDbId', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal subsidiary record linked to the opportunity.' },
  { id: 'opportunityCurrencyDbId', label: 'Currency DB Id', fieldType: 'text', source: 'Opportunities', description: 'Internal currency record linked to the opportunity.' },
  { id: 'opportunityInactive', label: 'Inactive', fieldType: 'boolean', source: 'Opportunities', description: 'Indicates whether the linked opportunity is inactive.' },
  { id: 'opportunityCreatedAt', label: 'Created', fieldType: 'date', source: 'Opportunities', description: 'Date/time the linked opportunity record was created.' },
  { id: 'opportunityUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Opportunities', description: 'Date/time the linked opportunity record was last modified.' },
]

const OWNER_REFERENCE_FIELDS: SalesOrderReferenceFieldMeta[] = [
  { id: 'ownerDbId', label: 'DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal database identifier for the linked user.' },
  { id: 'ownerUserId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'User identifier for the record owner/creator.' },
  { id: 'ownerName', label: 'Name', fieldType: 'text', source: 'Users master data', description: 'Display name for the linked user.' },
  { id: 'ownerEmail', label: 'Email', fieldType: 'email', source: 'Users master data', description: 'Email address for the linked user.' },
  { id: 'ownerRoleDbId', label: 'Role DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal role record linked to the user.' },
  { id: 'ownerDepartmentDbId', label: 'Department DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal department record linked to the user.' },
  { id: 'ownerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Users master data', description: 'Indicates whether the linked user is inactive.' },
  { id: 'ownerLocked', label: 'Locked', fieldType: 'boolean', source: 'Users master data', description: 'Indicates whether the linked user account is locked.' },
  { id: 'ownerLockedAt', label: 'Locked At', fieldType: 'date', source: 'Users master data', description: 'Timestamp when the linked user account was locked.' },
  { id: 'ownerLastLoginAt', label: 'Last Login', fieldType: 'date', source: 'Users master data', description: 'Timestamp of the linked user’s last login.' },
  { id: 'ownerPasswordChangedAt', label: 'Password Changed', fieldType: 'date', source: 'Users master data', description: 'Timestamp when the linked user last changed password.' },
  { id: 'ownerMustChangePassword', label: 'Must Change Password', fieldType: 'boolean', source: 'Users master data', description: 'Indicates whether the linked user must change password at next login.' },
  { id: 'ownerFailedLoginAttempts', label: 'Failed Login Attempts', fieldType: 'number', source: 'Users master data', description: 'Current failed login attempt count for the linked user.' },
  { id: 'ownerDefaultSubsidiaryDbId', label: 'Default Subsidiary DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal default subsidiary linked to the user.' },
  { id: 'ownerIncludeChildren', label: 'Include Children', fieldType: 'boolean', source: 'Users master data', description: 'Indicates whether the user includes child subsidiaries by default.' },
  { id: 'ownerApprovalLimit', label: 'Approval Limit', fieldType: 'currency', source: 'Users master data', description: 'Approval limit captured on the linked user.' },
  { id: 'ownerApprovalCurrencyDbId', label: 'Approval Currency DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal approval currency linked to the user.' },
  { id: 'ownerDelegatedApproverDbId', label: 'Delegated Approver DB Id', fieldType: 'text', source: 'Users master data', description: 'Internal delegated approver user linked to the user.' },
  { id: 'ownerDelegationStartDate', label: 'Delegation Start', fieldType: 'date', source: 'Users master data', description: 'Delegation start date on the linked user.' },
  { id: 'ownerDelegationEndDate', label: 'Delegation End', fieldType: 'date', source: 'Users master data', description: 'Delegation end date on the linked user.' },
  { id: 'ownerCreatedAt', label: 'Created', fieldType: 'date', source: 'Users master data', description: 'Date/time the linked user record was created.' },
  { id: 'ownerUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Users master data', description: 'Date/time the linked user record was last modified.' },
]

const SUBSIDIARY_REFERENCE_FIELDS: SalesOrderReferenceFieldMeta[] = [
  { id: 'subsidiaryDbId', label: 'DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal database identifier for the linked subsidiary.' },
  { id: 'subsidiaryCode', label: 'Subsidiary Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Identifier for the linked subsidiary.' },
  { id: 'subsidiaryName', label: 'Subsidiary Name', fieldType: 'text', source: 'Subsidiaries master data', description: 'Display name for the linked subsidiary.' },
  { id: 'subsidiaryLegalName', label: 'Legal Name', fieldType: 'text', source: 'Subsidiaries master data', description: 'Legal entity name for the linked subsidiary.' },
  { id: 'subsidiaryEntityType', label: 'Entity Type', fieldType: 'text', source: 'Subsidiaries master data', description: 'Entity type captured on the linked subsidiary.' },
  { id: 'subsidiaryCountry', label: 'Country', fieldType: 'text', source: 'Subsidiaries master data', description: 'Country captured on the linked subsidiary.' },
  { id: 'subsidiaryAddress', label: 'Address', fieldType: 'text', source: 'Subsidiaries master data', description: 'Address captured on the linked subsidiary.' },
  { id: 'subsidiaryTaxId', label: 'Tax Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Tax identifier for the linked subsidiary.' },
  { id: 'subsidiaryRegistrationNumber', label: 'Registration Number', fieldType: 'text', source: 'Subsidiaries master data', description: 'Registration number for the linked subsidiary.' },
  { id: 'subsidiaryParentDbId', label: 'Parent Subsidiary DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal parent subsidiary linked to this subsidiary.' },
  { id: 'subsidiaryLocalCurrencyDbId', label: 'Local Currency DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal local currency linked to the subsidiary.' },
  { id: 'subsidiaryFunctionalCurrencyDbId', label: 'Functional Currency DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal functional currency linked to the subsidiary.' },
  { id: 'subsidiaryGroupCurrencyDbId', label: 'Group Currency DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal group currency linked to the subsidiary.' },
  { id: 'subsidiaryFiscalCalendarDbId', label: 'Fiscal Calendar DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal fiscal calendar linked to the subsidiary.' },
  { id: 'subsidiaryConsolidationMethod', label: 'Consolidation Method', fieldType: 'text', source: 'Subsidiaries master data', description: 'Consolidation method captured on the linked subsidiary.' },
  { id: 'subsidiaryOwnershipPercent', label: 'Ownership %', fieldType: 'number', source: 'Subsidiaries master data', description: 'Ownership percentage captured on the linked subsidiary.' },
  { id: 'subsidiaryRetainedEarningsAccountDbId', label: 'Retained Earnings Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal retained earnings account linked to the subsidiary.' },
  { id: 'subsidiaryCtaAccountDbId', label: 'CTA Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal CTA account linked to the subsidiary.' },
  { id: 'subsidiaryIntercompanyClearingAccountDbId', label: 'Intercompany Clearing Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal intercompany clearing account linked to the subsidiary.' },
  { id: 'subsidiaryDueToAccountDbId', label: 'Due To Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal due-to account linked to the subsidiary.' },
  { id: 'subsidiaryDueFromAccountDbId', label: 'Due From Account DB Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal due-from account linked to the subsidiary.' },
  { id: 'subsidiaryPeriodLockDate', label: 'Period Lock Date', fieldType: 'date', source: 'Subsidiaries master data', description: 'Period lock date on the linked subsidiary.' },
  { id: 'subsidiaryActive', label: 'Active', fieldType: 'boolean', source: 'Subsidiaries master data', description: 'Indicates whether the linked subsidiary is active.' },
  { id: 'subsidiaryCreatedAt', label: 'Created', fieldType: 'date', source: 'Subsidiaries master data', description: 'Date/time the linked subsidiary record was created.' },
  { id: 'subsidiaryUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Subsidiaries master data', description: 'Date/time the linked subsidiary record was last modified.' },
]

const CURRENCY_REFERENCE_FIELDS: SalesOrderReferenceFieldMeta[] = [
  { id: 'currencyDbId', label: 'DB Id', fieldType: 'text', source: 'Currencies master data', description: 'Internal database identifier for the linked currency.' },
  { id: 'currencyCode', label: 'Currency Code', fieldType: 'text', source: 'Currencies master data', description: 'Transaction currency code from the linked currency record.' },
  { id: 'currencyNumber', label: 'Currency Id', fieldType: 'text', source: 'Currencies master data', description: 'Internal currency identifier from the linked currency record.' },
  { id: 'currencyName', label: 'Currency Name', fieldType: 'text', source: 'Currencies master data', description: 'Display name from the linked currency record.' },
  { id: 'currencySymbol', label: 'Symbol', fieldType: 'text', source: 'Currencies master data', description: 'Display symbol for the linked currency.' },
  { id: 'currencyDecimals', label: 'Decimals', fieldType: 'number', source: 'Currencies master data', description: 'Decimal precision configured for the linked currency.' },
  { id: 'currencyIsBase', label: 'Is Base', fieldType: 'boolean', source: 'Currencies master data', description: 'Indicates whether the linked currency is the base currency.' },
  { id: 'currencyActive', label: 'Active', fieldType: 'boolean', source: 'Currencies master data', description: 'Indicates whether the linked currency is active.' },
  { id: 'currencyCreatedAt', label: 'Created', fieldType: 'date', source: 'Currencies master data', description: 'Date/time the linked currency record was created.' },
  { id: 'currencyUpdatedAt', label: 'Last Modified', fieldType: 'date', source: 'Currencies master data', description: 'Date/time the linked currency record was last modified.' },
]

export const SALES_ORDER_REFERENCE_SOURCES: SalesOrderReferenceSourceMeta[] = [
  {
    id: 'customer',
    label: 'Customer',
    linkedFieldLabel: 'Customer Id',
    description: 'Expand customer context from the linked customer on this sales order.',
    fields: CUSTOMER_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['customerName', 'customerEmail', 'customerPhone', 'customerNumber'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'quote',
    label: 'Quote',
    linkedFieldLabel: 'Quote Id',
    description: 'Expand context from the linked source quote.',
    fields: QUOTE_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['quoteNumber', 'quoteStatus', 'quoteTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'opportunity',
    label: 'Opportunity',
    linkedFieldLabel: 'Opportunity Id',
    description: 'Expand selling context from the linked opportunity.',
    fields: OPPORTUNITY_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['opportunityNumber', 'opportunityName', 'opportunityStage', 'opportunityExpectedValue'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'User Id',
    description: 'Expand the linked user record for the sales order owner/creator.',
    fields: OWNER_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for the sales order.',
    fields: SUBSIDIARY_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryCode', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for the sales order.',
    fields: CURRENCY_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
]

export const SALES_ORDER_STAT_CARDS: Array<{ id: SalesOrderStatCardKey; label: string }> = [
  { id: 'total', label: 'Sales Order Total' },
  { id: 'createdFrom', label: 'Created From' },
  { id: 'lineCount', label: 'Sales Order Lines' },
  { id: 'status', label: 'Status' },
  { id: 'customerId', label: 'Customer Id' },
  { id: 'userId', label: 'User Id' },
  { id: 'quoteId', label: 'Quote Id' },
  { id: 'opportunityId', label: 'Opportunity Id' },
  { id: 'subsidiaryId', label: 'Subsidiary Id' },
  { id: 'currencyId', label: 'Currency Id' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Last Modified' },
  { id: 'dbId', label: 'DB Id' },
]

export const SALES_ORDER_LINE_COLUMNS: SalesOrderLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the sales order.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the sales order line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Ordered quantity for the line item.' },
  { id: 'fulfilled-qty', label: 'Fulfilled Qty', description: 'Fulfilled quantity associated with the line item.' },
  { id: 'open-qty', label: 'Open Qty', description: 'Remaining open quantity not yet fulfilled.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
]

export const DEFAULT_SALES_ORDER_DETAIL_SECTIONS = [
  'Document Identity',
  'Source Context',
  'Commercial Terms',
  'Record Keys',
  'System Dates',
] as const

export const DEFAULT_SALES_ORDER_STAT_CARD_METRICS: SalesOrderStatCardKey[] = [
  'total',
  'createdFrom',
  'lineCount',
  'status',
]

const DEFAULT_SALES_ORDER_LINE_WIDTHS: Record<SalesOrderLineColumnKey, SalesOrderLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  quantity: 'compact',
  'fulfilled-qty': 'compact',
  'open-qty': 'compact',
  'unit-price': 'normal',
  'line-total': 'normal',
}

const DEFAULT_SALES_ORDER_LINE_EDIT_DISPLAY: Record<SalesOrderLineColumnKey, SalesOrderLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  quantity: 'label',
  'fulfilled-qty': 'label',
  'open-qty': 'label',
  'unit-price': 'label',
  'line-total': 'label',
}

const DEFAULT_SALES_ORDER_LINE_VIEW_DISPLAY: Record<SalesOrderLineColumnKey, SalesOrderLineDisplayMode> = {
  ...DEFAULT_SALES_ORDER_LINE_EDIT_DISPLAY,
}

const DEFAULT_SALES_ORDER_LINE_DROPDOWN_DISPLAY: Record<SalesOrderLineColumnKey, SalesOrderLineDisplayMode> = {
  ...DEFAULT_SALES_ORDER_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_SALES_ORDER_LINE_DROPDOWN_SORT: Record<SalesOrderLineColumnKey, SalesOrderLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  quantity: 'id',
  'fulfilled-qty': 'id',
  'open-qty': 'id',
  'unit-price': 'id',
  'line-total': 'id',
}

export function buildDefaultSalesOrderReferenceLayout(
  referenceId: SalesOrderReferenceSourceKey,
  slotId = `reference-${referenceId}-1`,
): SalesOrderReferenceLayout {
  const source = SALES_ORDER_REFERENCE_SOURCES.find((entry) => entry.id === referenceId) ?? SALES_ORDER_REFERENCE_SOURCES[0]
  const formColumns = Math.min(4, Math.max(1, source.defaultColumns ?? 2))
  const rows = Math.max(1, source.defaultRows ?? 2)

  return {
    id: slotId,
    referenceId: source.id,
    formColumns,
    rows,
    fields: Object.fromEntries(
      source.fields.map((field, index) => {
        const column = (index % formColumns) + 1
        const order = Math.floor(index / formColumns)
        return [
          field.id,
          {
            visible: source.defaultVisibleFieldIds.includes(field.id),
            column,
            order,
          },
        ]
      }),
    ) as Partial<Record<SalesOrderReferenceFieldKey, SalesOrderReferenceFieldCustomization>>,
  }
}

export function defaultSalesOrderDetailCustomization(): SalesOrderDetailCustomizationConfig {
  const sectionMap: Record<SalesOrderDetailFieldKey, string> = {
    id: 'Record Keys',
    customerId: 'Document Identity',
    userId: 'Record Keys',
    quoteId: 'Source Context',
    number: 'Document Identity',
    createdBy: 'Document Identity',
    createdFrom: 'Source Context',
    opportunityId: 'Source Context',
    subsidiaryId: 'Commercial Terms',
    currencyId: 'Commercial Terms',
    status: 'Commercial Terms',
    total: 'Commercial Terms',
    createdAt: 'System Dates',
    updatedAt: 'System Dates',
  }

  const columnMap: Record<SalesOrderDetailFieldKey, number> = {
    id: 1,
    customerId: 2,
    userId: 1,
    quoteId: 2,
    number: 1,
    createdBy: 3,
    createdFrom: 1,
    opportunityId: 3,
    subsidiaryId: 1,
    currencyId: 2,
    status: 3,
    total: 1,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<SalesOrderDetailFieldKey, number> = {
    id: 0,
    customerId: 0,
    userId: 0,
    quoteId: 0,
    number: 0,
    createdBy: 0,
    createdFrom: 0,
    opportunityId: 0,
    subsidiaryId: 0,
    currencyId: 0,
    status: 0,
    total: 1,
    createdAt: 0,
    updatedAt: 0,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_SALES_ORDER_DETAIL_SECTIONS],
    sectionRows: {
      'Document Identity': 1,
      'Source Context': 1,
      'Commercial Terms': 2,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: Object.fromEntries(
      SALES_ORDER_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<SalesOrderDetailFieldKey, SalesOrderDetailFieldCustomization>,
    referenceLayouts: [buildDefaultSalesOrderReferenceLayout('customer')],
    lineSettings: {
      fontSize: 'sm',
    },
    lineColumns: Object.fromEntries(
      SALES_ORDER_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_SALES_ORDER_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_SALES_ORDER_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_SALES_ORDER_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_SALES_ORDER_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_SALES_ORDER_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as Record<SalesOrderLineColumnKey, SalesOrderLineColumnCustomization>,
    statCards: DEFAULT_SALES_ORDER_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
