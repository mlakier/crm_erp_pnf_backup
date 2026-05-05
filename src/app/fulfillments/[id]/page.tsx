import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadManagedListDetail } from '@/lib/manage-lists'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import RecordStatusButton from '@/components/RecordStatusButton'
import FulfillmentDetailCustomizeMode from '@/components/FulfillmentDetailCustomizeMode'
import FulfillmentLineItemsSection from '@/components/FulfillmentLineItemsSection'
import FulfillmentRelatedDocuments from '@/components/FulfillmentRelatedDocuments'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import {
  FULFILLMENT_DETAIL_FIELDS,
  FULFILLMENT_LINE_COLUMNS,
  FULFILLMENT_REFERENCE_SOURCES,
  type FulfillmentDetailFieldKey,
  type FulfillmentLineColumnKey,
} from '@/lib/fulfillment-detail-customization'
import { loadFulfillmentDetailCustomization } from '@/lib/fulfillment-detail-customization-store'
import { fulfillmentPageConfig } from '@/lib/transaction-page-configs/fulfillment'
import {
  getAvailableWorkflowStatusActions,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import type { TransactionStatusColorTone } from '@/lib/company-preferences-definitions'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

type FulfillmentHeaderField = {
  key: FulfillmentDetailFieldKey
} & RecordHeaderField

function formatFulfillmentStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getToneStyle(tone: TransactionStatusColorTone) {
  if (tone === 'gray') {
    return { bg: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }
  }
  if (tone === 'accent') {
    return { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }
  }
  if (tone === 'teal') {
    return { bg: 'rgba(20,184,166,0.18)', color: '#5eead4' }
  }
  if (tone === 'yellow') {
    return { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d' }
  }
  if (tone === 'orange') {
    return { bg: 'rgba(249,115,22,0.18)', color: '#fdba74' }
  }
  if (tone === 'green') {
    return { bg: 'rgba(34,197,94,0.16)', color: '#86efac' }
  }
  if (tone === 'red') {
    return { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' }
  }
  if (tone === 'purple') {
    return { bg: 'rgba(168,85,247,0.18)', color: '#d8b4fe' }
  }
  if (tone === 'pink') {
    return { bg: 'rgba(236,72,153,0.18)', color: '#f9a8d4' }
  }
  return { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }
}

function getFulfillmentStatusTone(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
) {
  return getToneStyle(configuredTones[(status ?? '').toLowerCase()] ?? 'default')
}

function getFulfillmentStatusToneKey(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
): TransactionVisualTone {
  return configuredTones[(status ?? '').toLowerCase()] ?? 'default'
}

export default async function FulfillmentDetailPage({
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

  const fulfillment = await prisma.fulfillment.findUnique({
    where: { id },
    include: {
      salesOrder: {
        include: {
          customer: true,
          quote: { include: { opportunity: true } },
          user: { select: { id: true, userId: true, name: true, email: true } },
          subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
          currency: { select: { id: true, currencyId: true, code: true, name: true } },
          fulfillments: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, number: true, status: true, date: true, notes: true },
          },
          invoices: {
            orderBy: { createdAt: 'desc' },
            include: {
              cashReceipts: {
                orderBy: { date: 'desc' },
                select: { id: true, number: true, amount: true, date: true, method: true, reference: true },
              },
            },
          },
          lineItems: {
            orderBy: { createdAt: 'asc' },
            include: {
              item: { select: { id: true, itemId: true, name: true } },
              fulfillmentLines: { select: { id: true, quantity: true, fulfillmentId: true } },
            },
          },
        },
      },
      subsidiary: true,
      currency: true,
      lines: {
        orderBy: { id: 'asc' },
        include: {
          salesOrderLineItem: {
            include: {
              item: { select: { id: true, itemId: true, name: true } },
              fulfillmentLines: { select: { id: true, quantity: true, fulfillmentId: true } },
            },
          },
        },
      },
    },
  })

  if (!fulfillment) notFound()

  const [customization, activities, statusListDetail, subsidiaries, currencies, workflow] = await Promise.all([
    loadFulfillmentDetailCustomization(),
    prisma.activity.findMany({
      where: {
        entityType: 'fulfillment',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadManagedListDetail('FULFILL-STATUS'),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    loadOtcWorkflowRuntime(),
  ])

  const detailHref = `/fulfillments/${fulfillment.id}`
  const fulfillmentStatusColors = Object.fromEntries(
    (statusListDetail?.rows ?? []).map((row) => [row.value.toLowerCase(), row.colorTone ?? 'default']),
  ) as Record<string, TransactionStatusColorTone>
  const statusTone = getFulfillmentStatusTone(fulfillment.status, fulfillmentStatusColors)
  const statusOptions = (statusListDetail?.rows ?? []).map((row) => ({ value: row.value.toLowerCase(), label: row.value }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
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

  const lineRows = fulfillment.lines.map((line) => {
    const salesOrderLine = line.salesOrderLineItem
    const fulfilledByOthers = (salesOrderLine?.fulfillmentLines ?? []).reduce(
      (sum, fulfillmentLine) => sum + (fulfillmentLine.fulfillmentId === fulfillment.id ? 0 : fulfillmentLine.quantity),
      0,
    )
    const openQuantity = Math.max(0, (salesOrderLine?.quantity ?? 0) - fulfilledByOthers)

    return {
      id: line.id,
      salesOrderLineItemId: salesOrderLine?.id ?? null,
      lineNumber: Math.max(
        1,
        (fulfillment.salesOrder?.lineItems.findIndex((candidate) => candidate.id === salesOrderLine?.id) ?? 0) + 1,
      ),
      itemId: salesOrderLine?.item?.itemId ?? null,
      itemName: salesOrderLine?.item?.name ?? null,
      description: salesOrderLine?.description ?? '',
      orderedQuantity: salesOrderLine?.quantity ?? 0,
      alreadyFulfilledQuantity: fulfilledByOthers,
      openQuantity,
      fulfillmentQuantity: line.quantity,
      notes: line.notes ?? '',
    }
  })

  const lineOptions = (fulfillment.salesOrder?.lineItems ?? [])
    .map((line, index) => {
      const fulfilledByOthers = line.fulfillmentLines.reduce(
        (sum, fulfillmentLine) => sum + (fulfillmentLine.fulfillmentId === fulfillment.id ? 0 : fulfillmentLine.quantity),
        0,
      )
      return {
        id: line.id,
        lineNumber: index + 1,
        itemId: line.item?.itemId ?? null,
        itemName: line.item?.name ?? null,
        description: line.description,
        orderedQuantity: line.quantity,
        alreadyProcessedQuantity: fulfilledByOthers,
        openQuantity: Math.max(0, line.quantity - fulfilledByOthers),
      }
    })
    .filter((line) => line.openQuantity > 0 || lineRows.some((row) => row.salesOrderLineItemId === line.id))

  const totalQuantity = lineRows.reduce((sum, row) => sum + row.fulfillmentQuantity, 0)
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

  const headerFieldDefinitions: Record<FulfillmentDetailFieldKey, FulfillmentHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: fulfillment.salesOrder?.customer.name ?? '',
      helpText: 'Display name from the linked sales order customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: fulfillment.salesOrder?.customer.customerId ?? '',
      helpText: 'Internal customer identifier from the linked sales order customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: fulfillment.id,
      helpText: 'Internal database identifier for this fulfillment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    number: {
      key: 'number',
      label: 'Fulfillment Id',
      value: fulfillment.number,
      helpText: 'Unique identifier for this fulfillment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    salesOrderId: {
      key: 'salesOrderId',
      label: 'Sales Order Id',
      value: fulfillment.salesOrder?.number ?? '',
      displayValue: fulfillment.salesOrder ? (
        <Link href={`/sales-orders/${fulfillment.salesOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {fulfillment.salesOrder.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Sales order linked to this fulfillment.',
      fieldType: 'text',
      sourceText: 'Sales order transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    quoteId: {
      key: 'quoteId',
      label: 'Quote Id',
      value: fulfillment.salesOrder?.quote?.number ?? '',
      displayValue: fulfillment.salesOrder?.quote ? (
        <Link href={`/quotes/${fulfillment.salesOrder.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {fulfillment.salesOrder.quote.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Quote linked through the sales order.',
      fieldType: 'text',
      sourceText: 'Quote transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity Id',
      value: fulfillment.salesOrder?.quote?.opportunity?.opportunityNumber ?? '',
      displayValue: fulfillment.salesOrder?.quote?.opportunity ? (
        <Link href={`/opportunities/${fulfillment.salesOrder.quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {fulfillment.salesOrder.quote.opportunity.opportunityNumber ?? fulfillment.salesOrder.quote.opportunity.name}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Opportunity linked through the quote.',
      fieldType: 'text',
      sourceText: 'Opportunity transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: fulfillment.subsidiaryId ?? '',
      displayValue: fulfillment.subsidiary ? `${fulfillment.subsidiary.subsidiaryId} - ${fulfillment.subsidiary.name}` : '-',
      href: fulfillment.subsidiary ? `/subsidiaries/${fulfillment.subsidiary.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary that owns the fulfillment.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: fulfillment.currencyId ?? '',
      displayValue: fulfillment.currency ? `${fulfillment.currency.code ?? fulfillment.currency.currencyId} - ${fulfillment.currency.name}` : '-',
      href: fulfillment.currency ? `/currencies/${fulfillment.currency.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Currency inherited from the sales order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: fulfillment.status ?? '',
      displayValue: formatFulfillmentStatus(fulfillment.status),
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the fulfillment.',
      fieldType: 'list',
      sourceText: 'Fulfillment status list',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    date: {
      key: 'date',
      label: 'Fulfillment Date',
      value: fulfillment.date.toISOString().slice(0, 10),
      displayValue: fmtDocumentDate(fulfillment.date, moneySettings),
      editable: true,
      type: 'date',
      helpText: 'Date the fulfillment was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: fulfillment.notes ?? '',
      displayValue: fulfillment.notes ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Warehouse or shipping notes for this fulfillment.',
      fieldType: 'text',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: fulfillment.createdAt.toISOString(),
      displayValue: fmtDocumentDate(fulfillment.createdAt, moneySettings),
      helpText: 'Date/time the fulfillment record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this fulfillment.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: fulfillment.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(fulfillment.updatedAt, moneySettings),
      helpText: 'Date/time the fulfillment record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this fulfillment.',
    },
  }
  const customerHref = fulfillment.salesOrder?.customer ? `/customers/${fulfillment.salesOrder.customer.id}` : null
  const salesOrderHref = fulfillment.salesOrder ? `/sales-orders/${fulfillment.salesOrder.id}` : null
  const quoteHref = fulfillment.salesOrder?.quote ? `/quotes/${fulfillment.salesOrder.quote.id}` : null
  const opportunityHref = fulfillment.salesOrder?.quote?.opportunity
    ? `/opportunities/${fulfillment.salesOrder.quote.opportunity.id}`
    : null
  const subsidiaryHref = fulfillment.subsidiary ? `/subsidiaries/${fulfillment.subsidiary.id}` : null
  const currencyHref = fulfillment.currency ? `/currencies/${fulfillment.currency.id}` : null

  headerFieldDefinitions.customerNumber.href = customerHref
  headerFieldDefinitions.salesOrderId.href = salesOrderHref
  headerFieldDefinitions.quoteId.href = quoteHref
  headerFieldDefinitions.opportunityId.href = opportunityHref
  headerFieldDefinitions.subsidiaryId.href = subsidiaryHref
  headerFieldDefinitions.currencyId.href = currencyHref

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(FULFILLMENT_REFERENCE_SOURCES, {
    salesOrder: fulfillment.salesOrder,
    subsidiary: fulfillment.subsidiary,
    currency: fulfillment.currency,
  }, {
    salesOrder: salesOrderHref,
    subsidiary: subsidiaryHref,
    currency: currencyHref,
  })
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: FULFILLMENT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: fulfillmentPageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: FULFILLMENT_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      quoteId: fulfillment.salesOrder?.quote?.number ?? '',
      opportunityId: fulfillment.salesOrder?.quote?.opportunity?.opportunityNumber ?? '',
      subsidiaryId: fulfillment.subsidiary ? `${fulfillment.subsidiary.subsidiaryId} - ${fulfillment.subsidiary.name}` : '',
      currencyId: fulfillment.currency ? `${fulfillment.currency.code ?? fulfillment.currency.currencyId} - ${fulfillment.currency.name}` : '',
      status: formatFulfillmentStatus(fulfillment.status),
      date: fmtDocumentDate(fulfillment.date, moneySettings),
      createdAt: fmtDocumentDate(fulfillment.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(fulfillment.updatedAt, moneySettings),
    },
  })

  const visibleLineColumnIds = getOrderedVisibleTransactionLineColumns(FULFILLMENT_LINE_COLUMNS, customization).map(
    (column) => column.id,
  ) as FulfillmentLineColumnKey[]
  const statsRecord = {
    statusLabel: formatFulfillmentStatus(fulfillment.status),
    statusTone: getFulfillmentStatusToneKey(fulfillment.status, fulfillmentStatusColors),
    salesOrderId: fulfillment.salesOrder?.id ?? null,
    salesOrderNumber: fulfillment.salesOrder?.number ?? null,
    lineCount: lineRows.length,
    totalQuantity,
    date: fulfillment.date,
    moneySettings,
  } as const
  const statPreviewCards = fulfillmentPageConfig.stats.map((stat) => ({
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
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(FULFILLMENT_REFERENCE_SOURCES, {
    salesOrder: fulfillment.salesOrder,
    subsidiary: fulfillment.subsidiary,
    currency: fulfillment.currency,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = FULFILLMENT_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const fulfillmentStatusActions = getAvailableWorkflowStatusActions(workflow, 'fulfillment', fulfillment.status)
  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/fulfillments'}
      backLabel={isCustomizing ? '<- Back to Fulfillment Detail' : '<- Back to Fulfillments'}
      meta={fulfillment.number}
      title={fulfillment.salesOrder?.customer.name ?? fulfillment.number}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Fulfillment
          </span>
          <span
            className="inline-flex rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: statusTone.bg, color: statusTone.color }}
          >
            {formatFulfillmentStatus(fulfillment.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {fulfillmentStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="fulfillments"
                id={fulfillment.id}
                status={action.nextValue}
                label={action.label}
                tone={action.tone}
                fieldName={action.fieldName}
                workflowStep={action.step}
                workflowActionId={action.id}
              />
            ))}
          </div>
        ) : null
      }
      actions={
          <TransactionActionStack
            mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${fulfillment.id}`}
            recordId={fulfillment.id}
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
                    newHref="/fulfillments/new"
                    duplicateHref={`/fulfillments/new?duplicateFrom=${encodeURIComponent(fulfillment.id)}`}
                  />
                  <MasterDataDetailExportMenu
                    title={fulfillment.number}
                    fileName={`fulfillment-${fulfillment.number}`}
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
                  <DeleteButton resource="fulfillments" id={fulfillment.id} />
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
              stats={fulfillmentPageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <FulfillmentDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={fulfillmentPageConfig.sectionDescriptions}
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
                  containerDescription="Expanded context from linked records on this fulfillment."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={fulfillment.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Fulfillment Details"
                containerDescription="Core fulfillment fields organized into configurable sections."
                showSubsections={false}
                updateUrl={`/api/fulfillments?id=${encodeURIComponent(fulfillment.id)}`}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : (
            <FulfillmentLineItemsSection
              rows={lineRows}
              editing={isEditing}
              lineOptions={lineOptions}
              visibleColumnIds={visibleLineColumnIds}
              allowAddLines
              remoteConfig={
                isEditing
                  ? {
                      fulfillmentId: fulfillment.id,
                      userId: fulfillment.salesOrder?.userId ?? null,
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
                key: 'customer',
                label: 'Customer',
                count: fulfillment.salesOrder?.customer ? 1 : 0,
                emptyMessage: 'No related customer is linked to this fulfillment.',
                rows: fulfillment.salesOrder?.customer
                  ? [
                      {
                        id: fulfillment.salesOrder.customer.id,
                        type: 'Customer',
                        reference: fulfillment.salesOrder.customer.customerId ?? fulfillment.salesOrder.customer.id,
                        name: fulfillment.salesOrder.customer.name,
                        details:
                          [fulfillment.salesOrder.customer.email, fulfillment.salesOrder.customer.phone]
                            .filter(Boolean)
                            .join(' | ') || '-',
                        href: `/customers/${fulfillment.salesOrder.customer.id}`,
                      },
                    ]
                  : [],
              },
            ]}
          />
        )}
        relatedRecordsCount={fulfillment.salesOrder?.customer ? 1 : 0}
        relatedDocuments={isCustomizing ? null : (
          <FulfillmentRelatedDocuments
            embedded
            showDisplayControl={false}
            opportunities={
              fulfillment.salesOrder?.quote?.opportunity
                ? [
                    {
                      id: fulfillment.salesOrder.quote.opportunity.id,
                      number:
                        fulfillment.salesOrder.quote.opportunity.opportunityNumber ??
                        fulfillment.salesOrder.quote.opportunity.id,
                      name: fulfillment.salesOrder.quote.opportunity.name,
                      status: fulfillment.salesOrder.quote.opportunity.stage,
                      total: Number(fulfillment.salesOrder.quote.opportunity.amount ?? 0),
                    },
                  ]
                : []
            }
            quotes={
              fulfillment.salesOrder?.quote
                ? [
                    {
                      id: fulfillment.salesOrder.quote.id,
                      number: fulfillment.salesOrder.quote.number,
                      status: fulfillment.salesOrder.quote.status,
                      total: Number(fulfillment.salesOrder.quote.total),
                      validUntil: fulfillment.salesOrder.quote.validUntil?.toISOString() ?? null,
                      opportunityName: fulfillment.salesOrder.quote.opportunity?.name ?? null,
                    },
                  ]
                : []
            }
            fulfillments={(fulfillment.salesOrder?.fulfillments ?? [])
              .filter((row) => row.id !== fulfillment.id)
              .map((row) => ({
                id: row.id,
                number: row.number,
                status: row.status,
                date: row.date.toISOString(),
                notes: row.notes ?? null,
              }))}
            invoices={(fulfillment.salesOrder?.invoices ?? []).map((invoice) => ({
              id: invoice.id,
              number: invoice.number,
              status: invoice.status,
              total: Number(invoice.total),
              dueDate: invoice.dueDate?.toISOString() ?? null,
              createdAt: invoice.createdAt.toISOString(),
            }))}
            cashReceipts={(fulfillment.salesOrder?.invoices ?? []).flatMap((invoice) =>
              invoice.cashReceipts.map((receipt) => ({
                id: receipt.id,
                number: receipt.number ?? null,
                amount: Number(receipt.amount),
                date: receipt.date.toISOString(),
                method: receipt.method,
                reference: receipt.reference ?? null,
                invoiceNumber: invoice.number,
              })),
            )}
          />
        )}
        relatedDocumentsCount={
          (fulfillment.salesOrder?.quote?.opportunity ? 1 : 0) +
          (fulfillment.salesOrder?.quote ? 1 : 0) +
          (fulfillment.salesOrder?.fulfillments.filter((row) => row.id !== fulfillment.id).length ?? 0) +
          (fulfillment.salesOrder?.invoices.length ?? 0) +
          (fulfillment.salesOrder?.invoices.reduce((sum, invoice) => sum + invoice.cashReceipts.length, 0) ?? 0)
        }
        supplementarySections={null}
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId="fulfillment-communications-toolbar"
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: fulfillment.id,
              userId: fulfillment.salesOrder?.userId ?? null,
              number: fulfillment.number,
              counterpartyName: fulfillment.salesOrder?.customer.name ?? fulfillment.number,
              counterpartyEmail: fulfillment.salesOrder?.customer.email ?? null,
              fromEmail: fulfillment.salesOrder?.user?.email ?? null,
              status: formatFulfillmentStatus(fulfillment.status),
              total: String(totalQuantity),
              lineItems: lineRows.map((row) => ({
                line: row.lineNumber,
                itemId: row.itemId ?? '-',
                description: row.description,
                quantity: row.orderedQuantity,
                receivedQuantity: row.fulfillmentQuantity,
                openQuantity: row.openQuantity,
                billedQuantity: 0,
                unitPrice: 0,
                lineTotal: 0,
              })),
              sendEmailEndpoint: '/api/fulfillments?action=send-email',
              recordIdFieldName: 'fulfillmentId',
              documentLabel: 'Fulfillment',
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId="fulfillment-communications-toolbar"
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId="fulfillment-system-notes-toolbar" showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId="fulfillment-system-notes-toolbar"
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}
