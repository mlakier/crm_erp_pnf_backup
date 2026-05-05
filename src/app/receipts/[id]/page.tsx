import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadListValues } from '@/lib/load-list-values'
import { buildReceiptDisplayNumberMap } from '@/lib/receipt-display-number'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import ReceiptDetailCustomizeMode from '@/components/ReceiptDetailCustomizeMode'
import ReceiptLineItemsSection from '@/components/ReceiptLineItemsSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import RecordStatusButton from '@/components/RecordStatusButton'
import SystemNotesSection from '@/components/SystemNotesSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import ReceiptGlImpactSection from '@/components/ReceiptGlImpactSection'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import ReceiptRelatedDocuments from '@/components/ReceiptRelatedDocuments'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import { canReceivePurchaseOrderLine } from '@/lib/item-business-rules'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionGlImpactRows,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
} from '@/lib/transaction-detail-helpers'
import {
  RECEIPT_DETAIL_FIELDS,
  RECEIPT_REFERENCE_SOURCES,
  RECEIPT_STAT_CARDS,
  type ReceiptDetailFieldKey,
} from '@/lib/receipt-detail-customization'
import { loadReceiptDetailCustomization } from '@/lib/receipt-detail-customization-store'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'

type ReceiptHeaderField = {
  key: ReceiptDetailFieldKey
} & RecordHeaderField

function getReceiptStatusActions(currentStatus: string) {
  const normalized = currentStatus.toLowerCase()

  const allActions = [
    {
      id: 'receipt-mark-pending',
      nextValue: 'pending',
      label: 'Mark Pending',
      tone: 'amber' as const,
    },
    {
      id: 'receipt-mark-received',
      nextValue: 'received',
      label: 'Mark Received',
      tone: 'emerald' as const,
    },
    {
      id: 'receipt-cancel',
      nextValue: 'cancelled',
      label: 'Cancel',
      tone: 'red' as const,
    },
  ]

  return allActions.filter((action) => action.nextValue !== normalized)
}

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  await connection()
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const { moneySettings } = await loadCompanyDisplaySettings()

  const [receipt, allReceiptIds, statusValues, customization] = await Promise.all([
    prisma.receipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            vendor: true,
            user: true,
            requisition: true,
            lineItems: {
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                item: {
                  select: {
                    id: true,
                    itemId: true,
                    name: true,
                    dropShipItem: true,
                    specialOrderItem: true,
                  },
                },
                receiptLines: { select: { id: true, quantity: true, receiptId: true } },
              },
            },
            bills: {
              include: {
                billPayments: true,
              },
            },
            subsidiary: true,
            currency: true,
          },
        },
        lines: {
          orderBy: { id: 'asc' },
          include: {
            purchaseOrderLineItem: {
              include: {
                item: {
                  select: {
                    id: true,
                    itemId: true,
                    name: true,
                    dropShipItem: true,
                    specialOrderItem: true,
                  },
                },
                receiptLines: { select: { id: true, quantity: true, receiptId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.receipt.findMany({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    loadListValues('RECEIPT-STATUS'),
    loadReceiptDetailCustomization(),
  ])

  if (!receipt) notFound()

  const purchaseOrderCurrencyCode =
    receipt.purchaseOrder.currency?.code ?? receipt.purchaseOrder.currency?.currencyId ?? undefined

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: receipt.id },
    include: {
      lineItems: {
        include: {
          account: {
            select: { accountId: true, accountNumber: true, name: true },
          },
        },
      },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  const detailHref = `/receipts/${receipt.id}`
  const receiptNumberMap = buildReceiptDisplayNumberMap(allReceiptIds)
  const receiptLabel = receiptNumberMap.get(receipt.id) ?? receipt.id
  const glSourceNumberByKey = new Map<string, string>()
  for (const entry of glImpactEntries) {
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, receiptLabel)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const formattedStatus = formatRecordLabel(receipt.status, statusLabelMap)
  const statusOptions = statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))
  const lineRows = receipt.lines.map((line) => {
    const purchaseOrderLine = line.purchaseOrderLineItem
    const alreadyReceivedByOthers = (purchaseOrderLine?.receiptLines ?? []).reduce(
      (sum, receiptLine) => sum + (receiptLine.receiptId === receipt.id ? 0 : receiptLine.quantity),
      0,
    )
    const openQuantity = Math.max(0, (purchaseOrderLine?.quantity ?? 0) - alreadyReceivedByOthers)
    return {
      id: line.id,
      purchaseOrderLineItemId: purchaseOrderLine?.id ?? null,
      lineNumber: Math.max(
        1,
        (receipt.purchaseOrder.lineItems.findIndex((candidate) => candidate.id === purchaseOrderLine?.id) ?? 0) + 1,
      ),
      itemId: purchaseOrderLine?.item?.itemId ?? null,
      itemName: purchaseOrderLine?.item?.name ?? null,
      description: purchaseOrderLine?.description ?? '',
      orderedQuantity: purchaseOrderLine?.quantity ?? 0,
      alreadyReceivedQuantity: alreadyReceivedByOthers,
      openQuantity,
      receiptQuantity: line.quantity,
      notes: line.notes ?? '',
    }
  })
  const lineOptions = receipt.purchaseOrder.lineItems
    .filter((line) => canReceivePurchaseOrderLine(line.item))
    .map((line, index) => {
      const alreadyReceivedByOthers = line.receiptLines.reduce(
        (sum, receiptLine) => sum + (receiptLine.receiptId === receipt.id ? 0 : receiptLine.quantity),
        0,
      )
      return {
        id: line.id,
        lineNumber: index + 1,
        itemId: line.item?.itemId ?? null,
        itemName: line.item?.name ?? null,
        description: line.description,
        orderedQuantity: line.quantity,
        alreadyProcessedQuantity: alreadyReceivedByOthers,
        openQuantity: Math.max(0, line.quantity - alreadyReceivedByOthers),
      }
    })
    .filter((line) => line.openQuantity > 0 || lineRows.some((row) => row.purchaseOrderLineItemId === line.id))
  const quantityIsDerivedFromLines = lineRows.length > 0

  const sectionDescriptions: Record<string, string> = {
    'Document Identity': 'Receipt numbering and source purchase-order context for this receipt.',
    'Receipt Terms': 'Core receipt quantity, date, status, and operational notes.',
    'Record Keys': 'Internal and linked transaction identifiers for this receipt.',
    'System Dates': 'System-managed timestamps for this receipt.',
  }

  const receiptStats: TransactionStatDefinition<typeof receipt>[] = [
    {
      id: 'quantity',
      label: 'Quantity',
      accent: true,
      getValue: (record) => record.quantity,
      getValueTone: () => 'accent',
    },
    {
      id: 'status',
      label: 'Status',
      getValue: () => formattedStatus,
      getValueTone: () =>
        receipt.status === 'received'
          ? 'green'
          : receipt.status === 'pending'
            ? 'yellow'
            : receipt.status === 'cancelled'
              ? 'red'
              : 'default',
    },
    {
      id: 'date',
      label: 'Date',
      getValue: (record) => fmtDocumentDate(record.date, moneySettings),
    },
    {
      id: 'purchaseOrder',
      label: 'Purchase Order',
      getValue: (record) => record.purchaseOrder.number,
      getHref: (record) => `/purchase-orders/${record.purchaseOrder.id}`,
      getValueTone: () => 'accent',
    },
  ]

  const statPreviewCards = receiptStats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(receipt),
    href: stat.getHref?.(receipt) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(receipt),
    cardTone: stat.getCardTone?.(receipt),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
  }))

  const activities = await prisma.activity.findMany({
    where: {
      entityType: 'receipt',
      entityId: id,
    },
    orderBy: { createdAt: 'desc' },
  })

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
      user.userId && user.name ? `${user.userId} - ${user.name}` : user.userId ?? user.name ?? user.email,
    ]),
  )

  const headerFieldDefinitions: Record<ReceiptDetailFieldKey, ReceiptHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: receipt.id,
      helpText: 'Internal database identifier for this receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    number: {
      key: 'number',
      label: 'Receipt Id',
      value: receiptLabel,
      helpText: 'Display identifier for this receipt.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
    },
    purchaseOrderId: {
      key: 'purchaseOrderId',
      label: 'Purchase Order',
      value: receipt.purchaseOrderId,
      displayValue: (
        <Link href={`/purchase-orders/${receipt.purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {receipt.purchaseOrder.number}
        </Link>
      ),
      editable: true,
      type: 'select',
      options: [{ value: receipt.purchaseOrder.id, label: receipt.purchaseOrder.number }],
      helpText: 'Purchase order that this receipt belongs to.',
      fieldType: 'text',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
      href: `/purchase-orders/${receipt.purchaseOrder.id}`,
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: receipt.subsidiaryId ?? receipt.purchaseOrder.subsidiaryId ?? '',
      displayValue: receipt.purchaseOrder.subsidiary
        ? `${receipt.purchaseOrder.subsidiary.subsidiaryId} - ${receipt.purchaseOrder.subsidiary.name}`
        : '-',
      helpText: 'Subsidiary derived from the linked purchase order posting context.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
      href: receipt.purchaseOrder.subsidiaryId ? `/subsidiaries/${receipt.purchaseOrder.subsidiaryId}` : undefined,
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: receipt.currencyId ?? receipt.purchaseOrder.currencyId ?? '',
      displayValue: receipt.purchaseOrder.currency
        ? `${receipt.purchaseOrder.currency.code ?? receipt.purchaseOrder.currency.currencyId} - ${receipt.purchaseOrder.currency.name}`
        : '-',
      helpText: 'Transaction currency derived from the linked purchase order posting context.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
      href: receipt.purchaseOrder.currencyId ? `/currencies/${receipt.purchaseOrder.currencyId}` : undefined,
    },
    quantity: {
      key: 'quantity',
      label: 'Quantity',
      value: String(receipt.quantity),
      displayValue: String(receipt.quantity),
      editable: !quantityIsDerivedFromLines,
      type: 'number',
      helpText: quantityIsDerivedFromLines
        ? 'Derived from the receipt line quantities below.'
        : 'Total quantity received on this receipt.',
      fieldType: 'number',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: receipt.date.toISOString().slice(0, 10),
      displayValue: fmtDocumentDate(receipt.date, moneySettings),
      editable: true,
      type: 'date',
      helpText: 'Date the receipt was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: receipt.status,
      displayValue: formattedStatus,
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Status of this receipt.',
      fieldType: 'list',
      sourceText: 'Receipt status list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: receipt.notes ?? '',
      displayValue: receipt.notes ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Free-form notes for this receipt.',
      fieldType: 'text',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: receipt.createdAt.toISOString(),
      displayValue: fmtDocumentDate(receipt.createdAt, moneySettings),
      helpText: 'Date/time the receipt record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: receipt.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(receipt.updatedAt, moneySettings),
      helpText: 'Date/time the receipt record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: RECEIPT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    RECEIPT_REFERENCE_SOURCES,
    { purchaseOrder: receipt.purchaseOrder },
    { purchaseOrder: `/purchase-orders/${receipt.purchaseOrder.id}` },
  )

  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: RECEIPT_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      quantity: String(receipt.quantity),
      date: fmtDocumentDate(receipt.date, moneySettings),
      createdAt: fmtDocumentDate(receipt.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(receipt.updatedAt, moneySettings),
    },
  })

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

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(RECEIPT_REFERENCE_SOURCES, {
    purchaseOrder: receipt.purchaseOrder,
  })

  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = RECEIPT_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const receiptStatusActions = getReceiptStatusActions(receipt.status)

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/receipts'}
      backLabel={isCustomizing ? '<- Back to Receipt Detail' : '<- Back to Receipts'}
      meta={receiptLabel}
      title={`Receipt for ${receipt.purchaseOrder.number}`}
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {receiptStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="receipts"
                id={receipt.id}
                status={action.nextValue}
                label={action.label}
                tone={action.tone}
              />
            ))}
          </div>
        ) : null
      }
      actions={
        <TransactionActionStack
          mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
          cancelHref={detailHref}
          formId={`inline-record-form-${receipt.id}`}
          recordId={receipt.id}
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
                  newHref="/receipts/new"
                  duplicateHref={`/receipts/new?duplicateFrom=${encodeURIComponent(receipt.id)}`}
                />
                <MasterDataDetailExportMenu
                  title={receiptLabel}
                  fileName={`receipt-${receiptLabel}`}
                  sections={headerSections.map((section) => ({
                    title: section.title,
                    fields: buildTransactionExportHeaderFields([section]),
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
                <DeleteButton endpoint="/api/receipts" id={receipt.id} label={receiptLabel} />
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
              record={receipt}
              stats={receiptStats}
              visibleStatCards={customization.statCards}
              visibleStatIds={RECEIPT_STAT_CARDS.map((card) => card.id)}
            />
          )
        }
        header={
          isCustomizing ? (
            <ReceiptDetailCustomizeMode
              detailHref={detailHref}
              initialLayout={customization}
              fields={customizeFields}
              referenceSourceDefinitions={referenceSourceDefinitions}
              sectionDescriptions={sectionDescriptions}
              statPreviewCards={statPreviewCards}
            />
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
                  containerDescription="Expanded context from linked records on this receipt."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={receipt.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Receipt Details"
                containerDescription="Core receipt fields organized into configurable sections."
                showSubsections={false}
                updateUrl={`/api/receipts?id=${encodeURIComponent(receipt.id)}`}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : (
            <ReceiptLineItemsSection
              rows={lineRows}
              editing={isEditing}
              lineOptions={lineOptions}
              allowAddLines
              remoteConfig={
                isEditing
                  ? {
                      receiptId: receipt.id,
                      userId: receipt.purchaseOrder.userId ?? null,
                    }
                  : undefined
              }
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
                emptyMessage: 'No related vendor is linked to this receipt.',
                rows: [
                  {
                    id: receipt.purchaseOrder.vendor.id,
                    type: 'Vendor',
                    reference: receipt.purchaseOrder.vendor.vendorNumber ?? receipt.purchaseOrder.vendor.id,
                    name: receipt.purchaseOrder.vendor.name,
                    details:
                      [receipt.purchaseOrder.vendor.email, receipt.purchaseOrder.vendor.phone]
                        .filter(Boolean)
                        .join(' | ') || '-',
                    href: `/vendors/${receipt.purchaseOrder.vendor.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <ReceiptRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={purchaseOrderCurrencyCode}
            purchaseRequisitions={
              receipt.purchaseOrder.requisition
                ? [
                    {
                      id: receipt.purchaseOrder.requisition.id,
                      number: receipt.purchaseOrder.requisition.number,
                      status: receipt.purchaseOrder.requisition.status,
                      total: Number(receipt.purchaseOrder.requisition.total),
                      createdAt: receipt.purchaseOrder.requisition.createdAt.toISOString(),
                      currencyCode: purchaseOrderCurrencyCode,
                    },
                  ]
                : []
            }
            purchaseOrders={[
              {
                id: receipt.purchaseOrder.id,
                number: receipt.purchaseOrder.number,
                status: receipt.purchaseOrder.status,
                total: Number(receipt.purchaseOrder.total),
                createdAt: receipt.purchaseOrder.createdAt.toISOString(),
                currencyCode: purchaseOrderCurrencyCode,
              },
            ]}
            bills={receipt.purchaseOrder.bills.map((bill) => ({
              id: bill.id,
              number: bill.number,
              date: bill.date.toISOString(),
              dueDate: bill.dueDate ? bill.dueDate.toISOString() : null,
              status: bill.status,
              total: Number(bill.total),
              notes: bill.notes ?? null,
              currencyCode: purchaseOrderCurrencyCode,
            }))}
            billPayments={receipt.purchaseOrder.bills.flatMap((bill) =>
              bill.billPayments.map((payment) => ({
                id: payment.id,
                number: payment.number,
                date: payment.date.toISOString(),
                status: payment.status,
                amount: Number(payment.amount),
                reference: payment.reference ?? null,
                billNumber: bill.number,
                currencyCode: purchaseOrderCurrencyCode,
              })),
            )}
            moneySettings={moneySettings}
          />
        )}
        relatedDocumentsCount={
          (receipt.purchaseOrder.requisition ? 1 : 0) +
          1 +
          receipt.purchaseOrder.bills.length +
          receipt.purchaseOrder.bills.reduce((sum, bill) => sum + bill.billPayments.length, 0)
        }
        supplementarySections={
          isCustomizing ? null : (
            <ReceiptGlImpactSection
              rows={glImpactRows}
              settings={customization.glImpactSettings}
              columnCustomization={customization.glImpactColumns}
            />
          )
        }
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId="receipt-communications-toolbar"
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: receipt.id,
              userId: receipt.purchaseOrder.userId,
              number: receiptLabel,
              counterpartyName: receipt.purchaseOrder.vendor.name,
              counterpartyEmail: receipt.purchaseOrder.vendor.email ?? null,
              fromEmail: receipt.purchaseOrder.user?.email ?? null,
              status: formattedStatus,
              total: String(receipt.quantity),
              lineItems: [],
              sendEmailEndpoint: '/api/receipts?action=send-email',
              recordIdFieldName: 'receiptId',
              documentLabel: 'Receipt',
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId="receipt-communications-toolbar"
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId="receipt-system-notes-toolbar" showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId="receipt-system-notes-toolbar"
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}
