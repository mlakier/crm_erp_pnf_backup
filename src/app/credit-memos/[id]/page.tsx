import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import type { RecordHeaderField } from '@/components/RecordHeaderDetails'
import type { RelatedRecordsTab } from '@/components/RelatedRecordsSection'
import CreditDocumentDetailFrame from '@/components/CreditDocumentDetailFrame'
import CreditDocumentGlImpactSection from '@/components/CreditDocumentGlImpactSection'
import CreditDocumentDetailCustomizeMode from '@/components/CreditDocumentDetailCustomizeMode'
import CreditDocumentApplicationsSection from '@/components/CreditDocumentApplicationsSection'
import CreditDocumentLineItemsSection from '@/components/CreditDocumentLineItemsSection'
import CreditDocumentPageClient from '@/components/CreditDocumentPageClient'
import InvoiceRelatedDocuments from '@/components/InvoiceRelatedDocuments'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import { loadCreditMemoApplicationCandidates } from '@/lib/credit-document-application-context'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import {
  CREDIT_MEMO_DETAIL_FIELDS,
  CREDIT_MEMO_REFERENCE_SOURCES,
  type CreditMemoDetailFieldKey,
} from '@/lib/credit-memo-detail-customization'
import { loadCreditMemoDetailCustomization } from '@/lib/credit-memo-detail-customization-store'
import {
  CREDIT_DOCUMENT_LINE_COLUMNS,
  CURRENCY_READOUT_FIELD_KEYS,
  buildPostedCurrencyReadoutSection,
} from '@/lib/credit-document-detail-customization-shared'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import { prisma } from '@/lib/prisma'
import {
  buildConfiguredTransactionSections,
  buildTransactionGlImpactRows,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'
import { computeRealizedFxLayerAmount } from '@/lib/settlement-fx-journal'

export const runtime = 'nodejs'

type CreditMemoHeaderField = { key: CreditMemoDetailFieldKey } & RecordHeaderField

const CREDIT_MEMO_SECTION_DESCRIPTIONS: Record<string, string> = {
  'Document Identity': 'Core credit memo identifiers and source-document context.',
  'Workflow & Timing': 'Lifecycle status and key dates for this credit memo.',
  'Sourcing & Financials': 'Organizational, currency, and monetary context for this credit memo.',
  'Record Keys': 'Internal database and created-by identifiers for this credit memo.',
  'System Dates': 'System-managed timestamps for this credit memo.',
}

const BASE_CREDIT_MEMO_FIELDS = CREDIT_MEMO_DETAIL_FIELDS.filter(
  (field) => !CURRENCY_READOUT_FIELD_KEYS.includes(field.id as (typeof CURRENCY_READOUT_FIELD_KEYS)[number]),
)

export default async function CreditMemoDetailPage({
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

  const [
    creditMemo,
    creditMemoOpenItem,
    creditMemoApplications,
    activities,
    customization,
    currencies,
    applicationCandidates,
  ] = await Promise.all([
    prisma.creditMemo.findUnique({
      where: { id },
      include: {
        customer: true,
        invoice: {
          include: {
            salesOrder: {
              include: {
                quote: {
                  include: {
                    opportunity: true,
                  },
                },
              },
            },
            currency: true,
            cashReceipts: {
              orderBy: { date: 'desc' },
            },
          },
        },
        user: true,
        subsidiary: true,
        currency: true,
        lineItems: {
          include: {
            item: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'credit-memo',
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
    prisma.openItemApplication.findMany({
      where: {
        settlementTransactionType: 'credit-memo',
        settlementTransactionId: id,
      },
      select: {
        transactionAmount: true,
        groupAmount: true,
        realizedFxLocalAmount: true,
        realizedFxFunctionalAmount: true,
        toOpenItem: {
          select: {
            sourceTransactionId: true,
            originalTransactionAmount: true,
            originalGroupAmount: true,
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'credit-memo',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadCreditMemoDetailCustomization(),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    loadCreditMemoApplicationCandidates(),
  ])

  if (!creditMemo) notFound()

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: creditMemo.id },
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
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, creditMemo.number)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback),
  })

  if (isEditing) {
    const [customers, subsidiaries, editCurrencies, items] = await Promise.all([
      prisma.customer.findMany({
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          customerId: true,
          name: true,
          email: true,
          subsidiary: { select: { id: true } },
          currency: { select: { id: true } },
        },
      }),
      prisma.subsidiary.findMany({
        orderBy: [{ subsidiaryId: 'asc' }],
        select: { id: true, subsidiaryId: true, name: true },
      }),
      prisma.currency.findMany({
        orderBy: [{ code: 'asc' }],
        select: { id: true, code: true, currencyId: true, name: true },
      }),
      prisma.item.findMany({
        orderBy: [{ itemId: 'asc' }],
        select: { id: true, itemId: true, name: true },
      }),
    ])

    const userLabel =
      creditMemo.user.userId && creditMemo.user.name
        ? `${creditMemo.user.userId} - ${creditMemo.user.name}`
        : creditMemo.user.userId ?? creditMemo.user.name ?? creditMemo.user.email

    return (
      <CreditDocumentPageClient
        kind="credit-memo"
        mode="edit"
        documentId={creditMemo.id}
        nextNumber={creditMemo.number}
        userId={creditMemo.userId}
        userLabel={userLabel}
        counterparties={customers.map((customer) => ({
          id: customer.id,
          reference: customer.customerId ?? customer.id,
          name: customer.name,
          email: customer.email,
          subsidiaryId: customer.subsidiary?.id ?? null,
          currencyId: customer.currency?.id ?? null,
        }))}
        sourceDocuments={applicationCandidates.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          counterpartyId: invoice.customerId,
          subsidiaryId: invoice.subsidiaryId ?? null,
          currencyId: invoice.currencyId ?? null,
          total: Number(invoice.total),
          status: invoice.status,
          date: new Date(invoice.date).toISOString(),
          openAmount: invoice.openAmount,
          currencyCode: invoice.currencyCode ?? null,
          userId: invoice.userId ?? null,
        }))}
        subsidiaries={subsidiaries.map((subsidiary) => ({
          value: subsidiary.id,
          label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
        }))}
        currencies={editCurrencies.map((currency) => ({
          value: currency.id,
          label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
        }))}
        items={items}
        moneySettings={moneySettings}
        initialHeaderValues={{
          id: creditMemo.id,
          number: creditMemo.number,
          counterpartyId: creditMemo.customerId,
          sourceDocumentId: creditMemo.invoiceId ?? '',
          subsidiaryId: creditMemo.subsidiaryId ?? '',
          currencyId: creditMemo.currencyId ?? '',
          status: creditMemo.status,
          date: creditMemo.date.toISOString().slice(0, 10),
          reason: creditMemo.reason ?? '',
          notes: creditMemo.notes ?? '',
          createdAtDisplay: fmtDocumentDate(creditMemo.createdAt, moneySettings),
          updatedAtDisplay: fmtDocumentDate(creditMemo.updatedAt, moneySettings),
          applications: JSON.stringify(
            creditMemoApplications.map((application) => ({
              invoiceId: application.toOpenItem?.sourceTransactionId ?? '',
              appliedAmount: Number(application.transactionAmount),
            })).filter((application) => application.invoiceId),
          ),
        }}
        initialLineItems={creditMemo.lineItems.map((line) => ({
          id: line.id,
          itemId: line.itemId ?? '',
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: String(Number(line.unitPrice)),
          notes: line.notes ?? '',
        }))}
      />
    )
  }

  const activityUserIds = Array.from(
    new Set(activities.map((activity) => activity.userId).filter(Boolean)),
  ) as string[]
  const activityUsers = activityUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: activityUserIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const activityUserLabelById = Object.fromEntries(
    activityUsers.map((user) => [
      user.id,
      user.userId && user.name ? `${user.userId} - ${user.name}` : user.userId ?? user.name ?? user.email ?? user.id,
    ]),
  )

  const currencyCode = creditMemo.currency?.code ?? creditMemo.currency?.currencyId ?? undefined
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null] as const),
  )
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`] as const),
  )
  const totalRealizedFxLocal = creditMemoApplications.reduce(
    (sum, application) => sum + Number(application.realizedFxLocalAmount ?? 0),
    0,
  )
  const totalRealizedFxFunctional = creditMemoApplications.reduce(
    (sum, application) => sum + Number(application.realizedFxFunctionalAmount ?? 0),
    0,
  )
  const totalRealizedFxGroup = creditMemoApplications.reduce((sum, application) => {
    const computed = computeRealizedFxLayerAmount({
      originalTransactionAmount:
        application.toOpenItem?.originalTransactionAmount == null
          ? null
          : Number(application.toOpenItem.originalTransactionAmount),
      originalTranslatedAmount:
        application.toOpenItem?.originalGroupAmount == null
          ? null
          : Number(application.toOpenItem.originalGroupAmount),
      settledTransactionAmount:
        application.transactionAmount == null ? null : Number(application.transactionAmount),
      settledTranslatedAmount:
        application.groupAmount == null ? null : Number(application.groupAmount),
    })
    return sum + Number(computed ?? 0)
  }, 0)

  const currencySection = buildPostedCurrencyReadoutSection({
    postingStatus: creditMemoOpenItem
      ? creditMemoOpenItem.isOpen
        ? `Posted to open item (${creditMemoOpenItem.status})`
        : `Posted and settled (${creditMemoOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: creditMemoOpenItem?.id ?? null,
    openItemNumber: creditMemoOpenItem?.openItemNumber ?? null,
    transactionAmount: creditMemoOpenItem?.originalTransactionAmount ?? creditMemo.total,
    transactionCurrencyCode:
      currencyCodeById.get(creditMemoOpenItem?.transactionCurrencyId ?? creditMemo.currencyId ?? '') ?? null,
    transactionCurrencyLabel:
      currencyLabelById.get(creditMemoOpenItem?.transactionCurrencyId ?? creditMemo.currencyId ?? '') ??
      (creditMemo.currency ? `${creditMemo.currency.code ?? creditMemo.currency.currencyId} - ${creditMemo.currency.name}` : null),
    localAmount: creditMemoOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(creditMemoOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(creditMemoOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: creditMemoOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(creditMemoOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(creditMemoOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: creditMemoOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(creditMemoOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(creditMemoOpenItem?.groupCurrencyId ?? '') ?? null,
    realizedFxLocalAmount: creditMemoApplications.length > 0 ? totalRealizedFxLocal : null,
    realizedFxFunctionalAmount: creditMemoApplications.length > 0 ? totalRealizedFxFunctional : null,
    realizedFxGroupAmount: creditMemoApplications.length > 0 ? totalRealizedFxGroup : null,
    fxRateType:
      creditMemoOpenItem?.originalFunctionalAmount != null || creditMemoOpenItem?.originalGroupAmount != null ? 'spot' : null,
    fxRateSource:
      creditMemoOpenItem?.originalFunctionalAmount != null || creditMemoOpenItem?.originalGroupAmount != null
        ? 'Configured exchange rates'
        : null,
    formatCurrency: (value, code) => fmtCurrency(value, code ?? undefined, moneySettings),
  })

  const customerHref = `/customers/${creditMemo.customerId}`
  const invoiceHref = creditMemo.invoiceId ? `/invoices/${creditMemo.invoiceId}` : null
  const userHref = `/users/${creditMemo.userId}`
  const subsidiaryHref = creditMemo.subsidiaryId ? `/subsidiaries/${creditMemo.subsidiaryId}` : null
  const currencyHref = creditMemo.currencyId ? `/currencies/${creditMemo.currencyId}` : null

  const fieldDefinitions = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: creditMemo.id,
      displayValue: creditMemo.id,
      fieldType: 'text',
    },
    number: {
      key: 'number',
      label: 'Credit Memo Id',
      value: creditMemo.number,
      displayValue: creditMemo.number,
      fieldType: 'text',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer',
      value: creditMemo.customerId,
      displayValue: creditMemo.customer.name,
      href: customerHref,
      fieldType: 'text',
    },
    invoiceId: {
      key: 'invoiceId',
      label: 'Invoice',
      value: creditMemo.invoiceId ?? '',
      displayValue: creditMemo.invoice?.number ?? '-',
      href: invoiceHref,
      fieldType: 'text',
    },
    reason: {
      key: 'reason',
      label: 'Reason',
      value: creditMemo.reason ?? '',
      displayValue: creditMemo.reason ?? '-',
      fieldType: 'text',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: creditMemo.notes ?? '',
      displayValue: creditMemo.notes ?? '-',
      fieldType: 'text',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: creditMemo.status,
      displayValue: creditMemo.status,
      fieldType: 'text',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: creditMemo.date.toISOString(),
      displayValue: fmtDocumentDate(creditMemo.date, moneySettings),
      fieldType: 'date',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: creditMemo.subsidiaryId ?? '',
      displayValue: creditMemo.subsidiary ? `${creditMemo.subsidiary.subsidiaryId} - ${creditMemo.subsidiary.name}` : '-',
      href: subsidiaryHref,
      fieldType: 'text',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: creditMemo.currencyId ?? '',
      displayValue: creditMemo.currency ? `${creditMemo.currency.code ?? creditMemo.currency.currencyId} - ${creditMemo.currency.name}` : '-',
      href: currencyHref,
      fieldType: 'text',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(creditMemo.total),
      displayValue: fmtCurrency(creditMemo.total, currencyCode, moneySettings),
      fieldType: 'currency',
    },
    userId: {
      key: 'userId',
      label: 'Created By',
      value: creditMemo.userId,
      displayValue:
        creditMemo.user.userId && creditMemo.user.name
          ? `${creditMemo.user.userId} - ${creditMemo.user.name}`
          : creditMemo.user.userId ?? creditMemo.user.name ?? creditMemo.user.email,
      href: userHref,
      fieldType: 'text',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: creditMemo.createdAt.toISOString(),
      displayValue: fmtDocumentDate(creditMemo.createdAt, moneySettings),
      fieldType: 'date',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: creditMemo.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(creditMemo.updatedAt, moneySettings),
      fieldType: 'date',
    },
  } as Record<CreditMemoDetailFieldKey, CreditMemoHeaderField>
  Object.assign(
    fieldDefinitions,
    currencySection.fields as Partial<Record<CreditMemoDetailFieldKey, CreditMemoHeaderField>>,
  )

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    CREDIT_MEMO_REFERENCE_SOURCES,
    {
      customer: creditMemo.customer,
      invoice: creditMemo.invoice,
      owner: creditMemo.user,
      subsidiary: creditMemo.subsidiary,
      currency: creditMemo.currency,
    },
    {
      customer: customerHref,
      invoice: invoiceHref,
      owner: userHref,
      subsidiary: subsidiaryHref,
      currency: currencyHref,
    },
    {
      invoice: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, code) =>
          fmtCurrency(value as Parameters<typeof fmtCurrency>[0], code ?? undefined, moneySettings),
        currencyCode: creditMemo.invoice?.currency?.code ?? creditMemo.invoice?.currency?.currencyId ?? null,
      },
    },
  )

  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...fieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const previewOverrides = {
    customerId: creditMemo.customer.customerId ?? '',
    invoiceId: creditMemo.invoice?.number ?? '-',
    subsidiaryId: creditMemo.subsidiary ? `${creditMemo.subsidiary.subsidiaryId} - ${creditMemo.subsidiary.name}` : '-',
    currencyId: creditMemo.currency ? `${creditMemo.currency.code ?? creditMemo.currency.currencyId} - ${creditMemo.currency.name}` : '-',
    userId:
      creditMemo.user.userId && creditMemo.user.name
        ? `${creditMemo.user.userId} - ${creditMemo.user.name}`
        : creditMemo.user.userId ?? creditMemo.user.name ?? creditMemo.user.email ?? '',
    total: fmtCurrency(creditMemo.total, currencyCode, moneySettings),
  } satisfies Partial<Record<CreditMemoDetailFieldKey, string>>

  const customizeFieldsWithCurrency = buildTransactionCustomizePreviewFields({
    fields: CREDIT_MEMO_DETAIL_FIELDS,
    fieldDefinitions: allFieldDefinitions,
    previewOverrides,
  })

  const headerSections = buildConfiguredTransactionSections({
    fields: BASE_CREDIT_MEMO_FIELDS,
    layout: customization,
    fieldDefinitions,
    sectionDescriptions: CREDIT_MEMO_SECTION_DESCRIPTIONS,
  })

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(CREDIT_MEMO_REFERENCE_SOURCES, {
    customer: creditMemo.customer,
    invoice: creditMemo.invoice,
    owner: creditMemo.user,
    subsidiary: creditMemo.subsidiary,
    currency: creditMemo.currency,
  }, {
    invoice: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, code) =>
        fmtCurrency(value as Parameters<typeof fmtCurrency>[0], code ?? undefined, moneySettings),
      currencyCode: creditMemo.invoice?.currency?.code ?? creditMemo.invoice?.currency?.currencyId ?? null,
    },
  })

  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = CREDIT_MEMO_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
        rows: referenceLayout.rows,
        fields,
      }
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
  const referenceColumns = Math.max(1, ...(customization.referenceLayouts ?? []).map((layout) => layout.formColumns ?? 1))

  const statPreviewCards = [
    {
      id: 'credit-memo-total',
      label: 'Total',
      value: fmtCurrency(creditMemo.total, currencyCode, moneySettings),
      accent: true as const,
      supportsColorized: true,
      supportsLink: false,
    },
    {
      id: 'credit-memo-status',
      label: 'Status',
      value: creditMemo.status,
      supportsColorized: false,
      supportsLink: false,
    },
    {
      id: 'credit-memo-date',
      label: 'Date',
      value: fmtDocumentDate(creditMemo.date, moneySettings),
      supportsColorized: false,
      supportsLink: false,
    },
    {
      id: 'credit-memo-customer',
      label: 'Customer',
      value: creditMemo.customer.name,
      href: customerHref,
      accent: true as const,
      supportsColorized: true,
      supportsLink: true,
    },
  ] satisfies Array<{
    id: string
    label: string
    value: string | number
    href?: string | null
    accent?: true | 'teal' | 'yellow'
    valueTone?: TransactionVisualTone
    cardTone?: TransactionVisualTone
    supportsColorized?: boolean
    supportsLink?: boolean
  }>

  const relatedRecordTabs: RelatedRecordsTab[] = [
    {
      key: 'customer',
      label: 'Customer',
      count: 1,
      emptyMessage: 'No linked customer.',
      rows: [
        {
          id: creditMemo.customer.id,
          type: 'Customer',
          reference: creditMemo.customer.customerId ?? creditMemo.customer.id,
          name: creditMemo.customer.name,
          details: creditMemo.customer.email ?? '-',
          href: customerHref,
        },
      ],
    },
    {
      key: 'accounting-context',
      label: 'Accounting Context',
      count: (creditMemo.subsidiary ? 1 : 0) + (creditMemo.currency ? 1 : 0) + 1,
      emptyMessage: 'No accounting-context references.',
      rows: [
        ...(creditMemo.subsidiary
          ? [{
              id: creditMemo.subsidiary.id,
              type: 'Subsidiary',
              reference: creditMemo.subsidiary.subsidiaryId,
              name: creditMemo.subsidiary.name,
              details: 'Posting subsidiary',
              href: subsidiaryHref,
            }]
          : []),
        ...(creditMemo.currency
          ? [{
              id: creditMemo.currency.id,
              type: 'Currency',
              reference: creditMemo.currency.code ?? creditMemo.currency.currencyId,
              name: creditMemo.currency.name,
              details: 'Document currency',
              href: currencyHref,
            }]
          : []),
        {
          id: creditMemo.user.id,
          type: 'User',
          reference: creditMemo.user.userId ?? creditMemo.user.id,
          name: creditMemo.user.name ?? creditMemo.user.email ?? creditMemo.user.id,
          details: 'Created by',
          href: userHref,
        },
      ],
    },
    {
      key: 'items',
      label: 'Items',
      count: creditMemo.lineItems.filter((line) => line.item).length,
      emptyMessage: 'No linked items.',
      rows: creditMemo.lineItems
        .filter((line) => line.item)
        .map((line) => ({
          id: line.item!.id,
          type: 'Item',
          reference: line.item!.itemId ?? line.item!.id,
          name: line.item!.name,
          details: line.description || '-',
          href: `/items/${line.item!.id}`,
        })),
    },
  ]

  const relatedDocumentTabs: RelatedRecordsTab[] = []
  const relatedInvoices = creditMemo.invoice
    ? [
        {
          id: creditMemo.invoice.id,
          number: creditMemo.invoice.number,
          status: creditMemo.invoice.status,
          total: Number(creditMemo.invoice.total),
        },
      ]
    : []
  const relatedSalesOrders = creditMemo.invoice?.salesOrder
    ? [
        {
          id: creditMemo.invoice.salesOrder.id,
          number: creditMemo.invoice.salesOrder.number,
          status: creditMemo.invoice.salesOrder.status,
          total: Number(creditMemo.invoice.salesOrder.total),
        },
      ]
    : []
  const relatedQuotes = creditMemo.invoice?.salesOrder?.quote
    ? [
        {
          id: creditMemo.invoice.salesOrder.quote.id,
          number: creditMemo.invoice.salesOrder.quote.number,
          status: creditMemo.invoice.salesOrder.quote.status,
          total: Number(creditMemo.invoice.salesOrder.quote.total),
        },
      ]
    : []
  const relatedOpportunities = creditMemo.invoice?.salesOrder?.quote?.opportunity
    ? [
        {
          id: creditMemo.invoice.salesOrder.quote.opportunity.id,
          number:
            creditMemo.invoice.salesOrder.quote.opportunity.opportunityNumber ??
            creditMemo.invoice.salesOrder.quote.opportunity.id,
          name: creditMemo.invoice.salesOrder.quote.opportunity.name,
          status: creditMemo.invoice.salesOrder.quote.opportunity.stage,
          total: Number(creditMemo.invoice.salesOrder.quote.opportunity.amount ?? 0),
        },
      ]
    : []
  const relatedCashReceipts =
    creditMemo.invoice?.cashReceipts.map((receipt) => ({
      id: receipt.id,
      number: receipt.number,
      amount: Number(receipt.amount),
      date: receipt.date.toISOString(),
      method: receipt.method,
      reference: receipt.reference,
    })) ?? []
  const relatedDocumentsCount =
    relatedInvoices.length +
    relatedSalesOrders.length +
    relatedQuotes.length +
    relatedOpportunities.length +
    relatedCashReceipts.length

  const appliedInvoiceIds = new Set(
    creditMemoApplications
      .map((application) => application.toOpenItem?.sourceTransactionId ?? '')
      .filter(Boolean),
  )
  const appliedInvoiceDocuments = applicationCandidates.filter((candidate) => appliedInvoiceIds.has(candidate.id))
  const creditMemoApplicationInputs = creditMemoApplications
    .map((application) => ({
      invoiceId: application.toOpenItem?.sourceTransactionId ?? '',
      appliedAmount: Number(application.transactionAmount),
    }))
    .filter((application) => application.invoiceId && application.appliedAmount > 0)

  const stats: TransactionStatDefinition<typeof creditMemo>[] = [
    {
      id: 'total',
      label: 'Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, currencyCode, moneySettings),
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.status,
    },
    {
      id: 'date',
      label: 'Date',
      getValue: (record) => fmtDocumentDate(record.date, moneySettings),
    },
    {
      id: 'customer',
      label: 'Customer',
      accent: true,
      getValue: () => creditMemo.customer.name,
      getHref: () => customerHref,
    },
  ]

  const exportSections = headerSections.map((section) => ({
    title: section.title,
    fields: section.fields.map((field) => ({
      label: field.label,
      value:
        typeof field.displayValue === 'string'
          ? field.displayValue
          : typeof field.value === 'string'
            ? field.value
            : '',
    })),
  }))

  const visibleLineColumns = getOrderedVisibleTransactionLineColumns(CREDIT_DOCUMENT_LINE_COLUMNS, customization)
  const transactionCurrencyCode =
    currencyCodeById.get(creditMemoOpenItem?.transactionCurrencyId ?? creditMemo.currencyId ?? '') ?? null
  const localCurrencyCode = currencyCodeById.get(creditMemoOpenItem?.localCurrencyId ?? '') ?? null
  const functionalCurrencyCode = currencyCodeById.get(creditMemoOpenItem?.functionalCurrencyId ?? '') ?? null
  const groupCurrencyCode = currencyCodeById.get(creditMemoOpenItem?.groupCurrencyId ?? '') ?? null

  if (isCustomizing) {
    return (
      <RecordDetailPageShell
        backHref={`/credit-memos/${creditMemo.id}`}
        backLabel="<- Back to Credit Memo Detail"
        meta={creditMemo.number}
        title={`Credit Memo for ${creditMemo.customer.name}`}
      >
        <CreditDocumentDetailCustomizeMode
          kind="credit-memo"
          detailHref={`/credit-memos/${creditMemo.id}`}
          initialLayout={customization}
          fields={customizeFieldsWithCurrency}
          referenceSourceDefinitions={referenceSourceDefinitions}
          sectionDescriptions={CREDIT_MEMO_SECTION_DESCRIPTIONS}
          statPreviewCards={statPreviewCards}
        />
      </RecordDetailPageShell>
    )
  }

  return (
    <CreditDocumentDetailFrame
      backHref="/credit-memos"
      backLabel="Back to Credit Memos"
      meta={creditMemo.number}
      title={`Credit Memo for ${creditMemo.customer.name}`}
      record={creditMemo}
      stats={stats}
      visibleStatCards={customization.statCards}
      currencySection={
        <TransactionFourCurrencySection
          section={currencySection}
          layout={customization}
          description="Read the transaction, local, functional, and group amounts from the posted credit memo context."
        />
      }
      referenceSections={referenceSections}
      referenceColumns={referenceColumns}
      headerSections={headerSections}
      headerContainerTitle="Credit Memo Details"
      headerContainerDescription="Core credit memo fields organized in one shared detail container."
      relatedRecordTabs={relatedRecordTabs}
      relatedDocumentTabs={relatedDocumentTabs}
      relatedDocumentsSection={
        <InvoiceRelatedDocuments
          invoices={relatedInvoices}
          salesOrders={relatedSalesOrders}
          quotes={relatedQuotes}
          opportunities={relatedOpportunities}
          cashReceipts={relatedCashReceipts}
          moneySettings={moneySettings}
          defaultCurrencyCode={currencyCode}
          embedded
          defaultActiveKey="opportunities"
        />
      }
      relatedDocumentsCount={relatedDocumentsCount}
      activities={activities}
      activityUserLabelById={activityUserLabelById}
      actions={
        <RecordDetailActionBar
          mode="detail"
          newHref="/credit-memos/new"
          duplicateHref={`/credit-memos/new?duplicateFrom=${encodeURIComponent(creditMemo.id)}`}
          customizeHref={`/credit-memos/${creditMemo.id}?customize=1`}
          exportTitle={`Credit Memo ${creditMemo.number}`}
          exportFileName={creditMemo.number}
          exportSections={exportSections}
          editHref={`/credit-memos/${creditMemo.id}?edit=1`}
          deleteResource="credit-memos"
          deleteId={creditMemo.id}
          deleteLabel={creditMemo.number}
        />
      }
      compose={buildTransactionCommunicationComposePayload({
        recordId: creditMemo.id,
        userId: creditMemo.userId,
        number: creditMemo.number,
        counterpartyName: creditMemo.customer.name,
        counterpartyEmail: creditMemo.customer.email ?? null,
        fromEmail: creditMemo.user.email ?? null,
        status: creditMemo.status,
        total: fmtCurrency(creditMemo.total, currencyCode, moneySettings),
        lineItems: creditMemo.lineItems.map((line, index) => ({
          line: index + 1,
          itemId: line.item?.itemId ?? line.item?.id ?? '-',
          description: line.description,
          quantity: line.quantity,
          receivedQuantity: 0,
          openQuantity: 0,
          billedQuantity: 0,
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.lineTotal),
        })),
        sendEmailEndpoint: '/api/credit-memos?action=send-email',
        recordIdFieldName: 'creditMemoId',
        documentLabel: 'Credit Memo',
      })}
      formatDate={(value) => fmtDocumentDate(value, moneySettings)}
      lineItemsSection={
        <CreditDocumentLineItemsSection
          title="Credit Memo Lines"
          rows={creditMemo.lineItems.map((line) => ({
            id: line.id,
            itemHref: line.item ? `/items/${line.item.id}` : null,
            itemReference: line.item ? `${line.item.itemId ?? line.item.id} - ${line.item.name}` : '-',
            description: line.description,
            quantity: line.quantity,
            unitPrice: Number(line.unitPrice),
            lineTotal: Number(line.lineTotal),
            notes: line.notes,
            createdAt: line.createdAt,
            updatedAt: line.updatedAt,
          }))}
          currencyCode={currencyCode}
          moneySettings={moneySettings}
          lineSettings={customization.lineSettings}
          lineColumnCustomization={customization.lineColumns}
          visibleColumns={visibleLineColumns}
        />
      }
      applicationsSection={
        <CreditDocumentApplicationsSection
          kind="credit-memo"
          documents={appliedInvoiceDocuments}
          selectedCounterpartyId={creditMemo.customerId}
          selectedSourceDocumentId=""
          documentAmount={Number(creditMemo.total)}
          applications={creditMemoApplicationInputs}
          editing={false}
          moneySettings={moneySettings}
          currencyCode={currencyCode ?? null}
        />
      }
      glImpactSection={
        <CreditDocumentGlImpactSection
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
      }
    />
  )
}
