import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import RecordHeaderDetails, {
  type RecordHeaderField,
} from '@/components/RecordHeaderDetails'
import PurchaseRequisitionDetailCustomizeMode from '@/components/PurchaseRequisitionDetailCustomizeMode'
import PurchaseRequisitionLineItemsSection from '@/components/PurchaseRequisitionLineItemsSection'
import PurchaseRequisitionRelatedDocuments from '@/components/PurchaseRequisitionRelatedDocuments'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  PURCHASE_REQUISITION_DETAIL_FIELDS,
  PURCHASE_REQUISITION_LINE_COLUMNS,
  PURCHASE_REQUISITION_REFERENCE_SOURCES,
  type PurchaseRequisitionDetailFieldKey,
} from '@/lib/purchase-requisitions-detail-customization'
import { loadPurchaseRequisitionDetailCustomization } from '@/lib/purchase-requisitions-detail-customization-store'
import { purchaseRequisitionPageConfig } from '@/lib/transaction-page-configs/purchase-requisition'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import { buildReceiptDisplayNumberMap } from '@/lib/receipt-display-number'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'

type PurchaseRequisitionHeaderField = RecordHeaderField & { key: PurchaseRequisitionDetailFieldKey }

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
            include: {
              receipts: { orderBy: { date: 'desc' } },
              bills: {
                orderBy: { date: 'desc' },
                include: {
                  billPayments: {
                    orderBy: { date: 'desc' },
                  },
                },
              },
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
  const requisitionCurrencyCode = req.currency?.code ?? req.currency?.currencyId ?? undefined

  const detailHref = `/purchase-requisitions/${req.id}`
  const receiptNumberMap = buildReceiptDisplayNumberMap(
    await prisma.receipt.findMany({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  )
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
  const communications = activities
    .map((activity) => {
      const parsed = parseCommunicationSummary(activity.summary)
      if (!parsed) return null

      return {
        id: activity.id,
        date: fmtDocumentDate(activity.createdAt, moneySettings),
        direction: parsed.direction || '-',
        channel: parsed.channel || '-',
        subject: parsed.subject || '-',
        from: parsed.from || '-',
        to: parsed.to || '-',
        status: parsed.status || '-',
      }
    })
    .filter((communication): communication is Exclude<typeof communication, null> => Boolean(communication))

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

  const orderedVisibleLineColumns = getOrderedVisibleTransactionLineColumns(
    PURCHASE_REQUISITION_LINE_COLUMNS,
    customization
  )

  const headerFieldDefinitions: Record<
    PurchaseRequisitionDetailFieldKey,
    PurchaseRequisitionHeaderField
  > = {
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
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Current workflow status, urgency, approval context, and required-by timing.',
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
      subsectionTitle: 'Request Details',
      subsectionDescription: 'Business purpose, summary, and internal notes for the requisition request.',
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
      subsectionTitle: 'Request Details',
      subsectionDescription: 'Business purpose, summary, and internal notes for the requisition request.',
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
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Current workflow status, urgency, approval context, and required-by timing.',
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
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Current workflow status, urgency, approval context, and required-by timing.',
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
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Current workflow status, urgency, approval context, and required-by timing.',
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
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Department, vendor, subsidiary, currency, and financial context for the request.',
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
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Department, vendor, subsidiary, currency, and financial context for the request.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: req.subsidiaryId ?? '',
      href: req.subsidiary ? `/subsidiaries/${req.subsidiary.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: req.subsidiary ? `${req.subsidiary.subsidiaryId} - ${req.subsidiary.name}` : '-',
      helpText: 'Subsidiary that owns the requisition.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Department, vendor, subsidiary, currency, and financial context for the request.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: req.currencyId ?? '',
      href: req.currency ? `/currencies/${req.currency.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: req.currency
        ? `${req.currency.code ?? req.currency.currencyId} - ${req.currency.name}`
        : '-',
      helpText: 'Transaction currency for the requisition.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Department, vendor, subsidiary, currency, and financial context for the request.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(toNumericValue(req.total, 0)),
      displayValue: fmtCurrency(req.total, requisitionCurrencyCode, moneySettings),
      helpText: 'Current document total based on all requisition line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Department, vendor, subsidiary, currency, and financial context for the request.',
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
      subsectionTitle: 'Request Details',
      subsectionDescription: 'Business purpose, summary, and internal notes for the requisition request.',
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
      total: fmtCurrency(req.total, requisitionCurrencyCode, moneySettings),
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

  const statsRecord = {
    total: toNumericValue(req.total, 0),
    currencyCode: requisitionCurrencyCode ?? null,
    neededByDate: req.neededByDate,
    lineCount: req.lineItems.length,
    statusLabel: formatStatus(req.status),
    moneySettings,
  } as const
  const statPreviewCards = purchaseRequisitionPageConfig.stats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(statsRecord),
    href: stat.getHref?.(statsRecord) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(statsRecord),
    cardTone: stat.getCardTone?.(statsRecord),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
  }))

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    PURCHASE_REQUISITION_REFERENCE_SOURCES,
    {
      vendor: req.vendor,
      department: req.department,
      owner: req.user,
      subsidiary: req.subsidiary,
      currency: req.currency,
    },
    {
      vendor: req.vendor ? `/vendors/${req.vendor.id}` : null,
      department: req.department ? `/departments/${req.department.id}` : null,
      owner: req.user ? `/users/${req.user.id}` : null,
      subsidiary: req.subsidiary ? `/subsidiaries/${req.subsidiary.id}` : null,
      currency: req.currency ? `/currencies/${req.currency.id}` : null,
    },
  )
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(
    PURCHASE_REQUISITION_REFERENCE_SOURCES,
    {
      vendor: req.vendor,
      department: req.department,
      owner: req.user,
      subsidiary: req.subsidiary,
      currency: req.currency,
    },
  )
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = PURCHASE_REQUISITION_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
      if (!source) return null
      const fields = source.fields
        .filter((field) => referenceLayout.fields[field.id]?.visible)
        .sort((left, right) => {
          const leftConfig = referenceLayout.fields[left.id]
          const rightConfig = referenceLayout.fields[right.id]
          if (!leftConfig || !rightConfig) return 0
          if (leftConfig.column !== rightConfig.column) return leftConfig.column - rightConfig.column
          return leftConfig.order - rightConfig.order
        })
        .map((field) => ({
          ...allFieldDefinitions[field.id],
          column: referenceLayout.fields[field.id]?.column ?? 1,
          order: referenceLayout.fields[field.id]?.order ?? 0,
        }))

      if (fields.length === 0) return null

      return {
        title: source.label,
        description: source.description,
        columns: referenceLayout.formColumns,
        rows: Math.max(1, ...fields.map((field) => Math.max(1, (field.order ?? 0) + 1))),
        fields,
      }
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
  const referenceColumns = Math.max(1, ...referenceSections.map((section) => section.columns))

  const exportHeaderFields = buildTransactionExportHeaderFields<
    PurchaseRequisitionDetailFieldKey,
    PurchaseRequisitionHeaderField
  >(headerSections, {
    total: () => fmtCurrency(req.total, requisitionCurrencyCode, moneySettings),
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
          <TransactionActionStack
            mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${req.id}`}
            recordId={req.id}
            primaryActions={
              isEditing ? (
                <Link
                  href={`${detailHref}?customize=1`}
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Customize
                </Link>
              ) : (
                <>
                  <MasterDataDetailCreateMenu
                    newHref="/purchase-requisitions/new"
                    duplicateHref={`/purchase-requisitions/new?duplicateFrom=${encodeURIComponent(req.id)}`}
                  />
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
              )
            }
          />
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={
          isCustomizing ? null : (
            <TransactionStatsRow
              record={statsRecord}
              stats={purchaseRequisitionPageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <PurchaseRequisitionDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={purchaseRequisitionPageConfig.sectionDescriptions}
                statPreviewCards={statPreviewCards}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {referenceSections.length > 0 ? (
                <RecordHeaderDetails
                  editing={false}
                  sections={referenceSections.map((section) => ({
                    title: section.title,
                    description: section.description,
                    rows: section.rows,
                    fields: section.fields,
                  }))}
                  columns={referenceColumns}
                  containerTitle="Reference Details"
                  containerDescription="Expanded context from linked records on this purchase requisition."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={req.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Purchase Requisition Details"
                containerDescription="Core purchase requisition fields organized into configurable sections."
                showSubsections={false}
                updateUrl={`/api/purchase-requisitions?id=${encodeURIComponent(req.id)}`}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : isEditing ? (
            <TransactionLineItemsSection
              editing
              rows={req.lineItems.map((line, index) => ({
                id: line.id,
                displayOrder: index,
                itemRecordId: line.item?.id ?? null,
                itemId: line.item?.itemId ?? null,
                itemName: line.item?.name ?? null,
                description: line.description,
                quantity: line.quantity,
                receivedQuantity: 0,
                billedQuantity: 0,
                openQuantity: line.quantity,
                unitPrice: toNumericValue(line.unitPrice, 0),
                lineTotal: toNumericValue(line.lineTotal, 0),
                notes: line.notes ?? '',
              }))}
              purchaseOrderId={req.id}
              userId={req.userId}
              itemOptions={items.map((item) => ({
                id: item.id,
                itemId: item.itemId ?? 'Pending',
                name: item.name,
                unitPrice: toNumericValue(item.listPrice, 0),
                itemDrivenValues: {
                  description: item.name,
                  unitPrice: String(toNumericValue(item.listPrice, 0)),
                },
              }))}
              lineColumns={orderedVisibleLineColumns}
              lineSettings={customization.lineSettings}
              lineColumnCustomization={customization.lineColumns}
              lineItemApiBasePath="/api/purchase-requisitions/line-items"
              deleteResource="purchase-requisitions/line-items"
              parentIdFieldName="requisitionId"
              sectionTitle="Purchase Requisition Line Items"
              tableId="purchase-requisition-line-items"
              allowAddLines
            />
          ) : (
            <PurchaseRequisitionLineItemsSection
              requisitionId={req.id}
              items={items
                .filter((item): item is typeof item & { itemId: string } => Boolean(item.itemId))
                .map((item) => ({
                  ...item,
                  listPrice: toNumericValue(item.listPrice, 0),
                }))}
              lineRows={lineRows}
              currencyCode={requisitionCurrencyCode ?? null}
              moneySettings={moneySettings}
              lineSettings={customization.lineSettings}
              lineColumns={customization.lineColumns}
            />
          )
        }
        relatedRecords={isCustomizing ? null : (
          <RelatedRecordsSection
            embedded
            showDisplayControl={false}
            tabs={[
              {
                key: 'vendor',
                label: 'Vendor',
                count: req.vendor ? 1 : 0,
                emptyMessage: 'No related vendor is linked to this purchase requisition.',
                rows: req.vendor
                  ? [
                      {
                        id: req.vendor.id,
                        type: 'Vendor',
                        reference: req.vendor.vendorNumber ?? req.vendor.id,
                        name: req.vendor.name,
                        details: [req.vendor.email, req.vendor.phone].filter(Boolean).join(' | ') || '-',
                        href: `/vendors/${req.vendor.id}`,
                      },
                    ]
                  : [],
              },
            ]}
          />
        )}
        relatedRecordsCount={req.vendor ? 1 : 0}
        relatedDocuments={isCustomizing ? null : (
          <PurchaseRequisitionRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={requisitionCurrencyCode}
            purchaseOrders={
              req.purchaseOrder
                ? [
                    {
                      id: req.purchaseOrder.id,
                      number: req.purchaseOrder.number,
                      status: req.purchaseOrder.status,
                      total: toNumericValue(req.purchaseOrder.total, 0),
                      createdAt: req.purchaseOrder.createdAt.toISOString(),
                      currencyCode: requisitionCurrencyCode,
                    },
                  ]
                : []
            }
            receipts={
              req.purchaseOrder?.receipts.map((receipt) => ({
                id: receipt.id,
                number: receiptNumberMap.get(receipt.id) ?? receipt.id,
                date: receipt.date,
                status: receipt.status,
                quantity: receipt.quantity,
                notes: receipt.notes ?? null,
              })) ?? []
            }
            bills={
              req.purchaseOrder?.bills.map((bill) => ({
                id: bill.id,
                number: bill.number,
                date: bill.date,
                dueDate: bill.dueDate,
                status: bill.status,
                total: toNumericValue(bill.total, 0),
                notes: bill.notes ?? null,
                currencyCode: requisitionCurrencyCode,
              })) ?? []
            }
            billPayments={
              req.purchaseOrder?.bills.flatMap((bill) =>
                bill.billPayments.map((payment) => ({
                  id: payment.id,
                  number: payment.number,
                  date: payment.date,
                  status: payment.status,
                  amount: toNumericValue(payment.amount, 0),
                  reference: payment.reference ?? null,
                  billNumber: bill.number,
                  currencyCode: requisitionCurrencyCode,
                })),
              ) ?? []
            }
            moneySettings={moneySettings}
          />
        )}
        relatedDocumentsCount={
          (req.purchaseOrder ? 1 : 0) +
          (req.purchaseOrder?.receipts.length ?? 0) +
          (req.purchaseOrder?.bills.length ?? 0) +
          (req.purchaseOrder?.bills.reduce((sum, bill) => sum + bill.billPayments.length, 0) ?? 0)
        }
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId="purchase-requisition-communications-toolbar"
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: req.id,
              userId: req.userId,
              number: req.number,
              counterpartyName: req.vendor?.name ?? 'Vendor',
              counterpartyEmail: req.vendor?.email ?? null,
              fromEmail: req.user?.email ?? null,
              status: formatStatus(req.status),
              total: fmtCurrency(req.total, requisitionCurrencyCode, moneySettings),
              lineItems: req.lineItems.map((line, index) => ({
                line: index + 1,
                itemId: line.item?.itemId ?? '-',
                description: line.description,
                quantity: line.quantity,
                receivedQuantity: 0,
                openQuantity: line.quantity,
                billedQuantity: 0,
                unitPrice: toNumericValue(line.unitPrice, 0),
                lineTotal: toNumericValue(line.lineTotal, 0),
              })),
              sendEmailEndpoint: '/api/purchase-requisitions?action=send-email',
              recordIdFieldName: 'requisitionId',
              documentLabel: 'Purchase Requisition',
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId="purchase-requisition-communications-toolbar"
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId="purchase-requisition-system-notes-toolbar" showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId="purchase-requisition-system-notes-toolbar"
        systemNotesToolbarPlacement="tab-bar"
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
