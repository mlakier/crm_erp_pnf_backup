export type PurchaseRequisitionDetailFieldKey =
  | 'vendorName'
  | 'vendorNumber'
  | 'vendorEmail'
  | 'vendorPhone'
  | 'vendorTaxId'
  | 'vendorAddress'
  | 'vendorPrimarySubsidiary'
  | 'vendorPrimaryCurrency'
  | 'vendorInactive'
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

export type PurchaseRequisitionDetailFieldMeta = {
  id: PurchaseRequisitionDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type PurchaseRequisitionDetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type PurchaseRequisitionDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<PurchaseRequisitionDetailFieldKey, PurchaseRequisitionDetailFieldCustomization>
}

export const PURCHASE_REQUISITION_DETAIL_FIELDS: PurchaseRequisitionDetailFieldMeta[] = [
  { id: 'vendorName', label: 'Vendor Name', fieldType: 'text', source: 'Vendors master data', description: 'Display name from the linked vendor record.' },
  { id: 'vendorNumber', label: 'Vendor #', fieldType: 'text', source: 'Vendors master data', description: 'Internal vendor identifier from the linked vendor record.' },
  { id: 'vendorEmail', label: 'Email', fieldType: 'email', source: 'Vendors master data', description: 'Primary vendor email address.' },
  { id: 'vendorPhone', label: 'Phone', fieldType: 'text', source: 'Vendors master data', description: 'Primary vendor phone number.' },
  { id: 'vendorTaxId', label: 'Tax ID', fieldType: 'text', source: 'Vendors master data', description: 'Vendor tax registration or identification number.' },
  { id: 'vendorAddress', label: 'Address', fieldType: 'text', source: 'Vendors master data', description: 'Mailing or remittance address from the linked vendor record.' },
  { id: 'vendorPrimarySubsidiary', label: 'Primary Subsidiary', fieldType: 'list', source: 'Vendors master data', description: 'Default subsidiary context from the linked vendor record.' },
  { id: 'vendorPrimaryCurrency', label: 'Primary Currency', fieldType: 'list', source: 'Vendors master data', description: 'Default transaction currency from the linked vendor record.' },
  { id: 'vendorInactive', label: 'Inactive', fieldType: 'boolean', source: 'Vendors master data', description: 'Indicates whether the linked vendor is inactive for new activity.' },
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

export const DEFAULT_PURCHASE_REQUISITION_DETAIL_SECTIONS = ['Vendor', 'Purchase Requisition Details'] as const

export function defaultPurchaseRequisitionDetailCustomization(): PurchaseRequisitionDetailCustomizationConfig {
  const sectionMap: Record<PurchaseRequisitionDetailFieldKey, string> = {
    vendorName: 'Vendor',
    vendorNumber: 'Vendor',
    vendorEmail: 'Vendor',
    vendorPhone: 'Vendor',
    vendorTaxId: 'Vendor',
    vendorAddress: 'Vendor',
    vendorPrimarySubsidiary: 'Vendor',
    vendorPrimaryCurrency: 'Vendor',
    vendorInactive: 'Vendor',
    id: 'Purchase Requisition Details',
    number: 'Purchase Requisition Details',
    userId: 'Purchase Requisition Details',
    departmentRecordId: 'Purchase Requisition Details',
    vendorRecordId: 'Purchase Requisition Details',
    subsidiaryRecordId: 'Purchase Requisition Details',
    currencyRecordId: 'Purchase Requisition Details',
    createdBy: 'Purchase Requisition Details',
    createdFrom: 'Purchase Requisition Details',
    approvedBy: 'Purchase Requisition Details',
    title: 'Purchase Requisition Details',
    description: 'Purchase Requisition Details',
    status: 'Purchase Requisition Details',
    priority: 'Purchase Requisition Details',
    neededByDate: 'Purchase Requisition Details',
    departmentId: 'Purchase Requisition Details',
    vendorId: 'Purchase Requisition Details',
    subsidiaryId: 'Purchase Requisition Details',
    currencyId: 'Purchase Requisition Details',
    total: 'Purchase Requisition Details',
    notes: 'Purchase Requisition Details',
    createdAt: 'Purchase Requisition Details',
    updatedAt: 'Purchase Requisition Details',
  }

  const columnMap: Record<PurchaseRequisitionDetailFieldKey, number> = {
    vendorName: 1,
    vendorNumber: 1,
    vendorEmail: 2,
    vendorPhone: 2,
    vendorTaxId: 3,
    vendorAddress: 3,
    vendorPrimarySubsidiary: 1,
    vendorPrimaryCurrency: 2,
    vendorInactive: 3,
    id: 1,
    number: 1,
    userId: 2,
    departmentRecordId: 3,
    vendorRecordId: 1,
    subsidiaryRecordId: 2,
    currencyRecordId: 3,
    createdBy: 3,
    createdFrom: 2,
    approvedBy: 3,
    title: 1,
    description: 1,
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
    vendorName: 0,
    vendorNumber: 1,
    vendorEmail: 0,
    vendorPhone: 1,
    vendorTaxId: 0,
    vendorAddress: 1,
    vendorPrimarySubsidiary: 2,
    vendorPrimaryCurrency: 2,
    vendorInactive: 2,
    id: 0,
    number: 1,
    userId: 0,
    departmentRecordId: 0,
    vendorRecordId: 1,
    subsidiaryRecordId: 1,
    currencyRecordId: 1,
    createdBy: 2,
    createdFrom: 2,
    approvedBy: 2,
    title: 3,
    description: 4,
    status: 5,
    priority: 5,
    neededByDate: 5,
    departmentId: 6,
    vendorId: 6,
    subsidiaryId: 7,
    currencyId: 7,
    total: 7,
    notes: 8,
    createdAt: 9,
    updatedAt: 9,
  }

  return {
    formColumns: 3,
    sections: [...DEFAULT_PURCHASE_REQUISITION_DETAIL_SECTIONS],
    sectionRows: {
      Vendor: 3,
      'Purchase Requisition Details': 10,
    },
    fields: Object.fromEntries(
      PURCHASE_REQUISITION_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible: field.id === 'vendorTaxId' || field.id === 'vendorAddress' || field.id === 'vendorInactive' || field.id === 'createdFrom' || field.id === 'approvedBy'
            ? false
            : true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<PurchaseRequisitionDetailFieldKey, PurchaseRequisitionDetailFieldCustomization>,
  }
}
