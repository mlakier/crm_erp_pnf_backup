import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { sumMoney } from '@/lib/money'
import RecordStatusButton from '@/components/RecordStatusButton'
import SalesOrderCreateInvoiceButton from '@/components/SalesOrderCreateInvoiceButton'
import SalesOrderDetailCustomizeMode from '@/components/SalesOrderDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import SalesOrderRelatedDocuments from '@/components/SalesOrderRelatedDocuments'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import InvoiceGlImpactSection, { type InvoiceGlImpactRow } from '@/components/InvoiceGlImpactSection'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  SALES_ORDER_DETAIL_FIELDS,
  SALES_ORDER_LINE_COLUMNS,
  type SalesOrderDetailFieldKey,
} from '@/lib/sales-order-detail-customization'
import { loadSalesOrderDetailCustomization } from '@/lib/sales-order-detail-customization-store'
import { salesOrderPageConfig } from '@/lib/transaction-page-configs/sales-order'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'

function formatSalesOrderStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatStatusTone(status: string | null) {
  const key = (status ?? '').toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    booked: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    fulfilled: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
  }
  return styles[key] ?? styles.draft
}

type SalesOrderHeaderField = {
  key: SalesOrderDetailFieldKey
} & PurchaseOrderHeaderField

type SalesOrderLineRow = {
  id: string
  lineNumber: number
  itemRecordId: string | null
  itemId: string | null
  itemName: string | null
  description: string
  quantity: number
  fulfilledQuantity: number
  openQuantity: number
  unitPrice: number
  lineTotal: number
}

export default async function SalesOrderDetailPage({
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
  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'booked', label: 'Booked' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const [salesOrder, activities, customization, subsidiaries, currencies, items] = await Promise.all([
    prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
          },
        },
        quote: {
          include: {
            opportunity: true,
          },
        },
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
        lineItems: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            item: { select: { id: true, itemId: true, name: true } },
            fulfillmentLines: {
              select: { id: true, quantity: true },
            },
          },
        },
        fulfillments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            number: true,
            status: true,
            date: true,
            notes: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            cashReceipts: {
              orderBy: { date: 'desc' },
              select: {
                id: true,
                amount: true,
                date: true,
                method: true,
                reference: true,
              },
            },
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'sales-order',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadSalesOrderDetailCustomization(),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: { itemId: 'asc' },
      select: { id: true, itemId: true, name: true, listPrice: true },
      take: 500,
    }),
  ])

  if (!salesOrder) notFound()

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

  const lineRows: SalesOrderLineRow[] = salesOrder.lineItems.map((line, index) => {
    const fulfilledQuantity = line.fulfillmentLines.reduce((sum, row) => sum + row.quantity, 0)
    return {
      id: line.id,
      lineNumber: index + 1,
      itemRecordId: line.item?.id ?? null,
      itemId: line.item?.itemId ?? null,
      itemName: line.item?.name ?? null,
      description: line.description,
      quantity: line.quantity,
      fulfilledQuantity,
      openQuantity: Math.max(0, line.quantity - fulfilledQuantity),
      unitPrice: toNumericValue(line.unitPrice, 0),
      lineTotal: toNumericValue(line.lineTotal, 0),
    }
  })
  const computedTotal = sumMoney(lineRows.map((row) => row.lineTotal))
  const latestInvoice = salesOrder.invoices[0]
  const statusTone = formatStatusTone(salesOrder.status)
  const detailHref = `/sales-orders/${salesOrder.id}`
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
  const itemOptions = items.map((item) => ({
    id: item.id,
    itemId: item.itemId ?? item.id,
    name: item.name,
    unitPrice: toNumericValue(item.listPrice, 0),
  }))
  const createdByLabel =
    salesOrder.user?.userId && salesOrder.user?.name
      ? `${salesOrder.user.userId} - ${salesOrder.user.name}`
      : salesOrder.user?.userId ?? salesOrder.user?.name ?? salesOrder.user?.email ?? '-'

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

  const headerFieldDefinitions: Record<SalesOrderDetailFieldKey, SalesOrderHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: salesOrder.customer.name,
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: salesOrder.customer.customerId ?? '',
      helpText: 'Internal customer identifier from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerEmail: {
      key: 'customerEmail',
      label: 'Email',
      value: salesOrder.customer.email ?? '',
      helpText: 'Primary customer email address.',
      fieldType: 'email',
      sourceText: 'Customers master data',
    },
    customerPhone: {
      key: 'customerPhone',
      label: 'Phone',
      value: salesOrder.customer.phone ?? '',
      helpText: 'Primary customer phone number.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerAddress: {
      key: 'customerAddress',
      label: 'Billing Address',
      value: salesOrder.customer.address ?? '',
      helpText: 'Main billing address from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerPrimarySubsidiary: {
      key: 'customerPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: salesOrder.customer.subsidiary ? `${salesOrder.customer.subsidiary.subsidiaryId} - ${salesOrder.customer.subsidiary.name}` : '',
      helpText: 'Default subsidiary context from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerPrimaryCurrency: {
      key: 'customerPrimaryCurrency',
      label: 'Primary Currency',
      value: salesOrder.customer.currency ? `${salesOrder.customer.currency.code} - ${salesOrder.customer.currency.name}` : '',
      helpText: 'Default transaction currency from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerInactive: {
      key: 'customerInactive',
      label: 'Inactive',
      value: salesOrder.customer.inactive ? 'Yes' : 'No',
      helpText: 'Indicates whether the linked customer is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: salesOrder.id,
      helpText: 'Internal database identifier for the sales order record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    number: {
      key: 'number',
      label: 'Sales Order Id',
      value: salesOrder.number,
      editable: true,
      type: 'text',
      helpText: 'Unique sales order number used across OTC workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer Id',
      value: salesOrder.customer.customerId ?? '',
      helpText: 'Customer identifier linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Customers master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: salesOrder.user?.userId ?? '',
      helpText: 'User identifier for the creator/owner of the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    quoteId: {
      key: 'quoteId',
      label: 'Quote Id',
      value: salesOrder.quote?.number ?? '',
      helpText: 'Quote identifier linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      helpText: 'User who created the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: salesOrder.quote?.number ?? '',
      displayValue: salesOrder.quote ? (
        <Link href={`/quotes/${salesOrder.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {salesOrder.quote.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Source quote that created this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity Id',
      value: salesOrder.quote?.opportunity?.opportunityNumber ?? '',
      displayValue: salesOrder.quote?.opportunity ? (
        <Link href={`/opportunities/${salesOrder.quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {salesOrder.quote.opportunity.opportunityNumber ?? salesOrder.quote.opportunity.name}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Opportunity linked through the source quote.',
      fieldType: 'text',
      sourceText: 'Opportunities',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: salesOrder.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: salesOrder.subsidiary ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}` : '-',
      helpText: 'Subsidiary that owns the sales order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: salesOrder.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: salesOrder.currency ? `${salesOrder.currency.code} - ${salesOrder.currency.name}` : '-',
      helpText: 'Transaction currency for the sales order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: salesOrder.status ?? '',
      displayValue: formatSalesOrderStatus(salesOrder.status),
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the sales order.',
      fieldType: 'list',
      sourceText: 'System sales order statuses',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: computedTotal.toString(),
      displayValue: fmtCurrency(computedTotal, undefined, moneySettings),
      helpText: 'Current document total based on all sales order line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: salesOrder.createdAt.toISOString(),
      displayValue: fmtDocumentDate(salesOrder.createdAt, moneySettings),
      helpText: 'Date/time the sales order record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this sales order record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: salesOrder.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(salesOrder.updatedAt, moneySettings),
      helpText: 'Date/time the sales order record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this sales order record.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: SALES_ORDER_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: salesOrderPageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: SALES_ORDER_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
      previewOverrides: {
      id: salesOrder.id,
      customerId: salesOrder.customer.customerId ?? '',
      customerAddress: salesOrder.customer.address ?? '',
      customerPrimarySubsidiary: salesOrder.customer.subsidiary ? `${salesOrder.customer.subsidiary.subsidiaryId} - ${salesOrder.customer.subsidiary.name}` : '',
      customerPrimaryCurrency: salesOrder.customer.currency ? `${salesOrder.customer.currency.code} - ${salesOrder.customer.currency.name}` : '',
      customerInactive: salesOrder.customer.inactive ? 'Yes' : 'No',
      userId: salesOrder.user?.userId ?? '',
      quoteId: salesOrder.quote?.number ?? '',
      createdBy: createdByLabel,
      createdFrom: salesOrder.quote?.number ?? '',
      opportunityId: salesOrder.quote?.opportunity?.opportunityNumber ?? '',
      subsidiaryId: salesOrder.subsidiary ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}` : '',
      currencyId: salesOrder.currency ? `${salesOrder.currency.code} - ${salesOrder.currency.name}` : '',
      status: formatSalesOrderStatus(salesOrder.status),
      total: fmtCurrency(computedTotal, undefined, moneySettings),
      createdAt: fmtDocumentDate(salesOrder.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(salesOrder.updatedAt, moneySettings),
    },
  })

  const visibleLineColumnOrder = getOrderedVisibleTransactionLineColumns(
    SALES_ORDER_LINE_COLUMNS,
    customization
  )
  const poCompatibleLineColumns = visibleLineColumnOrder
    .map((column) => {
      if (column.id === 'fulfilled-qty') {
        return { id: 'received-qty' as const, label: column.label }
      }
      return column.id === 'line' ||
        column.id === 'item-id' ||
        column.id === 'description' ||
        column.id === 'quantity' ||
        column.id === 'open-qty' ||
        column.id === 'unit-price' ||
        column.id === 'line-total'
        ? column
        : null
    })
    .filter((column): column is { id: 'line' | 'item-id' | 'description' | 'quantity' | 'received-qty' | 'open-qty' | 'unit-price' | 'line-total'; label: string } => Boolean(column))
  const visibleStatIds = customization.statCards
    .filter((card) => card.visible)
    .sort((left, right) => left.order - right.order)
    .map((card) => card.metric)
  const glImpactRows: InvoiceGlImpactRow[] = []

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/sales-orders'}
      backLabel={isCustomizing ? '<- Back to Sales Order Detail' : '<- Back to Sales Orders'}
      meta={salesOrder.number}
      title={salesOrder.customer.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Sales Order
          </span>
          <span
            className="inline-flex rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: statusTone.bg, color: statusTone.color }}
          >
            {formatSalesOrderStatus(salesOrder.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <>
            {salesOrder.status !== 'booked' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="booked" label="Book Order" tone="blue" /> : null}
            {salesOrder.status !== 'fulfilled' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="fulfilled" label="Mark Fulfilled" tone="emerald" /> : null}
            {salesOrder.status !== 'draft' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="draft" label="Reset Draft" tone="gray" /> : null}
            <SalesOrderCreateInvoiceButton salesOrderId={salesOrder.id} existingInvoiceId={latestInvoice?.id} />
          </>
        ) : null
      }
      actions={
        isCustomizing ? null : (
          <TransactionActionStack
            mode={isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${salesOrder.id}`}
            recordId={salesOrder.id}
            primaryActions={!isEditing ? (
              <>
                <MasterDataDetailCreateMenu newHref="/sales-orders/new" duplicateHref={`/sales-orders/new?duplicateFrom=${salesOrder.id}`} />
                <MasterDataDetailExportMenu
                  title={salesOrder.number}
                  fileName={`sales-order-${salesOrder.number}`}
                  sections={headerSections.map((section) => ({
                    title: section.title,
                    fields: section.fields.map((field) => ({
                      label: field.label,
                      value: field.value ?? '',
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
                <DeleteButton resource="sales-orders" id={salesOrder.id} />
              </>
            ) : null}
          />
        )
      }
    >
      <TransactionDetailFrame
        stats={
          <TransactionStatsRow
            record={{
              id: salesOrder.id,
              total: computedTotal,
              createdFrom: salesOrder.quote?.number ?? null,
              lineCount: lineRows.length,
              statusLabel: formatSalesOrderStatus(salesOrder.status),
              statusTone:
                salesOrder.status === 'fulfilled'
                  ? 'green'
                  : salesOrder.status === 'cancelled'
                    ? 'red'
                    : salesOrder.status === 'booked'
                      ? 'blue'
                      : 'default',
              customerId: salesOrder.customer.customerId ?? null,
              customerHref: `/customers/${salesOrder.customer.id}`,
              userId: salesOrder.user?.userId ?? null,
              quoteId: salesOrder.quote?.number ?? null,
              quoteHref: salesOrder.quote ? `/quotes/${salesOrder.quote.id}` : null,
              opportunityId: salesOrder.quote?.opportunity?.opportunityNumber ?? null,
              opportunityHref: salesOrder.quote?.opportunity ? `/opportunities/${salesOrder.quote.opportunity.id}` : null,
              subsidiaryId: salesOrder.subsidiary?.subsidiaryId ?? null,
              currencyId: salesOrder.currency?.currencyId ?? salesOrder.currency?.code ?? null,
              createdAt: fmtDocumentDate(salesOrder.createdAt, moneySettings),
              updatedAt: fmtDocumentDate(salesOrder.updatedAt, moneySettings),
              moneySettings,
            }}
            stats={salesOrderPageConfig.stats}
            visibleStatIds={visibleStatIds}
          />
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <SalesOrderDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                sectionDescriptions={salesOrderPageConfig.sectionDescriptions}
              />
            </div>
          ) : (
            <PurchaseOrderHeaderSections
              purchaseOrderId={salesOrder.id}
              editing={isEditing}
              sections={headerSections}
              columns={customization.formColumns}
              updateUrl={`/api/sales-orders?id=${encodeURIComponent(salesOrder.id)}`}
            />
          )
        }
        lineItems={
          <PurchaseOrderLineItemsSection
            rows={lineRows.map((row, index) => ({
              id: row.id,
              displayOrder: index,
              itemRecordId: row.itemRecordId,
              itemId: row.itemId,
              itemName: row.itemName,
              description: row.description,
              quantity: row.quantity,
              receivedQuantity: row.fulfilledQuantity,
              billedQuantity: 0,
              openQuantity: row.openQuantity,
              unitPrice: row.unitPrice,
              lineTotal: row.lineTotal,
            }))}
            editing={isEditing}
            purchaseOrderId={salesOrder.id}
            userId={salesOrder.userId}
            itemOptions={itemOptions}
            lineColumns={poCompatibleLineColumns}
            sectionTitle="Sales Order Line Items"
            lineItemApiBasePath="/api/sales-order-line-items"
            deleteResource="sales-order-line-items"
            parentIdFieldName="salesOrderId"
            tableId="sales-order-line-items"
            allowAddLines={isEditing}
          />
        }
        relatedDocuments={
          <SalesOrderRelatedDocuments
            quotes={
              salesOrder.quote
                ? [
                    {
                      id: salesOrder.quote.id,
                      number: salesOrder.quote.number,
                      status: salesOrder.quote.status,
                      total: toNumericValue(salesOrder.quote.total, 0),
                      validUntil: salesOrder.quote.validUntil?.toISOString() ?? null,
                      opportunityName: salesOrder.quote.opportunity?.name ?? null,
                    },
                  ]
                : []
            }
            fulfillments={salesOrder.fulfillments.map((fulfillment) => ({
              id: fulfillment.id,
              number: fulfillment.number,
              status: fulfillment.status,
              date: fulfillment.date.toISOString(),
              notes: fulfillment.notes ?? null,
            }))}
            invoices={salesOrder.invoices.map((invoice) => ({
              id: invoice.id,
              number: invoice.number,
              status: invoice.status,
              total: toNumericValue(invoice.total, 0),
              dueDate: invoice.dueDate?.toISOString() ?? null,
              createdAt: invoice.createdAt.toISOString(),
            }))}
            cashReceipts={salesOrder.invoices.flatMap((invoice) =>
              invoice.cashReceipts.map((receipt) => ({
                id: receipt.id,
                amount: toNumericValue(receipt.amount, 0),
                date: receipt.date.toISOString(),
                method: receipt.method ?? null,
                reference: receipt.reference ?? null,
                invoiceNumber: invoice.number,
              }))
            )}
          />
        }
        communications={
          <CommunicationsSection
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: salesOrder.id,
              userId: salesOrder.userId,
              number: salesOrder.number,
              counterpartyName: salesOrder.customer.name,
              counterpartyEmail: salesOrder.customer.email ?? null,
              fromEmail: salesOrder.user?.email ?? null,
              status: formatSalesOrderStatus(salesOrder.status),
              total: fmtCurrency(computedTotal, undefined, moneySettings),
              lineItems: lineRows.map((row) => ({
                line: row.lineNumber,
                itemId: row.itemId ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: row.fulfilledQuantity,
                openQuantity: row.openQuantity,
                billedQuantity: 0,
                unitPrice: row.unitPrice,
                lineTotal: row.lineTotal,
              })),
            })}
          />
        }
        supplementarySections={<InvoiceGlImpactSection rows={glImpactRows} />}
        systemNotes={<SystemNotesSection notes={systemNotes} />}
      />
    </RecordDetailPageShell>
  )
}

