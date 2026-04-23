export type PurchaseOrderDetailFieldKey =
  | 'vendorName'
  | 'vendorNumber'
  | 'vendorEmail'
  | 'vendorPhone'
  | 'vendorTaxId'
  | 'vendorAddress'
  | 'vendorPrimarySubsidiary'
  | 'vendorPrimaryCurrency'
  | 'vendorInactive'
  | 'number'
  | 'createdBy'
  | 'createdFrom'
  | 'approvedBy'
  | 'subsidiaryId'
  | 'vendorId'
  | 'status'
  | 'total'

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
}

export type PurchaseOrderDetailCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<PurchaseOrderDetailFieldKey, PurchaseOrderDetailFieldCustomization>
  lineColumns: Record<PurchaseOrderLineColumnKey, PurchaseOrderLineColumnCustomization>
}

export const PURCHASE_ORDER_DETAIL_FIELDS: PurchaseOrderDetailFieldMeta[] = [
  {
    id: 'vendorName',
    label: 'Vendor Name',
    fieldType: 'text',
    source: 'Vendors master data',
    description: 'Display name from the linked vendor record.',
  },
  {
    id: 'vendorNumber',
    label: 'Vendor #',
    fieldType: 'text',
    source: 'Vendors master data',
    description: 'Internal vendor identifier from the linked vendor record.',
  },
  {
    id: 'vendorEmail',
    label: 'Email',
    fieldType: 'email',
    source: 'Vendors master data',
    description: 'Primary vendor email address.',
  },
  {
    id: 'vendorPhone',
    label: 'Phone',
    fieldType: 'text',
    source: 'Vendors master data',
    description: 'Primary vendor phone number.',
  },
  {
    id: 'vendorTaxId',
    label: 'Tax ID',
    fieldType: 'text',
    source: 'Vendors master data',
    description: 'Vendor tax registration or identification number.',
  },
  {
    id: 'vendorAddress',
    label: 'Address',
    fieldType: 'text',
    source: 'Vendors master data',
    description: 'Mailing or remittance address from the linked vendor record.',
  },
  {
    id: 'vendorPrimarySubsidiary',
    label: 'Primary Subsidiary',
    fieldType: 'list',
    source: 'Vendors master data',
    description: 'Default subsidiary context from the linked vendor record.',
  },
  {
    id: 'vendorPrimaryCurrency',
    label: 'Primary Currency',
    fieldType: 'list',
    source: 'Vendors master data',
    description: 'Default transaction currency from the linked vendor record.',
  },
  {
    id: 'vendorInactive',
    label: 'Inactive',
    fieldType: 'boolean',
    source: 'Vendors master data',
    description: 'Indicates whether the linked vendor is inactive for new activity.',
  },
  {
    id: 'number',
    label: 'Purchase Order #',
    fieldType: 'text',
    description: 'Unique purchase order number used across procurement workflows.',
  },
  {
    id: 'createdBy',
    label: 'Created By',
    fieldType: 'text',
    source: 'Users master data',
    description: 'User who created the purchase order.',
  },
  {
    id: 'createdFrom',
    label: 'Created From',
    fieldType: 'text',
    source: 'Source transaction',
    description: 'Source transaction that created this purchase order.',
  },
  {
    id: 'approvedBy',
    label: 'Approved By',
    fieldType: 'text',
    source: 'System Notes / activity history',
    description: 'User who approved the purchase order based on the approval activity trail.',
  },
  {
    id: 'subsidiaryId',
    label: 'Subsidiary',
    fieldType: 'list',
    source: 'Subsidiaries master data',
    description: 'Subsidiary that owns the purchase order.',
  },
  {
    id: 'vendorId',
    label: 'Vendor',
    fieldType: 'list',
    source: 'Vendors master data',
    description: 'Vendor linked to this purchase order.',
  },
  {
    id: 'status',
    label: 'Status',
    fieldType: 'list',
    source: 'System purchase order statuses',
    description: 'Current lifecycle stage of the purchase order.',
  },
  {
    id: 'total',
    label: 'Total',
    fieldType: 'currency',
    description: 'Document total based on all purchase order line amounts.',
  },
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

export const DEFAULT_PURCHASE_ORDER_DETAIL_SECTIONS = ['Vendor', 'Purchase Order Details'] as const

export function defaultPurchaseOrderDetailCustomization(): PurchaseOrderDetailCustomizationConfig {
  const sectionMap: Record<PurchaseOrderDetailFieldKey, string> = {
    vendorName: 'Vendor',
    vendorNumber: 'Vendor',
    vendorEmail: 'Vendor',
    vendorPhone: 'Vendor',
    vendorTaxId: 'Vendor',
    vendorAddress: 'Vendor',
    vendorPrimarySubsidiary: 'Vendor',
    vendorPrimaryCurrency: 'Vendor',
    vendorInactive: 'Vendor',
    number: 'Purchase Order Details',
    createdBy: 'Purchase Order Details',
    createdFrom: 'Purchase Order Details',
    approvedBy: 'Purchase Order Details',
    subsidiaryId: 'Purchase Order Details',
    vendorId: 'Purchase Order Details',
    status: 'Purchase Order Details',
    total: 'Purchase Order Details',
  }

  const columnMap: Record<PurchaseOrderDetailFieldKey, number> = {
    vendorName: 1,
    vendorNumber: 2,
    vendorEmail: 1,
    vendorPhone: 2,
    vendorTaxId: 2,
    vendorAddress: 1,
    vendorPrimarySubsidiary: 1,
    vendorPrimaryCurrency: 2,
    vendorInactive: 1,
    number: 1,
    createdBy: 2,
    createdFrom: 1,
    approvedBy: 2,
    subsidiaryId: 1,
    vendorId: 2,
    status: 1,
    total: 2,
  }

  const rowMap: Record<PurchaseOrderDetailFieldKey, number> = {
    vendorName: 0,
    vendorNumber: 0,
    vendorEmail: 1,
    vendorPhone: 1,
    vendorTaxId: 2,
    vendorAddress: 2,
    vendorPrimarySubsidiary: 3,
    vendorPrimaryCurrency: 3,
    vendorInactive: 4,
    number: 0,
    createdBy: 0,
    createdFrom: 1,
    approvedBy: 1,
    subsidiaryId: 1,
    vendorId: 1,
    status: 2,
    total: 2,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_PURCHASE_ORDER_DETAIL_SECTIONS],
    sectionRows: {
      Vendor: 3,
      'Purchase Order Details': 3,
    },
    fields: Object.fromEntries(
      PURCHASE_ORDER_DETAIL_FIELDS.map((field) => [
        field.id,
        {
          visible:
            field.id === 'vendorAddress' ||
            field.id === 'vendorPrimarySubsidiary' ||
            field.id === 'vendorPrimaryCurrency' ||
            field.id === 'vendorInactive'
              ? false
              : true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<PurchaseOrderDetailFieldKey, PurchaseOrderDetailFieldCustomization>,
    lineColumns: Object.fromEntries(
      PURCHASE_ORDER_LINE_COLUMNS.map((column, index) => [
        column.id,
        {
          visible: true,
          order: index,
        },
      ])
    ) as Record<PurchaseOrderLineColumnKey, PurchaseOrderLineColumnCustomization>,
  }
}
