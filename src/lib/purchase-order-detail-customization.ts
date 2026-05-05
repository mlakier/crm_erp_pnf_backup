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
  CURRENCY_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type PurchaseOrderDetailFieldKey =
  | 'id'
  | 'number'
  | 'userId'
  | 'vendorRecordId'
  | 'subsidiaryRecordId'
  | 'currencyRecordId'
  | 'requisitionRecordId'
  | 'createdBy'
  | 'createdFrom'
  | 'approvedBy'
  | 'status'
  | 'vendorId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'total'
  | 'createdAt'
  | 'updatedAt'

export type PurchaseOrderLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'received-qty'
  | 'open-qty'
  | 'billed-qty'
  | 'unit-price'
  | 'line-total'

export type PurchaseOrderLineFontSize = 'xs' | 'sm'
export type PurchaseOrderLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'
export type PurchaseOrderLineDisplayMode = 'label' | 'idAndLabel' | 'id'
export type PurchaseOrderLineDropdownSortMode = 'id' | 'label'

export type PurchaseOrderDetailFieldMeta = {
  id: PurchaseOrderDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type PurchaseOrderLineColumnMeta = {
  id: PurchaseOrderLineColumnKey
  label: string
  description?: string
}

export type PurchaseOrderDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type PurchaseOrderLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: PurchaseOrderLineWidthMode
  editDisplay: PurchaseOrderLineDisplayMode
  viewDisplay: PurchaseOrderLineDisplayMode
  dropdownDisplay: PurchaseOrderLineDisplayMode
  dropdownSort: PurchaseOrderLineDropdownSortMode
}

export type PurchaseOrderLineSettings = {
  fontSize: PurchaseOrderLineFontSize
}

export type PurchaseOrderStatCardKey = 'total' | 'lineCount' | 'receiptCount' | 'status'

export type PurchaseOrderStatCardSlot = TransactionStatCardSlot<PurchaseOrderStatCardKey>

export type PurchaseOrderDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<PurchaseOrderDetailFieldKey, PurchaseOrderDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: PurchaseOrderLineSettings
  lineColumns: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineColumnCustomization>
  glImpactSettings: TransactionGlImpactSettings
  glImpactColumns: Record<TransactionGlImpactColumnKey, TransactionGlImpactColumnCustomization>
  statCards: PurchaseOrderStatCardSlot[]
}

export const PURCHASE_ORDER_DETAIL_FIELDS: PurchaseOrderDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for the purchase order record.' },
  { id: 'number', label: 'Purchase Order Id', fieldType: 'text', description: 'Unique purchase order number used across procure-to-pay workflows.' },
  { id: 'userId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'Internal user identifier for the purchase order creator.' },
  { id: 'vendorRecordId', label: 'Vendor Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal vendor identifier linked to this purchase order.' },
  { id: 'subsidiaryRecordId', label: 'Subsidiary Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal subsidiary identifier linked to this purchase order.' },
  { id: 'currencyRecordId', label: 'Currency Id', fieldType: 'text', source: 'Currencies master data', description: 'Internal currency identifier linked to this purchase order.' },
  { id: 'requisitionRecordId', label: 'Requisition Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal requisition identifier linked as the source document.' },
  { id: 'createdBy', label: 'Created By', fieldType: 'text', source: 'Users master data', description: 'User who created the purchase order.' },
  { id: 'createdFrom', label: 'Created From', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Source purchase requisition that created this purchase order.' },
  { id: 'approvedBy', label: 'Approved By', fieldType: 'text', source: 'System Notes / activity history', description: 'User who approved the purchase order based on the approval activity trail.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'System purchase order statuses', description: 'Current lifecycle stage of the purchase order.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', source: 'Vendors master data', description: 'Vendor record linked to this purchase order.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns this purchase order.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for this purchase order.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Current document total based on all purchase order line amounts.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the purchase order record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the purchase order record was last modified.' },
]

export const PURCHASE_ORDER_LINE_COLUMNS: PurchaseOrderLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the purchase order.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the purchase order line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Ordered quantity for the line item.' },
  { id: 'received-qty', label: "Rec'd Qty", description: 'Received quantity associated with the line item.' },
  { id: 'open-qty', label: 'Open Qty', description: 'Remaining open quantity not yet received.' },
  { id: 'billed-qty', label: 'Billed Qty', description: 'Billed quantity associated with the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
]

export const PURCHASE_ORDER_STAT_CARDS: Array<{ id: PurchaseOrderStatCardKey; label: string }> = [
  { id: 'total', label: 'Purchase Order Total' },
  { id: 'lineCount', label: 'Line Items' },
  { id: 'receiptCount', label: 'Receipts' },
  { id: 'status', label: 'Status' },
]

const VENDOR_FULL_REFERENCE_FIELDS: LinkedRecordReferenceSource['fields'] = [
  { id: 'vendorDbId', label: 'DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal database identifier for the linked vendor.', path: ['id'] },
  { id: 'vendorNumberRef', label: 'Vendor #', fieldType: 'text', source: 'Vendors master data', description: 'Internal vendor identifier from the linked vendor record.', path: ['vendorNumber'] },
  { id: 'vendorNameRef', label: 'Vendor Name', fieldType: 'text', source: 'Vendors master data', description: 'Display name from the linked vendor record.', path: ['name'] },
  { id: 'vendorEmailRef', label: 'Email', fieldType: 'email', source: 'Vendors master data', description: 'Primary vendor email address.', path: ['email'] },
  { id: 'vendorPhoneRef', label: 'Phone', fieldType: 'text', source: 'Vendors master data', description: 'Primary vendor phone number.', path: ['phone'] },
  { id: 'vendorAddressRef', label: 'Address', fieldType: 'text', source: 'Vendors master data', description: 'Mailing or remittance address from the linked vendor.', path: ['address'] },
  { id: 'vendorTaxIdRef', label: 'Tax ID', fieldType: 'text', source: 'Vendors master data', description: 'Vendor tax registration or identification number.', path: ['taxId'] },
  { id: 'vendorSubsidiaryDbIdRef', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal subsidiary identifier from the linked vendor.', path: ['subsidiaryId'] },
  { id: 'vendorCurrencyDbIdRef', label: 'Currency DB Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal currency identifier from the linked vendor.', path: ['currencyId'] },
  { id: 'vendorInactiveRef', label: 'Inactive', fieldType: 'boolean', source: 'Vendors master data', description: 'Whether the linked vendor is inactive.', path: ['inactive'] },
  { id: 'vendorCreatedAtRef', label: 'Created', fieldType: 'date', source: 'Vendors master data', description: 'Date/time the linked vendor record was created.', path: ['createdAt'] },
  { id: 'vendorUpdatedAtRef', label: 'Last Modified', fieldType: 'date', source: 'Vendors master data', description: 'Date/time the linked vendor record was last modified.', path: ['updatedAt'] },
]

const PURCHASE_REQUISITION_FULL_REFERENCE_FIELDS: LinkedRecordReferenceSource['fields'] = [
  { id: 'requisitionDbIdRef', label: 'DB Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal database identifier for the linked purchase requisition.', path: ['id'] },
  { id: 'requisitionNumberRef', label: 'Purchase Requisition #', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Identifier for the linked purchase requisition.', path: ['number'] },
  { id: 'requisitionStatusRef', label: 'Status', fieldType: 'list', source: 'Purchase requisition transaction', description: 'Status from the linked purchase requisition.', path: ['status'] },
  { id: 'requisitionPriorityRef', label: 'Priority', fieldType: 'list', source: 'Purchase requisition transaction', description: 'Priority from the linked purchase requisition.', path: ['priority'] },
  { id: 'requisitionTitleRef', label: 'Title', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Title from the linked purchase requisition.', path: ['title'] },
  { id: 'requisitionDescriptionRef', label: 'Description', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Description from the linked purchase requisition.', path: ['description'] },
  { id: 'requisitionNeededByRef', label: 'Needed By', fieldType: 'date', source: 'Purchase requisition transaction', description: 'Needed-by date from the linked purchase requisition.', path: ['neededByDate'] },
  { id: 'requisitionTotalRef', label: 'Total', fieldType: 'currency', source: 'Purchase requisition transaction', description: 'Total from the linked purchase requisition.', path: ['total'] },
  { id: 'requisitionUserDbIdRef', label: 'User DB Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal user identifier from the linked purchase requisition.', path: ['userId'] },
  { id: 'requisitionVendorDbIdRef', label: 'Vendor DB Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal vendor identifier from the linked purchase requisition.', path: ['vendorId'] },
  { id: 'requisitionDepartmentDbIdRef', label: 'Department DB Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal department identifier from the linked purchase requisition.', path: ['departmentId'] },
  { id: 'requisitionSubsidiaryDbIdRef', label: 'Subsidiary DB Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal subsidiary identifier from the linked purchase requisition.', path: ['subsidiaryId'] },
  { id: 'requisitionCurrencyDbIdRef', label: 'Currency DB Id', fieldType: 'text', source: 'Purchase requisition transaction', description: 'Internal currency identifier from the linked purchase requisition.', path: ['currencyId'] },
  { id: 'requisitionCreatedAtRef', label: 'Created', fieldType: 'date', source: 'Purchase requisition transaction', description: 'Date/time the linked purchase requisition record was created.', path: ['createdAt'] },
  { id: 'requisitionUpdatedAtRef', label: 'Last Modified', fieldType: 'date', source: 'Purchase requisition transaction', description: 'Date/time the linked purchase requisition record was last modified.', path: ['updatedAt'] },
]

export const PURCHASE_ORDER_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'vendor',
    label: 'Vendor',
    linkedFieldLabel: 'Vendor',
    description: 'Expand the linked vendor record for this purchase order.',
    fields: VENDOR_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['vendorNumberRef', 'vendorNameRef', 'vendorEmailRef', 'vendorPhoneRef'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'requisition',
    label: 'Created From',
    linkedFieldLabel: 'Created From',
    description: 'Expand the linked purchase requisition that created this purchase order.',
    fields: PURCHASE_REQUISITION_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['requisitionNumberRef', 'requisitionStatusRef', 'requisitionPriorityRef', 'requisitionNeededByRef'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the linked user record for the purchase order creator.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for this purchase order.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for this purchase order.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
]

const DEFAULT_PURCHASE_ORDER_SECTIONS = [
  'Document Identity',
  'Workflow & Approval',
  'Sourcing & Financials',
  'Record Keys',
  'System Dates',
] as const

const DEFAULT_PURCHASE_ORDER_STAT_CARD_METRICS: PurchaseOrderStatCardKey[] = [
  'total',
  'lineCount',
  'receiptCount',
  'status',
]

const DEFAULT_PURCHASE_ORDER_LINE_WIDTHS: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  quantity: 'compact',
  'received-qty': 'compact',
  'open-qty': 'compact',
  'billed-qty': 'compact',
  'unit-price': 'normal',
  'line-total': 'normal',
}

const DEFAULT_PURCHASE_ORDER_LINE_EDIT_DISPLAY: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  quantity: 'label',
  'received-qty': 'label',
  'open-qty': 'label',
  'billed-qty': 'label',
  'unit-price': 'label',
  'line-total': 'label',
}

const DEFAULT_PURCHASE_ORDER_LINE_VIEW_DISPLAY: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineDisplayMode> = {
  ...DEFAULT_PURCHASE_ORDER_LINE_EDIT_DISPLAY,
}

const DEFAULT_PURCHASE_ORDER_LINE_DROPDOWN_DISPLAY: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineDisplayMode> = {
  ...DEFAULT_PURCHASE_ORDER_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_PURCHASE_ORDER_LINE_DROPDOWN_SORT: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  quantity: 'id',
  'received-qty': 'id',
  'open-qty': 'id',
  'billed-qty': 'id',
  'unit-price': 'id',
  'line-total': 'id',
}

export function defaultPurchaseOrderDetailCustomization(): PurchaseOrderDetailCustomizationConfig {
  const sectionMap: Record<PurchaseOrderDetailFieldKey, string> = {
    id: 'Record Keys',
    number: 'Document Identity',
    userId: 'Record Keys',
    vendorRecordId: 'Record Keys',
    subsidiaryRecordId: 'Record Keys',
    currencyRecordId: 'Record Keys',
    requisitionRecordId: 'Record Keys',
    createdBy: 'Document Identity',
    createdFrom: 'Document Identity',
    approvedBy: 'Workflow & Approval',
    status: 'Workflow & Approval',
    vendorId: 'Sourcing & Financials',
    subsidiaryId: 'Sourcing & Financials',
    currencyId: 'Sourcing & Financials',
    total: 'Sourcing & Financials',
    createdAt: 'System Dates',
    updatedAt: 'System Dates',
  }

  const columnMap: Record<PurchaseOrderDetailFieldKey, number> = {
    id: 1,
    number: 1,
    userId: 2,
    vendorRecordId: 1,
    subsidiaryRecordId: 2,
    currencyRecordId: 3,
    requisitionRecordId: 3,
    createdBy: 2,
    createdFrom: 3,
    approvedBy: 1,
    status: 1,
    vendorId: 1,
    subsidiaryId: 1,
    currencyId: 2,
    total: 3,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<PurchaseOrderDetailFieldKey, number> = {
    id: 0,
    number: 0,
    userId: 0,
    vendorRecordId: 1,
    subsidiaryRecordId: 1,
    currencyRecordId: 1,
    requisitionRecordId: 0,
    createdBy: 0,
    createdFrom: 0,
    approvedBy: 0,
    status: 0,
    vendorId: 0,
    subsidiaryId: 1,
    currencyId: 1,
    total: 1,
    createdAt: 0,
    updatedAt: 0,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_PURCHASE_ORDER_SECTIONS],
    sectionRows: {
      'Document Identity': 2,
      'Workflow & Approval': 1,
      'Sourcing & Financials': 2,
      'Record Keys': 2,
      'System Dates': 1,
    },
    lineSettings: {
      fontSize: 'sm',
    },
    fields: Object.fromEntries(
      PURCHASE_ORDER_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: !['id', 'approvedBy', 'requisitionRecordId', 'userId', 'vendorRecordId', 'subsidiaryRecordId', 'currencyRecordId'].includes(field.id),
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<PurchaseOrderDetailFieldKey, PurchaseOrderDetailFieldCustomization>,
    referenceLayouts: [buildDefaultTransactionReferenceLayout(PURCHASE_ORDER_REFERENCE_SOURCES, 'vendor')],
    lineColumns: Object.fromEntries(
      PURCHASE_ORDER_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
          widthMode: DEFAULT_PURCHASE_ORDER_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_PURCHASE_ORDER_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_PURCHASE_ORDER_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_PURCHASE_ORDER_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_PURCHASE_ORDER_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as Record<PurchaseOrderLineColumnKey, PurchaseOrderLineColumnCustomization>,
    glImpactSettings: defaultTransactionGlImpactSettings(),
    glImpactColumns: defaultTransactionGlImpactColumns(),
    statCards: DEFAULT_PURCHASE_ORDER_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
