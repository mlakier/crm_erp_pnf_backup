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
  PURCHASE_ORDER_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  CURRENCY_FULL_REFERENCE_FIELDS,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'
import {
  buildDefaultCurrencyReadoutFieldCustomizations,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
} from '@/lib/four-currency-readout'

export type BillDetailFieldKey =
  | 'id'
  | 'number'
  | 'vendorBillNumber'
  | 'vendorBillDate'
  | 'vendorId'
  | 'purchaseOrderId'
  | 'userId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'total'
  | 'date'
  | 'dueDate'
  | 'status'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
  | CurrencyReadoutFieldKey

export type BillDetailFieldMeta = {
  id: BillDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type BillDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type BillLineColumnKey =
  | 'line'
  | 'line-type'
  | 'item-id'
  | 'expense-account'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'
  | 'notes'

export type BillLineFontSize = 'xs' | 'sm'

export type BillLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type BillLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type BillLineDropdownSortMode = 'id' | 'label'
export type BillLineShowColumnMode = 'always' | 'itemOnly' | 'expenseOnly'

export type BillLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: BillLineWidthMode
  showColumnMode: BillLineShowColumnMode
  editDisplay: BillLineDisplayMode
  viewDisplay: BillLineDisplayMode
  dropdownDisplay: BillLineDisplayMode
  dropdownSort: BillLineDropdownSortMode
}

export type BillLineSettings = {
  fontSize: BillLineFontSize
}

export type BillStatCardKey = 'total' | 'status' | 'date' | 'purchaseOrder'

export type BillDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<BillDetailFieldKey, BillDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: BillLineSettings
  lineColumns: Record<BillLineColumnKey, BillLineColumnCustomization>
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards?: Array<TransactionStatCardSlot<BillStatCardKey>>
}

export const BILL_STAT_CARDS: Array<{ id: BillStatCardKey; label: string }> = [
  { id: 'total', label: 'Total' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Bill Date' },
  { id: 'purchaseOrder', label: 'Purchase Order' },
]

export const BILL_LINE_COLUMNS: Array<{ id: BillLineColumnKey; label: string; description?: string }> = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the bill.' },
  { id: 'line-type', label: 'Line Type', description: 'Controls whether the bill line is item-driven or expense-account driven.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the bill line.' },
  { id: 'expense-account', label: 'Expense Account', description: 'Posting expense account for expense-type bill lines.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Billed quantity for the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Price per unit for the bill line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
  { id: 'notes', label: 'Notes', description: 'Bill line notes.' },
]

export const BILL_DETAIL_FIELDS: BillDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for this bill.' },
  { id: 'number', label: 'Business Id', fieldType: 'text', description: 'Internal operational identifier for this bill.' },
  { id: 'vendorBillNumber', label: 'Vendor Bill Number', fieldType: 'text', description: 'Vendor-provided invoice or bill reference number.' },
  { id: 'vendorBillDate', label: 'Vendor Bill Date', fieldType: 'date', description: 'Vendor-provided invoice or bill date from the source document.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', source: 'Vendors master data', description: 'Vendor linked to this bill.' },
  { id: 'purchaseOrderId', label: 'Purchase Order', fieldType: 'list', source: 'Purchase order transaction', description: 'Source purchase order for this bill.' },
  { id: 'userId', label: 'Created By', fieldType: 'list', source: 'Users master data', description: 'User who created this bill.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns this bill.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for this bill.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Current bill total based on line items.' },
  { id: 'date', label: 'Bill Date', fieldType: 'date', description: 'Date of the bill.' },
  { id: 'dueDate', label: 'Due Date', fieldType: 'date', description: 'Payment due date.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'Bill status list', description: 'Status of this bill.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Free-form notes for this bill.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the bill record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the bill record was last modified.' },
  ...CURRENCY_READOUT_CUSTOMIZE_FIELDS,
]

export const BILL_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'purchaseOrder',
    label: 'Purchase Order',
    linkedFieldLabel: 'Purchase Order',
    description: 'Expand the linked purchase order context for this bill.',
    fields: PURCHASE_ORDER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['purchaseOrderNumber', 'purchaseOrderStatus', 'purchaseOrderTotal'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the creating user context for this bill.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['userNumber', 'userName', 'userEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary context for this bill.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency context for this bill.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 2,
  },
]

export function defaultBillDetailCustomization(): BillDetailCustomizationConfig {
  return {
    formColumns: 2,
    sections: [CURRENCY_READOUT_SECTION_TITLE, 'Document Identity', 'Workflow & Timing', 'Sourcing & Financials', 'Record Keys', 'System Dates'],
    sectionRows: {
      [CURRENCY_READOUT_SECTION_TITLE]: 4,
      'Document Identity': 2,
      'Workflow & Timing': 2,
      'Sourcing & Financials': 2,
      'Record Keys': 1,
      'System Dates': 1,
    },
    fields: {
      id: { visible: true, section: 'Record Keys', order: 0, column: 1 },
      number: { visible: true, section: 'Document Identity', order: 0, column: 1 },
      vendorBillNumber: { visible: true, section: 'Document Identity', order: 0, column: 2 },
      vendorBillDate: { visible: true, section: 'Document Identity', order: 1, column: 1 },
      vendorId: { visible: true, section: 'Document Identity', order: 2, column: 1 },
      purchaseOrderId: { visible: true, section: 'Document Identity', order: 2, column: 2 },
      userId: { visible: true, section: 'Record Keys', order: 0, column: 2 },
      subsidiaryId: { visible: true, section: 'Sourcing & Financials', order: 0, column: 1 },
      currencyId: { visible: true, section: 'Sourcing & Financials', order: 0, column: 2 },
      total: { visible: true, section: 'Sourcing & Financials', order: 1, column: 1 },
      date: { visible: true, section: 'Workflow & Timing', order: 0, column: 1 },
      dueDate: { visible: true, section: 'Workflow & Timing', order: 0, column: 2 },
      status: { visible: true, section: 'Workflow & Timing', order: 1, column: 1 },
      notes: { visible: true, section: 'Sourcing & Financials', order: 2, column: 1 },
      createdAt: { visible: true, section: 'System Dates', order: 0, column: 1 },
      updatedAt: { visible: true, section: 'System Dates', order: 0, column: 2 },
      ...buildDefaultCurrencyReadoutFieldCustomizations(),
    },
    lineSettings: {
      fontSize: 'sm',
    },
    lineColumns: Object.fromEntries(
      BILL_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode:
            column.id === 'line' ? 'compact' : column.id === 'description' || column.id === 'notes' || column.id === 'expense-account' ? 'wide' : 'normal',
          showColumnMode:
            column.id === 'item-id'
              ? 'itemOnly'
              : column.id === 'expense-account'
                ? 'expenseOnly'
                : 'always',
          editDisplay: column.id === 'item-id' ? 'id' : column.id === 'expense-account' ? 'idAndLabel' : 'label',
          viewDisplay: column.id === 'item-id' ? 'id' : column.id === 'expense-account' ? 'idAndLabel' : 'label',
          dropdownDisplay: column.id === 'item-id' || column.id === 'expense-account' ? 'idAndLabel' : 'label',
          dropdownSort: column.id === 'item-id' || column.id === 'expense-account' ? 'id' : 'label',
        },
      ]),
    ) as Record<BillLineColumnKey, BillLineColumnCustomization>,
    referenceLayouts: [buildDefaultTransactionReferenceLayout(BILL_REFERENCE_SOURCES, 'purchaseOrder')],
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: [
      { id: 'bill-total', metric: 'total', visible: true, order: 0 },
      { id: 'bill-status', metric: 'status', visible: true, order: 1 },
      { id: 'bill-date', metric: 'date', visible: true, order: 2 },
      { id: 'bill-po', metric: 'purchaseOrder', visible: true, order: 3 },
    ],
  }
}
