import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadListValues } from '@/lib/load-list-values'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import RecordStatusButton from '@/components/RecordStatusButton'
import FulfillmentDetailCustomizeMode from '@/components/FulfillmentDetailCustomizeMode'
import FulfillmentLineItemsSection from '@/components/FulfillmentLineItemsSection'
import FulfillmentRelatedDocuments from '@/components/FulfillmentRelatedDocuments'
import FulfillmentGlImpactSection from '@/components/FulfillmentGlImpactSection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
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
  type FulfillmentDetailFieldKey,
  type FulfillmentLineColumnKey,
} from '@/lib/fulfillment-detail-customization'
import { loadFulfillmentDetailCustomization } from '@/lib/fulfillment-detail-customization-store'
import { fulfillmentPageConfig } from '@/lib/transaction-page-configs/fulfillment'

type FulfillmentHeaderField = {
  key: FulfillmentDetailFieldKey
} & PurchaseOrderHeaderField

function formatFulfillmentStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getStatusTone(status: string | null) {
  const styles: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    packed: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    shipped: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
  }
  return styles[(status ?? '').toLowerCase()] ?? styles.pending
}

export default async function FulfillmentDetailPage({
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
                select: { id: true, amount: true, date: true, method: true, reference: true },
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
      subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
      currency: { select: { id: true, currencyId: true, code: true, name: true } },
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

  const [customization, activities, statusValues, subsidiaries, currencies] = await Promise.all([
    loadFulfillmentDetailCustomization(),
    prisma.activity.findMany({
      where: {
        entityType: 'fulfillment',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadListValues('FULFILL-STATUS'),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
  ])

  const detailHref = `/fulfillments/${fulfillment.id}`
  const statusTone = getStatusTone(fulfillment.status)
  const statusOptions = statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))
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
        alreadyFulfilledQuantity: fulfilledByOthers,
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
  const visibleStatIds = customization.statCards
    .filter((card) => card.visible)
    .sort((left, right) => left.order - right.order)
    .map((card) => card.metric)

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
          <>
            {fulfillment.status !== 'packed' ? <RecordStatusButton resource="fulfillments" id={fulfillment.id} status="packed" label="Mark Packed" tone="blue" /> : null}
            {fulfillment.status !== 'shipped' ? <RecordStatusButton resource="fulfillments" id={fulfillment.id} status="shipped" label="Mark Shipped" tone="emerald" /> : null}
            {fulfillment.status !== 'pending' ? <RecordStatusButton resource="fulfillments" id={fulfillment.id} status="pending" label="Reset Pending" tone="gray" /> : null}
          </>
        ) : null
      }
      actions={
        isCustomizing ? null : (
          <TransactionActionStack
            mode={isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${fulfillment.id}`}
            recordId={fulfillment.id}
            primaryActions={
              !isEditing ? (
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
              statusLabel: formatFulfillmentStatus(fulfillment.status),
              salesOrderId: fulfillment.salesOrder?.id ?? null,
              salesOrderNumber: fulfillment.salesOrder?.number ?? null,
              lineCount: lineRows.length,
              totalQuantity,
              date: fulfillment.date,
              moneySettings,
            }}
            stats={fulfillmentPageConfig.stats}
            visibleStatIds={visibleStatIds}
          />
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <FulfillmentDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                sectionDescriptions={fulfillmentPageConfig.sectionDescriptions}
              />
            </div>
          ) : (
            <PurchaseOrderHeaderSections
              purchaseOrderId={fulfillment.id}
              editing={isEditing}
              sections={headerSections}
              columns={customization.formColumns}
              updateUrl={`/api/fulfillments?id=${encodeURIComponent(fulfillment.id)}`}
            />
          )
        }
        lineItems={
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
        }
        relatedDocuments={
          <FulfillmentRelatedDocuments
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
                amount: Number(receipt.amount),
                date: receipt.date.toISOString(),
                method: receipt.method,
                reference: receipt.reference ?? null,
                invoiceNumber: invoice.number,
              })),
            )}
          />
        }
        supplementarySections={<FulfillmentGlImpactSection rows={[]} />}
        communications={
          <CommunicationsSection
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
        }
        systemNotes={<SystemNotesSection notes={systemNotes} />}
      />
    </RecordDetailPageShell>
  )
}
