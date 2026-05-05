import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'
import {
  buildDefaultTransactionReferenceLayout,
  type TransactionReferenceLayout,
} from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactColumns,
  defaultTransactionGlImpactSettings,
  type TransactionGlImpactColumnCustomization,
  type TransactionGlImpactColumnKey,
  type TransactionGlImpactSettings,
} from '@/lib/transaction-gl-impact'
import {
  type LinkedRecordReferenceSource,
  CUSTOMER_FULL_REFERENCE_FIELDS,
  CURRENCY_FULL_REFERENCE_FIELDS,
  SALES_ORDER_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'
import {
  buildDefaultCurrencyReadoutFieldCustomizations,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_FIELD_KEYS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
} from '@/lib/four-currency-readout'

export type InvoiceDetailFieldKey =
  | 'customerName'
  | 'customerNumber'
  | 'customerEmail'
  | 'customerPhone'
  | 'customerAddress'
  | 'customerPrimarySubsidiary'
  | 'customerPrimaryCurrency'
  | 'customerInactive'
  | 'id'
  | 'customerId'
  | 'salesOrderId'
  | 'userId'
  | 'number'
  | 'createdBy'
  | 'createdFrom'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'status'
  | 'total'
  | 'dueDate'
  | 'paidDate'
  | 'createdAt'
  | 'updatedAt'
  | CurrencyReadoutFieldKey

export type InvoiceLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'
  | 'notes'
  | 'department'
  | 'location'
  | 'project'
  | 'service-start'
  | 'service-end'
  | 'rev-rec-template'
  | 'performance-obligation-code'
  | 'ssp'
  | 'allocated-amount'

export type InvoiceLineFontSize = 'xs' | 'sm'

export type InvoiceLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type InvoiceLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type InvoiceLineDropdownSortMode = 'id' | 'label'

export type InvoiceDetailFieldMeta = {
  id: InvoiceDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type InvoiceDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type InvoiceLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: InvoiceLineWidthMode
  editDisplay: InvoiceLineDisplayMode
  viewDisplay: InvoiceLineDisplayMode
  dropdownDisplay: InvoiceLineDisplayMode
  dropdownSort: InvoiceLineDropdownSortMode
}

export type InvoiceLineSettings = {
  fontSize: InvoiceLineFontSize
}

export type InvoiceStatCardKey =
  | 'total'
  | 'status'
  | 'dueDate'
  | 'paidDate'
  | 'customerId'
  | 'salesOrderId'
  | 'userId'
  | 'quoteId'
  | 'opportunityId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'createdAt'
  | 'updatedAt'
  | 'dbId'

export type InvoiceStatCardSlot = TransactionStatCardSlot<InvoiceStatCardKey>

export type InvoiceDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<InvoiceDetailFieldKey, InvoiceDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: InvoiceLineSettings
  lineColumns: Record<InvoiceLineColumnKey, InvoiceLineColumnCustomization>
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards: InvoiceStatCardSlot[]
}

export const INVOICE_DETAIL_FIELDS: InvoiceDetailFieldMeta[] = [
  { id: 'customerName', label: 'Customer Name', fieldType: 'text', source: 'Customers master data', description: 'Display name from the linked customer record.' },
  { id: 'customerNumber', label: 'Customer #', fieldType: 'text', source: 'Customers master data', description: 'Internal customer identifier from the linked customer record.' },
  { id: 'customerEmail', label: 'Email', fieldType: 'email', source: 'Customers master data', description: 'Primary customer email address.' },
  { id: 'customerPhone', label: 'Phone', fieldType: 'text', source: 'Customers master data', description: 'Primary customer phone number.' },
  { id: 'customerAddress', label: 'Billing Address', fieldType: 'text', source: 'Customers master data', description: 'Main billing address from the linked customer record.' },
  { id: 'customerPrimarySubsidiary', label: 'Primary Subsidiary', fieldType: 'list', source: 'Customers master data', description: 'Default subsidiary context from the linked customer record.' },
  { id: 'customerPrimaryCurrency', label: 'Primary Currency', fieldType: 'list', source: 'Customers master data', description: 'Default transaction currency from the linked customer record.' },
  { id: 'customerInactive', label: 'Inactive', fieldType: 'boolean', source: 'Customers master data', description: 'Indicates whether the linked customer is inactive for new activity.' },
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for the invoice record.' },
  { id: 'customerId', label: 'Customer Id', fieldType: 'text', source: 'Customers master data', description: 'Customer identifier linked to this invoice.' },
  { id: 'salesOrderId', label: 'Sales Order Id', fieldType: 'text', source: 'Source transaction', description: 'Sales order identifier linked to this invoice.' },
  { id: 'userId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'User identifier for the invoice creator/owner.' },
  { id: 'number', label: 'Invoice #', fieldType: 'text', description: 'Unique invoice number used across OTC workflows.' },
  { id: 'createdBy', label: 'Created By', fieldType: 'text', source: 'Users master data', description: 'User who created the invoice.' },
  { id: 'createdFrom', label: 'Created From', fieldType: 'text', source: 'Source transaction', description: 'Source sales order that created this invoice.' },
  { id: 'quoteId', label: 'Quote Id', fieldType: 'text', source: 'Source transaction', description: 'Quote identifier linked through the sales order.' },
  { id: 'opportunityId', label: 'Opportunity Id', fieldType: 'text', source: 'Opportunities', description: 'Opportunity identifier linked through the source quote.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns the invoice.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for the invoice.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'System invoice statuses', description: 'Current lifecycle stage of the invoice.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Document total based on all invoice line amounts.' },
  { id: 'dueDate', label: 'Due Date', fieldType: 'date', description: 'Date payment is due.' },
  { id: 'paidDate', label: 'Paid Date', fieldType: 'date', description: 'Date payment was completed.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the invoice record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the invoice record was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

export const INVOICE_LINE_COLUMNS: Array<{ id: InvoiceLineColumnKey; label: string; description?: string }> = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the invoice.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the invoice line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Invoiced quantity for the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Invoiced price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
  { id: 'notes', label: 'Notes', description: 'Invoice line notes.' },
  { id: 'department', label: 'Department', description: 'Department coding on the invoice line.' },
  { id: 'location', label: 'Location', description: 'Location coding on the invoice line.' },
  { id: 'project', label: 'Project', description: 'Project coding on the invoice line.' },
  { id: 'service-start', label: 'Service Start', description: 'Service period start date for the invoice line.' },
  { id: 'service-end', label: 'Service End', description: 'Service period end date for the invoice line.' },
  { id: 'rev-rec-template', label: 'Rev Rec Template', description: 'Revenue recognition template on the invoice line.' },
  { id: 'performance-obligation-code', label: 'Performance Obligation Code', description: 'Performance obligation code for the invoice line.' },
  { id: 'ssp', label: 'Standalone Selling Price', description: 'Standalone selling price on the invoice line.' },
  { id: 'allocated-amount', label: 'Allocated Amount', description: 'Allocated revenue amount on the invoice line.' },
]

export const DEFAULT_INVOICE_DETAIL_SECTIONS = [
  CURRENCY_READOUT_SECTION_TITLE,
  'Document Identity',
  'Customer Snapshot',
  'Source Context',
  'Financial Terms',
  'Record Keys',
  'System Dates',
] as const

export const INVOICE_STAT_CARDS: Array<{ id: InvoiceStatCardKey; label: string }> = [
  { id: 'total', label: 'Invoice Total' },
  { id: 'status', label: 'Status' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'paidDate', label: 'Paid Date' },
  { id: 'customerId', label: 'Customer Id' },
  { id: 'salesOrderId', label: 'Sales Order Id' },
  { id: 'userId', label: 'User Id' },
  { id: 'quoteId', label: 'Quote Id' },
  { id: 'opportunityId', label: 'Opportunity Id' },
  { id: 'subsidiaryId', label: 'Subsidiary Id' },
  { id: 'currencyId', label: 'Currency Id' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Last Modified' },
  { id: 'dbId', label: 'DB Id' },
]

export const INVOICE_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'customer',
    label: 'Customer',
    linkedFieldLabel: 'Customer Id',
    description: 'Expand the linked customer record for this invoice.',
    fields: CUSTOMER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['customerNumber', 'customerName', 'customerEmail', 'customerPhone'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'salesOrder',
    label: 'Sales Order',
    linkedFieldLabel: 'Sales Order Id',
    description: 'Expand the linked sales order record for this invoice.',
    fields: SALES_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['salesOrderNumber', 'salesOrderStatus', 'salesOrderTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the linked owner user record for this invoice.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for this invoice.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 1,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for this invoice.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 1,
    defaultRows: 1,
  },
]

export const DEFAULT_INVOICE_STAT_CARD_METRICS: InvoiceStatCardKey[] = [
  'total',
  'status',
  'dueDate',
  'paidDate',
]

const DEFAULT_INVOICE_LINE_WIDTHS: Record<InvoiceLineColumnKey, InvoiceLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  quantity: 'compact',
  'unit-price': 'normal',
  'line-total': 'normal',
  notes: 'wide',
  department: 'wide',
  location: 'wide',
  project: 'wide',
  'service-start': 'normal',
  'service-end': 'normal',
  'rev-rec-template': 'wide',
  'performance-obligation-code': 'wide',
  ssp: 'normal',
  'allocated-amount': 'normal',
}

const DEFAULT_INVOICE_LINE_EDIT_DISPLAY: Record<InvoiceLineColumnKey, InvoiceLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  quantity: 'label',
  'unit-price': 'label',
  'line-total': 'label',
  notes: 'label',
  department: 'idAndLabel',
  location: 'idAndLabel',
  project: 'label',
  'service-start': 'label',
  'service-end': 'label',
  'rev-rec-template': 'idAndLabel',
  'performance-obligation-code': 'label',
  ssp: 'label',
  'allocated-amount': 'label',
}

const DEFAULT_INVOICE_LINE_VIEW_DISPLAY: Record<InvoiceLineColumnKey, InvoiceLineDisplayMode> = {
  ...DEFAULT_INVOICE_LINE_EDIT_DISPLAY,
}

const DEFAULT_INVOICE_LINE_DROPDOWN_DISPLAY: Record<InvoiceLineColumnKey, InvoiceLineDisplayMode> = {
  ...DEFAULT_INVOICE_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_INVOICE_LINE_DROPDOWN_SORT: Record<InvoiceLineColumnKey, InvoiceLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  quantity: 'id',
  'unit-price': 'id',
  'line-total': 'id',
  notes: 'label',
  department: 'label',
  location: 'label',
  project: 'label',
  'service-start': 'id',
  'service-end': 'id',
  'rev-rec-template': 'label',
  'performance-obligation-code': 'label',
  ssp: 'id',
  'allocated-amount': 'id',
}

export function defaultInvoiceDetailCustomization(): InvoiceDetailCustomizationConfig {
  const sectionMap: Record<Exclude<InvoiceDetailFieldKey, CurrencyReadoutFieldKey>, string> = {
    number: 'Document Identity',
    createdBy: 'Document Identity',
    customerId: 'Document Identity',
    customerNumber: 'Customer Snapshot',
    customerName: 'Customer Snapshot',
    customerEmail: 'Customer Snapshot',
    customerPhone: 'Customer Snapshot',
    customerAddress: 'Customer Snapshot',
    customerPrimarySubsidiary: 'Customer Snapshot',
    customerPrimaryCurrency: 'Customer Snapshot',
    customerInactive: 'Customer Snapshot',
    createdFrom: 'Source Context',
    salesOrderId: 'Source Context',
    quoteId: 'Source Context',
    opportunityId: 'Source Context',
    status: 'Financial Terms',
    subsidiaryId: 'Financial Terms',
    currencyId: 'Financial Terms',
    total: 'Financial Terms',
    dueDate: 'Financial Terms',
    paidDate: 'Financial Terms',
    id: 'Record Keys',
    userId: 'Record Keys',
    createdAt: 'System Dates',
    updatedAt: 'System Dates',
  }

  const columnMap: Record<Exclude<InvoiceDetailFieldKey, CurrencyReadoutFieldKey>, number> = {
    number: 1,
    createdBy: 2,
    customerId: 3,
    customerNumber: 1,
    customerName: 2,
    customerEmail: 3,
    customerPhone: 1,
    customerAddress: 2,
    customerPrimarySubsidiary: 1,
    customerPrimaryCurrency: 2,
    customerInactive: 3,
    createdFrom: 1,
    salesOrderId: 2,
    quoteId: 3,
    opportunityId: 1,
    status: 1,
    subsidiaryId: 2,
    currencyId: 3,
    total: 1,
    dueDate: 2,
    paidDate: 3,
    id: 1,
    userId: 2,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<Exclude<InvoiceDetailFieldKey, CurrencyReadoutFieldKey>, number> = {
    number: 0,
    createdBy: 0,
    customerId: 0,
    customerNumber: 0,
    customerName: 0,
    customerEmail: 0,
    customerPhone: 1,
    customerAddress: 1,
    customerPrimarySubsidiary: 2,
    customerPrimaryCurrency: 2,
    customerInactive: 2,
    createdFrom: 0,
    salesOrderId: 0,
    quoteId: 0,
    opportunityId: 1,
    status: 0,
    subsidiaryId: 0,
    currencyId: 0,
    total: 1,
    dueDate: 1,
    paidDate: 1,
    id: 0,
    userId: 0,
    createdAt: 0,
    updatedAt: 0,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_INVOICE_DETAIL_SECTIONS],
    sectionRows: {
      [CURRENCY_READOUT_SECTION_TITLE]: 4,
      'Document Identity': 1,
      'Customer Snapshot': 3,
      'Source Context': 2,
      'Financial Terms': 2,
      'Record Keys': 1,
      'System Dates': 1,
    },
    lineSettings: {
      fontSize: 'sm',
    },
    fields: Object.fromEntries(
      INVOICE_DETAIL_FIELDS.map((field) => [
        field.id,
        CURRENCY_READOUT_FIELD_KEYS.includes(field.id as CurrencyReadoutFieldKey)
          ? buildDefaultCurrencyReadoutFieldCustomizations()[field.id as CurrencyReadoutFieldKey]
          : {
              visible: field.id === 'customerAddress' || field.id === 'customerInactive' || field.id === 'paidDate' ? false : true,
              section: sectionMap[field.id as Exclude<InvoiceDetailFieldKey, CurrencyReadoutFieldKey>],
              order: rowMap[field.id as Exclude<InvoiceDetailFieldKey, CurrencyReadoutFieldKey>],
              column: columnMap[field.id as Exclude<InvoiceDetailFieldKey, CurrencyReadoutFieldKey>],
            },
      ]),
    ) as Record<InvoiceDetailFieldKey, InvoiceDetailFieldCustomization>,
    referenceLayouts: [buildDefaultTransactionReferenceLayout(INVOICE_REFERENCE_SOURCES, 'customer')],
    lineColumns: Object.fromEntries(
      INVOICE_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: ['notes', 'department', 'location', 'project', 'service-start', 'service-end', 'rev-rec-template', 'performance-obligation-code', 'ssp', 'allocated-amount'].includes(column.id)
            ? false
            : true,
          order: index,
          widthMode: DEFAULT_INVOICE_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_INVOICE_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_INVOICE_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_INVOICE_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_INVOICE_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as Record<InvoiceLineColumnKey, InvoiceLineColumnCustomization>,
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: DEFAULT_INVOICE_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
