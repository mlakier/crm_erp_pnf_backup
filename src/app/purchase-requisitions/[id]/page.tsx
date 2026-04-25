import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, fmtPhone, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import PurchaseOrderHeaderSections, {
  type PurchaseOrderHeaderField,
} from '@/components/PurchaseOrderHeaderSections'
import PurchaseRequisitionDetailCustomizeMode from '@/components/PurchaseRequisitionDetailCustomizeMode'
import PurchaseRequisitionRelatedDocuments from '@/components/PurchaseRequisitionRelatedDocuments'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import RequisitionLineItemForm from '@/components/RequisitionLineItemForm'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import { parseFieldChangeSummary } from '@/lib/activity'
import {
  PURCHASE_REQUISITION_DETAIL_FIELDS,
  type PurchaseRequisitionDetailFieldKey,
} from '@/lib/purchase-requisitions-detail-customization'
import { loadPurchaseRequisitionDetailCustomization } from '@/lib/purchase-requisitions-detail-customization-store'
import { purchaseRequisitionPageConfig } from '@/lib/transaction-page-configs/purchase-requisition'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
} from '@/lib/transaction-detail-helpers'

type PurchaseRequisitionHeaderField = PurchaseOrderHeaderField & { key: PurchaseRequisitionDetailFieldKey }

const REQUISITION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

type RequisitionLineRow = {
  id: string
  lineNumber: number
  itemId: string | null
  itemName: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  notes: string | null
}

export default async function PurchaseRequisitionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const { moneySettings } = await loadCompanyDisplaySettings()

  const [req, vendors, departments, subsidiaries, currencies, items, activities, customization] =
    await Promise.all([
      prisma.requisition.findUnique({
        where: { id },
        include: {
          vendor: {
            include: {
              subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
              currency: { select: { id: true, currencyId: true, code: true, name: true } },
            },
          },
          department: true,
          subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
          currency: { select: { id: true, currencyId: true, code: true, name: true } },
          user: {
            select: {
              id: true,
              userId: true,
              name: true,
              email: true,
            },
          },
          lineItems: {
            orderBy: { createdAt: 'asc' },
            include: {
              item: { select: { id: true, itemId: true, name: true } },
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              number: true,
              status: true,
              total: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.vendor.findMany({
        orderBy: { vendorNumber: 'asc' },
        select: {
          id: true,
          vendorNumber: true,
          name: true,
          email: true,
          phone: true,
          taxId: true,
          address: true,
          inactive: true,
        },
      }),
      prisma.department.findMany({
        where: { active: true },
        orderBy: { departmentId: 'asc' },
        select: { id: true, departmentId: true, name: true },
      }),
      prisma.subsidiary.findMany({
        orderBy: { subsidiaryId: 'asc' },
        select: { id: true, subsidiaryId: true, name: true },
      }),
      prisma.currency.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, currencyId: true, code: true, name: true },
      }),
      prisma.item.findMany({
        where: { active: true },
        orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
        select: { id: true, itemId: true, name: true, listPrice: true },
      }),
      prisma.activity.findMany({
        where: { entityType: 'purchase-requisition', entityId: id },
        orderBy: { createdAt: 'desc' },
      }),
      loadPurchaseRequisitionDetailCustomization(),
    ])

  if (!req) notFound()

  const detailHref = `/purchase-requisitions/${req.id}`
  const activityUserIds = Array.from(
    new Set(activities.map((activity) => activity.userId).filter(Boolean))
  ) as string[]
  const activityUsers = activityUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: activityUserIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const activityUserLabelById = new Map(
    activityUsers.map((user) => [
      user.id,
      user.userId && user.name ? `${user.userId} - ${user.name}` : user.userId ?? user.name ?? user.email,
    ])
  )
  const approvedStatusActivity = activities.find((activity) => {
    const parsed = parseFieldChangeSummary(activity.summary)
    return parsed?.fieldName === 'Status' && parsed.newValue.toLowerCase() === 'approved'
  })
  const approvedByLabel = approvedStatusActivity?.userId
    ? activityUserLabelById.get(approvedStatusActivity.userId) ?? approvedStatusActivity.userId
    : ''
  const createdByLabel =
    req.user?.userId && req.user?.name
      ? `${req.user.userId} - ${req.user.name}`
      : req.user?.userId ?? req.user?.name ?? req.user?.email ?? '-'

  const systemNotes = activities
    .map((activity) => {
      const parsed = parseFieldChangeSummary(activity.summary)
      if (!parsed) return null

      return {
        id: activity.id,
        date: fmtDocumentDate(activity.createdAt, moneySettings),
        setBy: activity.userId ? activityUserLabelById.get(activity.userId) ?? activity.userId : 'System',
        context: parsed.context,
        fieldName: parsed.fieldName,
        oldValue: parsed.oldValue,
        newValue: parsed.newValue,
      }
    })
    .filter((note): note is Exclude<typeof note, null> => Boolean(note))

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`,
  }))
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: `${department.departmentId} - ${department.name}`,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))

  const lineRows: RequisitionLineRow[] = req.lineItems.map((line, index) => ({
    id: line.id,
    lineNumber: index + 1,
    itemId: line.item?.itemId ?? null,
    itemName: line.item?.name ?? null,
    description: line.description,
    quantity: line.quantity,
    unitPrice: toNumericValue(line.unitPrice, 0),
    lineTotal: toNumericValue(line.lineTotal, 0),
    notes: line.notes ?? null,
  }))

  const headerFieldDefinitions: Record<
    PurchaseRequisitionDetailFieldKey,
    PurchaseRequisitionHeaderField
  > = {
    vendorName: {
      key: 'vendorName',
      label: 'Vendor Name',
      value: req.vendor?.name ?? '',
      displayValue: req.vendor?.name ?? '-',
      helpText: 'Display name from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorNumber: {
      key: 'vendorNumber',
      label: 'Vendor #',
      value: req.vendor?.vendorNumber ?? '',
      displayValue: req.vendor?.vendorNumber ?? '-',
      helpText: 'Internal vendor identifier from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorEmail: {
      key: 'vendorEmail',
      label: 'Email',
      value: req.vendor?.email ?? '',
      displayValue: req.vendor?.email ?? '-',
      helpText: 'Primary vendor email address.',
      fieldType: 'email',
      sourceText: 'Vendors master data',
    },
    vendorPhone: {
      key: 'vendorPhone',
      label: 'Phone',
      value: req.vendor?.phone ?? '',
      displayValue: req.vendor?.phone ? fmtPhone(req.vendor.phone) : '-',
      helpText: 'Primary vendor phone number.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorTaxId: {
      key: 'vendorTaxId',
      label: 'Tax ID',
      value: req.vendor?.taxId ?? '',
      displayValue: req.vendor?.taxId ?? '-',
      helpText: 'Vendor tax registration or identification number.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorAddress: {
      key: 'vendorAddress',
      label: 'Address',
      value: req.vendor?.address ?? '',
      displayValue: req.vendor?.address ?? '-',
      helpText: 'Mailing or remittance address from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorPrimarySubsidiary: {
      key: 'vendorPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: req.vendor?.subsidiary
        ? `${req.vendor.subsidiary.subsidiaryId} - ${req.vendor.subsidiary.name}`
        : '',
      displayValue: req.vendor?.subsidiary
        ? `${req.vendor.subsidiary.subsidiaryId} - ${req.vendor.subsidiary.name}`
        : '-',
      helpText: 'Default subsidiary context from the linked vendor record.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    vendorPrimaryCurrency: {
      key: 'vendorPrimaryCurrency',
      label: 'Primary Currency',
      value: req.vendor?.currency
        ? `${req.vendor.currency.code ?? req.vendor.currency.currencyId} - ${req.vendor.currency.name}`
        : '',
      displayValue: req.vendor?.currency
        ? `${req.vendor.currency.code ?? req.vendor.currency.currencyId} - ${req.vendor.currency.name}`
        : '-',
      helpText: 'Default transaction currency from the linked vendor record.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    vendorInactive: {
      key: 'vendorInactive',
      label: 'Inactive',
      value: req.vendor ? (req.vendor.inactive ? 'Yes' : 'No') : '',
      displayValue: req.vendor ? (req.vendor.inactive ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked vendor is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Vendors master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: req.id,
      helpText: 'Internal database identifier for the purchase requisition record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    number: {
      key: 'number',
      label: 'Purchase Requisition Id',
      value: req.number,
      editable: true,
      type: 'text',
      helpText: 'Unique purchase requisition number used across procurement workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: req.user?.userId ?? '',
      helpText: 'Internal user identifier for the requisition creator.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    departmentRecordId: {
      key: 'departmentRecordId',
      label: 'Department Id',
      value: req.department?.departmentId ?? '',
      helpText: 'Internal department identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Departments master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    vendorRecordId: {
      key: 'vendorRecordId',
      label: 'Vendor Id',
      value: req.vendor?.vendorNumber ?? '',
      helpText: 'Internal vendor identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    subsidiaryRecordId: {
      key: 'subsidiaryRecordId',
      label: 'Subsidiary Id',
      value: req.subsidiary?.subsidiaryId ?? '',
      helpText: 'Internal subsidiary identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    currencyRecordId: {
      key: 'currencyRecordId',
      label: 'Currency Id',
      value: req.currency?.currencyId ?? req.currency?.code ?? '',
      helpText: 'Internal currency identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      displayValue: createdByLabel,
      helpText: 'User who created the purchase requisition.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: '',
      displayValue: '-',
      helpText: 'Source transaction that created this requisition.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    approvedBy: {
      key: 'approvedBy',
      label: 'Approved By',
      value: approvedByLabel,
      displayValue: approvedByLabel || '-',
      helpText: 'User who approved the requisition based on the approval activity trail.',
      fieldType: 'text',
      sourceText: 'System Notes / activity history',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    title: {
      key: 'title',
      label: 'Title',
      value: req.title ?? '',
      displayValue: req.title ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Brief internal title for the requisition.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    description: {
      key: 'description',
      label: 'Description',
      value: req.description ?? '',
      displayValue: req.description ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Header description for the requisition.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: req.status,
      editable: true,
      type: 'select',
      options: REQUISITION_STATUS_OPTIONS,
      helpText: 'Current workflow state of the requisition.',
      fieldType: 'list',
      sourceText: 'System purchase requisition statuses',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    priority: {
      key: 'priority',
      label: 'Priority',
      value: req.priority,
      editable: true,
      type: 'select',
      options: PRIORITY_OPTIONS,
      helpText: 'Urgency level for the requested spend.',
      fieldType: 'list',
      sourceText: 'System purchase requisition priorities',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    neededByDate: {
      key: 'neededByDate',
      label: 'Needed By',
      value: req.neededByDate ? req.neededByDate.toISOString().slice(0, 10) : '',
      displayValue: req.neededByDate ? fmtDocumentDate(req.neededByDate, moneySettings) : '-',
      editable: true,
      type: 'text',
      helpText: 'Date the requested goods or services are needed.',
      fieldType: 'date',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    departmentId: {
      key: 'departmentId',
      label: 'Department',
      value: req.departmentId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...departmentOptions],
      displayValue: req.department ? `${req.department.departmentId} - ${req.department.name}` : '-',
      helpText: 'Department requesting or funding the spend.',
      fieldType: 'list',
      sourceText: 'Departments master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: req.vendorId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...vendorOptions],
      displayValue: req.vendor ? `${req.vendor.vendorNumber ?? 'VENDOR'} - ${req.vendor.name}` : '-',
      helpText: 'Preferred vendor linked to this requisition.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: req.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: req.subsidiary ? `${req.subsidiary.subsidiaryId} - ${req.subsidiary.name}` : '-',
      helpText: 'Subsidiary that owns the requisition.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: req.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: req.currency
        ? `${req.currency.code ?? req.currency.currencyId} - ${req.currency.name}`
        : '-',
      helpText: 'Transaction currency for the requisition.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(toNumericValue(req.total, 0)),
      displayValue: fmtCurrency(req.total, undefined, moneySettings),
      helpText: 'Current document total based on all requisition line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: req.notes ?? '',
      displayValue: req.notes ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Internal notes or comments for the requisition.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: req.createdAt.toISOString(),
      displayValue: fmtDocumentDate(req.createdAt, moneySettings),
      helpText: 'Date/time the requisition record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this requisition record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: req.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(req.updatedAt, moneySettings),
      helpText: 'Date/time the requisition record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this requisition record.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: PURCHASE_REQUISITION_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: purchaseRequisitionPageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: PURCHASE_REQUISITION_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      id: req.id,
      userId: req.user?.userId ?? '',
      departmentRecordId: req.department?.departmentId ?? '',
      vendorRecordId: req.vendor?.vendorNumber ?? '',
      subsidiaryRecordId: req.subsidiary?.subsidiaryId ?? '',
      currencyRecordId: req.currency?.currencyId ?? req.currency?.code ?? '',
      createdBy: createdByLabel,
      createdFrom: '',
      approvedBy: approvedByLabel,
      neededByDate: req.neededByDate ? fmtDocumentDate(req.neededByDate, moneySettings) : '-',
      total: fmtCurrency(req.total, undefined, moneySettings),
      vendorPrimarySubsidiary: req.vendor?.subsidiary
        ? `${req.vendor.subsidiary.subsidiaryId} - ${req.vendor.subsidiary.name}`
        : '',
      vendorPrimaryCurrency: req.vendor?.currency
        ? `${req.vendor.currency.code ?? req.vendor.currency.currencyId} - ${req.vendor.currency.name}`
        : '',
      vendorInactive: req.vendor ? (req.vendor.inactive ? 'Yes' : 'No') : '',
      vendorId: req.vendor ? `${req.vendor.vendorNumber ?? 'VENDOR'} - ${req.vendor.name}` : '',
      departmentId: req.department ? `${req.department.departmentId} - ${req.department.name}` : '',
      subsidiaryId: req.subsidiary ? `${req.subsidiary.subsidiaryId} - ${req.subsidiary.name}` : '',
      currencyId: req.currency
        ? `${req.currency.code ?? req.currency.currencyId} - ${req.currency.name}`
        : '',
      createdAt: fmtDocumentDate(req.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(req.updatedAt, moneySettings),
    },
  })

  const exportHeaderFields = buildTransactionExportHeaderFields<
    PurchaseRequisitionDetailFieldKey,
    PurchaseRequisitionHeaderField
  >(headerSections, {
    total: () => fmtCurrency(req.total, undefined, moneySettings),
  })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/purchase-requisitions'}
      backLabel={isCustomizing ? '<- Back to Purchase Requisition Detail' : '<- Back to Purchase Requisitions'}
      meta={req.number}
      title={req.title ?? req.number}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Purchase Requisition
          </span>
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: statusTone(req.status).bg, color: statusTone(req.status).color }}
          >
            {formatStatus(req.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={
        isCustomizing ? null : (
          <TransactionActionStack
            mode={isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${req.id}`}
            recordId={req.id}
            primaryActions={
              !isEditing ? (
                <>
                  <MasterDataDetailCreateMenu newHref="/purchase-requisitions/new" />
                  <MasterDataDetailExportMenu
                    title={req.number}
                    fileName={`purchase-requisition-${req.number}`}
                    sections={headerSections.map((section) => ({
                      title: section.title,
                      fields: section.fields.map((field) => ({
                        label: field.label,
                        value:
                          exportHeaderFields.find((candidate) => candidate.label === field.label)?.value ??
                          String(field.value || field.displayValue || '-'),
                        type: field.type,
                        options: field.options,
                      })),
                    }))}
                  />
                  <Link
                    href={`${detailHref}?customize=1`}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Customize
                  </Link>
                  <Link
                    href={`${detailHref}?edit=1`}
                    className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                  >
                    Edit
                  </Link>
                  <DeleteButton resource="purchase-requisitions" id={req.id} />
                </>
              ) : null
            }
          />
        )
      }
    >
      <TransactionDetailFrame
        stats={
          <TransactionStatsRow
            record={{
              total: toNumericValue(req.total, 0),
              neededByDate: req.neededByDate,
              lineCount: req.lineItems.length,
              statusLabel: formatStatus(req.status),
              moneySettings,
            }}
            stats={purchaseRequisitionPageConfig.stats}
          />
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <PurchaseRequisitionDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                sectionDescriptions={purchaseRequisitionPageConfig.sectionDescriptions}
              />
            </div>
          ) : (
            <PurchaseOrderHeaderSections
              purchaseOrderId={req.id}
              editing={isEditing}
              sections={headerSections}
              columns={customization.formColumns}
              updateUrl={`/api/purchase-requisitions?id=${encodeURIComponent(req.id)}`}
            />
          )
        }
        lineItems={
          <>
            <div className="mb-6">
              <RequisitionLineItemForm
                requisitionId={req.id}
                items={items.map((item) => ({
                  ...item,
                  listPrice: toNumericValue(item.listPrice, 0),
                }))}
              />
            </div>
            <RecordDetailSection title="Purchase Requisition Line Items" count={req.lineItems.length}>
              {req.lineItems.length === 0 ? (
                <RecordDetailEmptyState message="No requisition lines yet." />
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <RecordDetailHeaderCell>Line</RecordDetailHeaderCell>
                      <RecordDetailHeaderCell>Item Id</RecordDetailHeaderCell>
                      <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
                      <RecordDetailHeaderCell>Qty</RecordDetailHeaderCell>
                      <RecordDetailHeaderCell>Unit Price</RecordDetailHeaderCell>
                      <RecordDetailHeaderCell>Line Total</RecordDetailHeaderCell>
                      <RecordDetailHeaderCell>Notes</RecordDetailHeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.map((line, index) => (
                      <tr
                        key={line.id}
                        id={`req-line-item-${line.id}`}
                        tabIndex={-1}
                        style={
                          index < lineRows.length - 1
                            ? { borderBottom: '1px solid var(--border-muted)' }
                            : undefined
                        }
                      >
                        <RecordDetailCell>{line.lineNumber}</RecordDetailCell>
                        <RecordDetailCell>{line.itemId ?? '-'}</RecordDetailCell>
                        <RecordDetailCell>{line.description}</RecordDetailCell>
                        <RecordDetailCell>{line.quantity}</RecordDetailCell>
                        <RecordDetailCell>{fmtCurrency(line.unitPrice, undefined, moneySettings)}</RecordDetailCell>
                        <RecordDetailCell>{fmtCurrency(line.lineTotal, undefined, moneySettings)}</RecordDetailCell>
                        <RecordDetailCell>{line.notes ?? '-'}</RecordDetailCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </RecordDetailSection>
          </>
        }
        relatedDocuments={
          <PurchaseRequisitionRelatedDocuments
            purchaseOrders={
              req.purchaseOrder
                ? [
                    {
                      id: req.purchaseOrder.id,
                      number: req.purchaseOrder.number,
                      status: req.purchaseOrder.status,
                      total: toNumericValue(req.purchaseOrder.total, 0),
                      createdAt: req.purchaseOrder.createdAt.toISOString(),
                    },
                  ]
                : []
            }
            moneySettings={moneySettings}
          />
        }
        systemNotes={<SystemNotesSection notes={systemNotes} />}
      />
    </RecordDetailPageShell>
  )
}

function formatStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusTone(status: string | null) {
  const key = (status ?? '').toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d' },
    approved: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    ordered: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
  }
  return styles[key] ?? styles.draft
}
