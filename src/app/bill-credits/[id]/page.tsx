import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import type { RecordHeaderField } from '@/components/RecordHeaderDetails'
import type { RelatedRecordsTab } from '@/components/RelatedRecordsSection'
import BillRelatedDocuments from '@/components/BillRelatedDocuments'
import CreditDocumentDetailFrame from '@/components/CreditDocumentDetailFrame'
import CreditDocumentGlImpactSection from '@/components/CreditDocumentGlImpactSection'
import CreditDocumentDetailCustomizeMode from '@/components/CreditDocumentDetailCustomizeMode'
import CreditDocumentApplicationsSection from '@/components/CreditDocumentApplicationsSection'
import CreditDocumentLineItemsSection from '@/components/CreditDocumentLineItemsSection'
import CreditDocumentPageClient from '@/components/CreditDocumentPageClient'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import { loadBillCreditApplicationCandidates } from '@/lib/credit-document-application-context'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import {
  BILL_CREDIT_DETAIL_FIELDS,
  BILL_CREDIT_REFERENCE_SOURCES,
  type BillCreditDetailFieldKey,
} from '@/lib/bill-credit-detail-customization'
import { loadBillCreditDetailCustomization } from '@/lib/bill-credit-detail-customization-store'
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

type BillCreditHeaderField = { key: BillCreditDetailFieldKey } & RecordHeaderField

const BILL_CREDIT_SECTION_DESCRIPTIONS: Record<string, string> = {
  'Document Identity': 'Core bill credit identifiers and source-document context.',
  'Workflow & Timing': 'Lifecycle status and key dates for this bill credit.',
  'Sourcing & Financials': 'Organizational, currency, and monetary context for this bill credit.',
  'Record Keys': 'Internal database and created-by identifiers for this bill credit.',
  'System Dates': 'System-managed timestamps for this bill credit.',
}

const BASE_BILL_CREDIT_FIELDS = BILL_CREDIT_DETAIL_FIELDS.filter(
  (field) => !CURRENCY_READOUT_FIELD_KEYS.includes(field.id as (typeof CURRENCY_READOUT_FIELD_KEYS)[number]),
)

export default async function BillCreditDetailPage({
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
    billCredit,
    billCreditOpenItem,
    billCreditApplications,
    activities,
    customization,
    currencies,
    applicationCandidates,
  ] = await Promise.all([
    prisma.billCredit.findUnique({
      where: { id },
      include: {
        vendor: true,
        bill: {
          include: {
            currency: true,
            purchaseOrder: true,
            billPayments: {
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
        sourceTransactionType: 'bill-credit',
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
        settlementTransactionType: 'bill-credit',
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
        entityType: 'bill-credit',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadBillCreditDetailCustomization(),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    loadBillCreditApplicationCandidates(),
  ])

  if (!billCredit) notFound()

  const linkedPurchaseOrder = billCredit.bill?.purchaseOrderId
    ? await prisma.purchaseOrder.findUnique({
        where: { id: billCredit.bill.purchaseOrderId },
        include: {
          requisition: true,
          receipts: true,
        },
      })
    : null

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: billCredit.id },
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
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, billCredit.number)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback),
  })

  if (isEditing) {
    const [vendors, subsidiaries, editCurrencies, items] = await Promise.all([
      prisma.vendor.findMany({
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          vendorNumber: true,
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
      billCredit.user.userId && billCredit.user.name
        ? `${billCredit.user.userId} - ${billCredit.user.name}`
        : billCredit.user.userId ?? billCredit.user.name ?? billCredit.user.email

    return (
      <CreditDocumentPageClient
        kind="bill-credit"
        mode="edit"
        documentId={billCredit.id}
        nextNumber={billCredit.number}
        userId={billCredit.userId}
        userLabel={userLabel}
        counterparties={vendors.map((vendor) => ({
          id: vendor.id,
          reference: vendor.vendorNumber ?? vendor.id,
          name: vendor.name,
          email: vendor.email,
          subsidiaryId: vendor.subsidiary?.id ?? null,
          currencyId: vendor.currency?.id ?? null,
        }))}
        sourceDocuments={applicationCandidates.map((bill) => ({
          id: bill.id,
          number: bill.number,
          counterpartyId: bill.vendorId,
          subsidiaryId: bill.subsidiaryId ?? null,
          currencyId: bill.currencyId ?? null,
          total: Number(bill.total),
          status: bill.status,
          date: new Date(bill.date).toISOString(),
          openAmount: bill.openAmount,
          currencyCode: bill.currencyCode ?? null,
          userId: bill.userId ?? null,
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
          id: billCredit.id,
          number: billCredit.number,
          counterpartyId: billCredit.vendorId,
          sourceDocumentId: billCredit.billId ?? '',
          subsidiaryId: billCredit.subsidiaryId ?? '',
          currencyId: billCredit.currencyId ?? '',
          status: billCredit.status,
          date: billCredit.date.toISOString().slice(0, 10),
          reason: billCredit.reason ?? '',
          notes: billCredit.notes ?? '',
          createdAtDisplay: fmtDocumentDate(billCredit.createdAt, moneySettings),
          updatedAtDisplay: fmtDocumentDate(billCredit.updatedAt, moneySettings),
          applications: JSON.stringify(
            billCreditApplications.map((application) => ({
              billId: application.toOpenItem?.sourceTransactionId ?? '',
              appliedAmount: Number(application.transactionAmount),
            })).filter((application) => application.billId),
          ),
        }}
        initialLineItems={billCredit.lineItems.map((line) => ({
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

  const currencyCode = billCredit.currency?.code ?? billCredit.currency?.currencyId ?? undefined
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null] as const),
  )
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`] as const),
  )
  const totalRealizedFxLocal = billCreditApplications.reduce(
    (sum, application) => sum + Number(application.realizedFxLocalAmount ?? 0),
    0,
  )
  const totalRealizedFxFunctional = billCreditApplications.reduce(
    (sum, application) => sum + Number(application.realizedFxFunctionalAmount ?? 0),
    0,
  )
  const totalRealizedFxGroup = billCreditApplications.reduce((sum, application) => {
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
    postingStatus: billCreditOpenItem
      ? billCreditOpenItem.isOpen
        ? `Posted to open item (${billCreditOpenItem.status})`
        : `Posted and settled (${billCreditOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: billCreditOpenItem?.id ?? null,
    openItemNumber: billCreditOpenItem?.openItemNumber ?? null,
    transactionAmount: billCreditOpenItem?.originalTransactionAmount ?? billCredit.total,
    transactionCurrencyCode:
      currencyCodeById.get(billCreditOpenItem?.transactionCurrencyId ?? billCredit.currencyId ?? '') ?? null,
    transactionCurrencyLabel:
      currencyLabelById.get(billCreditOpenItem?.transactionCurrencyId ?? billCredit.currencyId ?? '') ??
      (billCredit.currency ? `${billCredit.currency.code ?? billCredit.currency.currencyId} - ${billCredit.currency.name}` : null),
    localAmount: billCreditOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(billCreditOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(billCreditOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: billCreditOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(billCreditOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(billCreditOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: billCreditOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(billCreditOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(billCreditOpenItem?.groupCurrencyId ?? '') ?? null,
    realizedFxLocalAmount: billCreditApplications.length > 0 ? totalRealizedFxLocal : null,
    realizedFxFunctionalAmount: billCreditApplications.length > 0 ? totalRealizedFxFunctional : null,
    realizedFxGroupAmount: billCreditApplications.length > 0 ? totalRealizedFxGroup : null,
    fxRateType:
      billCreditOpenItem?.originalFunctionalAmount != null || billCreditOpenItem?.originalGroupAmount != null ? 'spot' : null,
    fxRateSource:
      billCreditOpenItem?.originalFunctionalAmount != null || billCreditOpenItem?.originalGroupAmount != null
        ? 'Configured exchange rates'
        : null,
    formatCurrency: (value, code) => fmtCurrency(value, code ?? undefined, moneySettings),
  })

  const vendorHref = `/vendors/${billCredit.vendorId}`
  const billHref = billCredit.billId ? `/bills/${billCredit.billId}` : null
  const userHref = `/users/${billCredit.userId}`
  const subsidiaryHref = billCredit.subsidiaryId ? `/subsidiaries/${billCredit.subsidiaryId}` : null
  const currencyHref = billCredit.currencyId ? `/currencies/${billCredit.currencyId}` : null

  const fieldDefinitions = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: billCredit.id,
      displayValue: billCredit.id,
      fieldType: 'text',
    },
    number: {
      key: 'number',
      label: 'Bill Credit Id',
      value: billCredit.number,
      displayValue: billCredit.number,
      fieldType: 'text',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: billCredit.vendorId,
      displayValue: billCredit.vendor.name,
      href: vendorHref,
      fieldType: 'text',
    },
    billId: {
      key: 'billId',
      label: 'Bill',
      value: billCredit.billId ?? '',
      displayValue: billCredit.bill?.number ?? '-',
      href: billHref,
      fieldType: 'text',
    },
    reason: {
      key: 'reason',
      label: 'Reason',
      value: billCredit.reason ?? '',
      displayValue: billCredit.reason ?? '-',
      fieldType: 'text',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: billCredit.notes ?? '',
      displayValue: billCredit.notes ?? '-',
      fieldType: 'text',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: billCredit.status,
      displayValue: billCredit.status,
      fieldType: 'text',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: billCredit.date.toISOString(),
      displayValue: fmtDocumentDate(billCredit.date, moneySettings),
      fieldType: 'date',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: billCredit.subsidiaryId ?? '',
      displayValue: billCredit.subsidiary ? `${billCredit.subsidiary.subsidiaryId} - ${billCredit.subsidiary.name}` : '-',
      href: subsidiaryHref,
      fieldType: 'text',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: billCredit.currencyId ?? '',
      displayValue: billCredit.currency ? `${billCredit.currency.code ?? billCredit.currency.currencyId} - ${billCredit.currency.name}` : '-',
      href: currencyHref,
      fieldType: 'text',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(billCredit.total),
      displayValue: fmtCurrency(billCredit.total, currencyCode, moneySettings),
      fieldType: 'currency',
    },
    userId: {
      key: 'userId',
      label: 'Created By',
      value: billCredit.userId,
      displayValue:
        billCredit.user.userId && billCredit.user.name
          ? `${billCredit.user.userId} - ${billCredit.user.name}`
          : billCredit.user.userId ?? billCredit.user.name ?? billCredit.user.email,
      href: userHref,
      fieldType: 'text',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: billCredit.createdAt.toISOString(),
      displayValue: fmtDocumentDate(billCredit.createdAt, moneySettings),
      fieldType: 'date',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: billCredit.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(billCredit.updatedAt, moneySettings),
      fieldType: 'date',
    },
  } as Record<BillCreditDetailFieldKey, BillCreditHeaderField>
  Object.assign(
    fieldDefinitions,
    currencySection.fields as Partial<Record<BillCreditDetailFieldKey, BillCreditHeaderField>>,
  )

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    BILL_CREDIT_REFERENCE_SOURCES,
    {
      bill: billCredit.bill,
      owner: billCredit.user,
      subsidiary: billCredit.subsidiary,
      currency: billCredit.currency,
    },
    {
      bill: billHref,
      owner: userHref,
      subsidiary: subsidiaryHref,
      currency: currencyHref,
    },
    {
      bill: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, code) =>
          fmtCurrency(value as Parameters<typeof fmtCurrency>[0], code ?? undefined, moneySettings),
        currencyCode: billCredit.bill?.currency?.code ?? billCredit.bill?.currency?.currencyId ?? null,
      },
    },
  )

  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...fieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const previewOverrides = {
    vendorId: billCredit.vendor.vendorNumber ?? '',
    billId: billCredit.bill?.number ?? '-',
    subsidiaryId: billCredit.subsidiary ? `${billCredit.subsidiary.subsidiaryId} - ${billCredit.subsidiary.name}` : '-',
    currencyId: billCredit.currency ? `${billCredit.currency.code ?? billCredit.currency.currencyId} - ${billCredit.currency.name}` : '-',
    userId:
      billCredit.user.userId && billCredit.user.name
        ? `${billCredit.user.userId} - ${billCredit.user.name}`
        : billCredit.user.userId ?? billCredit.user.name ?? billCredit.user.email ?? '',
    total: fmtCurrency(billCredit.total, currencyCode, moneySettings),
  } satisfies Partial<Record<BillCreditDetailFieldKey, string>>

  const customizeFieldsWithCurrency = buildTransactionCustomizePreviewFields({
    fields: BILL_CREDIT_DETAIL_FIELDS,
    fieldDefinitions: allFieldDefinitions,
    previewOverrides,
  })

  const headerSections = buildConfiguredTransactionSections({
    fields: BASE_BILL_CREDIT_FIELDS,
    layout: customization,
    fieldDefinitions,
    sectionDescriptions: BILL_CREDIT_SECTION_DESCRIPTIONS,
  })

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(BILL_CREDIT_REFERENCE_SOURCES, {
    bill: billCredit.bill,
    owner: billCredit.user,
    subsidiary: billCredit.subsidiary,
    currency: billCredit.currency,
  }, {
    bill: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, code) =>
        fmtCurrency(value as Parameters<typeof fmtCurrency>[0], code ?? undefined, moneySettings),
      currencyCode: billCredit.bill?.currency?.code ?? billCredit.bill?.currency?.currencyId ?? null,
    },
  })

  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = BILL_CREDIT_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
      id: 'bill-credit-total',
      label: 'Total',
      value: fmtCurrency(billCredit.total, currencyCode, moneySettings),
      accent: true as const,
      supportsColorized: true,
      supportsLink: false,
    },
    {
      id: 'bill-credit-status',
      label: 'Status',
      value: billCredit.status,
      supportsColorized: false,
      supportsLink: false,
    },
    {
      id: 'bill-credit-date',
      label: 'Date',
      value: fmtDocumentDate(billCredit.date, moneySettings),
      supportsColorized: false,
      supportsLink: false,
    },
    {
      id: 'bill-credit-vendor',
      label: 'Vendor',
      value: billCredit.vendor.name,
      href: vendorHref,
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
      key: 'vendor',
      label: 'Vendor',
      count: 1,
      emptyMessage: 'No linked vendor.',
      rows: [
        {
          id: billCredit.vendor.id,
          type: 'Vendor',
          reference: billCredit.vendor.vendorNumber ?? billCredit.vendor.id,
          name: billCredit.vendor.name,
          details: billCredit.vendor.email ?? '-',
          href: vendorHref,
        },
      ],
    },
    {
      key: 'accounting-context',
      label: 'Accounting Context',
      count: (billCredit.subsidiary ? 1 : 0) + (billCredit.currency ? 1 : 0) + 1,
      emptyMessage: 'No accounting-context references.',
      rows: [
        ...(billCredit.subsidiary
          ? [{
              id: billCredit.subsidiary.id,
              type: 'Subsidiary',
              reference: billCredit.subsidiary.subsidiaryId,
              name: billCredit.subsidiary.name,
              details: 'Posting subsidiary',
              href: subsidiaryHref,
            }]
          : []),
        ...(billCredit.currency
          ? [{
              id: billCredit.currency.id,
              type: 'Currency',
              reference: billCredit.currency.code ?? billCredit.currency.currencyId,
              name: billCredit.currency.name,
              details: 'Document currency',
              href: currencyHref,
            }]
          : []),
        {
          id: billCredit.user.id,
          type: 'User',
          reference: billCredit.user.userId ?? billCredit.user.id,
          name: billCredit.user.name ?? billCredit.user.email ?? billCredit.user.id,
          details: 'Created by',
          href: userHref,
        },
      ],
    },
    {
      key: 'items',
      label: 'Items',
      count: billCredit.lineItems.filter((line) => line.item).length,
      emptyMessage: 'No linked items.',
      rows: billCredit.lineItems
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
  const relatedBills = billCredit.bill
    ? [
        {
          id: billCredit.bill.id,
          number: billCredit.bill.number,
          status: billCredit.bill.status,
          total: Number(billCredit.bill.total),
          date: billCredit.bill.date,
        },
      ]
    : []
  const relatedPurchaseOrders = linkedPurchaseOrder
    ? [
        {
          id: linkedPurchaseOrder.id,
          number: linkedPurchaseOrder.number,
          status: linkedPurchaseOrder.status,
          total: Number(linkedPurchaseOrder.total),
          createdAt: linkedPurchaseOrder.createdAt,
        },
      ]
    : []
  const relatedPurchaseRequisitions = linkedPurchaseOrder?.requisition
    ? [
        {
          id: linkedPurchaseOrder.requisition.id,
          number: linkedPurchaseOrder.requisition.number,
          status: linkedPurchaseOrder.requisition.status,
          total: Number(linkedPurchaseOrder.requisition.total ?? 0),
          createdAt: linkedPurchaseOrder.requisition.createdAt,
        },
      ]
    : []
  const relatedReceipts =
    linkedPurchaseOrder?.receipts.map((receipt) => ({
      id: receipt.id,
      number: receipt.id,
      date: receipt.date,
      status: receipt.status,
      quantity: Number(receipt.quantity ?? 0),
      notes: receipt.notes,
    })) ?? []
  const relatedBillPayments =
    billCredit.bill?.billPayments.map((payment) => ({
      id: payment.id,
      number: payment.number,
      date: payment.date,
      status: payment.status,
      amount: Number(payment.amount),
      reference: payment.reference,
    })) ?? []
  const relatedDocumentsCount =
    relatedBills.length +
    relatedPurchaseOrders.length +
    relatedPurchaseRequisitions.length +
    relatedReceipts.length +
    relatedBillPayments.length

  const appliedBillIds = new Set(
    billCreditApplications
      .map((application) => application.toOpenItem?.sourceTransactionId ?? '')
      .filter(Boolean),
  )
  const appliedBillDocuments = applicationCandidates.filter((candidate) => appliedBillIds.has(candidate.id))
  const billCreditApplicationInputs = billCreditApplications
    .map((application) => ({
      billId: application.toOpenItem?.sourceTransactionId ?? '',
      appliedAmount: Number(application.transactionAmount),
    }))
    .filter((application) => application.billId && application.appliedAmount > 0)

  const stats: TransactionStatDefinition<typeof billCredit>[] = [
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
      id: 'vendor',
      label: 'Vendor',
      accent: true,
      getValue: () => billCredit.vendor.name,
      getHref: () => vendorHref,
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
    currencyCodeById.get(billCreditOpenItem?.transactionCurrencyId ?? billCredit.currencyId ?? '') ?? null
  const localCurrencyCode = currencyCodeById.get(billCreditOpenItem?.localCurrencyId ?? '') ?? null
  const functionalCurrencyCode = currencyCodeById.get(billCreditOpenItem?.functionalCurrencyId ?? '') ?? null
  const groupCurrencyCode = currencyCodeById.get(billCreditOpenItem?.groupCurrencyId ?? '') ?? null

  if (isCustomizing) {
    return (
      <RecordDetailPageShell
        backHref={`/bill-credits/${billCredit.id}`}
        backLabel="<- Back to Bill Credit Detail"
        meta={billCredit.number}
        title={`Bill Credit for ${billCredit.vendor.name}`}
      >
        <CreditDocumentDetailCustomizeMode
          kind="bill-credit"
          detailHref={`/bill-credits/${billCredit.id}`}
          initialLayout={customization}
          fields={customizeFieldsWithCurrency}
          referenceSourceDefinitions={referenceSourceDefinitions}
          sectionDescriptions={BILL_CREDIT_SECTION_DESCRIPTIONS}
          statPreviewCards={statPreviewCards}
        />
      </RecordDetailPageShell>
    )
  }

  return (
    <CreditDocumentDetailFrame
      backHref="/bill-credits"
      backLabel="Back to Bill Credits"
      meta={billCredit.number}
      title={`Bill Credit for ${billCredit.vendor.name}`}
      record={billCredit}
      stats={stats}
      visibleStatCards={customization.statCards}
      currencySection={
        <TransactionFourCurrencySection
          section={currencySection}
          layout={customization}
          description="Read the transaction, local, functional, and group amounts from the posted bill credit context."
        />
      }
      referenceSections={referenceSections}
      referenceColumns={referenceColumns}
      headerSections={headerSections}
      headerContainerTitle="Bill Credit Details"
      headerContainerDescription="Core bill credit fields organized in one shared detail container."
      relatedRecordTabs={relatedRecordTabs}
      relatedDocumentTabs={relatedDocumentTabs}
      relatedDocumentsSection={
        <BillRelatedDocuments
          bills={relatedBills}
          purchaseOrders={relatedPurchaseOrders}
          purchaseRequisitions={relatedPurchaseRequisitions}
          receipts={relatedReceipts}
          billPayments={relatedBillPayments}
          moneySettings={moneySettings}
          defaultCurrencyCode={currencyCode}
          embedded
          defaultActiveKey="purchase-requisitions"
        />
      }
      relatedDocumentsCount={relatedDocumentsCount}
      activities={activities}
      activityUserLabelById={activityUserLabelById}
      actions={
        <RecordDetailActionBar
          mode="detail"
          newHref="/bill-credits/new"
          duplicateHref={`/bill-credits/new?duplicateFrom=${encodeURIComponent(billCredit.id)}`}
          customizeHref={`/bill-credits/${billCredit.id}?customize=1`}
          exportTitle={`Bill Credit ${billCredit.number}`}
          exportFileName={billCredit.number}
          exportSections={exportSections}
          editHref={`/bill-credits/${billCredit.id}?edit=1`}
          deleteResource="bill-credits"
          deleteId={billCredit.id}
          deleteLabel={billCredit.number}
        />
      }
      compose={buildTransactionCommunicationComposePayload({
        recordId: billCredit.id,
        userId: billCredit.userId,
        number: billCredit.number,
        counterpartyName: billCredit.vendor.name,
        counterpartyEmail: billCredit.vendor.email ?? null,
        fromEmail: billCredit.user.email ?? null,
        status: billCredit.status,
        total: fmtCurrency(billCredit.total, currencyCode, moneySettings),
        lineItems: billCredit.lineItems.map((line, index) => ({
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
        sendEmailEndpoint: '/api/bill-credits?action=send-email',
        recordIdFieldName: 'billCreditId',
        documentLabel: 'Bill Credit',
      })}
      formatDate={(value) => fmtDocumentDate(value, moneySettings)}
      lineItemsSection={
        <CreditDocumentLineItemsSection
          title="Bill Credit Lines"
          rows={billCredit.lineItems.map((line) => ({
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
          kind="bill-credit"
          documents={appliedBillDocuments}
          selectedCounterpartyId={billCredit.vendorId}
          selectedSourceDocumentId=""
          documentAmount={Number(billCredit.total)}
          applications={billCreditApplicationInputs}
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
