import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import RecordStatusButton from '@/components/RecordStatusButton'
import InvoiceDetailCustomizeMode from '@/components/InvoiceDetailCustomizeMode'
import InvoiceRelatedDocuments from '@/components/InvoiceRelatedDocuments'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import {
  RecordDetailCell,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import CommunicationsSection from '@/components/CommunicationsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  INVOICE_DETAIL_FIELDS,
  INVOICE_LINE_COLUMNS,
  INVOICE_REFERENCE_SOURCES,
  type InvoiceDetailFieldKey,
  type InvoiceLineColumnKey,
} from '@/lib/invoice-detail-customization'
import { loadInvoiceDetailCustomization } from '@/lib/invoice-detail-customization-store'
import { invoicePageConfig } from '@/lib/transaction-page-configs/invoice'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import InvoiceGlImpactSection from '@/components/InvoiceGlImpactSection'
import {
  buildConfiguredTransactionSections,
  buildTransactionGlImpactRows,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import {
  buildPostedCurrencyReadoutSection,
  CURRENCY_READOUT_SECTION_TITLE,
} from '@/lib/four-currency-readout'
import { loadManagedListDetail } from '@/lib/manage-lists'
import {
  getAvailableWorkflowStatusActions,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import type { TransactionStatusColorTone } from '@/lib/company-preferences-definitions'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

type InvoiceHeaderField = {
  key: InvoiceDetailFieldKey
} & RecordHeaderField

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

function getInvoiceStatusTone(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
) {
  return getToneStyle(configuredTones[(status ?? '').toLowerCase()] ?? 'default')
}

function getInvoiceStatusToneKey(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
): TransactionVisualTone {
  return configuredTones[(status ?? '').toLowerCase()] ?? 'default'
}

export default async function InvoiceDetailPage({
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

  const [invoice, invoiceOpenItem, activities, customization, subsidiaries, currencies, items, statusListDetail, workflow] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
          },
        },
        salesOrder: {
          include: {
            quote: {
              include: {
                opportunity: true,
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
            department: { select: { id: true, departmentId: true, name: true } },
            location: { select: { id: true, locationId: true, name: true } },
            project: { select: { id: true, name: true } },
            revRecTemplate: { select: { id: true, templateId: true, name: true } },
          },
        },
        cashReceipts: {
          orderBy: { date: 'desc' },
        },
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'invoice',
        sourceTransactionId: id,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        openItemNumber: true,
        transactionCurrencyId: true,
        localCurrencyId: true,
        functionalCurrencyId: true,
        groupCurrencyId: true,
        originalTransactionAmount: true,
        originalLocalAmount: true,
        originalFunctionalAmount: true,
        originalGroupAmount: true,
        isOpen: true,
        status: true,
      },
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'invoice',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadInvoiceDetailCustomization(),
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
    loadManagedListDetail('INV-STATUS'),
    loadOtcWorkflowRuntime(),
  ])

  if (!invoice) notFound()

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: invoice.id },
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
  const glSourceNumberByKey = new Map<string, string>()
  for (const entry of glImpactEntries) {
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, invoice.number)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })

  const detailHref = `/invoices/${invoice.id}`
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`]),
  )
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]),
  )
  const invoiceStatusColors = Object.fromEntries(
    (statusListDetail?.rows ?? []).map((row) => [row.value.toLowerCase(), row.colorTone ?? 'default']),
  ) as Record<string, TransactionStatusColorTone>
  const statusOptions = (statusListDetail?.rows ?? []).map((row) => ({
    value: row.value.toLowerCase(),
    label: formatInvoiceStatus(row.value),
  }))
  const itemOptions = items.map((item) => ({
    id: item.id,
    itemId: item.itemId ?? item.id,
    name: item.name,
    unitPrice: toNumericValue(item.listPrice, 0),
  }))
  const createdByLabel =
    invoice.user?.userId && invoice.user?.name
      ? `${invoice.user.userId} - ${invoice.user.name}`
      : invoice.user?.userId ?? invoice.user?.name ?? invoice.user?.email ?? '-'

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
    ]),
  )

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

  const headerFieldDefinitions: Record<string, InvoiceHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: invoice.customer.name,
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: invoice.customer.customerId ?? '',
      helpText: 'Internal customer identifier from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerEmail: {
      key: 'customerEmail',
      label: 'Email',
      value: invoice.customer.email ?? '',
      helpText: 'Primary customer email address.',
      fieldType: 'email',
      sourceText: 'Customers master data',
    },
    customerPhone: {
      key: 'customerPhone',
      label: 'Phone',
      value: invoice.customer.phone ?? '',
      helpText: 'Primary customer phone number.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerAddress: {
      key: 'customerAddress',
      label: 'Billing Address',
      value: invoice.customer.address ?? '',
      helpText: 'Main billing address from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerPrimarySubsidiary: {
      key: 'customerPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: invoice.customer.subsidiary ? `${invoice.customer.subsidiary.subsidiaryId} - ${invoice.customer.subsidiary.name}` : '',
      helpText: 'Default subsidiary context from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerPrimaryCurrency: {
      key: 'customerPrimaryCurrency',
      label: 'Primary Currency',
      value: invoice.customer.currency ? `${invoice.customer.currency.code ?? invoice.customer.currency.currencyId} - ${invoice.customer.currency.name}` : '',
      helpText: 'Default transaction currency from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerInactive: {
      key: 'customerInactive',
      label: 'Inactive',
      value: invoice.customer.inactive ? 'Yes' : 'No',
      helpText: 'Indicates whether the linked customer is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: invoice.id,
      helpText: 'Internal database identifier for this invoice record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this invoice.',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer Id',
      value: invoice.customer.customerId ?? '',
      href: `/customers/${invoice.customer.id}`,
      helpText: 'Customer identifier linked to this invoice.',
      fieldType: 'text',
      sourceText: 'Customers master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this invoice.',
    },
    salesOrderId: {
      key: 'salesOrderId',
      label: 'Sales Order Id',
      value: invoice.salesOrder?.number ?? '',
      href: invoice.salesOrder ? `/sales-orders/${invoice.salesOrder.id}` : null,
      helpText: 'Sales order identifier linked to this invoice.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this invoice.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: invoice.user?.userId ?? '',
      href: invoice.user ? `/users/${invoice.user.id}` : null,
      helpText: 'User identifier for the invoice creator/owner.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this invoice.',
    },
    number: {
      key: 'number',
      label: 'Invoice Id',
      value: invoice.number,
      editable: true,
      type: 'text',
      helpText: 'Unique invoice number used across OTC workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Invoice numbering, source context, and ownership for this transaction.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      helpText: 'User who created the invoice.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Invoice numbering, source context, and ownership for this transaction.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: invoice.salesOrder?.number ?? '',
      displayValue: invoice.salesOrder ? (
        <Link href={`/sales-orders/${invoice.salesOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {invoice.salesOrder.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Source sales order that created this invoice.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Invoice numbering, source context, and ownership for this transaction.',
    },
    quoteId: {
      key: 'quoteId',
      label: 'Quote Id',
      value: invoice.salesOrder?.quote?.number ?? '',
      displayValue: invoice.salesOrder?.quote ? (
        <Link href={`/quotes/${invoice.salesOrder.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {invoice.salesOrder.quote.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Quote identifier linked through the sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Invoice numbering, source context, and ownership for this transaction.',
    },
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity Id',
      value: invoice.salesOrder?.quote?.opportunity?.opportunityNumber ?? '',
      displayValue: invoice.salesOrder?.quote?.opportunity ? (
        <Link href={`/opportunities/${invoice.salesOrder.quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {invoice.salesOrder.quote.opportunity.opportunityNumber ?? invoice.salesOrder.quote.opportunity.name}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Opportunity identifier linked through the source quote.',
      fieldType: 'text',
      sourceText: 'Opportunities',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Invoice numbering, source context, and ownership for this transaction.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: invoice.subsidiaryId ?? '',
      displayValue: invoice.subsidiary ? `${invoice.subsidiary.subsidiaryId} - ${invoice.subsidiary.name}` : '-',
      href: invoice.subsidiary ? `/subsidiaries/${invoice.subsidiary.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary that owns the invoice.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Financial Terms',
      subsectionDescription: 'Status, dates, and monetary context for this invoice.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: invoice.currencyId ?? '',
      displayValue: invoice.currency ? `${invoice.currency.code ?? invoice.currency.currencyId} - ${invoice.currency.name}` : '-',
      href: invoice.currency ? `/currencies/${invoice.currency.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Transaction currency for the invoice.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Financial Terms',
      subsectionDescription: 'Status, dates, and monetary context for this invoice.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: invoice.status ?? '',
      displayValue: formatInvoiceStatus(invoice.status),
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the invoice.',
      fieldType: 'list',
      sourceText: 'Invoice status list',
      subsectionTitle: 'Financial Terms',
      subsectionDescription: 'Status, dates, and monetary context for this invoice.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(invoice.total),
      displayValue: fmtCurrency(invoice.total, invoice.currency?.code ?? invoice.currency?.currencyId ?? undefined, moneySettings),
      helpText: 'Document total based on all invoice line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Financial Terms',
      subsectionDescription: 'Status, dates, and monetary context for this invoice.',
    },
    dueDate: {
      key: 'dueDate',
      label: 'Due Date',
      value: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '',
      displayValue: invoice.dueDate ? fmtDocumentDate(invoice.dueDate, moneySettings) : '-',
      editable: true,
      type: 'text',
      helpText: 'Date payment is due.',
      fieldType: 'date',
      subsectionTitle: 'Financial Terms',
      subsectionDescription: 'Status, dates, and monetary context for this invoice.',
    },
    paidDate: {
      key: 'paidDate',
      label: 'Paid Date',
      value: invoice.paidDate ? invoice.paidDate.toISOString().slice(0, 10) : '',
      displayValue: invoice.paidDate ? fmtDocumentDate(invoice.paidDate, moneySettings) : '-',
      editable: true,
      type: 'text',
      helpText: 'Date payment was completed.',
      fieldType: 'date',
      subsectionTitle: 'Financial Terms',
      subsectionDescription: 'Status, dates, and monetary context for this invoice.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: invoice.createdAt.toISOString(),
      displayValue: fmtDocumentDate(invoice.createdAt, moneySettings),
      helpText: 'Date/time the invoice record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this invoice record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: invoice.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(invoice.updatedAt, moneySettings),
      helpText: 'Date/time the invoice record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this invoice record.',
    },
  }

  const customerHref = `/customers/${invoice.customer.id}`
  const salesOrderHref = invoice.salesOrder ? `/sales-orders/${invoice.salesOrder.id}` : null
  const quoteHref = invoice.salesOrder?.quote ? `/quotes/${invoice.salesOrder.quote.id}` : null
  const opportunityHref = invoice.salesOrder?.quote?.opportunity
    ? `/opportunities/${invoice.salesOrder.quote.opportunity.id}`
    : null
  const communicationsToolbarTargetId = 'invoice-communications-toolbar'
  const systemNotesToolbarTargetId = 'invoice-system-notes-toolbar'
  const ownerHref = invoice.user ? `/users/${invoice.user.id}` : null
  const subsidiaryHref = invoice.subsidiary ? `/subsidiaries/${invoice.subsidiary.id}` : null
  const currencyHref = invoice.currency ? `/currencies/${invoice.currency.id}` : null

  headerFieldDefinitions.customerNumber.href = customerHref
  headerFieldDefinitions.customerId.href = customerHref
  headerFieldDefinitions.salesOrderId.href = salesOrderHref
  headerFieldDefinitions.userId.href = ownerHref
  headerFieldDefinitions.createdFrom.href = salesOrderHref
  headerFieldDefinitions.quoteId.href = quoteHref
  headerFieldDefinitions.opportunityId.href = opportunityHref
  headerFieldDefinitions.subsidiaryId.href = subsidiaryHref
  headerFieldDefinitions.currencyId.href = currencyHref

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(INVOICE_REFERENCE_SOURCES, {
    customer: invoice.customer,
    salesOrder: invoice.salesOrder,
    owner: invoice.user,
    subsidiary: invoice.subsidiary,
    currency: invoice.currency,
  }, {
    customer: customerHref,
    salesOrder: salesOrderHref,
    owner: ownerHref,
    subsidiary: subsidiaryHref,
    currency: currencyHref,
  })
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }
  const customizePreviewOverrides = {
    id: invoice.id,
    customerId: invoice.customer.customerId ?? '',
    salesOrderId: invoice.salesOrder?.number ?? '',
    userId: invoice.user?.userId ?? '',
    createdBy: createdByLabel,
    createdFrom: invoice.salesOrder?.number ?? '',
    quoteId: invoice.salesOrder?.quote?.number ?? '',
    opportunityId: invoice.salesOrder?.quote?.opportunity?.opportunityNumber ?? '',
    subsidiaryId: invoice.subsidiary ? `${invoice.subsidiary.subsidiaryId} - ${invoice.subsidiary.name}` : '',
    currencyId: invoice.currency ? `${invoice.currency.code ?? invoice.currency.currencyId} - ${invoice.currency.name}` : '',
    status: formatInvoiceStatus(invoice.status),
    total: fmtCurrency(invoice.total, invoice.currency?.code ?? invoice.currency?.currencyId ?? undefined, moneySettings),
    dueDate: invoice.dueDate ? fmtDocumentDate(invoice.dueDate, moneySettings) : '-',
    paidDate: invoice.paidDate ? fmtDocumentDate(invoice.paidDate, moneySettings) : '-',
    createdAt: fmtDocumentDate(invoice.createdAt, moneySettings),
    updatedAt: fmtDocumentDate(invoice.updatedAt, moneySettings),
  } satisfies Partial<Record<InvoiceDetailFieldKey, string>>

  const visibleLineColumns = getOrderedVisibleTransactionLineColumns(INVOICE_LINE_COLUMNS, customization)
  const statusTone = getInvoiceStatusTone(invoice.status, invoiceStatusColors)
  const statsRecord = {
    total: Number(invoice.total),
    currencyCode: invoice.currency?.code ?? invoice.currency?.currencyId ?? null,
    statusLabel: formatInvoiceStatus(invoice.status),
    statusTone: getInvoiceStatusToneKey(invoice.status, invoiceStatusColors),
    dueDate: invoice.dueDate,
    paidDate: invoice.paidDate,
    salesOrderId: invoice.salesOrder?.id ?? null,
    salesOrderNumber: invoice.salesOrder?.number ?? null,
    moneySettings,
  } as const
  const statPreviewCards = invoicePageConfig.stats.map((stat) => ({
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
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(INVOICE_REFERENCE_SOURCES, {
    customer: invoice.customer,
    salesOrder: invoice.salesOrder,
    owner: invoice.user,
    subsidiary: invoice.subsidiary,
    currency: invoice.currency,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = INVOICE_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const invoiceStatusActions = getAvailableWorkflowStatusActions(workflow, 'invoice', invoice.status)
  const formatMonetaryValue = (
    value: number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode?: string | null,
  ) => fmtCurrency(value, currencyCode ?? undefined, moneySettings)
  const currencyReadoutSection = buildPostedCurrencyReadoutSection({
    postingStatus: invoiceOpenItem
      ? invoiceOpenItem.isOpen
        ? `Posted to open item (${invoiceOpenItem.status})`
        : `Posted and settled (${invoiceOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: invoiceOpenItem?.id ?? null,
    openItemNumber: invoiceOpenItem?.openItemNumber ?? null,
    transactionAmount: invoiceOpenItem?.originalTransactionAmount ?? invoice.total,
    transactionCurrencyCode: currencyCodeById.get(invoiceOpenItem?.transactionCurrencyId ?? invoice.currencyId ?? '') ?? null,
    transactionCurrencyLabel:
      currencyLabelById.get(invoiceOpenItem?.transactionCurrencyId ?? invoice.currencyId ?? '') ??
      (invoice.currency ? `${invoice.currency.code ?? invoice.currency.currencyId} - ${invoice.currency.name}` : null),
    localAmount: invoiceOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(invoiceOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(invoiceOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: invoiceOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(invoiceOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(invoiceOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: invoiceOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(invoiceOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(invoiceOpenItem?.groupCurrencyId ?? '') ?? null,
    fxRateType:
      invoiceOpenItem?.originalFunctionalAmount != null || invoiceOpenItem?.originalGroupAmount != null ? 'spot' : null,
    fxRateSource:
      invoiceOpenItem?.originalFunctionalAmount != null || invoiceOpenItem?.originalGroupAmount != null
        ? 'Configured exchange rates'
        : null,
    formatCurrency: formatMonetaryValue,
  })
  const fieldDefinitionsWithCurrency: Record<string, RecordHeaderField> = {
    ...allFieldDefinitions,
    ...Object.fromEntries(currencyReadoutSection.fields.map((field) => [field.key, field])),
  }
  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: INVOICE_DETAIL_FIELDS,
    fieldDefinitions: fieldDefinitionsWithCurrency,
    previewOverrides: customizePreviewOverrides,
  })
  const customizeFieldsWithCurrency = [
    ...customizeFields,
  ]
  const configuredHeaderSections = buildConfiguredTransactionSections({
    fields: INVOICE_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: fieldDefinitionsWithCurrency,
    sectionDescriptions: {
      ...invoicePageConfig.sectionDescriptions,
      [CURRENCY_READOUT_SECTION_TITLE]: 'Read the transaction, local, functional, and group amounts from the posted invoice context.',
    },
  })
  const configuredCurrencySection =
    configuredHeaderSections.find((section) => section.title === CURRENCY_READOUT_SECTION_TITLE) ?? currencyReadoutSection
  const headerSections = configuredHeaderSections.filter((section) => section.title !== CURRENCY_READOUT_SECTION_TITLE)
  const transactionCurrencyCode =
    currencyCodeById.get(invoiceOpenItem?.transactionCurrencyId ?? invoice.currencyId ?? '') ?? null
  const localCurrencyCode = currencyCodeById.get(invoiceOpenItem?.localCurrencyId ?? '') ?? null
  const functionalCurrencyCode = currencyCodeById.get(invoiceOpenItem?.functionalCurrencyId ?? '') ?? null
  const groupCurrencyCode = currencyCodeById.get(invoiceOpenItem?.groupCurrencyId ?? '') ?? null

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/invoices'}
      backLabel={isCustomizing ? '<- Back to Invoice Detail' : '<- Back to Invoices'}
      meta={invoice.number}
      title={invoice.customer.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Invoice
          </span>
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: statusTone.bg, color: statusTone.color }}
          >
            {formatInvoiceStatus(invoice.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {invoiceStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="invoices"
                id={invoice.id}
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
          formId={`inline-record-form-${invoice.id}`}
          recordId={invoice.id}
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
                  newHref="/invoices/new"
                  duplicateHref={`/invoices/new?duplicateFrom=${encodeURIComponent(invoice.id)}`}
                />
                <MasterDataDetailExportMenu
                  title={invoice.number}
                  fileName={`invoice-${invoice.number}`}
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
                <DeleteButton resource="invoices" id={invoice.id} />
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
              stats={invoicePageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
                <InvoiceDetailCustomizeMode
                  detailHref={detailHref}
                  initialLayout={customization}
                  fields={customizeFieldsWithCurrency}
                  referenceSourceDefinitions={referenceSourceDefinitions}
                  sectionDescriptions={invoicePageConfig.sectionDescriptions}
                  statPreviewCards={statPreviewCards}
                />
            </div>
          ) : (
            <div className="space-y-6">
              <TransactionFourCurrencySection
                section={configuredCurrencySection}
                layout={customization}
                description="Read the transaction, local, functional, and group amounts from the posted invoice context."
              />
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
                  containerDescription="Expanded context from linked records on this invoice."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={invoice.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Invoice Details"
                containerDescription="Core invoice fields organized into configurable sections."
                showSubsections={false}
                updateUrl={`/api/invoices?id=${encodeURIComponent(invoice.id)}`}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : isEditing ? (
            <TransactionLineItemsSection
              rows={invoice.lineItems.map((line, index) => ({
                id: line.id,
                displayOrder: index,
                itemRecordId: line.item?.id ?? null,
                itemId: line.item?.itemId ?? null,
                itemName: line.item?.name ?? null,
                description: line.description,
                quantity: line.quantity,
                receivedQuantity: 0,
                billedQuantity: 0,
                openQuantity: 0,
                unitPrice: toNumericValue(line.unitPrice, 0),
                lineTotal: toNumericValue(line.lineTotal, 0),
              }))}
              editing
              purchaseOrderId={invoice.id}
              userId={invoice.userId ?? ''}
              itemOptions={itemOptions}
              currencyCode={transactionCurrencyCode}
              lineSettings={customization.lineSettings}
              lineColumnCustomization={customization.lineColumns}
              lineColumns={visibleLineColumns
                .map((column) =>
                  column.id === 'line' ||
                  column.id === 'item-id' ||
                  column.id === 'description' ||
                  column.id === 'quantity' ||
                  column.id === 'unit-price' ||
                  column.id === 'line-total'
                    ? column
                    : null,
                )
                .filter((column): column is { id: 'line' | 'item-id' | 'description' | 'quantity' | 'unit-price' | 'line-total'; label: string } => Boolean(column))}
              sectionTitle="Invoice Line Items"
              lineItemApiBasePath="/api/invoice-line-items"
              deleteResource="invoice-line-items"
              parentIdFieldName="invoiceId"
              tableId="invoice-line-items"
              allowAddLines
            />
          ) : (
            <RecordDetailSection title="Invoice Line Items" count={invoice.lineItems.length}>
              {invoice.lineItems.length === 0 ? (
                <div className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No invoice lines yet.
                </div>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr>
                      {visibleLineColumns.map((column) => (
                        <RecordDetailHeaderCell key={column.id}>{column.label}</RecordDetailHeaderCell>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((line, index) => (
                      <tr
                        key={line.id}
                        style={index < invoice.lineItems.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                      >
                        {visibleLineColumns.map((column) => (
                          <RecordDetailCell key={`${line.id}-${column.id}`}>
                            {renderLineValue({
                              columnId: column.id,
                              index,
                              line,
                              currencyCode: transactionCurrencyCode,
                              moneySettings,
                            })}
                          </RecordDetailCell>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </RecordDetailSection>
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
                emptyMessage: 'No related customer is linked to this invoice.',
                rows: [
                  {
                    id: invoice.customer.id,
                    type: 'Customer',
                    reference: invoice.customer.customerId ?? invoice.customer.id,
                    name: invoice.customer.name,
                    details: [invoice.customer.email, invoice.customer.phone].filter(Boolean).join(' | ') || '-',
                    href: `/customers/${invoice.customer.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <InvoiceRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={transactionCurrencyCode}
            salesOrders={
              invoice.salesOrder
                ? [
                    {
                      id: invoice.salesOrder.id,
                      number: invoice.salesOrder.number,
                      status: invoice.salesOrder.status,
                      total: Number(invoice.salesOrder.total),
                      currencyCode: transactionCurrencyCode,
                    },
                  ]
                : []
            }
            quotes={
              invoice.salesOrder?.quote
                ? [
                    {
                      id: invoice.salesOrder.quote.id,
                      number: invoice.salesOrder.quote.number,
                      status: invoice.salesOrder.quote.status,
                      total: Number(invoice.salesOrder.quote.total),
                      currencyCode: transactionCurrencyCode,
                    },
                  ]
                : []
            }
            opportunities={
              invoice.salesOrder?.quote?.opportunity
                ? [
                    {
                      id: invoice.salesOrder.quote.opportunity.id,
                      number: invoice.salesOrder.quote.opportunity.opportunityNumber ?? invoice.salesOrder.quote.opportunity.id,
                      name: invoice.salesOrder.quote.opportunity.name,
                      status: invoice.salesOrder.quote.opportunity.stage,
                      total: Number(invoice.salesOrder.quote.opportunity.amount ?? 0),
                      currencyCode: transactionCurrencyCode,
                    },
                  ]
                : []
            }
            cashReceipts={invoice.cashReceipts.map((receipt) => ({
              id: receipt.id,
              number: receipt.number ?? null,
              amount: Number(receipt.amount),
              date: receipt.date.toISOString(),
              method: receipt.method,
              reference: receipt.reference ?? null,
              currencyCode: transactionCurrencyCode,
            }))}
            moneySettings={moneySettings}
          />
        )}
        relatedDocumentsCount={
          (invoice.salesOrder ? 1 : 0) +
          (invoice.salesOrder?.quote ? 1 : 0) +
          (invoice.salesOrder?.quote?.opportunity ? 1 : 0) +
          invoice.cashReceipts.length
        }
        supplementarySections={
          isCustomizing ? null : (
            <InvoiceGlImpactSection
              rows={glImpactRows}
              settings={customization.glImpactSettings}
              columnCustomization={customization.glImpactColumns}
              currencyCodes={{
                transaction: transactionCurrencyCode,
                local: localCurrencyCode,
                functional: functionalCurrencyCode,
                group: groupCurrencyCode,
              }}
            />
          )
        }
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId={communicationsToolbarTargetId}
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: invoice.id,
              userId: invoice.userId,
              number: invoice.number,
              counterpartyName: invoice.customer.name,
              counterpartyEmail: invoice.customer.email,
              fromEmail: invoice.user?.email ?? null,
              status: formatInvoiceStatus(invoice.status),
              total: fmtCurrency(invoice.total, invoice.currency?.code ?? invoice.currency?.currencyId ?? undefined, moneySettings),
              lineItems: invoice.lineItems.map((line, index) => ({
                line: index + 1,
                itemId: line.item?.itemId ?? '-',
                description: line.description,
                quantity: line.quantity,
                receivedQuantity: 0,
                openQuantity: 0,
                billedQuantity: 0,
                unitPrice: toNumericValue(line.unitPrice, 0),
                lineTotal: toNumericValue(line.lineTotal, 0),
              })),
              sendEmailEndpoint: '/api/invoices?action=send-email',
              recordIdFieldName: 'invoiceId',
              documentLabel: 'Invoice',
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

function formatInvoiceStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function renderLineValue({
  columnId,
  index,
  line,
  currencyCode,
  moneySettings,
}: {
  columnId: InvoiceLineColumnKey
  index: number
  line: {
    item?: { itemId: string | null } | null
    description: string
    quantity: number
    unitPrice: Parameters<typeof fmtCurrency>[0]
    lineTotal: Parameters<typeof fmtCurrency>[0]
    notes: string | null
    department?: { departmentId: string | null; name: string } | null
    location?: { locationId: string | null; name: string } | null
    project?: { name: string } | null
    serviceStartDate: Date | null
    serviceEndDate: Date | null
    revRecTemplate?: { templateId: string | null; name: string } | null
    performanceObligationCode: string | null
    standaloneSellingPrice: Parameters<typeof fmtCurrency>[0] | null
    allocatedAmount: Parameters<typeof fmtCurrency>[0] | null
  }
  currencyCode?: string | null
  moneySettings: Parameters<typeof fmtCurrency>[2]
}) {
  switch (columnId) {
    case 'line':
      return index + 1
    case 'item-id':
      return line.item?.itemId ?? '-'
    case 'description':
      return line.description
    case 'quantity':
      return line.quantity
    case 'unit-price':
      return fmtCurrency(line.unitPrice, currencyCode ?? undefined, moneySettings)
    case 'line-total':
      return fmtCurrency(line.lineTotal, currencyCode ?? undefined, moneySettings)
    case 'notes':
      return line.notes ?? '-'
    case 'department':
      return line.department ? `${line.department.departmentId ?? ''} - ${line.department.name}`.trim().replace(/^ - /, '') : '-'
    case 'location':
      return line.location ? `${line.location.locationId ?? ''} - ${line.location.name}`.trim().replace(/^ - /, '') : '-'
    case 'project':
      return line.project?.name ?? '-'
    case 'service-start':
      return line.serviceStartDate ? fmtDocumentDate(line.serviceStartDate, moneySettings) : '-'
    case 'service-end':
      return line.serviceEndDate ? fmtDocumentDate(line.serviceEndDate, moneySettings) : '-'
    case 'rev-rec-template':
      return line.revRecTemplate ? `${line.revRecTemplate.templateId ?? ''} - ${line.revRecTemplate.name}`.trim().replace(/^ - /, '') : '-'
    case 'performance-obligation-code':
      return line.performanceObligationCode ?? '-'
    case 'ssp':
      return line.standaloneSellingPrice != null ? fmtCurrency(line.standaloneSellingPrice, currencyCode ?? undefined, moneySettings) : '-'
    case 'allocated-amount':
      return line.allocatedAmount != null ? fmtCurrency(line.allocatedAmount, currencyCode ?? undefined, moneySettings) : '-'
    default:
      return '-'
  }
}
