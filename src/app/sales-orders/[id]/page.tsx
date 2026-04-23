import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import RecordStatusButton from '@/components/RecordStatusButton'
import SalesOrderCreateInvoiceButton from '@/components/SalesOrderCreateInvoiceButton'
import SalesOrderDetailCustomizeMode from '@/components/SalesOrderDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionFieldSummarySection from '@/components/TransactionFieldSummarySection'
import TransactionLineTable, { type TransactionLineColumn } from '@/components/TransactionLineTable'
import SalesOrderRelatedDocuments from '@/components/SalesOrderRelatedDocuments'
import SystemNotesSection from '@/components/SystemNotesSection'
import { parseFieldChangeSummary } from '@/lib/activity'
import {
  SALES_ORDER_DETAIL_FIELDS,
  SALES_ORDER_LINE_COLUMNS,
  type SalesOrderDetailFieldKey,
} from '@/lib/sales-order-detail-customization'
import { loadSalesOrderDetailCustomization } from '@/lib/sales-order-detail-customization-store'
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
  label: string
  value: string
  displayValue?: React.ReactNode
  column?: number
  order?: number
  helpText?: string
  fieldType?: 'text' | 'number' | 'date' | 'email' | 'list' | 'checkbox' | 'currency'
  sourceText?: string
}

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

const sectionDescriptions = {
  Customer: 'Customer contact and default commercial context from the linked master data record.',
  'Sales Order Details': 'Core order control fields and upstream sales context.',
} as const

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ customize?: string }>
}) {
  const { id } = await params
  const { customize } = await searchParams
  const isCustomizing = customize === '1'

  const [salesOrder, activities, customization] = await Promise.all([
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
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    }
  })
  const computedTotal = lineRows.reduce((sum, row) => sum + row.lineTotal, 0)
  const latestInvoice = salesOrder.invoices[0]
  const statusTone = formatStatusTone(salesOrder.status)
  const detailHref = `/sales-orders/${salesOrder.id}`
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
        date: new Date(activity.createdAt).toLocaleString(),
        setBy: activity.userId ? activityUserLabelById.get(activity.userId) ?? activity.userId : 'System',
        context: parsed.context,
        fieldName: parsed.fieldName,
        oldValue: parsed.oldValue,
        newValue: parsed.newValue,
      }
    })
    .filter((note): note is Exclude<typeof note, null> => Boolean(note))

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
    number: {
      key: 'number',
      label: 'Sales Order Id',
      value: salesOrder.number,
      helpText: 'Unique sales order number used across OTC workflows.',
      fieldType: 'text',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      helpText: 'User who created the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
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
    },
    opportunity: {
      key: 'opportunity',
      label: 'Opportunity',
      value: salesOrder.quote?.opportunity?.name ?? '',
      helpText: 'Opportunity linked through the source quote.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: salesOrder.subsidiary ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}` : '',
      helpText: 'Subsidiary that owns the sales order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: salesOrder.currency ? `${salesOrder.currency.code} - ${salesOrder.currency.name}` : '',
      helpText: 'Transaction currency for the sales order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: salesOrder.status ?? '',
      displayValue: formatSalesOrderStatus(salesOrder.status),
      helpText: 'Current lifecycle stage of the sales order.',
      fieldType: 'list',
      sourceText: 'System sales order statuses',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: computedTotal.toString(),
      displayValue: fmtCurrency(computedTotal),
      helpText: 'Current document total based on all sales order line amounts.',
      fieldType: 'currency',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: SALES_ORDER_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: SALES_ORDER_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      customerAddress: salesOrder.customer.address ?? '',
      customerPrimarySubsidiary: salesOrder.customer.subsidiary ? `${salesOrder.customer.subsidiary.subsidiaryId} - ${salesOrder.customer.subsidiary.name}` : '',
      customerPrimaryCurrency: salesOrder.customer.currency ? `${salesOrder.customer.currency.code} - ${salesOrder.customer.currency.name}` : '',
      customerInactive: salesOrder.customer.inactive ? 'Yes' : 'No',
      createdBy: createdByLabel,
      createdFrom: salesOrder.quote?.number ?? '',
      subsidiaryId: salesOrder.subsidiary ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}` : '',
      currencyId: salesOrder.currency ? `${salesOrder.currency.code} - ${salesOrder.currency.name}` : '',
      status: formatSalesOrderStatus(salesOrder.status),
      total: fmtCurrency(computedTotal),
    },
  })

  const visibleLineColumnOrder = getOrderedVisibleTransactionLineColumns(
    SALES_ORDER_LINE_COLUMNS,
    customization
  )

  const lineColumnMap: Record<string, TransactionLineColumn<SalesOrderLineRow>> = {
    line: {
      id: 'line',
      label: 'Line',
      sticky: true,
      width: 72,
      render: (row) => row.lineNumber,
    },
    'item-id': {
      id: 'item-id',
      label: 'Item Id',
      sticky: true,
      width: 140,
      render: (row) =>
        row.itemRecordId && row.itemId ? (
          <Link href={`/items/${row.itemRecordId}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {row.itemId}
          </Link>
        ) : (
          row.itemId ?? '-'
        ),
    },
    description: {
      id: 'description',
      label: 'Description',
      width: 320,
      render: (row) => row.description,
    },
    quantity: {
      id: 'quantity',
      label: 'Qty',
      align: 'right',
      render: (row) => row.quantity,
    },
    'fulfilled-qty': {
      id: 'fulfilled-qty',
      label: 'Fulfilled Qty',
      align: 'right',
      render: (row) => row.fulfilledQuantity,
    },
    'open-qty': {
      id: 'open-qty',
      label: 'Open Qty',
      align: 'right',
      render: (row) => row.openQuantity,
    },
    'unit-price': {
      id: 'unit-price',
      label: 'Unit Price',
      align: 'right',
      render: (row) => fmtCurrency(row.unitPrice),
    },
    'line-total': {
      id: 'line-total',
      label: 'Line Total',
      align: 'right',
      render: (row) => fmtCurrency(row.lineTotal),
    },
  }

  const visibleLineColumns = visibleLineColumnOrder
    .map((column) => lineColumnMap[column.id])
    .filter((column): column is TransactionLineColumn<SalesOrderLineRow> => Boolean(column))

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
      actions={
        isCustomizing ? null : (
          <>
            <Link
              href={`${detailHref}?customize=1`}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Customize
            </Link>
            {salesOrder.status !== 'booked' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="booked" label="Book Order" tone="blue" /> : null}
            {salesOrder.status !== 'fulfilled' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="fulfilled" label="Mark Fulfilled" tone="emerald" /> : null}
            {salesOrder.status !== 'cancelled' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="cancelled" label="Cancel" tone="red" /> : null}
            {salesOrder.status !== 'draft' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="draft" label="Reset Draft" tone="gray" /> : null}
            <SalesOrderCreateInvoiceButton salesOrderId={salesOrder.id} existingInvoiceId={latestInvoice?.id} />
            {salesOrder.quote ? (
              <Link
                href={`/quotes/${salesOrder.quote.id}`}
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                View Quote
              </Link>
            ) : null}
          </>
        )
      }
    >
      {isCustomizing ? (
        <SalesOrderDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={customization}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
        />
      ) : (
        headerSections.map((section) => (
          <TransactionFieldSummarySection
            key={section.title}
            title={section.title}
            description={section.description}
            count={section.fields.length}
            fields={section.fields.map((field) => ({
              label: field.label,
              value: field.displayValue ?? field.value ?? '-',
              helpText: field.helpText,
              fieldId: field.key,
              fieldType: field.fieldType,
              sourceText: field.sourceText,
            }))}
            columns={customization.formColumns as 1 | 2 | 3 | 4}
          />
        ))
      )}

      <TransactionLineTable
        title="Line Items"
        count={lineRows.length}
        summary={lineRows.length ? `Total ${fmtCurrency(computedTotal)}` : undefined}
        tableId="sales-order-line-items"
        emptyMessage="No line items are on this sales order yet."
        rows={lineRows}
        getRowKey={(row) => row.id}
        columns={visibleLineColumns}
      />

      <SalesOrderRelatedDocuments
        quotes={
          salesOrder.quote
            ? [
                {
                  id: salesOrder.quote.id,
                  number: salesOrder.quote.number,
                  status: salesOrder.quote.status,
                  total: salesOrder.quote.total,
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
          total: invoice.total,
          dueDate: invoice.dueDate?.toISOString() ?? null,
          createdAt: invoice.createdAt.toISOString(),
        }))}
        cashReceipts={salesOrder.invoices.flatMap((invoice) =>
          invoice.cashReceipts.map((receipt) => ({
            id: receipt.id,
            amount: receipt.amount,
            date: receipt.date.toISOString(),
            method: receipt.method ?? null,
            reference: receipt.reference ?? null,
            invoiceNumber: invoice.number,
          }))
        )}
      />

      <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
