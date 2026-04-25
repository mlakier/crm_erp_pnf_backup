import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import QuoteCreateSalesOrderButton from '@/components/QuoteCreateSalesOrderButton'
import QuoteDetailCustomizeMode from '@/components/QuoteDetailCustomizeMode'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import QuoteRelatedDocuments from '@/components/QuoteRelatedDocuments'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import InvoiceGlImpactSection, { type InvoiceGlImpactRow } from '@/components/InvoiceGlImpactSection'
import DeleteButton from '@/components/DeleteButton'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  QUOTE_DETAIL_FIELDS,
  QUOTE_LINE_COLUMNS,
  type QuoteDetailFieldKey,
} from '@/lib/quotes-detail-customization'
import { loadQuoteDetailCustomization } from '@/lib/quotes-detail-customization-store'
import { quotePageConfig } from '@/lib/transaction-page-configs/quote'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import { loadListValues } from '@/lib/load-list-values'

type QuoteHeaderField = PurchaseOrderHeaderField & { key: QuoteDetailFieldKey }

export default async function QuoteDetailPage({
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

  const [quote, activities, customization, subsidiaries, currencies, statusValues, items, customers] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
          },
        },
        opportunity: true,
        salesOrder: {
          include: {
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
              select: {
                id: true,
                number: true,
                status: true,
                total: true,
                dueDate: true,
                createdAt: true,
              },
            },
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
          orderBy: { createdAt: 'asc' },
          include: {
            item: { select: { id: true, itemId: true, name: true } },
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: { entityType: 'quote', entityId: id },
      orderBy: { createdAt: 'desc' },
    }),
    loadQuoteDetailCustomization(),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    loadListValues('QUOTE-STATUS'),
    prisma.item.findMany({
      where: { active: true },
      orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
      select: { id: true, itemId: true, name: true, listPrice: true },
    }),
    prisma.customer.findMany({
      where: { inactive: false },
      orderBy: [{ customerId: 'asc' }, { name: 'asc' }],
      select: { id: true, customerId: true, name: true },
    }),
  ])

  if (!quote) notFound()

  const detailHref = `/quotes/${quote.id}`
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

  const createdByLabel =
    quote.user?.userId && quote.user?.name
      ? `${quote.user.userId} - ${quote.user.name}`
      : quote.user?.userId ?? quote.user?.name ?? quote.user?.email ?? '-'

  const lineRows = quote.lineItems.map((line, index) => ({
    id: line.id,
    lineNumber: index + 1,
    itemId: line.item?.itemId ?? null,
    itemName: line.item?.name ?? null,
    description: line.description,
    quantity: line.quantity,
    unitPrice: toNumericValue(line.unitPrice, 0),
    lineTotal: toNumericValue(line.lineTotal, 0),
  }))

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

  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: `${customer.customerId ?? 'CUSTOMER'} - ${customer.name}`,
  }))
  const statusOptions = statusValues.map((status) => ({
    value: status.toLowerCase(),
    label: status,
  }))

  const headerFieldDefinitions: Record<QuoteDetailFieldKey, QuoteHeaderField> = {
    customerId: {
      key: 'customerId',
      label: 'Customer',
      value: quote.customerId,
      editable: true,
      type: 'select',
      options: customerOptions,
      displayValue: `${quote.customer.customerId ?? 'CUSTOMER'} - ${quote.customer.name}`,
      helpText: 'Customer record linked to this quote.',
      fieldType: 'list',
      sourceText: 'Customers master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: quote.customer.name,
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: quote.customer.customerId ?? '',
      helpText: 'Internal customer identifier from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerEmail: {
      key: 'customerEmail',
      label: 'Email',
      value: quote.customer.email ?? '',
      helpText: 'Primary customer email address.',
      fieldType: 'email',
      sourceText: 'Customers master data',
    },
    customerPhone: {
      key: 'customerPhone',
      label: 'Phone',
      value: quote.customer.phone ?? '',
      helpText: 'Primary customer phone number.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerAddress: {
      key: 'customerAddress',
      label: 'Billing Address',
      value: quote.customer.address ?? '',
      helpText: 'Main billing address from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerPrimarySubsidiary: {
      key: 'customerPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: quote.customer.subsidiary ? `${quote.customer.subsidiary.subsidiaryId} - ${quote.customer.subsidiary.name}` : '',
      helpText: 'Default subsidiary context from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerPrimaryCurrency: {
      key: 'customerPrimaryCurrency',
      label: 'Primary Currency',
      value: quote.customer.currency ? `${quote.customer.currency.code ?? quote.customer.currency.currencyId} - ${quote.customer.currency.name}` : '',
      helpText: 'Default transaction currency from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerInactive: {
      key: 'customerInactive',
      label: 'Inactive',
      value: quote.customer.inactive ? 'Yes' : 'No',
      helpText: 'Indicates whether the linked customer is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Customers master data',
    },
    number: {
      key: 'number',
      label: 'Quote Id',
      value: quote.number,
      editable: true,
      type: 'text',
      helpText: 'Unique quote number used across OTC workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Quote number, source context, and ownership for this document.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      displayValue: createdByLabel,
      helpText: 'User who created the quote.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Quote number, source context, and ownership for this document.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: quote.opportunity?.opportunityNumber ?? '',
      displayValue: quote.opportunity ? (
        <Link href={`/opportunities/${quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {quote.opportunity.opportunityNumber ?? quote.opportunity.name}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Source transaction that created this quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Quote number, source context, and ownership for this document.',
    },
    opportunity: {
      key: 'opportunity',
      label: 'Opportunity',
      value: quote.opportunity?.name ?? '',
      displayValue: quote.opportunity?.name ?? '-',
      helpText: 'Opportunity linked to this quote.',
      fieldType: 'text',
      sourceText: 'Opportunities',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Quote number, source context, and ownership for this document.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: quote.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary that owns the quote.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: quote.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Transaction currency for the quote.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: quote.status ?? '',
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the quote.',
      fieldType: 'list',
      sourceText: 'System quote statuses',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
    validUntil: {
      key: 'validUntil',
      label: 'Valid Until',
      value: quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : '',
      displayValue: quote.validUntil ? fmtDocumentDate(quote.validUntil, moneySettings) : '-',
      editable: true,
      type: 'text',
      helpText: 'Date through which the quote remains valid.',
      fieldType: 'date',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(toNumericValue(quote.total, 0)),
      displayValue: fmtCurrency(quote.total, undefined, moneySettings),
      helpText: 'Document total based on all quote line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: quote.notes ?? '',
      displayValue: quote.notes ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Internal quote notes or summary context.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, validity, and monetary context for the quote.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: QUOTE_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: quotePageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: QUOTE_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      createdBy: createdByLabel,
      createdFrom: quote.opportunity?.opportunityNumber ?? '',
      validUntil: quote.validUntil ? fmtDocumentDate(quote.validUntil, moneySettings) : '-',
      total: fmtCurrency(quote.total, undefined, moneySettings),
      subsidiaryId: quote.subsidiary ? `${quote.subsidiary.subsidiaryId} - ${quote.subsidiary.name}` : '',
      currencyId: quote.currency ? `${quote.currency.code ?? quote.currency.currencyId} - ${quote.currency.name}` : '',
      customerPrimarySubsidiary: quote.customer.subsidiary ? `${quote.customer.subsidiary.subsidiaryId} - ${quote.customer.subsidiary.name}` : '',
      customerPrimaryCurrency: quote.customer.currency ? `${quote.customer.currency.code ?? quote.customer.currency.currencyId} - ${quote.customer.currency.name}` : '',
    },
  })
  const orderedVisibleLineColumns = getOrderedVisibleTransactionLineColumns(QUOTE_LINE_COLUMNS, customization)
  const visibleStatIds = customization.statCards
    .filter((card) => card.visible)
    .sort((left, right) => left.order - right.order)
    .map((card) => card.metric)
  const glImpactRows: InvoiceGlImpactRow[] = []

  const statusTone = formatStatusTone(quote.status)

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/quotes'}
      backLabel={isCustomizing ? '<- Back to Quote Detail' : '<- Back to Quotes'}
      meta={quote.number}
      title={quote.customer.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            Quote
          </span>
          <span className="inline-block rounded-full px-3 py-0.5 text-sm font-medium" style={{ backgroundColor: statusTone.bg, color: statusTone.color }}>
            {formatQuoteStatus(quote.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={
        isCustomizing ? null : (
          <TransactionActionStack
            mode={isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${quote.id}`}
            recordId={quote.id}
            primaryActions={
              !isEditing ? (
                <>
                  <MasterDataDetailCreateMenu newHref="/quotes/new" duplicateHref={`/quotes/new?duplicateFrom=${encodeURIComponent(quote.id)}`} />
                  <MasterDataDetailExportMenu
                    title={quote.number}
                    fileName={`quote-${quote.number}`}
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
                  <DeleteButton resource="quotes" id={quote.id} />
                </>
              ) : null
            }
          />
        )
      }
      headerCenter={!isCustomizing && !isEditing ? <QuoteCreateSalesOrderButton quoteId={quote.id} existingSalesOrderId={quote.salesOrder?.id} /> : null}
    >
      <TransactionDetailFrame
        stats={
          <TransactionStatsRow
            record={{
              customerId: quote.customer.customerId ?? null,
              customerHref: `/customers/${quote.customer.id}`,
              opportunityId: quote.opportunity?.opportunityNumber ?? null,
              opportunityHref: quote.opportunity ? `/opportunities/${quote.opportunity.id}` : null,
              total: toNumericValue(quote.total, 0),
              validUntil: quote.validUntil,
              lineCount: lineRows.length,
              statusLabel: formatQuoteStatus(quote.status),
              statusTone:
                quote.status === 'accepted'
                  ? 'green'
                  : quote.status === 'expired'
                    ? 'yellow'
                    : quote.status === 'sent'
                      ? 'accent'
                      : 'default',
              moneySettings,
            }}
            stats={quotePageConfig.stats}
            visibleStatIds={visibleStatIds}
          />
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <QuoteDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                sectionDescriptions={quotePageConfig.sectionDescriptions}
              />
            </div>
          ) : (
            <PurchaseOrderHeaderSections
              purchaseOrderId={quote.id}
              editing={isEditing}
              sections={headerSections}
              columns={customization.formColumns}
              updateUrl={`/api/quotes?id=${encodeURIComponent(quote.id)}`}
            />
          )
        }
        lineItems={
          <PurchaseOrderLineItemsSection
            rows={lineRows.map((row, index) => ({
              id: row.id,
              displayOrder: index,
              itemRecordId: quote.lineItems[index]?.item?.id ?? null,
              itemId: row.itemId,
              itemName: row.itemName,
              description: row.description,
              quantity: row.quantity,
              receivedQuantity: 0,
              billedQuantity: 0,
              openQuantity: row.quantity,
              unitPrice: row.unitPrice,
              lineTotal: row.lineTotal,
            }))}
            editing={isEditing}
            purchaseOrderId={quote.id}
            userId={quote.userId}
            itemOptions={items.map((item) => ({
              id: item.id,
              itemId: item.itemId ?? 'ITEM',
              name: item.name,
              unitPrice: toNumericValue(item.listPrice, 0),
            }))}
            lineColumns={orderedVisibleLineColumns}
            draftMode={isEditing}
            sectionTitle="Quote Line Items"
            allowAddLines={isEditing}
          />
        }
        relatedDocuments={
          <QuoteRelatedDocuments
            opportunities={
              quote.opportunity
                ? [
                    {
                      id: quote.opportunity.id,
                      number: quote.opportunity.opportunityNumber ?? quote.opportunity.name,
                      name: quote.opportunity.name,
                      status: quote.opportunity.stage,
                      total: toNumericValue(quote.opportunity.amount, 0),
                    },
                  ]
                : []
            }
            salesOrders={
              quote.salesOrder
                ? [
                    {
                      id: quote.salesOrder.id,
                      number: quote.salesOrder.number,
                      status: quote.salesOrder.status,
                      total: toNumericValue(quote.salesOrder.total, 0),
                    },
                  ]
                : []
            }
            fulfillments={(quote.salesOrder?.fulfillments ?? []).map((fulfillment) => ({
              id: fulfillment.id,
              number: fulfillment.number,
              status: fulfillment.status,
              date: fulfillment.date.toISOString(),
              notes: fulfillment.notes ?? null,
            }))}
            invoices={(quote.salesOrder?.invoices ?? []).map((invoice) => ({
              id: invoice.id,
              number: invoice.number,
              status: invoice.status,
              total: toNumericValue(invoice.total, 0),
              dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
              createdAt: invoice.createdAt.toISOString(),
            }))}
          />
        }
        communications={
          <CommunicationsSection
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: quote.id,
              userId: quote.userId,
              number: quote.number,
              counterpartyName: quote.customer.name,
              counterpartyEmail: quote.customer.email ?? null,
              fromEmail: quote.user?.email ?? null,
              status: formatQuoteStatus(quote.status),
              total: fmtCurrency(quote.total, undefined, moneySettings),
              lineItems: lineRows.map((row, index) => ({
                line: index + 1,
                itemId: row.itemId ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: 0,
                openQuantity: row.quantity,
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

function formatQuoteStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatStatusTone(status: string | null) {
  const key = (status ?? '').toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    sent: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    accepted: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    expired: { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d' },
  }
  return styles[key] ?? styles.draft
}
