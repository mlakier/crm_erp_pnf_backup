import type { TransactionStatCardSlot } from '@/lib/transaction-page-config'
import {
  buildDefaultTransactionReferenceLayout,
  type TransactionReferenceLayout,
} from '@/lib/transaction-reference-layouts'
import {
  type LinkedRecordReferenceSource,
  CURRENCY_FULL_REFERENCE_FIELDS,
  SUBSIDIARY_FULL_REFERENCE_FIELDS,
  USER_FULL_REFERENCE_FIELDS,
} from '@/lib/linked-record-reference-catalogs'

export type PurchaseRequisitionDetailFieldKey =
  | 'id'
  | 'number'
  | 'userId'
  | 'departmentRecordId'
  | 'vendorRecordId'
  | 'subsidiaryRecordId'
  | 'currencyRecordId'
  | 'createdBy'
  | 'createdFrom'
  | 'approvedBy'
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'neededByDate'
  | 'departmentId'
  | 'vendorId'
  | 'subsidiaryId'
  | 'currencyId'
  | 'total'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'

export type PurchaseRequisitionLineColumnKey =
  | 'line'
  | 'item-id'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'
  | 'notes'

export type PurchaseRequisitionLineFontSize = 'xs' | 'sm'

export type PurchaseRequisitionLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type PurchaseRequisitionLineDisplayMode = 'label' | 'idAndLabel' | 'id'

export type PurchaseRequisitionLineDropdownSortMode = 'id' | 'label'

export type PurchaseRequisitionDetailFieldMeta = {
  id: PurchaseRequisitionDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type PurchaseRequisitionLineColumnMeta = {
  id: PurchaseRequisitionLineColumnKey
  label: string
  description?: string
}

export type PurchaseRequisitionDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type PurchaseRequisitionLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: PurchaseRequisitionLineWidthMode
  editDisplay: PurchaseRequisitionLineDisplayMode
  viewDisplay: PurchaseRequisitionLineDisplayMode
  dropdownDisplay: PurchaseRequisitionLineDisplayMode
  dropdownSort: PurchaseRequisitionLineDropdownSortMode
}

export type PurchaseRequisitionLineSettings = {
  fontSize: PurchaseRequisitionLineFontSize
}

export type PurchaseRequisitionStatCardKey =
  | 'total'
  | 'neededByDate'
  | 'lineCount'
  | 'status'

export type PurchaseRequisitionStatCardSlot = TransactionStatCardSlot<PurchaseRequisitionStatCardKey>

export type PurchaseRequisitionDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<PurchaseRequisitionDetailFieldKey, PurchaseRequisitionDetailFieldCustomization>
  referenceLayouts: TransactionReferenceLayout[]
  lineSettings: PurchaseRequisitionLineSettings
  lineColumns: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineColumnCustomization>
  statCards: PurchaseRequisitionStatCardSlot[]
}

export const PURCHASE_REQUISITION_DETAIL_FIELDS: PurchaseRequisitionDetailFieldMeta[] = [
  { id: 'id', label: 'DB Id', fieldType: 'text', description: 'Internal database identifier for the requisition record.' },
  { id: 'number', label: 'Purchase Requisition #', fieldType: 'text', description: 'Unique purchase requisition number used across procurement workflows.' },
  { id: 'userId', label: 'User Id', fieldType: 'text', source: 'Users master data', description: 'Internal user identifier for the requisition creator.' },
  { id: 'departmentRecordId', label: 'Department Id', fieldType: 'text', source: 'Departments master data', description: 'Internal department identifier linked to the requisition.' },
  { id: 'vendorRecordId', label: 'Vendor Id', fieldType: 'text', source: 'Vendors master data', description: 'Internal vendor identifier linked to the requisition.' },
  { id: 'subsidiaryRecordId', label: 'Subsidiary Id', fieldType: 'text', source: 'Subsidiaries master data', description: 'Internal subsidiary identifier linked to the requisition.' },
  { id: 'currencyRecordId', label: 'Currency Id', fieldType: 'text', source: 'Currencies master data', description: 'Internal currency identifier linked to the requisition.' },
  { id: 'createdBy', label: 'Created By', fieldType: 'text', source: 'Users master data', description: 'User who created the purchase requisition.' },
  { id: 'createdFrom', label: 'Created From', fieldType: 'text', source: 'Source transaction', description: 'Source transaction that created this requisition.' },
  { id: 'approvedBy', label: 'Approved By', fieldType: 'text', source: 'System Notes / activity history', description: 'User who approved the purchase requisition.' },
  { id: 'title', label: 'Title', fieldType: 'text', description: 'Brief internal title for the requisition.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Header description for the requisition.' },
  { id: 'status', label: 'Status', fieldType: 'list', source: 'System purchase requisition statuses', description: 'Current workflow state of the requisition.' },
  { id: 'priority', label: 'Priority', fieldType: 'list', source: 'System purchase requisition priorities', description: 'Urgency level for the requested spend.' },
  { id: 'neededByDate', label: 'Needed By', fieldType: 'date', description: 'Date the requested goods or services are needed.' },
  { id: 'departmentId', label: 'Department', fieldType: 'list', source: 'Departments master data', description: 'Department requesting or funding the spend.' },
  { id: 'vendorId', label: 'Vendor', fieldType: 'list', source: 'Vendors master data', description: 'Preferred vendor linked to this requisition.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', source: 'Subsidiaries master data', description: 'Subsidiary that owns the requisition.' },
  { id: 'currencyId', label: 'Currency', fieldType: 'list', source: 'Currencies master data', description: 'Transaction currency for the requisition.' },
  { id: 'total', label: 'Total', fieldType: 'currency', description: 'Current document total based on all requisition line amounts.' },
  { id: 'notes', label: 'Notes', fieldType: 'text', description: 'Internal notes or comments for the requisition.' },
  { id: 'createdAt', label: 'Created', fieldType: 'date', description: 'Date/time the requisition record was created.' },
  { id: 'updatedAt', label: 'Last Modified', fieldType: 'date', description: 'Date/time the requisition record was last modified.' },
]

export const PURCHASE_REQUISITION_LINE_COLUMNS: PurchaseRequisitionLineColumnMeta[] = [
  { id: 'line', label: 'Line', description: 'Sequential line number for the purchase requisition.' },
  { id: 'item-id', label: 'Item Id', description: 'Linked item identifier for the requisition line.' },
  { id: 'description', label: 'Description', description: 'Description of the goods or services on the line.' },
  { id: 'quantity', label: 'Qty', description: 'Requested quantity for the line item.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Requested price per unit for the line item.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended line amount calculated from quantity and unit price.' },
  { id: 'notes', label: 'Notes', description: 'Line-level notes for the requisition.' },
]

export const PURCHASE_REQUISITION_STAT_CARDS: Array<{ id: PurchaseRequisitionStatCardKey; label: string }> = [
  { id: 'total', label: 'Requisition Total' },
  { id: 'neededByDate', label: 'Needed By' },
  { id: 'lineCount', label: 'Line Items' },
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

const DEPARTMENT_FULL_REFERENCE_FIELDS: LinkedRecordReferenceSource['fields'] = [
  { id: 'departmentDbId', label: 'DB Id', fieldType: 'text', source: 'Departments master data', description: 'Internal database identifier for the linked department.', path: ['id'] },
  { id: 'departmentCode', label: 'Department Id', fieldType: 'text', source: 'Departments master data', description: 'Internal department identifier from the linked department record.', path: ['departmentId'] },
  { id: 'departmentNumber', label: 'Department #', fieldType: 'text', source: 'Departments master data', description: 'Alternate department number from the linked department.', path: ['departmentNumber'] },
  { id: 'departmentName', label: 'Department Name', fieldType: 'text', source: 'Departments master data', description: 'Display name from the linked department record.', path: ['name'] },
  { id: 'departmentDescription', label: 'Description', fieldType: 'text', source: 'Departments master data', description: 'Description from the linked department record.', path: ['description'] },
  { id: 'departmentDivision', label: 'Division', fieldType: 'text', source: 'Departments master data', description: 'Division from the linked department record.', path: ['division'] },
  { id: 'departmentPlanningCategory', label: 'Planning Category', fieldType: 'text', source: 'Departments master data', description: 'Planning category from the linked department.', path: ['planningCategory'] },
  { id: 'departmentCostCenterCode', label: 'Cost Center Code', fieldType: 'text', source: 'Departments master data', description: 'Cost center code from the linked department.', path: ['costCenterCode'] },
  { id: 'departmentType', label: 'Department Type', fieldType: 'text', source: 'Departments master data', description: 'Department type from the linked department.', path: ['departmentType'] },
  { id: 'departmentSegmentReportingGroup', label: 'Segment Reporting Group', fieldType: 'text', source: 'Departments master data', description: 'Segment reporting group from the linked department.', path: ['segmentReportingGroup'] },
  { id: 'departmentIncludeChildren', label: 'Include Children', fieldType: 'boolean', source: 'Departments master data', description: 'Whether the linked department includes child departments.', path: ['includeChildren'] },
  { id: 'departmentSharedServicesFlag', label: 'Shared Services', fieldType: 'boolean', source: 'Departments master data', description: 'Whether the linked department is marked as shared services.', path: ['sharedServicesFlag'] },
  { id: 'departmentParentDepartmentDbId', label: 'Parent Department DB Id', fieldType: 'text', source: 'Departments master data', description: 'Parent department identifier from the linked department.', path: ['parentDepartmentId'] },
  { id: 'departmentManagerEmployeeDbId', label: 'Manager Employee DB Id', fieldType: 'text', source: 'Departments master data', description: 'Manager employee identifier from the linked department.', path: ['managerEmployeeId'] },
  { id: 'departmentApproverEmployeeDbId', label: 'Approver Employee DB Id', fieldType: 'text', source: 'Departments master data', description: 'Approver employee identifier from the linked department.', path: ['approverEmployeeId'] },
  { id: 'departmentActive', label: 'Active', fieldType: 'boolean', source: 'Departments master data', description: 'Whether the linked department is active.', path: ['active'] },
  { id: 'departmentCreatedAtRef', label: 'Created', fieldType: 'date', source: 'Departments master data', description: 'Date/time the linked department record was created.', path: ['createdAt'] },
  { id: 'departmentUpdatedAtRef', label: 'Last Modified', fieldType: 'date', source: 'Departments master data', description: 'Date/time the linked department record was last modified.', path: ['updatedAt'] },
]

export const PURCHASE_REQUISITION_REFERENCE_SOURCES: LinkedRecordReferenceSource[] = [
  {
    id: 'vendor',
    label: 'Vendor',
    linkedFieldLabel: 'Vendor',
    description: 'Expand the linked vendor record for this purchase requisition.',
    fields: VENDOR_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['vendorNumberRef', 'vendorNameRef', 'vendorEmailRef', 'vendorPhoneRef'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'department',
    label: 'Department',
    linkedFieldLabel: 'Department',
    description: 'Expand the linked department record for this purchase requisition.',
    fields: DEPARTMENT_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['departmentCode', 'departmentName', 'departmentDescription'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'owner',
    label: 'Created By',
    linkedFieldLabel: 'Created By',
    description: 'Expand the linked user record for the requisition creator.',
    fields: USER_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['ownerUserId', 'ownerName', 'ownerEmail'],
    defaultColumns: 2,
    defaultRows: 2,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiary',
    linkedFieldLabel: 'Subsidiary',
    description: 'Expand the linked subsidiary record for this purchase requisition.',
    fields: SUBSIDIARY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['subsidiaryNumber', 'subsidiaryName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
  {
    id: 'currency',
    label: 'Currency',
    linkedFieldLabel: 'Currency',
    description: 'Expand the linked currency record for this purchase requisition.',
    fields: CURRENCY_FULL_REFERENCE_FIELDS,
    defaultVisibleFieldIds: ['currencyCode', 'currencyName'],
    defaultColumns: 2,
    defaultRows: 1,
  },
]

const DEFAULT_PURCHASE_REQUISITION_SECTIONS = [
  'Document Identity',
  'Workflow & Timing',
  'Request Details',
  'Sourcing & Financials',
  'Record Keys',
  'System Dates',
] as const

const DEFAULT_PURCHASE_REQUISITION_STAT_CARD_METRICS: PurchaseRequisitionStatCardKey[] = [
  'total',
  'neededByDate',
  'lineCount',
  'status',
]

const DEFAULT_PURCHASE_REQUISITION_LINE_WIDTHS: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineWidthMode> = {
  line: 'compact',
  'item-id': 'wide',
  description: 'wide',
  quantity: 'compact',
  'unit-price': 'normal',
  'line-total': 'normal',
  notes: 'wide',
}

const DEFAULT_PURCHASE_REQUISITION_LINE_EDIT_DISPLAY: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineDisplayMode> = {
  line: 'label',
  'item-id': 'id',
  description: 'label',
  quantity: 'label',
  'unit-price': 'label',
  'line-total': 'label',
  notes: 'label',
}

const DEFAULT_PURCHASE_REQUISITION_LINE_VIEW_DISPLAY: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineDisplayMode> = {
  ...DEFAULT_PURCHASE_REQUISITION_LINE_EDIT_DISPLAY,
}

const DEFAULT_PURCHASE_REQUISITION_LINE_DROPDOWN_DISPLAY: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineDisplayMode> = {
  ...DEFAULT_PURCHASE_REQUISITION_LINE_EDIT_DISPLAY,
  'item-id': 'idAndLabel',
}

const DEFAULT_PURCHASE_REQUISITION_LINE_DROPDOWN_SORT: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineDropdownSortMode> = {
  line: 'id',
  'item-id': 'id',
  description: 'label',
  quantity: 'id',
  'unit-price': 'id',
  'line-total': 'id',
  notes: 'label',
}

export function defaultPurchaseRequisitionDetailCustomization(): PurchaseRequisitionDetailCustomizationConfig {
  const sectionMap: Record<PurchaseRequisitionDetailFieldKey, string> = {
    id: 'Record Keys',
    number: 'Document Identity',
    userId: 'Record Keys',
    departmentRecordId: 'Record Keys',
    vendorRecordId: 'Record Keys',
    subsidiaryRecordId: 'Record Keys',
    currencyRecordId: 'Record Keys',
    createdBy: 'Document Identity',
    createdFrom: 'Document Identity',
    approvedBy: 'Workflow & Timing',
    title: 'Request Details',
    description: 'Request Details',
    status: 'Workflow & Timing',
    priority: 'Workflow & Timing',
    neededByDate: 'Workflow & Timing',
    departmentId: 'Sourcing & Financials',
    vendorId: 'Sourcing & Financials',
    subsidiaryId: 'Sourcing & Financials',
    currencyId: 'Sourcing & Financials',
    total: 'Sourcing & Financials',
    notes: 'Request Details',
    createdAt: 'System Dates',
    updatedAt: 'System Dates',
  }

  const columnMap: Record<PurchaseRequisitionDetailFieldKey, number> = {
    id: 1,
    number: 1,
    userId: 2,
    departmentRecordId: 3,
    vendorRecordId: 1,
    subsidiaryRecordId: 2,
    currencyRecordId: 3,
    createdBy: 3,
    createdFrom: 2,
    approvedBy: 1,
    title: 1,
    description: 2,
    status: 1,
    priority: 2,
    neededByDate: 3,
    departmentId: 1,
    vendorId: 2,
    subsidiaryId: 1,
    currencyId: 2,
    total: 3,
    notes: 1,
    createdAt: 1,
    updatedAt: 2,
  }

  const rowMap: Record<PurchaseRequisitionDetailFieldKey, number> = {
    id: 0,
    number: 0,
    userId: 0,
    departmentRecordId: 0,
    vendorRecordId: 1,
    subsidiaryRecordId: 1,
    currencyRecordId: 1,
    createdBy: 1,
    createdFrom: 1,
    approvedBy: 1,
    title: 0,
    description: 0,
    status: 0,
    priority: 0,
    neededByDate: 0,
    departmentId: 0,
    vendorId: 0,
    subsidiaryId: 1,
    currencyId: 1,
    total: 1,
    notes: 1,
    createdAt: 0,
    updatedAt: 0,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_PURCHASE_REQUISITION_SECTIONS],
    sectionRows: {
      'Document Identity': 2,
      'Workflow & Timing': 2,
      'Request Details': 2,
      'Sourcing & Financials': 2,
      'Record Keys': 2,
      'System Dates': 1,
    },
    lineSettings: {
      fontSize: 'sm',
    },
    fields: Object.fromEntries(
      PURCHASE_REQUISITION_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: !['id', 'createdFrom', 'approvedBy'].includes(field.id),
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ]),
    ) as Record<PurchaseRequisitionDetailFieldKey, PurchaseRequisitionDetailFieldCustomization>,
    referenceLayouts: [buildDefaultTransactionReferenceLayout(PURCHASE_REQUISITION_REFERENCE_SOURCES, 'vendor')],
    lineColumns: Object.fromEntries(
      PURCHASE_REQUISITION_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: column.id === 'notes' ? false : true,
          order: index,
          widthMode: DEFAULT_PURCHASE_REQUISITION_LINE_WIDTHS[column.id],
          editDisplay: DEFAULT_PURCHASE_REQUISITION_LINE_EDIT_DISPLAY[column.id],
          viewDisplay: DEFAULT_PURCHASE_REQUISITION_LINE_VIEW_DISPLAY[column.id],
          dropdownDisplay: DEFAULT_PURCHASE_REQUISITION_LINE_DROPDOWN_DISPLAY[column.id],
          dropdownSort: DEFAULT_PURCHASE_REQUISITION_LINE_DROPDOWN_SORT[column.id],
        },
      ]),
    ) as Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineColumnCustomization>,
    statCards: DEFAULT_PURCHASE_REQUISITION_STAT_CARD_METRICS.map((metric, index) => ({
      id: `slot-${index + 1}`,
      metric,
      visible: true,
      order: index,
    })),
  }
}
