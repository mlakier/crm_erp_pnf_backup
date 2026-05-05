import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadListValues } from '@/lib/load-list-values'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import SystemNotesSection from '@/components/SystemNotesSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import DeleteButton from '@/components/DeleteButton'
import BillPaymentGlImpactSection from '@/components/BillPaymentGlImpactSection'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import VendorRefundPageClient from '@/components/VendorRefundPageClient'
import VendorRefundDetailCustomizeMode from '@/components/VendorRefundDetailCustomizeMode'
import BillRelatedDocuments from '@/components/BillRelatedDocuments'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
  buildTransactionGlImpactRows,
} from '@/lib/transaction-detail-helpers'
import {
  buildPostedCurrencyReadoutSection,
  CURRENCY_READOUT_SECTION_TITLE,
} from '@/lib/four-currency-readout'
import {
  VENDOR_REFUND_DETAIL_FIELDS,
  VENDOR_REFUND_REFERENCE_SOURCES,
  VENDOR_REFUND_STAT_CARDS,
  type VendorRefundDetailFieldKey,
} from '@/lib/vendor-refund-detail-customization'
import { loadVendorRefundDetailCustomization } from '@/lib/vendor-refund-detail-customization-store'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

export default async function VendorRefundDetailPage({
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

  const [refund, refundOpenItem, refundApplicationFx, customization, vendors, cashAccounts, methodValues, statusValues, refundSources, currencies] = await Promise.all([
    prisma.vendorRefund.findUnique({
      where: { id },
      include: {
        vendor: true,
        subsidiary: true,
        currency: true,
        user: {
          select: {
            email: true,
          },
        },
        billPayment: {
          include: {
            vendor: true,
            bill: {
              include: {
                vendor: true,
                currency: true,
                purchaseOrder: true,
              },
            },
            applications: {
              include: {
                bill: true,
              },
            },
          },
        },
        bankAccount: true,
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'vendor-refund',
        sourceTransactionId: id,
      },
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
    prisma.openItemApplication.aggregate({
      where: {
        settlementTransactionType: 'vendor-refund',
        settlementTransactionId: id,
      },
      _sum: {
        realizedFxLocalAmount: true,
        realizedFxFunctionalAmount: true,
      },
    }),
    loadVendorRefundDetailCustomization(),
    prisma.vendor.findMany({ orderBy: [{ name: 'asc' }] }),
    loadCashBankPostingAccounts(),
    loadListValues('PAYMENT-METHOD'),
    loadListValues('VENDOR-REFUND-STATUS'),
    prisma.billPayment.findMany({
      include: {
        vendor: true,
        bill: {
          include: {
            vendor: true,
          },
        },
        applications: true,
        vendorRefunds: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.currency.findMany({
      select: { id: true, code: true, currencyId: true, name: true },
      orderBy: [{ code: 'asc' }, { currencyId: 'asc' }],
    }),
  ])

  if (!refund) notFound()
  const refundCurrencyCode =
    refund.currency?.code
    ?? refund.currency?.currencyId
    ?? refund.billPayment?.bill?.currency?.code
    ?? refund.billPayment?.bill?.currency?.currencyId
    ?? undefined
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`]),
  )
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]),
  )

  const detailHref = `/vendor-refunds/${refund.id}`
  const glEntries = await prisma.journalEntry.findMany({
    where: { sourceType: 'vendor-refund', sourceId: id },
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
  const glEntry = glEntries[0] ?? null
  const glSourceNumberByKey = new Map<string, string>()
  for (const entry of glEntries) {
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, refund.number)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })

  const activities = await prisma.activity.findMany({
    where: {
      entityType: 'vendor-refund',
      entityId: refund.id,
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

  if (isEditing) {
    return (
      <VendorRefundPageClient
        mode="edit"
        refundId={refund.id}
        vendors={vendors.map((vendor) => ({ value: vendor.id, label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}` }))}
        bankAccountOptions={cashAccounts.map((account) => ({ value: account.id, label: formatGlAccountLabel(account) }))}
        methodOptions={methodValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
        statusOptions={statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
        refundSources={refundSources.map((payment) => {
          const appliedAmount = payment.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0)
          const refundedAmount = payment.vendorRefunds.reduce((sum, linkedRefund) => {
            if (linkedRefund.id === refund.id || (linkedRefund.status ?? '').toLowerCase() === 'void') return sum
            return sum + Number(linkedRefund.amount)
          }, 0)
          return {
            id: payment.id,
            vendorId: payment.vendorId ?? payment.bill?.vendorId ?? '',
            vendorName: payment.vendor?.name ?? payment.bill?.vendor?.name ?? 'Vendor',
            paymentNumber: payment.number,
            billNumber: payment.bill?.number ?? null,
            availableAmount: Math.max(0, Number(payment.amount) - appliedAmount - refundedAmount),
          }
        }).filter((payment) => payment.availableAmount > 0.005 || payment.id === refund.billPaymentId)}
        initialHeaderValues={{
          id: refund.id,
          number: refund.number,
          vendorId: refund.vendorId,
          billPaymentId: refund.billPaymentId ?? '',
          bankAccountId: refund.bankAccountId ?? '',
          amount: String(refund.amount),
          date: refund.date.toISOString().slice(0, 10),
          method: refund.method,
          reference: refund.reference ?? '',
          notes: refund.notes ?? '',
          status: refund.status,
          createdAt: refund.createdAt.toISOString(),
          createdAtDisplay: fmtDocumentDate(refund.createdAt, moneySettings),
          updatedAt: refund.updatedAt.toISOString(),
          updatedAtDisplay: fmtDocumentDate(refund.updatedAt, moneySettings),
        }}
      />
    )
  }

  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const formattedStatus = formatRecordLabel(refund.status, statusLabelMap)
  const sectionDescriptions: Record<string, string> = {
    'Document Identity': 'Core vendor refund identifiers and source overpayment linkage.',
    'Vendor Snapshot': 'Vendor context captured on the refund record.',
    'Refund Terms': 'Refund amount, bank account, payment method, and lifecycle status.',
    'Record Keys': 'Internal database identifiers for this vendor refund.',
    'System Dates': 'System-managed timestamps and posting linkage for this vendor refund.',
  }
  const communicationsToolbarTargetId = 'vendor-refund-communications-toolbar'
  const systemNotesToolbarTargetId = 'vendor-refund-system-notes-toolbar'

  type VendorRefundHeaderField = {
    key: VendorRefundDetailFieldKey
  } & RecordHeaderField

  const headerFieldDefinitions = {
    vendorName: {
      key: 'vendorName',
      label: 'Vendor Name',
      value: refund.vendor.name,
      displayValue: refund.vendor.name,
      helpText: 'Display name from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
      href: `/vendors/${refund.vendorId}`,
    },
    vendorNumber: {
      key: 'vendorNumber',
      label: 'Vendor #',
      value: refund.vendor.vendorNumber ?? '',
      displayValue: refund.vendor.vendorNumber ?? '-',
      helpText: 'Internal vendor identifier from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
      href: `/vendors/${refund.vendorId}`,
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: refund.id,
      helpText: 'Internal database identifier for this vendor refund.',
      fieldType: 'text',
    },
    number: {
      key: 'number',
      label: 'Vendor Refund Id',
      value: refund.number,
      displayValue: refund.number,
      helpText: 'Unique identifier for this vendor refund.',
      fieldType: 'text',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: refund.vendorId,
      displayValue: refund.vendor.name,
      helpText: 'Vendor issuing the refund.',
      fieldType: 'list',
      sourceText: 'Vendor record',
      href: `/vendors/${refund.vendorId}`,
    },
    billPaymentId: {
      key: 'billPaymentId',
      label: 'Refund Source',
      value: refund.billPaymentId ?? '',
      displayValue: refund.billPayment?.number ?? '-',
      helpText: 'Overpaid bill payment that funded this refund.',
      fieldType: 'text',
      sourceText: 'Bill payment transaction',
      href: refund.billPaymentId ? `/bill-payments/${refund.billPaymentId}` : undefined,
    },
    bankAccountId: {
      key: 'bankAccountId',
      label: 'Bank Account',
      value: refund.bankAccountId ?? '',
      displayValue: refund.bankAccount ? formatGlAccountLabel(refund.bankAccount) : '-',
      helpText: 'Cash or bank account receiving the refund disbursement.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      href: refund.bankAccountId ? `/chart-of-accounts/${refund.bankAccountId}` : undefined,
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: refund.subsidiaryId ?? '',
      displayValue: refund.subsidiary?.name ?? '-',
      helpText: 'Transaction subsidiary on this vendor refund.',
      fieldType: 'list',
      sourceText: 'Subsidiary record',
      href: refund.subsidiaryId ? `/subsidiaries/${refund.subsidiaryId}` : undefined,
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: refund.currencyId ?? '',
      displayValue: refund.currency ? `${refund.currency.code ?? refund.currency.currencyId} - ${refund.currency.name}` : '-',
      helpText: 'Transaction currency on this vendor refund.',
      fieldType: 'list',
      sourceText: 'Currency record',
      href: refund.currencyId ? `/currencies/${refund.currencyId}` : undefined,
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: String(refund.amount),
      displayValue: fmtCurrency(refund.amount, refundCurrencyCode, moneySettings),
      helpText: 'Refund amount received from the vendor.',
      fieldType: 'currency',
    },
    date: {
      key: 'date',
      label: 'Refund Date',
      value: refund.date.toISOString(),
      displayValue: fmtDocumentDate(refund.date, moneySettings),
      helpText: 'Date the refund was received.',
      fieldType: 'date',
    },
    method: {
      key: 'method',
      label: 'Payment Method',
      value: refund.method,
      displayValue: refund.method || '-',
      helpText: 'Receipt method for the refund.',
      fieldType: 'list',
      sourceText: 'Payment method list',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: refund.status,
      displayValue: formattedStatus,
      helpText: 'Lifecycle stage for the vendor refund.',
      fieldType: 'list',
      sourceText: 'Vendor refund status list',
    },
    reference: {
      key: 'reference',
      label: 'Reference',
      value: refund.reference ?? '',
      displayValue: refund.reference ?? '-',
      helpText: 'Reference number or memo for this refund.',
      fieldType: 'text',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: refund.notes ?? '',
      displayValue: refund.notes ?? '-',
      helpText: 'Internal notes for this refund.',
      fieldType: 'text',
    },
    journalEntry: {
      key: 'journalEntry',
      label: 'GL Posting',
      value: glEntry?.number ?? '',
      displayValue: glEntry?.number ?? 'Not posted',
      helpText: 'Journal entry created when the refund posts to GL.',
      fieldType: 'text',
      sourceText: 'Journal entry',
      href: glEntry ? `/journals/${glEntry.id}` : undefined,
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: refund.createdAt.toISOString(),
      displayValue: fmtDocumentDate(refund.createdAt, moneySettings),
      helpText: 'Date/time the vendor refund record was created.',
      fieldType: 'date',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: refund.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(refund.updatedAt, moneySettings),
      helpText: 'Date/time the vendor refund record was last modified.',
      fieldType: 'date',
    },
  } satisfies Record<string, VendorRefundHeaderField>

  const paymentCurrencyCode =
    refund.billPayment?.bill?.currency?.code
    ?? refund.billPayment?.bill?.currency?.currencyId
    ?? undefined
  const billCurrencyCode =
    currencyCodeById.get(refund.billPayment?.bill?.currencyId ?? '') ?? paymentCurrencyCode ?? null
  const purchaseOrderCurrencyCode =
    currencyCodeById.get(refund.billPayment?.bill?.purchaseOrder?.currencyId ?? '') ?? billCurrencyCode ?? null
  const formatMonetaryValue = (
    value: number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode?: string | null,
  ) => fmtCurrency(value, currencyCode ?? undefined, moneySettings)
  const refundRealizedFxGroupAmountRaw = glEntries.reduce((sum, entry) => (
    sum + entry.lineItems.reduce((lineSum, line) => {
      const isRealizedFxLine =
        (line.activityTypeCode ?? '').startsWith('fx_realized')
        || (line.description ?? '').toLowerCase().includes('realized fx')
      if (!isRealizedFxLine) return lineSum
      return lineSum + Number(line.groupDebit ?? 0) - Number(line.groupCredit ?? 0)
    }, 0)
  ), 0)
  const refundRealizedFxGroupAmount =
    Math.abs(refundRealizedFxGroupAmountRaw) > 0.005
      ? Math.abs(refundRealizedFxGroupAmountRaw)
      : null

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(VENDOR_REFUND_REFERENCE_SOURCES, {
    vendor: refund.vendor,
    billPayment: refund.billPayment,
    bill: refund.billPayment?.bill ?? null,
    purchaseOrder: refund.billPayment?.bill?.purchaseOrder ?? null,
  }, {
    billPayment: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? paymentCurrencyCode),
      currencyCode: paymentCurrencyCode,
    },
    bill: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? billCurrencyCode),
      currencyCode: billCurrencyCode,
    },
    purchaseOrder: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? purchaseOrderCurrencyCode),
      currencyCode: purchaseOrderCurrencyCode,
    },
  })
  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    VENDOR_REFUND_REFERENCE_SOURCES,
    {
      vendor: refund.vendor,
      billPayment: refund.billPayment,
      bill: refund.billPayment?.bill ?? null,
      purchaseOrder: refund.billPayment?.bill?.purchaseOrder ?? null,
    },
    {
      vendor: `/vendors/${refund.vendorId}`,
      billPayment: refund.billPaymentId ? `/bill-payments/${refund.billPaymentId}` : null,
      bill: refund.billPayment?.bill ? `/bills/${refund.billPayment.bill.id}` : null,
      purchaseOrder: refund.billPayment?.bill?.purchaseOrder ? `/purchase-orders/${refund.billPayment.bill.purchaseOrder.id}` : null,
    },
    {
      billPayment: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? paymentCurrencyCode),
        currencyCode: paymentCurrencyCode,
      },
      bill: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? billCurrencyCode),
        currencyCode: billCurrencyCode,
      },
      purchaseOrder: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? purchaseOrderCurrencyCode),
        currencyCode: purchaseOrderCurrencyCode,
      },
    },
  )
  const currencyReadoutSection = buildPostedCurrencyReadoutSection({
    postingStatus: refundOpenItem
      ? refundOpenItem.isOpen
        ? `Posted to open item (${refundOpenItem.status})`
        : `Posted and settled (${refundOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: refundOpenItem?.id ?? null,
    openItemNumber: refundOpenItem?.openItemNumber ?? null,
    transactionAmount: refundOpenItem?.originalTransactionAmount ?? refund.amount,
    transactionCurrencyCode: currencyCodeById.get(refundOpenItem?.transactionCurrencyId ?? refund.currencyId ?? '') ?? refundCurrencyCode ?? null,
    transactionCurrencyLabel: currencyLabelById.get(refundOpenItem?.transactionCurrencyId ?? refund.currencyId ?? '') ?? null,
    localAmount: refundOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(refundOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(refundOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: refundOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(refundOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(refundOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: refundOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(refundOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(refundOpenItem?.groupCurrencyId ?? '') ?? null,
    realizedFxLocalAmount: refundApplicationFx._sum.realizedFxLocalAmount,
    realizedFxFunctionalAmount: refundApplicationFx._sum.realizedFxFunctionalAmount,
    realizedFxGroupAmount: refundRealizedFxGroupAmount,
    fxRateType: refund.billPayment?.fxRateType ?? null,
    fxRateSource: refund.billPayment?.fxRateSource ?? null,
    fxEffectiveDateLabel: refund.billPayment?.fxEffectiveDate ? fmtDocumentDate(refund.billPayment.fxEffectiveDate, moneySettings) : null,
    formatCurrency: formatMonetaryValue,
  })
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
    ...Object.fromEntries(currencyReadoutSection.fields.map((field) => [field.key, field])),
  }
  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: VENDOR_REFUND_DETAIL_FIELDS,
    fieldDefinitions: allFieldDefinitions,
    previewOverrides: {
      amount: fmtCurrency(refund.amount, refundCurrencyCode, moneySettings),
      date: fmtDocumentDate(refund.date, moneySettings),
      createdAt: fmtDocumentDate(refund.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(refund.updatedAt, moneySettings),
    },
  })
  const configuredHeaderSections = buildConfiguredTransactionSections({
    fields: VENDOR_REFUND_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: allFieldDefinitions,
    sectionDescriptions,
  })
  const configuredCurrencySection =
    configuredHeaderSections.find((section) => section.title === CURRENCY_READOUT_SECTION_TITLE) ?? currencyReadoutSection
  const headerSections = configuredHeaderSections.filter((section) => section.title !== CURRENCY_READOUT_SECTION_TITLE)
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = VENDOR_REFUND_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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

  const refundStats: TransactionStatDefinition<typeof refund>[] = [
    {
      id: 'amount',
      label: 'Refund Amount',
      accent: true as const,
      getValue: (record: typeof refund) => fmtCurrency(record.amount, refundCurrencyCode, moneySettings),
      getValueTone: () => 'accent' as const,
    },
    {
      id: 'status',
      label: 'Status',
      getValue: () => formattedStatus,
    },
    {
      id: 'method',
      label: 'Method',
      getValue: (record: typeof refund) => record.method || '-',
    },
    {
      id: 'vendor',
      label: 'Vendor',
      getValue: (record: typeof refund) => record.vendor.name,
      getHref: (record: typeof refund) => `/vendors/${record.vendorId}`,
      getValueTone: () => 'accent' as const,
    },
  ]
  const statPreviewCards = refundStats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(refund),
    href: stat.getHref?.(refund) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(refund),
    cardTone: stat.getCardTone?.(refund),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
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

  const bill = refund.billPayment?.bill ?? null
  const purchaseOrder = bill?.purchaseOrder ?? null

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/vendor-refunds'}
      backLabel={isCustomizing ? '<- Back to Vendor Refund Detail' : '<- Back to Vendor Refunds'}
      meta={refund.number}
      title={`Vendor Refund ${refund.number}`}
      widthClassName="w-full max-w-none"
      actions={
        <TransactionActionStack
          mode={isCustomizing ? 'customize' : 'detail'}
          cancelHref={detailHref}
          primaryActions={
            <>
              <MasterDataDetailCreateMenu
                newHref="/vendor-refunds/new"
                duplicateHref={`/vendor-refunds/new?duplicateFrom=${encodeURIComponent(refund.id)}`}
              />
              <MasterDataDetailExportMenu
                title={refund.number}
                fileName={`vendor-refund-${refund.number}`}
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
              <DeleteButton resource="vendor-refunds" id={refund.id} />
            </>
          }
        />
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={isCustomizing ? null : (
          <TransactionStatsRow
            record={refund}
            stats={refundStats}
            visibleStatCards={customization.statCards}
            visibleStatIds={VENDOR_REFUND_STAT_CARDS.map((card) => card.id)}
          />
        )}
        header={
          isCustomizing ? (
            <VendorRefundDetailCustomizeMode
              detailHref={detailHref}
              initialLayout={customization}
              fields={customizeFields}
              referenceSourceDefinitions={referenceSourceDefinitions}
              sectionDescriptions={sectionDescriptions}
              statPreviewCards={statPreviewCards}
            />
          ) : (
            <div className="space-y-6">
              <TransactionFourCurrencySection
                section={configuredCurrencySection}
                layout={customization}
                description="Read the transaction, local, functional, and group amounts from the posted vendor refund context."
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
                  containerDescription="Expanded context from linked records on this vendor refund."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                editing={false}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Vendor Refund Details"
                containerDescription="Vendor refund, overpayment source, and cash receipt details."
                showSubsections={false}
              />
            </div>
          )
        }
        lineItems={null}
        relatedRecords={isCustomizing ? null : (
          <RelatedRecordsSection
            embedded
            showDisplayControl={false}
            tabs={[
              {
                key: 'vendor',
                label: 'Vendor',
                count: 1,
                emptyMessage: 'No related vendor is linked to this vendor refund.',
                rows: [
                  {
                    id: refund.vendor.id,
                    type: 'Vendor',
                    reference: refund.vendor.vendorNumber ?? refund.vendor.id,
                    name: refund.vendor.name,
                    details: [refund.vendor.email, refund.vendor.phone].filter(Boolean).join(' | ') || '-',
                    href: `/vendors/${refund.vendor.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <BillRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultActiveKey="bills"
            defaultCurrencyCode={refundCurrencyCode}
            bills={bill ? [{
              id: bill.id,
              number: bill.number,
              status: bill.status,
              total: Number(bill.total),
              date: bill.date,
              currencyCode: refundCurrencyCode,
            }] : []}
            purchaseRequisitions={[]}
            purchaseOrders={purchaseOrder ? [{
              id: purchaseOrder.id,
              number: purchaseOrder.number,
              status: purchaseOrder.status,
              total: Number(purchaseOrder.total),
              createdAt: purchaseOrder.createdAt,
              currencyCode: refundCurrencyCode,
            }] : []}
            receipts={[]}
            billPayments={refund.billPayment ? [{
              id: refund.billPayment.id,
              number: refund.billPayment.number,
              date: refund.billPayment.date,
              status: refund.billPayment.status,
              amount: Number(refund.billPayment.amount),
              reference: refund.billPayment.reference,
              currencyCode: refundCurrencyCode,
            }] : []}
            moneySettings={moneySettings}
          />
        )}
        relatedDocumentsCount={(bill ? 1 : 0) + (purchaseOrder ? 1 : 0) + (refund.billPayment ? 1 : 0)}
        supplementarySections={
          isCustomizing ? null : (
            <BillPaymentGlImpactSection
              rows={glImpactRows}
              settings={customization.glImpactSettings}
              columnCustomization={customization.glImpactColumns}
              currencyCodes={{
                transaction: currencyCodeById.get(refundOpenItem?.transactionCurrencyId ?? refund.currencyId ?? '') ?? refundCurrencyCode ?? null,
                local: currencyCodeById.get(refundOpenItem?.localCurrencyId ?? '') ?? null,
                functional: currencyCodeById.get(refundOpenItem?.functionalCurrencyId ?? '') ?? null,
                group: currencyCodeById.get(refundOpenItem?.groupCurrencyId ?? '') ?? null,
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
            compose={{
              recordId: refund.id,
              userId: refund.userId,
              number: refund.number,
              counterpartyName: refund.vendor.name,
              counterpartyEmail: refund.vendor.email,
              fromEmail: refund.user?.email ?? null,
              status: formattedStatus,
              total: fmtCurrency(refund.amount, refundCurrencyCode, moneySettings),
              lineItems: [],
              sendEmailEndpoint: '/api/vendor-refunds?action=send-email',
              recordIdFieldName: 'vendorRefundId',
              documentLabel: 'Vendor Refund',
            }}
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
