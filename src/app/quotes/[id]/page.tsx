import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import QuoteCreateSalesOrderButton from '@/components/QuoteCreateSalesOrderButton'
import QuoteDetailCustomizeMode from '@/components/QuoteDetailCustomizeMode'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import QuoteRelatedDocuments from '@/components/QuoteRelatedDocuments'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  QUOTE_REFERENCE_SOURCES,
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
import { loadManagedListDetail } from '@/lib/manage-lists'
import RecordStatusButton from '@/components/RecordStatusButton'
import {
  getAvailableWorkflowStatusActions,
  getWorkflowDocumentAction,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import type { TransactionStatusColorTone } from '@/lib/company-preferences-definitions'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

type QuoteHeaderField = RecordHeaderField & { key: QuoteDetailFieldKey }

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

function getQuoteStatusTone(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
) {
  return getToneStyle(configuredTones[(status ?? '').toLowerCase()] ?? 'default')
}

function getQuoteStatusToneKey(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
): TransactionVisualTone {
  return configuredTones[(status ?? '').toLowerCase()] ?? 'default'
}

export default async function QuoteDetailPage({
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

  const [quote, activities, customization, subsidiaries, currencies, statusListDetail, items, customers, workflow] = await Promise.all([
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
                currencyId: true,
                dueDate: true,
                createdAt: true,
                cashReceipts: {
                  orderBy: { date: 'desc' },
                  select: {
                    id: true,
                    number: true,
                    amount: true,
                    date: true,
                    method: true,
                    reference: true,
                  },
                },
              },
            },
          },
        },
        user: true,
        subsidiary: true,
        currency: true,
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
    loadManagedListDetail('QUOTE-STATUS'),
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
    loadOtcWorkflowRuntime(),
  ])

  if (!quote) notFound()
  const quoteCurrencyCode = quote.currency?.code ?? quote.currency?.currencyId ?? undefined
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]))

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
  const quoteStatusColors = Object.fromEntries(
    (statusListDetail?.rows ?? []).map((row) => [row.value.toLowerCase(), row.colorTone ?? 'default']),
  ) as Record<string, TransactionStatusColorTone>
  const statusOptions = (statusListDetail?.rows ?? []).map((row) => ({
    value: row.value.toLowerCase(),
    label: formatQuoteStatus(row.value),
  }))

  const headerFieldDefinitions: Record<QuoteDetailFieldKey, QuoteHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: quote.id,
      displayValue: quote.id,
      helpText: 'Internal database identifier for the quote record.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Quote number, source context, and ownership for this document.',
    },
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
    userId: {
      key: 'userId',
      label: 'User DB Id',
      value: quote.userId,
      displayValue: quote.userId,
      helpText: 'Internal database identifier for the quote owner.',
      fieldType: 'text',
      sourceText: 'Users master data',
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
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity DB Id',
      value: quote.opportunityId ?? '',
      displayValue: quote.opportunityId ?? '-',
      helpText: 'Internal database identifier for the linked opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
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
      href: quote.subsidiary ? `/subsidiaries/${quote.subsidiary.id}` : null,
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
      href: quote.currency ? `/currencies/${quote.currency.id}` : null,
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
      sourceText: 'Quote status list',
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
      displayValue: fmtCurrency(quote.total, quoteCurrencyCode, moneySettings),
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
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: quote.createdAt.toISOString(),
      displayValue: fmtDocumentDate(quote.createdAt, moneySettings),
      helpText: 'Date/time the quote record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this quote record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: quote.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(quote.updatedAt, moneySettings),
      helpText: 'Date/time the quote record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this quote record.',
    },
  }
  const customerHref = `/customers/${quote.customer.id}`
  const opportunityHref = quote.opportunity ? `/opportunities/${quote.opportunity.id}` : null
  const ownerHref = quote.user ? `/users/${quote.user.id}` : null
  const subsidiaryHref = quote.subsidiary ? `/subsidiaries/${quote.subsidiary.id}` : null
  const currencyHref = quote.currency ? `/currencies/${quote.currency.id}` : null
  const salesOrderHref = quote.salesOrder ? `/sales-orders/${quote.salesOrder.id}` : null

  headerFieldDefinitions.customerId.href = customerHref
  headerFieldDefinitions.customerNumber.href = customerHref
  headerFieldDefinitions.userId.href = ownerHref
  headerFieldDefinitions.opportunityId.href = opportunityHref
  headerFieldDefinitions.createdFrom.href = opportunityHref
  headerFieldDefinitions.subsidiaryId.href = subsidiaryHref
  headerFieldDefinitions.currencyId.href = currencyHref

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(QUOTE_REFERENCE_SOURCES, {
    customer: quote.customer,
    opportunity: quote.opportunity,
    owner: quote.user,
    subsidiary: quote.subsidiary,
    currency: quote.currency,
    salesOrder: quote.salesOrder,
  }, {
    customer: customerHref,
    opportunity: opportunityHref,
    owner: ownerHref,
    subsidiary: subsidiaryHref,
    currency: currencyHref,
    salesOrder: salesOrderHref,
  })
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
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
      id: quote.id,
      userId: quote.userId,
      opportunityId: quote.opportunityId ?? '-',
      createdBy: createdByLabel,
      createdFrom: quote.opportunity?.opportunityNumber ?? '',
      validUntil: quote.validUntil ? fmtDocumentDate(quote.validUntil, moneySettings) : '-',
      total: fmtCurrency(quote.total, quoteCurrencyCode, moneySettings),
      subsidiaryId: quote.subsidiary ? `${quote.subsidiary.subsidiaryId} - ${quote.subsidiary.name}` : '',
      currencyId: quote.currency ? `${quote.currency.code ?? quote.currency.currencyId} - ${quote.currency.name}` : '',
      customerPrimarySubsidiary: quote.customer.subsidiary ? `${quote.customer.subsidiary.subsidiaryId} - ${quote.customer.subsidiary.name}` : '',
      customerPrimaryCurrency: quote.customer.currency ? `${quote.customer.currency.code ?? quote.customer.currency.currencyId} - ${quote.customer.currency.name}` : '',
      createdAt: fmtDocumentDate(quote.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(quote.updatedAt, moneySettings),
    },
  })
  const orderedVisibleLineColumns = getOrderedVisibleTransactionLineColumns(QUOTE_LINE_COLUMNS, customization)
  const statusTone = getQuoteStatusTone(quote.status, quoteStatusColors)
  const statsRecord = {
    customerId: quote.customer.customerId ?? null,
    customerHref: `/customers/${quote.customer.id}`,
    opportunityId: quote.opportunity?.opportunityNumber ?? null,
    opportunityHref: quote.opportunity ? `/opportunities/${quote.opportunity.id}` : null,
    total: toNumericValue(quote.total, 0),
    currencyCode: quoteCurrencyCode ?? null,
    validUntil: quote.validUntil,
    lineCount: lineRows.length,
    statusLabel: formatQuoteStatus(quote.status),
    statusTone: getQuoteStatusToneKey(quote.status, quoteStatusColors),
    moneySettings,
  } as const
  const statPreviewCards = quotePageConfig.stats.map((stat) => ({
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
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(QUOTE_REFERENCE_SOURCES, {
    customer: quote.customer,
    opportunity: quote.opportunity,
    owner: quote.user,
    subsidiary: quote.subsidiary,
    currency: quote.currency,
    salesOrder: quote.salesOrder,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = QUOTE_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const quoteStatusActions = getAvailableWorkflowStatusActions(workflow, 'quote', quote.status)
  const createSalesOrderAction = getWorkflowDocumentAction(workflow, 'quote', 'sales-order', quote.status)
  const relatedDocumentsCount =
    (quote.opportunity ? 1 : 0) +
    (quote.salesOrder ? 1 : 0) +
    (quote.salesOrder?.fulfillments.length ?? 0) +
    (quote.salesOrder?.invoices.length ?? 0) +
    (quote.salesOrder?.invoices.flatMap((invoice) => invoice.cashReceipts).length ?? 0)
  const communicationsToolbarTargetId = 'quote-communications-toolbar'
  const systemNotesToolbarTargetId = 'quote-system-notes-toolbar'

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
          <TransactionActionStack
            mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${quote.id}`}
            recordId={quote.id}
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
              )
            }
          />
      }
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {quoteStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="quotes"
                id={quote.id}
                status={action.nextValue}
                label={action.label}
                tone={action.tone}
                fieldName={action.fieldName}
                workflowStep={action.step}
                workflowActionId={action.id}
              />
            ))}
            {createSalesOrderAction || quote.salesOrder ? (
              <QuoteCreateSalesOrderButton
                quoteId={quote.id}
                existingSalesOrderId={quote.salesOrder?.id ?? null}
              />
            ) : null}
          </div>
        ) : null
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={
          isCustomizing ? null : (
            <TransactionStatsRow
              record={statsRecord}
              stats={quotePageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <QuoteDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={quotePageConfig.sectionDescriptions}
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
                  containerDescription="Expanded context from linked records on this quote."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={quote.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Quote Details"
                containerDescription="Core quote fields organized into customizable sections."
                showSubsections={false}
                updateUrl={`/api/quotes?id=${encodeURIComponent(quote.id)}`}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : (
            <TransactionLineItemsSection
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
              lineSettings={customization.lineSettings}
              lineColumnCustomization={customization.lineColumns}
              draftMode={isEditing}
              sectionTitle="Quote Line Items"
              allowAddLines={isEditing}
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
                count: 1,
                emptyMessage: 'No related customer is linked to this quote.',
                rows: [
                  {
                    id: quote.customer.id,
                    type: 'Customer',
                    reference: quote.customer.customerId ?? quote.customer.id,
                    name: quote.customer.name,
                    details: [quote.customer.email, quote.customer.phone].filter(Boolean).join(' | ') || '-',
                    href: `/customers/${quote.customer.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <QuoteRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={quoteCurrencyCode ?? null}
            opportunities={
              quote.opportunity
                ? [
                    {
                      id: quote.opportunity.id,
                      number: quote.opportunity.opportunityNumber ?? quote.opportunity.name,
                      name: quote.opportunity.name,
                      status: quote.opportunity.stage,
                      total: toNumericValue(quote.opportunity.amount, 0),
                      currencyCode: currencyCodeById.get(quote.opportunity.currencyId ?? '') ?? null,
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
                      currencyCode: currencyCodeById.get(quote.salesOrder.currencyId ?? '') ?? null,
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
              currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
              dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
              createdAt: invoice.createdAt.toISOString(),
            }))}
            invoiceReceipts={(quote.salesOrder?.invoices ?? []).flatMap((invoice) =>
              invoice.cashReceipts.map((receipt) => ({
                id: receipt.id,
                number: receipt.number ?? 'Pending',
                amount: toNumericValue(receipt.amount, 0),
                currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                date: receipt.date.toISOString(),
                method: receipt.method,
                reference: receipt.reference,
              })),
            )}
          />
        )}
        relatedDocumentsCount={relatedDocumentsCount}
        supplementarySections={null}
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId={communicationsToolbarTargetId}
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: quote.id,
              userId: quote.userId,
              number: quote.number,
              counterpartyName: quote.customer.name,
              counterpartyEmail: quote.customer.email ?? null,
              fromEmail: quote.user?.email ?? null,
              status: formatQuoteStatus(quote.status),
                total: fmtCurrency(quote.total, quoteCurrencyCode, moneySettings),
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
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId={communicationsToolbarTargetId}
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId={systemNotesToolbarTargetId} showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId={systemNotesToolbarTargetId}
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}

function formatQuoteStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}
