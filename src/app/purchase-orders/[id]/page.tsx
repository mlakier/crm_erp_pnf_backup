import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { sumMoney } from '@/lib/money'
import PurchaseOrderDetailCustomizeMode from '@/components/PurchaseOrderDetailCustomizeMode'
import PurchaseOrderDetailExportButton from '@/components/PurchaseOrderDetailExportButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import RecordHeaderDetails, {
  type RecordHeaderField,
} from '@/components/RecordHeaderDetails'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import PurchaseOrderPageActions from '@/components/PurchaseOrderPageActions'
import PurchaseOrderRelatedDocuments from '@/components/PurchaseOrderRelatedDocuments'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  PURCHASE_ORDER_DETAIL_FIELDS,
  PURCHASE_ORDER_LINE_COLUMNS,
  PURCHASE_ORDER_REFERENCE_SOURCES,
  type PurchaseOrderDetailFieldKey,
} from '@/lib/purchase-order-detail-customization'
import { loadPurchaseOrderDetailCustomization } from '@/lib/purchase-order-detail-customization-store'
import { buildReceiptDisplayNumberMap } from '@/lib/receipt-display-number'
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
import { purchaseOrderPageConfig } from '@/lib/transaction-page-configs/purchase-order'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'

const PURCHASE_ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SYSTEM_NOTE_CURRENCY_FIELDS = new Set(['Total', 'Unit Price', 'Line Total'])
type PurchaseOrderDetailHeaderField = RecordHeaderField & { key: PurchaseOrderDetailFieldKey }

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { moneySettings } = await loadCompanyDisplaySettings()
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'

  const [po, vendors, subsidiaries, items, allReceiptIds, activities, customization] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        currency: true,
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            item: {
              select: { id: true, itemId: true, name: true, listPrice: true },
            },
          },
        },
        vendor: {
          include: {
            subsidiary: true,
            currency: true,
          },
        },
        receipts: { orderBy: { date: 'desc' } },
        requisition: true,
        bills: {
          orderBy: { date: 'desc' },
          include: {
            lineItems: {
              select: {
                id: true,
                quantity: true,
              },
            },
            billPayments: {
              orderBy: { date: 'desc' },
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
        subsidiaryId: true,
        currencyId: true,
        inactive: true,
      },
    }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
      select: { id: true, itemId: true, name: true, listPrice: true },
    }),
    prisma.receipt.findMany({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'purchase-order',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadPurchaseOrderDetailCustomization(),
  ])

  if (!po) notFound()
  const purchaseOrderCurrencyCode = po.currency?.code ?? po.currency?.currencyId ?? undefined

  const receivedQuantity = po.receipts.reduce((sum, receipt) => sum + receipt.quantity, 0)
  const billedQuantity = po.bills.reduce(
    (sum, bill) => sum + bill.lineItems.reduce((lineSum, lineItem) => lineSum + lineItem.quantity, 0),
    0
  )
  const detailHref = `/purchase-orders/${po.id}`
  const receiptNumberMap = buildReceiptDisplayNumberMap(allReceiptIds)
  const activityUserIds = Array.from(new Set(activities.map((activity) => activity.userId).filter(Boolean))) as string[]
  const activityUsers = activityUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: activityUserIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const activityUserLabelById = new Map(
    activityUsers.map((user) => [
      user.id,
      user.userId && user.name
        ? `${user.userId} - ${user.name}`
        : user.userId ?? user.name ?? user.email,
    ])
  )
  const approvedStatusActivity = activities.find((activity) => {
    const parsed = parseFieldChangeSummary(activity.summary)
    return (
      parsed?.fieldName === 'Status' &&
      parsed.newValue.toLowerCase() === 'approved'
    )
  })
  const approvedByLabel = approvedStatusActivity?.userId
    ? activityUserLabelById.get(approvedStatusActivity.userId) ?? approvedStatusActivity.userId
    : ''
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
          oldValue: formatSystemNoteValue(parsed.fieldName, parsed.oldValue, moneySettings, purchaseOrderCurrencyCode),
          newValue: formatSystemNoteValue(parsed.fieldName, parsed.newValue, moneySettings, purchaseOrderCurrencyCode),
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
  const derivedLineRows = po.lineItems.reduce<Array<{
    id: string
    displayOrder: number
    itemRecordId: string | null
    itemId: string | null
    itemName: string | null
    description: string
    quantity: number
    receivedQuantity: number
    billedQuantity: number
    openQuantity: number
    unitPrice: number
    lineTotal: number
  }>>((acc, item) => {
    const allocatedReceived = acc.reduce((sum, row) => sum + row.receivedQuantity, 0)
    const remainingReceived = Math.max(0, receivedQuantity - allocatedReceived)
    const lineReceivedQuantity = Math.min(item.quantity, remainingReceived)
    const allocatedBilled = acc.reduce((sum, row) => sum + row.billedQuantity, 0)
    const remainingBilled = Math.max(0, billedQuantity - allocatedBilled)
    const lineBilledQuantity = Math.min(item.quantity, remainingBilled)

    acc.push({
      id: item.id,
      displayOrder: item.displayOrder,
      itemRecordId: item.item?.id ?? null,
      itemId: item.item?.itemId ?? null,
      itemName: item.item?.name ?? null,
      description: item.description,
      quantity: item.quantity,
      receivedQuantity: lineReceivedQuantity,
      billedQuantity: lineBilledQuantity,
      openQuantity: Math.max(0, item.quantity - lineReceivedQuantity),
      unitPrice: toNumericValue(item.unitPrice, 0),
      lineTotal: toNumericValue(item.lineTotal, 0),
    })

    return acc
  }, [])
  const computedTotal = sumMoney(derivedLineRows.map((row) => row.lineTotal))
  const vendorOptions = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.vendorNumber} - ${vendor.name}`,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))

  const createdByLabel =
    po.user?.userId && po.user?.name
      ? `${po.user.userId} - ${po.user.name}`
      : po.user?.userId ?? po.user?.name ?? po.user?.email ?? '-'

  const headerFieldDefinitions: Record<PurchaseOrderDetailFieldKey, PurchaseOrderDetailHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: po.id,
      helpText: 'Internal database identifier for the purchase order record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this purchase order.',
    },
    number: {
      key: 'number',
      label: 'Purchase Order Id',
      value: po.number,
      editable: true,
      type: 'text',
      helpText: 'Unique purchase order number used across procure-to-pay workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, provenance, and ownership for the purchase order.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: po.user?.userId ?? '',
      helpText: 'Internal user identifier for the purchase order creator.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this purchase order.',
    },
    vendorRecordId: {
      key: 'vendorRecordId',
      label: 'Vendor Id',
      value: po.vendor?.vendorNumber ?? '',
      helpText: 'Internal vendor identifier linked to this purchase order.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this purchase order.',
    },
    subsidiaryRecordId: {
      key: 'subsidiaryRecordId',
      label: 'Subsidiary Id',
      value: po.subsidiary?.subsidiaryId ?? '',
      helpText: 'Internal subsidiary identifier linked to this purchase order.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this purchase order.',
    },
    currencyRecordId: {
      key: 'currencyRecordId',
      label: 'Currency Id',
      value: po.currency?.currencyId ?? po.currency?.code ?? '',
      helpText: 'Internal currency identifier linked to this purchase order.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this purchase order.',
    },
    requisitionRecordId: {
      key: 'requisitionRecordId',
      label: 'Requisition Id',
      value: po.requisition?.number ?? '',
      helpText: 'Internal requisition identifier linked as the source document.',
      fieldType: 'text',
      sourceText: 'Purchase requisition transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this purchase order.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      displayValue: createdByLabel,
      helpText: 'User who created the purchase order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, provenance, and ownership for the purchase order.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: po.requisition?.number ?? '',
      displayValue: po.requisition ? (
        <Link
          href={`/purchase-requisitions/${po.requisition.id}`}
          className="hover:underline"
          style={{ color: 'var(--accent-primary-strong)' }}
        >
          {po.requisition.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Source purchase requisition that created this purchase order.',
      fieldType: 'text',
      sourceText: 'Purchase requisition transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, provenance, and ownership for the purchase order.',
    },
    approvedBy: {
      key: 'approvedBy',
      label: 'Approved By',
      value: approvedByLabel,
      displayValue: approvedByLabel || '-',
      helpText: 'User who approved the purchase order based on the approval activity trail.',
      fieldType: 'text',
      sourceText: 'System Notes / activity history',
      subsectionTitle: 'Workflow & Approval',
      subsectionDescription: 'Current workflow status and approval ownership for the purchase order.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: po.status ?? '',
      editable: true,
      type: 'select',
      options: PURCHASE_ORDER_STATUS_OPTIONS,
      helpText: 'Current lifecycle stage of the purchase order.',
      fieldType: 'list',
      sourceText: 'System purchase order statuses',
      subsectionTitle: 'Workflow & Approval',
      subsectionDescription: 'Current workflow status and approval ownership for the purchase order.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: po.vendorId,
      editable: true,
      type: 'select',
      options: vendorOptions,
      displayValue: `${po.vendor.vendorNumber ?? 'VENDOR'} - ${po.vendor.name}`,
      helpText: 'Vendor record linked to this purchase order.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Vendor, subsidiary, currency, and total purchasing context for the order.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: po.subsidiaryId ?? '',
      href: po.subsidiary ? `/subsidiaries/${po.subsidiary.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: po.subsidiary ? `${po.subsidiary.subsidiaryId} - ${po.subsidiary.name}` : '-',
      helpText: 'Subsidiary that owns this purchase order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Vendor, subsidiary, currency, and total purchasing context for the order.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: po.currencyId ?? '',
      href: po.currency ? `/currencies/${po.currency.id}` : null,
      editable: false,
      displayValue: po.currency ? `${po.currency.code ?? po.currency.currencyId} - ${po.currency.name}` : '-',
      helpText: 'Transaction currency for this purchase order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Vendor, subsidiary, currency, and total purchasing context for the order.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: computedTotal.toString(),
      displayValue: fmtCurrency(computedTotal, purchaseOrderCurrencyCode, moneySettings),
      helpText: 'Current document total based on all purchase order line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Vendor, subsidiary, currency, and total purchasing context for the order.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: po.createdAt.toISOString(),
      displayValue: fmtDocumentDate(po.createdAt, moneySettings),
      helpText: 'Date/time the purchase order record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this purchase order.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: po.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(po.updatedAt, moneySettings),
      helpText: 'Date/time the purchase order record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this purchase order.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: PURCHASE_ORDER_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: purchaseOrderPageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: PURCHASE_ORDER_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      id: po.id,
      userId: po.user?.userId ?? '',
      vendorRecordId: po.vendor?.vendorNumber ?? '',
      subsidiaryRecordId: po.subsidiary?.subsidiaryId ?? '',
      currencyRecordId: po.currency?.currencyId ?? po.currency?.code ?? '',
      requisitionRecordId: po.requisition?.number ?? '',
      createdBy: createdByLabel,
      createdFrom: po.requisition?.number ?? '',
      approvedBy: approvedByLabel,
      status:
        PURCHASE_ORDER_STATUS_OPTIONS.find((option) => option.value === (po.status ?? ''))?.label ??
        (po.status ?? ''),
      vendorId: `${po.vendor.vendorNumber ?? 'VENDOR'} - ${po.vendor.name}`,
      subsidiaryId: po.subsidiary ? `${po.subsidiary.subsidiaryId} - ${po.subsidiary.name}` : '',
      currencyId: po.currency ? `${po.currency.code ?? po.currency.currencyId} - ${po.currency.name}` : '',
        total: fmtCurrency(computedTotal, purchaseOrderCurrencyCode, moneySettings),
      createdAt: fmtDocumentDate(po.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(po.updatedAt, moneySettings),
    },
  })

  const statsRecord = {
    total: computedTotal,
    currencyCode: purchaseOrderCurrencyCode ?? null,
    lineCount: derivedLineRows.length,
    receiptCount: po.receipts.length,
    statusLabel: po.status ? po.status.charAt(0).toUpperCase() + po.status.slice(1).toLowerCase() : 'Unknown',
    moneySettings,
  } as const
  const statPreviewCards = purchaseOrderPageConfig.stats.map((stat) => ({
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
    PURCHASE_ORDER_REFERENCE_SOURCES,
    {
      vendor: po.vendor,
      requisition: po.requisition,
      owner: po.user,
      subsidiary: po.subsidiary,
      currency: po.currency,
    },
    {
      vendor: po.vendor ? `/vendors/${po.vendor.id}` : null,
      requisition: po.requisition ? `/purchase-requisitions/${po.requisition.id}` : null,
      owner: po.user ? `/users/${po.user.id}` : null,
      subsidiary: po.subsidiary ? `/subsidiaries/${po.subsidiary.id}` : null,
      currency: po.currency ? `/currencies/${po.currency.id}` : null,
    },
  )
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(
    PURCHASE_ORDER_REFERENCE_SOURCES,
    {
      vendor: po.vendor,
      requisition: po.requisition,
      owner: po.user,
      subsidiary: po.subsidiary,
      currency: po.currency,
    },
  )
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = PURCHASE_ORDER_REFERENCE_SOURCES.find(
        (entry) => entry.id === referenceLayout.referenceId,
      )
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
    PurchaseOrderDetailFieldKey,
    PurchaseOrderDetailHeaderField
  >(headerSections, {
    total: () => fmtCurrency(computedTotal, purchaseOrderCurrencyCode, moneySettings),
  })

  const orderedVisibleLineColumns = getOrderedVisibleTransactionLineColumns(
    PURCHASE_ORDER_LINE_COLUMNS,
    customization
  )

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/purchase-orders'}
      backLabel={isCustomizing ? '<- Back to Purchase Order Detail' : '<- Back to Purchase Orders'}
      meta={po.number}
      title={po.vendor.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Purchase Order
          </span>
          <StatusBadge status={po.status} />
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={
        isCustomizing ? null : (
          <>
            {!isEditing ? (
              <MasterDataDetailCreateMenu
                newHref="/purchase-orders/new"
                duplicateHref={`/purchase-orders/new?duplicateFrom=${encodeURIComponent(po.id)}`}
              />
            ) : null}
            <PurchaseOrderDetailExportButton
              number={po.number}
              vendorName={po.vendor.name}
              vendorEmail={po.vendor.email ?? null}
              status={po.status ? po.status.charAt(0).toUpperCase() + po.status.slice(1).toLowerCase() : 'Unknown'}
              total={fmtCurrency(computedTotal, purchaseOrderCurrencyCode, moneySettings)}
              headerFields={exportHeaderFields}
              headerMap={{
                purchaseOrderNumber: po.number,
                vendorNumber: po.vendor.vendorNumber ?? '',
                vendorName: po.vendor.name,
                subsidiary: po.subsidiary ? `${po.subsidiary.subsidiaryId} - ${po.subsidiary.name}` : '',
                status: po.status ? po.status.charAt(0).toUpperCase() + po.status.slice(1).toLowerCase() : 'Unknown',
                total: fmtCurrency(computedTotal, purchaseOrderCurrencyCode, moneySettings),
                createdBy:
                  po.user?.userId && po.user?.name
                    ? `${po.user.userId} - ${po.user.name}`
                    : po.user?.userId ?? po.user?.name ?? po.user?.email ?? '',
                createdFrom: po.requisition?.number ?? '',
                approvedBy: approvedByLabel,
              }}
              lineItems={derivedLineRows.map((row, index) => ({
                line: index + 1,
                itemId: row.itemId ?? '-',
                itemName: row.itemName ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: row.receivedQuantity,
                openQuantity: row.openQuantity,
                billedQuantity: row.billedQuantity,
                unitPrice: row.unitPrice,
                lineTotal: row.lineTotal,
              }))}
            />
            {!isEditing ? (
              <Link
                href={`${detailHref}?customize=1`}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Customize
              </Link>
            ) : null}
            <PurchaseOrderPageActions
              purchaseOrderId={po.id}
              detailHref={detailHref}
              editing={isEditing}
              customizing={isCustomizing}
            />
          </>
        )
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={
          isCustomizing ? null : (
            <TransactionStatsRow
              record={statsRecord}
              stats={purchaseOrderPageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <PurchaseOrderDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={purchaseOrderPageConfig.sectionDescriptions}
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
                  containerDescription="Expanded context from linked records on this purchase order."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={po.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Purchase Order Details"
                containerDescription="Core purchase order fields organized into configurable sections."
                showSubsections={false}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : (
            <TransactionLineItemsSection
              editing={isEditing}
              rows={derivedLineRows}
              purchaseOrderId={po.id}
              userId={po.userId}
              lineColumns={orderedVisibleLineColumns}
              lineSettings={customization.lineSettings}
              lineColumnCustomization={customization.lineColumns}
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
                count: 1,
                emptyMessage: 'No related vendor is linked to this purchase order.',
                rows: [
                  {
                    id: po.vendor.id,
                    type: 'Vendor',
                    reference: po.vendor.vendorNumber ?? po.vendor.id,
                    name: po.vendor.name,
                    details: [po.vendor.email, po.vendor.phone].filter(Boolean).join(' | ') || '-',
                    href: `/vendors/${po.vendor.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <PurchaseOrderRelatedDocuments
            embedded
            showDisplayControl={false}
            moneySettings={moneySettings}
            requisitions={
              po.requisition
                ? [
                    {
                      id: po.requisition.id,
                      number: po.requisition.number,
                      status: po.requisition.status,
                      total: toNumericValue(po.requisition.total, 0),
                      currencyCode: purchaseOrderCurrencyCode,
                      title: po.requisition.title ?? null,
                      priority: po.requisition.priority ?? null,
                      createdAt: po.requisition.createdAt.toISOString(),
                    },
                  ]
                : []
            }
            receipts={po.receipts.map((receipt) => ({
              id: receipt.id,
              number: receiptNumberMap.get(receipt.id) ?? receipt.id,
              date: receipt.date.toISOString(),
              status: receipt.status,
              quantity: receipt.quantity,
              createdAt: receipt.createdAt.toISOString(),
              notes: receipt.notes ?? null,
            }))}
            bills={po.bills.map((bill) => ({
              id: bill.id,
              number: bill.number,
              status: bill.status,
              total: toNumericValue(bill.total, 0),
              currencyCode: purchaseOrderCurrencyCode,
              date: bill.date.toISOString(),
              dueDate: bill.dueDate ? bill.dueDate.toISOString() : null,
              notes: bill.notes ?? null,
            }))}
            billPayments={po.bills.flatMap((bill) =>
              bill.billPayments.map((payment) => ({
                id: payment.id,
                number: payment.number,
                amount: toNumericValue(payment.amount, 0),
                currencyCode: purchaseOrderCurrencyCode,
                date: payment.date.toISOString(),
                method: payment.method ?? null,
                status: payment.status,
                billNumber: bill.number,
                reference: payment.reference ?? null,
              }))
            )}
          />
        )}
        relatedDocumentsCount={
          (po.requisition ? 1 : 0) +
          po.receipts.length +
          po.bills.length +
          po.bills.reduce((sum, bill) => sum + bill.billPayments.length, 0)
        }
        supplementarySections={null}
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId="purchase-order-communications-toolbar"
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: po.id,
              userId: po.userId,
              number: po.number,
              counterpartyName: po.vendor.name,
              counterpartyEmail: po.vendor.email ?? null,
              fromEmail: po.user?.email ?? null,
              status: po.status ?? 'Draft',
              total: fmtCurrency(computedTotal, purchaseOrderCurrencyCode, moneySettings),
              lineItems: derivedLineRows.map((row, index) => ({
                line: index + 1,
                itemId: row.itemId ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: row.receivedQuantity,
                openQuantity: row.openQuantity,
                billedQuantity: row.billedQuantity,
                unitPrice: row.unitPrice,
                lineTotal: row.lineTotal,
              })),
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId="purchase-order-communications-toolbar"
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId="purchase-order-system-notes-toolbar" showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId="purchase-order-system-notes-toolbar"
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (status ?? '').toLowerCase()
  const styles: Record<string, { backgroundColor: string; color: string }> = {
    draft: { backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    pending: { backgroundColor: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    approved: { backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    received: { backgroundColor: 'rgba(34,197,94,0.16)', color: '#86efac' },
    cancelled: { backgroundColor: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
  }
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown'
  return (
    <span
      className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
      style={styles[key] ?? { backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
    >
      {label}
    </span>
  )
}

function formatSystemNoteValue(
  fieldName: string,
  value: string | null | undefined,
  moneySettings?: Parameters<typeof fmtCurrency>[2],
  currencyCode?: string,
) {
  if (!value || !value.trim()) return '-'

  if (SYSTEM_NOTE_CURRENCY_FIELDS.has(fieldName)) {
    const numericValue = Number(value)
    if (!Number.isNaN(numericValue)) {
        return fmtCurrency(numericValue, currencyCode, moneySettings)
    }
  }

  return value
}
