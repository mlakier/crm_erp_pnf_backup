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
import InvoiceReceiptGlImpactSection from '@/components/InvoiceReceiptGlImpactSection'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import CustomerRefundPageClient from '@/components/CustomerRefundPageClient'
import CustomerRefundDetailCustomizeMode from '@/components/CustomerRefundDetailCustomizeMode'
import CustomerRefundRelatedDocuments from '@/components/CustomerRefundRelatedDocuments'
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
  CUSTOMER_REFUND_DETAIL_FIELDS,
  CUSTOMER_REFUND_REFERENCE_SOURCES,
  CUSTOMER_REFUND_STAT_CARDS,
  type CustomerRefundDetailFieldKey,
} from '@/lib/customer-refund-detail-customization'
import { loadCustomerRefundDetailCustomization } from '@/lib/customer-refund-detail-customization-store'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

export default async function CustomerRefundDetailPage({
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

  const [refund, refundOpenItem, refundApplicationFx, customization, customers, cashAccounts, methodValues, statusValues, refundSources, currencies] = await Promise.all([
    prisma.customerRefund.findUnique({
      where: { id },
      include: {
        customer: true,
        subsidiary: true,
        currency: true,
        user: {
          select: {
            email: true,
          },
        },
        cashReceipt: {
          include: {
              invoice: {
                include: {
                  customer: true,
                  currency: true,
                  salesOrder: {
                    include: {
                      quote: {
                      include: {
                        opportunity: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        bankAccount: true,
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'customer-refund',
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
        settlementTransactionType: 'customer-refund',
        settlementTransactionId: id,
      },
      _sum: {
        realizedFxLocalAmount: true,
        realizedFxFunctionalAmount: true,
      },
    }),
    loadCustomerRefundDetailCustomization(),
    prisma.customer.findMany({ orderBy: [{ name: 'asc' }] }),
    loadCashBankPostingAccounts(),
    loadListValues('PAYMENT-METHOD'),
    loadListValues('CUSTOMER-REFUND-STATUS'),
    prisma.cashReceipt.findMany({
      where: { overpaymentHandling: 'refund_pending' },
      include: {
        invoice: { include: { customer: true } },
        applications: true,
        customerRefunds: true,
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
    ?? refund.cashReceipt?.invoice?.currency?.code
    ?? refund.cashReceipt?.invoice?.currency?.currencyId
    ?? undefined
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`]),
  )
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]),
  )

  const detailHref = `/customer-refunds/${refund.id}`
  const glEntries = await prisma.journalEntry.findMany({
    where: { sourceType: 'customer-refund', sourceId: id },
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
      entityType: 'customer-refund',
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
      <CustomerRefundPageClient
        mode="edit"
        refundId={refund.id}
        customers={customers.map((customer) => ({ value: customer.id, label: `${customer.customerId ?? 'CUSTOMER'} - ${customer.name}` }))}
        bankAccountOptions={cashAccounts.map((account) => ({ value: account.id, label: formatGlAccountLabel(account) }))}
        methodOptions={methodValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
        statusOptions={statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
        refundSources={refundSources.map((receipt) => {
          const appliedAmount = receipt.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0)
          const refundedAmount = receipt.customerRefunds.reduce((sum, linkedRefund) => {
            if (linkedRefund.id === refund.id || (linkedRefund.status ?? '').toLowerCase() === 'void') return sum
            return sum + Number(linkedRefund.amount)
          }, 0)
          return {
            id: receipt.id,
            customerId: receipt.invoice.customerId,
            customerName: receipt.invoice.customer.name,
            receiptNumber: receipt.number ?? receipt.id,
            availableAmount: Math.max(0, Number(receipt.amount) - appliedAmount - refundedAmount),
          }
        }).filter((receipt) => receipt.availableAmount > 0.005 || receipt.id === refund.cashReceiptId)}
        initialHeaderValues={{
          id: refund.id,
          number: refund.number,
          customerId: refund.customerId,
          cashReceiptId: refund.cashReceiptId ?? '',
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
    'Document Identity': 'Core customer refund identifiers and source overpayment linkage.',
    'Customer Snapshot': 'Customer context captured on the refund record.',
    'Refund Terms': 'Refund amount, bank account, payment method, and lifecycle status.',
    'Record Keys': 'Internal database identifiers for this customer refund.',
    'System Dates': 'System-managed timestamps and posting linkage for this customer refund.',
  }
  const communicationsToolbarTargetId = 'customer-refund-communications-toolbar'
  const systemNotesToolbarTargetId = 'customer-refund-system-notes-toolbar'
  type CustomerRefundHeaderField = {
    key: CustomerRefundDetailFieldKey
  } & RecordHeaderField

  const headerFieldDefinitions = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: refund.customer.name,
      displayValue: refund.customer.name,
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
      href: `/customers/${refund.customerId}`,
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: refund.customer.customerId ?? '',
      displayValue: refund.customer.customerId ?? '-',
      helpText: 'Internal customer identifier from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
      href: `/customers/${refund.customerId}`,
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: refund.id,
      helpText: 'Internal database identifier for this customer refund.',
      fieldType: 'text',
    },
    number: {
      key: 'number',
      label: 'Customer Refund Id',
      value: refund.number,
      displayValue: refund.number,
      helpText: 'Unique identifier for this customer refund.',
      fieldType: 'text',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer',
      value: refund.customerId,
      displayValue: refund.customer.name,
      helpText: 'Customer receiving the refund.',
      fieldType: 'list',
      sourceText: 'Customer record',
      href: `/customers/${refund.customerId}`,
    },
    cashReceiptId: {
      key: 'cashReceiptId',
      label: 'Refund Source',
      value: refund.cashReceiptId ?? '',
      displayValue: refund.cashReceipt?.number ?? '-',
      helpText: 'Refund-pending invoice receipt that funded this refund.',
      fieldType: 'text',
      sourceText: 'Invoice receipt transaction',
      href: refund.cashReceiptId ? `/invoice-receipts/${refund.cashReceiptId}` : undefined,
    },
    bankAccountId: {
      key: 'bankAccountId',
      label: 'Bank Account',
      value: refund.bankAccountId ?? '',
      displayValue: refund.bankAccount ? formatGlAccountLabel(refund.bankAccount) : '-',
      helpText: 'Cash or bank account used for the refund disbursement.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      href: refund.bankAccountId ? `/chart-of-accounts/${refund.bankAccountId}` : undefined,
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: refund.subsidiaryId ?? '',
      displayValue: refund.subsidiary?.name ?? '-',
      helpText: 'Transaction subsidiary on this customer refund.',
      fieldType: 'list',
      sourceText: 'Subsidiary record',
      href: refund.subsidiaryId ? `/subsidiaries/${refund.subsidiaryId}` : undefined,
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: refund.currencyId ?? '',
      displayValue: refund.currency ? `${refund.currency.code ?? refund.currency.currencyId} - ${refund.currency.name}` : '-',
      helpText: 'Transaction currency on this customer refund.',
      fieldType: 'list',
      sourceText: 'Currency record',
      href: refund.currencyId ? `/currencies/${refund.currencyId}` : undefined,
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: String(refund.amount),
      displayValue: fmtCurrency(refund.amount, refundCurrencyCode, moneySettings),
      helpText: 'Refund amount issued to the customer.',
      fieldType: 'currency',
    },
    date: {
      key: 'date',
      label: 'Refund Date',
      value: refund.date.toISOString(),
      displayValue: fmtDocumentDate(refund.date, moneySettings),
      helpText: 'Date the refund was issued.',
      fieldType: 'date',
    },
    method: {
      key: 'method',
      label: 'Payment Method',
      value: refund.method,
      displayValue: refund.method || '-',
      helpText: 'Disbursement method for the refund.',
      fieldType: 'list',
      sourceText: 'Payment method list',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: refund.status,
      displayValue: formattedStatus,
      helpText: 'Lifecycle stage for the customer refund.',
      fieldType: 'list',
      sourceText: 'Customer refund status list',
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
      helpText: 'Date/time the customer refund record was created.',
      fieldType: 'date',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: refund.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(refund.updatedAt, moneySettings),
      helpText: 'Date/time the customer refund record was last modified.',
      fieldType: 'date',
    },
  } satisfies Record<string, CustomerRefundHeaderField>

  const receiptCurrencyCode =
    currencyCodeById.get(refund.cashReceipt?.invoice?.currencyId ?? '') ?? refundCurrencyCode ?? null
  const invoiceCurrencyCode =
    currencyCodeById.get(refund.cashReceipt?.invoice?.currencyId ?? '') ?? receiptCurrencyCode ?? null
  const salesOrderCurrencyCode =
    currencyCodeById.get(refund.cashReceipt?.invoice?.salesOrder?.currencyId ?? '') ?? invoiceCurrencyCode ?? null
  const quoteCurrencyCode =
    currencyCodeById.get(refund.cashReceipt?.invoice?.salesOrder?.quote?.currencyId ?? '') ?? salesOrderCurrencyCode ?? null
  const opportunityCurrencyCode =
    currencyCodeById.get(refund.cashReceipt?.invoice?.salesOrder?.quote?.opportunity?.currencyId ?? '') ?? quoteCurrencyCode ?? null
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

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(CUSTOMER_REFUND_REFERENCE_SOURCES, {
    customer: refund.customer,
    receipt: refund.cashReceipt,
    invoice: refund.cashReceipt?.invoice ?? null,
    salesOrder: refund.cashReceipt?.invoice?.salesOrder ?? null,
    quote: refund.cashReceipt?.invoice?.salesOrder?.quote ?? null,
    opportunity: refund.cashReceipt?.invoice?.salesOrder?.quote?.opportunity ?? null,
  }, {
    receipt: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? receiptCurrencyCode),
      currencyCode: receiptCurrencyCode,
    },
    invoice: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? invoiceCurrencyCode),
      currencyCode: invoiceCurrencyCode,
    },
    salesOrder: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? salesOrderCurrencyCode),
      currencyCode: salesOrderCurrencyCode,
    },
    quote: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? quoteCurrencyCode),
      currencyCode: quoteCurrencyCode,
    },
    opportunity: {
      formatDate: (value) => fmtDocumentDate(value, moneySettings),
      formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? opportunityCurrencyCode),
      currencyCode: opportunityCurrencyCode,
    },
  })
  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    CUSTOMER_REFUND_REFERENCE_SOURCES,
    {
      customer: refund.customer,
      receipt: refund.cashReceipt,
      invoice: refund.cashReceipt?.invoice ?? null,
      salesOrder: refund.cashReceipt?.invoice?.salesOrder ?? null,
      quote: refund.cashReceipt?.invoice?.salesOrder?.quote ?? null,
      opportunity: refund.cashReceipt?.invoice?.salesOrder?.quote?.opportunity ?? null,
    },
    {
      customer: `/customers/${refund.customerId}`,
      receipt: refund.cashReceiptId ? `/invoice-receipts/${refund.cashReceiptId}` : null,
      invoice: refund.cashReceipt?.invoice ? `/invoices/${refund.cashReceipt.invoice.id}` : null,
      salesOrder: refund.cashReceipt?.invoice?.salesOrder ? `/sales-orders/${refund.cashReceipt.invoice.salesOrder.id}` : null,
      quote: refund.cashReceipt?.invoice?.salesOrder?.quote ? `/quotes/${refund.cashReceipt.invoice.salesOrder.quote.id}` : null,
      opportunity: refund.cashReceipt?.invoice?.salesOrder?.quote?.opportunity ? `/opportunities/${refund.cashReceipt.invoice.salesOrder.quote.opportunity.id}` : null,
    },
    {
      receipt: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? receiptCurrencyCode),
        currencyCode: receiptCurrencyCode,
      },
      invoice: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? invoiceCurrencyCode),
        currencyCode: invoiceCurrencyCode,
      },
      salesOrder: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? salesOrderCurrencyCode),
        currencyCode: salesOrderCurrencyCode,
      },
      quote: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? quoteCurrencyCode),
        currencyCode: quoteCurrencyCode,
      },
      opportunity: {
        formatDate: (value) => fmtDocumentDate(value, moneySettings),
        formatCurrency: (value, currencyCode) => formatMonetaryValue(value as number | string | null | undefined, currencyCode ?? opportunityCurrencyCode),
        currencyCode: opportunityCurrencyCode,
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
    fxRateType: refund.cashReceipt?.fxRateType ?? null,
    fxRateSource: refund.cashReceipt?.fxRateSource ?? null,
    fxEffectiveDateLabel: refund.cashReceipt?.fxEffectiveDate ? fmtDocumentDate(refund.cashReceipt.fxEffectiveDate, moneySettings) : null,
    formatCurrency: formatMonetaryValue,
  })
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
    ...Object.fromEntries(currencyReadoutSection.fields.map((field) => [field.key, field])),
  }
  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: CUSTOMER_REFUND_DETAIL_FIELDS,
    fieldDefinitions: allFieldDefinitions,
    previewOverrides: {
      amount: fmtCurrency(refund.amount, refundCurrencyCode, moneySettings),
      date: fmtDocumentDate(refund.date, moneySettings),
      createdAt: fmtDocumentDate(refund.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(refund.updatedAt, moneySettings),
    },
  })
  const configuredHeaderSections = buildConfiguredTransactionSections({
    fields: CUSTOMER_REFUND_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: allFieldDefinitions,
    sectionDescriptions,
  })
  const configuredCurrencySection =
    configuredHeaderSections.find((section) => section.title === CURRENCY_READOUT_SECTION_TITLE) ?? currencyReadoutSection
  const headerSections = configuredHeaderSections.filter((section) => section.title !== CURRENCY_READOUT_SECTION_TITLE)
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = CUSTOMER_REFUND_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
      id: 'customer',
      label: 'Customer',
      getValue: (record: typeof refund) => record.customer.name,
      getHref: (record: typeof refund) => `/customers/${record.customerId}`,
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

  const relatedDocumentsCount =
    1 +
    (refund.cashReceipt?.invoice?.salesOrder?.quote?.opportunity ? 1 : 0) +
    (refund.cashReceipt?.invoice?.salesOrder?.quote ? 1 : 0) +
    (refund.cashReceipt?.invoice?.salesOrder ? 1 : 0) +
    (refund.cashReceipt ? 1 : 0) +
    (refund.cashReceipt?.invoice ? 1 : 0)

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/customer-refunds'}
      backLabel={isCustomizing ? '<- Back to Customer Refund Detail' : '<- Back to Customer Refunds'}
      meta={refund.number}
      title={`Customer Refund ${refund.number}`}
      widthClassName="w-full max-w-none"
      actions={
        <TransactionActionStack
          mode={isCustomizing ? 'customize' : 'detail'}
          cancelHref={detailHref}
          primaryActions={
            <>
              <MasterDataDetailCreateMenu
                newHref="/customer-refunds/new"
                duplicateHref={`/customer-refunds/new?duplicateFrom=${encodeURIComponent(refund.id)}`}
              />
              <MasterDataDetailExportMenu
                title={refund.number}
                fileName={`customer-refund-${refund.number}`}
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
              <DeleteButton resource="customer-refunds" id={refund.id} />
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
            visibleStatIds={CUSTOMER_REFUND_STAT_CARDS.map((card) => card.id)}
          />
        )}
        header={
          isCustomizing ? (
            <CustomerRefundDetailCustomizeMode
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
                description="Read the transaction, local, functional, and group amounts from the posted customer refund context."
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
                  containerDescription="Expanded context from linked records on this customer refund."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                editing={false}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Customer Refund Details"
                containerDescription="Customer refund, overpayment source, and disbursement details."
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
                key: 'customer',
                label: 'Customer',
                count: 1,
                emptyMessage: 'No related customer is linked to this customer refund.',
                rows: [
                  {
                    id: refund.customer.id,
                    type: 'Customer',
                    reference: refund.customer.customerId ?? refund.customer.id,
                    name: refund.customer.name,
                    details: [refund.customer.email, refund.customer.phone].filter(Boolean).join(' | ') || '-',
                    href: `/customers/${refund.customer.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <CustomerRefundRelatedDocuments
            embedded
            showDisplayControl={false}
            customer={null}
            defaultCurrencyCode={refundCurrencyCode}
            opportunity={
              refund.cashReceipt?.invoice?.salesOrder?.quote?.opportunity
                ? {
                    id: refund.cashReceipt.invoice.salesOrder.quote.opportunity.id,
                    number:
                      refund.cashReceipt.invoice.salesOrder.quote.opportunity.opportunityNumber
                      ?? refund.cashReceipt.invoice.salesOrder.quote.opportunity.id,
                    name: refund.cashReceipt.invoice.salesOrder.quote.opportunity.name,
                    status: refund.cashReceipt.invoice.salesOrder.quote.opportunity.stage,
                    total: Number(refund.cashReceipt.invoice.salesOrder.quote.opportunity.amount ?? 0),
                    currencyCode: opportunityCurrencyCode,
                  }
                : null
            }
            quote={
              refund.cashReceipt?.invoice?.salesOrder?.quote
                ? {
                    id: refund.cashReceipt.invoice.salesOrder.quote.id,
                    number: refund.cashReceipt.invoice.salesOrder.quote.number,
                    status: refund.cashReceipt.invoice.salesOrder.quote.status,
                    total: Number(refund.cashReceipt.invoice.salesOrder.quote.total),
                    currencyCode: quoteCurrencyCode,
                  }
                : null
            }
            salesOrder={
              refund.cashReceipt?.invoice?.salesOrder
                ? {
                    id: refund.cashReceipt.invoice.salesOrder.id,
                    number: refund.cashReceipt.invoice.salesOrder.number,
                    status: refund.cashReceipt.invoice.salesOrder.status,
                    total: Number(refund.cashReceipt.invoice.salesOrder.total),
                    currencyCode: salesOrderCurrencyCode,
                  }
                : null
            }
            receipt={
              refund.cashReceipt
                ? {
                    id: refund.cashReceipt.id,
                    number: refund.cashReceipt.number ?? refund.cashReceipt.id,
                    status: refund.cashReceipt.status,
                    amount: Number(refund.cashReceipt.amount),
                    currencyCode: receiptCurrencyCode,
                  }
                : null
            }
            invoice={
              refund.cashReceipt?.invoice
                ? {
                    id: refund.cashReceipt.invoice.id,
                    number: refund.cashReceipt.invoice.number,
                    status: refund.cashReceipt.invoice.status,
                    total: Number(refund.cashReceipt.invoice.total),
                    currencyCode: invoiceCurrencyCode,
                  }
                : null
            }
            moneySettings={moneySettings}
          />
        )}
        relatedDocumentsCount={relatedDocumentsCount}
        supplementarySections={
          isCustomizing ? null : (
            <InvoiceReceiptGlImpactSection
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
              counterpartyName: refund.customer.name,
              counterpartyEmail: refund.customer.email,
              fromEmail: refund.user?.email ?? null,
              status: formattedStatus,
                total: fmtCurrency(refund.amount, refundCurrencyCode, moneySettings),
              lineItems: [],
              sendEmailEndpoint: '/api/customer-refunds?action=send-email',
              recordIdFieldName: 'customerRefundId',
              documentLabel: 'Customer Refund',
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
