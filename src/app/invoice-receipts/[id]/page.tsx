import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadListValues } from '@/lib/load-list-values'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import InvoiceReceiptDetailCustomizeMode from '@/components/InvoiceReceiptDetailCustomizeMode'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import SystemNotesSection from '@/components/SystemNotesSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import InvoiceReceiptRelatedDocuments from '@/components/InvoiceReceiptRelatedDocuments'
import InvoiceReceiptGlImpactSection from '@/components/InvoiceReceiptGlImpactSection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
} from '@/lib/transaction-detail-helpers'
import {
  INVOICE_RECEIPT_DETAIL_FIELDS,
  INVOICE_RECEIPT_STAT_CARDS,
  type InvoiceReceiptDetailFieldKey,
} from '@/lib/invoice-receipt-detail-customization'
import { loadInvoiceReceiptDetailCustomization } from '@/lib/invoice-receipt-detail-customization-store'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'

type InvoiceReceiptHeaderField = {
  key: InvoiceReceiptDetailFieldKey
} & PurchaseOrderHeaderField

export default async function InvoiceReceiptDetailPage({
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

  const [receipt, customization, invoices, paymentMethodValues] = await Promise.all([
    prisma.cashReceipt.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            customer: true,
            salesOrder: {
              include: {
                quote: {
                  include: {
                    opportunity: true,
                  },
                },
              },
            },
            cashReceipts: {
              orderBy: { date: 'desc' },
            },
          },
        },
      },
    }),
    loadInvoiceReceiptDetailCustomization(),
    prisma.invoice.findMany({
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadListValues('PAYMENT-METHOD'),
  ])

  if (!receipt) notFound()

  const detailHref = `/invoice-receipts/${receipt.id}`
  const invoiceOptions = invoices.map((invoice) => ({
    value: invoice.id,
    label: `${invoice.number} - ${invoice.customer.name}`,
  }))
  const methodOptions = paymentMethodValues.map((value) => ({
    value: value.toLowerCase(),
    label: value,
  }))

  const sectionDescriptions: Record<string, string> = {
    Customer: 'Customer context derived from the linked invoice.',
    'Invoice Receipt Details': 'Core receipt fields, invoice link, and system dates.',
  }

  const receiptStats: TransactionStatDefinition<typeof receipt>[] = [
    {
      id: 'amount',
      label: 'Receipt Amount',
      accent: true,
      getValue: (record) => fmtCurrency(record.amount, undefined, moneySettings),
      getValueTone: () => 'accent',
    },
    {
      id: 'date',
      label: 'Receipt Date',
      getValue: (record) => fmtDocumentDate(record.date, moneySettings),
    },
    {
      id: 'method',
      label: 'Method',
      getValue: (record) => record.method || '-',
    },
    {
      id: 'invoice',
      label: 'Invoice',
      getValue: (record) => record.invoice.number,
      getHref: (record) => `/invoices/${record.invoice.id}`,
      getValueTone: () => 'accent',
    },
  ]
  const activities = await prisma.activity.findMany({
    where: {
      entityType: 'invoice-receipt',
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

  const headerFieldDefinitions: Record<InvoiceReceiptDetailFieldKey, InvoiceReceiptHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: receipt.invoice.customer.name,
      helpText: 'Display name from the linked invoice customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: receipt.invoice.customer.customerId ?? '',
      helpText: 'Internal customer identifier from the linked invoice customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: receipt.id,
      helpText: 'Internal database identifier for this invoice receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    number: {
      key: 'number',
      label: 'Invoice Receipt Id',
      value: receipt.number ?? '',
      helpText: 'Unique identifier for this invoice receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    invoiceId: {
      key: 'invoiceId',
      label: 'Invoice',
      value: receipt.invoiceId,
      displayValue: (
        <Link href={`/invoices/${receipt.invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {receipt.invoice.number}
        </Link>
      ),
      editable: true,
      type: 'select',
      options: invoiceOptions,
      helpText: 'Invoice that this receipt is applied to.',
      fieldType: 'text',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: String(receipt.amount),
      displayValue: fmtCurrency(receipt.amount, undefined, moneySettings),
      editable: true,
      type: 'number',
      helpText: 'Cash receipt amount applied to the invoice.',
      fieldType: 'currency',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
    },
    date: {
      key: 'date',
      label: 'Receipt Date',
      value: receipt.date.toISOString().slice(0, 10),
      displayValue: fmtDocumentDate(receipt.date, moneySettings),
      editable: true,
      type: 'date',
      helpText: 'Date the receipt was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
    },
    method: {
      key: 'method',
      label: 'Method',
      value: receipt.method,
      editable: true,
      type: 'select',
      options: methodOptions,
      helpText: 'Method used to receive payment.',
      fieldType: 'list',
      sourceText: 'Payment method list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
    },
    reference: {
      key: 'reference',
      label: 'Reference',
      value: receipt.reference ?? '',
      displayValue: receipt.reference ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Reference number or memo for the receipt.',
      fieldType: 'text',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: receipt.createdAt.toISOString(),
      displayValue: fmtDocumentDate(receipt.createdAt, moneySettings),
      helpText: 'Date/time the invoice receipt record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: receipt.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(receipt.updatedAt, moneySettings),
      helpText: 'Date/time the invoice receipt record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: INVOICE_RECEIPT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: INVOICE_RECEIPT_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      amount: fmtCurrency(receipt.amount, undefined, moneySettings),
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

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/invoice-receipts'}
      backLabel={isCustomizing ? '<- Back to Invoice Receipt Detail' : '<- Back to Invoice Receipts'}
      meta={receipt.number ?? receipt.id}
      title={receipt.invoice.customer.name}
      widthClassName="w-full max-w-none"
      actions={
        isCustomizing ? null : (
          <TransactionActionStack
            mode={isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${receipt.id}`}
            recordId={receipt.id}
            primaryActions={
              !isEditing ? (
                <>
                  <MasterDataDetailCreateMenu
                    newHref="/invoice-receipts/new"
                    duplicateHref={`/invoice-receipts/new?duplicateFrom=${encodeURIComponent(receipt.id)}`}
                  />
                  <MasterDataDetailExportMenu
                    title={receipt.number ?? receipt.id}
                    fileName={`invoice-receipt-${receipt.number ?? receipt.id}`}
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
            record={receipt}
            stats={receiptStats}
            visibleStatIds={
              customization.statCards
                ?.filter((card) => card.visible)
                .sort((left, right) => left.order - right.order)
                .map((card) => card.metric) ?? INVOICE_RECEIPT_STAT_CARDS.map((card) => card.id)
            }
          />
        }
        header={
          isCustomizing ? (
            <InvoiceReceiptDetailCustomizeMode
              detailHref={detailHref}
              initialLayout={customization}
              fields={customizeFields}
              sectionDescriptions={sectionDescriptions}
            />
          ) : (
            <PurchaseOrderHeaderSections
              purchaseOrderId={receipt.id}
              editing={isEditing}
              sections={headerSections}
              columns={customization.formColumns}
              updateUrl={`/api/invoice-receipts?id=${encodeURIComponent(receipt.id)}`}
            />
          )
        }
        lineItems={null}
        relatedDocuments={
          <InvoiceReceiptRelatedDocuments
            salesOrder={
              receipt.invoice.salesOrder
                ? {
                    id: receipt.invoice.salesOrder.id,
                    number: receipt.invoice.salesOrder.number,
                    status: receipt.invoice.salesOrder.status,
                    total: Number(receipt.invoice.salesOrder.total),
                  }
                : null
            }
            quote={
              receipt.invoice.salesOrder?.quote
                ? {
                    id: receipt.invoice.salesOrder.quote.id,
                    number: receipt.invoice.salesOrder.quote.number,
                    status: receipt.invoice.salesOrder.quote.status,
                    total: Number(receipt.invoice.salesOrder.quote.total),
                  }
                : null
            }
            opportunity={
              receipt.invoice.salesOrder?.quote?.opportunity
                ? {
                    id: receipt.invoice.salesOrder.quote.opportunity.id,
                    number:
                      receipt.invoice.salesOrder.quote.opportunity.opportunityNumber ??
                      receipt.invoice.salesOrder.quote.opportunity.id,
                    name: receipt.invoice.salesOrder.quote.opportunity.name,
                    status: receipt.invoice.salesOrder.quote.opportunity.stage,
                    total: Number(receipt.invoice.salesOrder.quote.opportunity.amount ?? 0),
                  }
                : null
            }
            cashReceipts={receipt.invoice.cashReceipts.map((linkedReceipt) => ({
              id: linkedReceipt.id,
              number: linkedReceipt.number ?? null,
              amount: Number(linkedReceipt.amount),
              date: linkedReceipt.date.toISOString(),
              method: linkedReceipt.method,
              reference: linkedReceipt.reference ?? null,
            }))}
            moneySettings={moneySettings}
          />
        }
        supplementarySections={<InvoiceReceiptGlImpactSection rows={[]} />}
        communications={
          <CommunicationsSection
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: receipt.id,
              number: receipt.number ?? receipt.id,
              counterpartyName: receipt.invoice.customer.name,
              counterpartyEmail: receipt.invoice.customer.email ?? null,
              status: receipt.method,
              total: fmtCurrency(receipt.amount, undefined, moneySettings),
              lineItems: [],
            })}
          />
        }
        systemNotes={<SystemNotesSection notes={systemNotes} />}
      />
    </RecordDetailPageShell>
  )
}
