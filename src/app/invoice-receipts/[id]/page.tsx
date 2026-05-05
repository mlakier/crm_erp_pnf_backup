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
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import InvoiceReceiptDetailCustomizeMode from '@/components/InvoiceReceiptDetailCustomizeMode'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import SystemNotesSection from '@/components/SystemNotesSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import InvoiceReceiptRelatedDocuments from '@/components/InvoiceReceiptRelatedDocuments'
import InvoiceReceiptGlImpactSection from '@/components/InvoiceReceiptGlImpactSection'
import InvoiceReceiptDetailEditor from '@/components/InvoiceReceiptDetailEditor'
import InvoiceReceiptApplicationsSection from '@/components/InvoiceReceiptApplicationsSection'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionGlImpactRows,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
} from '@/lib/transaction-detail-helpers'
import {
  buildPostedCurrencyReadoutSection,
  CURRENCY_READOUT_SECTION_TITLE,
} from '@/lib/four-currency-readout'
import {
  roundMoney,
  type InvoiceReceiptApplicationInput,
} from '@/lib/invoice-receipt-applications'
import {
  INVOICE_RECEIPT_DETAIL_FIELDS,
  INVOICE_RECEIPT_REFERENCE_SOURCES,
  INVOICE_RECEIPT_STAT_CARDS,
  type InvoiceReceiptDetailFieldKey,
} from '@/lib/invoice-receipt-detail-customization'
import { loadInvoiceReceiptDetailCustomization } from '@/lib/invoice-receipt-detail-customization-store'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { loadDocumentRelationshipSummaries } from '@/lib/document-relationships'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

type InvoiceReceiptHeaderField = {
  key: InvoiceReceiptDetailFieldKey
} & RecordHeaderField

export default async function InvoiceReceiptDetailPage({
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

  const [receipt, receiptOpenItem, receiptApplicationFx, customization, invoices, paymentMethodValues, statusValues, cashAccounts, currencies, linkedDocuments] = await Promise.all([
    prisma.cashReceipt.findUnique({
      where: { id },
      include: {
        bankAccount: true,
        invoice: {
          include: {
            customer: true,
            subsidiary: true,
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
            cashReceipts: {
              orderBy: { date: 'desc' },
            },
          },
        },
        applications: {
          select: {
            invoiceId: true,
            appliedAmount: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'invoice-receipt',
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
    prisma.openItemApplication.aggregate({
      where: {
        settlementTransactionType: 'invoice-receipt',
        settlementTransactionId: id,
      },
      _sum: {
        realizedFxLocalAmount: true,
        realizedFxFunctionalAmount: true,
      },
    }),
    loadInvoiceReceiptDetailCustomization(),
    prisma.invoice.findMany({
      include: {
        customer: true,
        cashReceiptApplications: {
          include: {
            cashReceipt: {
              select: { id: true },
            },
          },
        },
        cashReceipts: {
          select: {
            id: true,
            amount: true,
            applications: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadListValues('PAYMENT-METHOD'),
    loadListValues('INV-RECEIPT-STATUS'),
    loadCashBankPostingAccounts(),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    loadDocumentRelationshipSummaries({
      recordType: 'invoice-receipt',
      recordId: id,
    }),
  ])

  if (!receipt) notFound()

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: receipt.id },
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
    glSourceNumberByKey.set(
      `${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`,
      receipt.number ?? receipt.id,
    )
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })

  const detailHref = `/invoice-receipts/${receipt.id}`
  const postingLocked = receipt.status.toLowerCase() === 'posted'
  const receiptApplications: InvoiceReceiptApplicationInput[] =
    receipt.applications.length > 0
      ? receipt.applications.map((application) => ({
          invoiceId: application.invoiceId,
          appliedAmount: Number(application.appliedAmount),
        }))
      : [{ invoiceId: receipt.invoiceId, appliedAmount: Number(receipt.amount) }]
  const invoiceOptions = invoices.map((invoice) => ({
    value: invoice.id,
    label: `${invoice.number} - ${invoice.customer.name}`,
  }))
  const bankAccountOptions = cashAccounts.map((account) => ({
    value: account.id,
    label: formatGlAccountLabel(account),
  }))
  const methodOptions = paymentMethodValues.map((value) => ({
    value: value.toLowerCase(),
    label: value,
  }))
  const statusOptions = statusValues.map((value) => ({
    value: value.toLowerCase(),
    label: value,
  }))
  const overpaymentHandlingOptions = [
    { value: '', label: 'Require Full Application' },
    { value: 'apply_to_future_invoices', label: 'Leave On Account' },
    { value: 'refund_pending', label: 'Refund Customer' },
  ]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const formattedStatus = formatRecordLabel(receipt.status, statusLabelMap)
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`]),
  )
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]),
  )
  const receiptCurrencyCode = currencyCodeById.get(receipt.invoice.currencyId ?? '') ?? null
  const formattedOverpaymentHandling =
    overpaymentHandlingOptions.find((option) => option.value === (receipt.overpaymentHandling ?? ''))?.label
    ?? 'Require Full Application'

  const sectionDescriptions: Record<string, string> = {
    'Document Identity': 'Primary invoice receipt identifier and linked invoice context.',
    'Customer Snapshot': 'Customer context derived from the linked invoice.',
    'Receipt Terms': 'Status, monetary amount, receipt date, payment method, and reference context.',
    'Record Keys': 'Internal database identifiers for this receipt.',
    'System Dates': 'System-managed timestamps for this receipt.',
  }
  const communicationsToolbarTargetId = 'invoice-receipt-communications-toolbar'
  const systemNotesToolbarTargetId = 'invoice-receipt-system-notes-toolbar'

  const receiptStats: TransactionStatDefinition<typeof receipt>[] = [
    {
      id: 'amount',
      label: 'Receipt Amount',
      accent: true,
        getValue: (record) => fmtCurrency(record.amount, receiptCurrencyCode ?? undefined, moneySettings),
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
      id: 'status',
      label: 'Status',
      getValue: () => formattedStatus,
    },
    {
      id: 'invoice',
      label: 'Invoice',
      getValue: (record) => record.invoice.number,
      getHref: (record) => `/invoices/${record.invoice.id}`,
      getValueTone: () => 'accent',
    },
  ]
  const statPreviewCards = receiptStats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(receipt),
    href: stat.getHref?.(receipt) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(receipt),
    cardTone: stat.getCardTone?.(receipt),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
  }))
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

  const headerFieldDefinitions: Record<string, InvoiceReceiptHeaderField> = {
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
      label: 'Anchor Invoice',
      value: receipt.invoiceId,
      displayValue: (
        receiptApplications.length > 1
          ? `${receiptApplications.length} applied invoices`
          : (
            <Link href={`/invoices/${receipt.invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              {receipt.invoice.number}
            </Link>
          )
      ),
      editable: !postingLocked,
      type: 'select',
      options: invoiceOptions,
      helpText: postingLocked
        ? 'Invoice applications are locked after this receipt has posted to GL.'
        : 'Select an invoice to establish customer context for the receipt applications below.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: receipt.invoice.subsidiaryId ?? '',
      displayValue: receipt.invoice.subsidiary
        ? `${receipt.invoice.subsidiary.subsidiaryId} - ${receipt.invoice.subsidiary.name}`
        : '-',
      helpText: 'Subsidiary inherited from the linked invoice posting context.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
      href: receipt.invoice.subsidiaryId ? `/subsidiaries/${receipt.invoice.subsidiaryId}` : undefined,
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: receipt.invoice.currencyId ?? '',
      displayValue: receipt.invoice.currency
        ? `${receipt.invoice.currency.code ?? receipt.invoice.currency.currencyId} - ${receipt.invoice.currency.name}`
        : '-',
      helpText: 'Transaction currency inherited from the linked invoice posting context.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
      href: receipt.invoice.currencyId ? `/currencies/${receipt.invoice.currencyId}` : undefined,
    },
    bankAccountId: {
      key: 'bankAccountId',
      label: 'Bank Account',
      value: receipt.bankAccountId ?? '',
      displayValue: receipt.bankAccount ? formatGlAccountLabel(receipt.bankAccount) : '-',
      href: receipt.bankAccount ? `/chart-of-accounts/${receipt.bankAccount.id}` : null,
      editable: !postingLocked,
      type: 'select',
      options: bankAccountOptions,
      helpText: postingLocked
        ? 'Bank account is locked after this receipt has posted to GL.'
        : 'Cash or bank GL account that receives this receipt.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: receipt.status,
      displayValue: formattedStatus,
      editable: !postingLocked,
      type: 'select',
      options: statusOptions,
      helpText: postingLocked
        ? 'Status is locked after this receipt has posted to GL.'
        : 'Draft receipts can remain unapplied; posted receipts must be fully applied before they post to GL.',
      fieldType: 'list',
      sourceText: 'Invoice receipt status list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    overpaymentHandling: {
      key: 'overpaymentHandling',
      label: 'Overpayment Handling',
      value: receipt.overpaymentHandling ?? '',
      displayValue: formattedOverpaymentHandling,
      editable: !postingLocked,
      type: 'select',
      options: overpaymentHandlingOptions,
      helpText: postingLocked
        ? 'Overpayment handling is locked after this receipt has posted to GL.'
        : 'Choose whether any posted overpayment stays on account or should be refunded.',
      fieldType: 'list',
      sourceText: 'Invoice receipt overpayment policy',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: String(receipt.amount),
      displayValue: fmtCurrency(receipt.amount, receiptCurrencyCode ?? undefined, moneySettings),
      editable: !postingLocked,
      type: 'number',
      helpText: postingLocked
        ? 'Receipt amount is locked after this receipt has posted to GL.'
        : 'Enter the total receipt amount, then allocate it across open invoices below.',
      fieldType: 'currency',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    date: {
      key: 'date',
      label: 'Receipt Date',
      value: receipt.date.toISOString().slice(0, 10),
      displayValue: fmtDocumentDate(receipt.date, moneySettings),
      editable: !postingLocked,
      type: 'date',
      helpText: postingLocked
        ? 'Receipt date is locked after this receipt has posted to GL.'
        : 'Date the receipt was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    method: {
      key: 'method',
      label: 'Method',
      value: receipt.method,
      editable: !postingLocked,
      type: 'select',
      options: methodOptions,
      helpText: postingLocked
        ? 'Payment method is locked after this receipt has posted to GL.'
        : 'Method used to receive payment.',
      fieldType: 'list',
      sourceText: 'Payment method list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    reference: {
      key: 'reference',
      label: 'Reference',
      value: receipt.reference ?? '',
      displayValue: receipt.reference ?? '-',
      editable: !postingLocked,
      type: 'text',
      helpText: postingLocked
        ? 'Reference is locked after this receipt has posted to GL.'
        : 'Reference number or memo for the receipt.',
      fieldType: 'text',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
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

  const customerHref = `/customers/${receipt.invoice.customer.id}`
  const invoiceHref = `/invoices/${receipt.invoice.id}`

  headerFieldDefinitions.customerNumber.href = customerHref
  headerFieldDefinitions.invoiceId.href = invoiceHref

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(INVOICE_RECEIPT_REFERENCE_SOURCES, {
    invoice: receipt.invoice,
  }, {
    invoice: invoiceHref,
  })
  const invoiceReferenceCurrencyCode =
    currencyCodeById.get(receipt.invoice.currencyId ?? '') ?? null
  if (referenceFieldDefinitions.invoiceTotal) {
    referenceFieldDefinitions.invoiceTotal = {
      ...referenceFieldDefinitions.invoiceTotal,
      displayValue: fmtCurrency(receipt.invoice.total, invoiceReferenceCurrencyCode ?? undefined, moneySettings),
      value: String(receipt.invoice.total),
    }
  }
  if (referenceFieldDefinitions.invoiceDueDate) {
    referenceFieldDefinitions.invoiceDueDate = {
      ...referenceFieldDefinitions.invoiceDueDate,
      displayValue: receipt.invoice.dueDate ? fmtDocumentDate(receipt.invoice.dueDate, moneySettings) : '-',
      value: receipt.invoice.dueDate?.toISOString?.() ?? (receipt.invoice.dueDate ? String(receipt.invoice.dueDate) : ''),
    }
  }
  if (referenceFieldDefinitions.invoiceCreatedAt) {
    referenceFieldDefinitions.invoiceCreatedAt = {
      ...referenceFieldDefinitions.invoiceCreatedAt,
      displayValue: fmtDocumentDate(receipt.invoice.createdAt, moneySettings),
      value: receipt.invoice.createdAt.toISOString(),
    }
  }
  if (referenceFieldDefinitions.invoiceUpdatedAt) {
    referenceFieldDefinitions.invoiceUpdatedAt = {
      ...referenceFieldDefinitions.invoiceUpdatedAt,
      displayValue: fmtDocumentDate(receipt.invoice.updatedAt, moneySettings),
      value: receipt.invoice.updatedAt.toISOString(),
    }
  }
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: INVOICE_RECEIPT_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
        amount: fmtCurrency(receipt.amount, receiptCurrencyCode ?? undefined, moneySettings),
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
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(INVOICE_RECEIPT_REFERENCE_SOURCES, {
    invoice: receipt.invoice,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = INVOICE_RECEIPT_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const formatMonetaryValue = (
    value: number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode?: string | null,
  ) => fmtCurrency(value, currencyCode ?? undefined, moneySettings)
  const currencyReadoutSection = buildPostedCurrencyReadoutSection({
    postingStatus: receiptOpenItem
      ? receiptOpenItem.isOpen
        ? `Posted to open item (${receiptOpenItem.status})`
        : `Posted and settled (${receiptOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: receiptOpenItem?.id ?? null,
    openItemNumber: receiptOpenItem?.openItemNumber ?? null,
    transactionAmount: receiptOpenItem?.originalTransactionAmount ?? receipt.amount,
    transactionCurrencyCode: currencyCodeById.get(receiptOpenItem?.transactionCurrencyId ?? receipt.invoice.currencyId ?? '') ?? null,
    transactionCurrencyLabel:
      currencyLabelById.get(receiptOpenItem?.transactionCurrencyId ?? receipt.invoice.currencyId ?? '') ??
      null,
    localAmount: receiptOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(receiptOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(receiptOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: receiptOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(receiptOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(receiptOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: receiptOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(receiptOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(receiptOpenItem?.groupCurrencyId ?? '') ?? null,
    realizedFxLocalAmount: receiptApplicationFx._sum.realizedFxLocalAmount,
    realizedFxFunctionalAmount: receiptApplicationFx._sum.realizedFxFunctionalAmount,
    fxRateType: receipt.fxRateType ?? null,
    fxRateSource: receipt.fxRateSource ?? null,
    fxEffectiveDateLabel: receipt.fxEffectiveDate ? fmtDocumentDate(receipt.fxEffectiveDate, moneySettings) : null,
    formatCurrency: formatMonetaryValue,
  })
  const fieldDefinitionsWithCurrency: Record<string, RecordHeaderField> = {
    ...allFieldDefinitions,
    ...Object.fromEntries(currencyReadoutSection.fields.map((field) => [field.key, field])),
  }
  const customizeFieldsWithCurrency = [
    ...customizeFields,
  ]
  const configuredHeaderSections = buildConfiguredTransactionSections({
    fields: INVOICE_RECEIPT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: fieldDefinitionsWithCurrency,
    sectionDescriptions: {
      ...sectionDescriptions,
      [CURRENCY_READOUT_SECTION_TITLE]: 'Read the transaction, local, functional, and group amounts from the posted invoice receipt context.',
    },
  })
  const configuredCurrencySection =
    configuredHeaderSections.find((section) => section.title === CURRENCY_READOUT_SECTION_TITLE) ?? currencyReadoutSection
  const headerSections = configuredHeaderSections.filter((section) => section.title !== CURRENCY_READOUT_SECTION_TITLE)
  const transactionCurrencyCode =
    currencyCodeById.get(receiptOpenItem?.transactionCurrencyId ?? receipt.invoice.currencyId ?? '') ?? null
  const localCurrencyCode = currencyCodeById.get(receiptOpenItem?.localCurrencyId ?? '') ?? null
  const functionalCurrencyCode = currencyCodeById.get(receiptOpenItem?.functionalCurrencyId ?? '') ?? null
  const groupCurrencyCode = currencyCodeById.get(receiptOpenItem?.groupCurrencyId ?? '') ?? null

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/invoice-receipts'}
      backLabel={isCustomizing ? '<- Back to Invoice Receipt Detail' : '<- Back to Invoice Receipts'}
      meta={receipt.number ?? receipt.id}
      title={receipt.invoice.customer.name}
      widthClassName="w-full max-w-none"
      actions={
        <TransactionActionStack
          mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
          cancelHref={detailHref}
          formId={`inline-record-form-${receipt.id}`}
          recordId={receipt.id}
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
                <DeleteButton resource="invoice-receipts" id={receipt.id} />
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
              record={receipt}
              stats={receiptStats}
              visibleStatCards={customization.statCards}
              visibleStatIds={INVOICE_RECEIPT_STAT_CARDS.map((card) => card.id)}
            />
          )
        }
        header={
          isCustomizing ? (
              <InvoiceReceiptDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFieldsWithCurrency}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={sectionDescriptions}
                statPreviewCards={statPreviewCards}
              />
          ) : (
            <div className="space-y-6">
              <TransactionFourCurrencySection
                section={configuredCurrencySection}
                layout={customization}
                description="Read the transaction, local, functional, and group amounts from the posted invoice receipt context."
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
                  containerDescription="Expanded context from linked records on this invoice receipt."
                  showSubsections={false}
                />
              ) : null}
              {isEditing ? (
                <InvoiceReceiptDetailEditor
                  receiptId={receipt.id}
                  detailHref={detailHref}
                  customization={customization}
                  invoices={invoices.map((invoice) => ({
                    id: invoice.id,
                    number: invoice.number,
                    customerId: invoice.customer.id,
                    customerName: invoice.customer.name,
                    status: invoice.status,
                    total: Number(invoice.total),
                    date: invoice.createdAt,
                    subsidiaryId: invoice.subsidiaryId ?? null,
                    currencyId: invoice.currencyId ?? null,
                    currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                    userId: invoice.userId ?? null,
                    openAmount: roundMoney(Number(invoice.total) - invoice.cashReceiptApplications.reduce((sum, application) => {
                      if (application.cashReceiptId === receipt.id) return sum
                      return sum + Number(application.appliedAmount)
                    }, 0) - invoice.cashReceipts.reduce((sum, cashReceipt) => {
                      if (cashReceipt.id === receipt.id) return sum
                      if (cashReceipt.applications.length > 0) return sum
                      return sum + Number(cashReceipt.amount)
                    }, 0)),
                  }))}
                  methodOptions={methodOptions}
                  statusOptions={statusOptions}
                  bankAccountOptions={bankAccountOptions}
                  initialHeaderValues={{
                    id: receipt.id,
                    number: receipt.number ?? '',
                    invoiceId: receipt.invoiceId,
                    bankAccountId: receipt.bankAccountId ?? '',
                    status: receipt.status,
                    overpaymentHandling: receipt.overpaymentHandling ?? '',
                    amount: String(receipt.amount),
                    date: receipt.date.toISOString().slice(0, 10),
                    method: receipt.method,
                    reference: receipt.reference ?? '',
                    createdAt: receipt.createdAt.toISOString(),
                    createdAtDisplay: fmtDocumentDate(receipt.createdAt, moneySettings),
                    updatedAt: receipt.updatedAt.toISOString(),
                    updatedAtDisplay: fmtDocumentDate(receipt.updatedAt, moneySettings),
                  }}
                  initialApplications={receiptApplications}
                  moneySettings={moneySettings}
                />
              ) : (
                <RecordHeaderDetails
                  purchaseOrderId={receipt.id}
                  editing={false}
                  sections={headerSections}
                  columns={customization.formColumns}
                  containerTitle="Invoice Receipt Details"
                  containerDescription="Core invoice receipt fields organized into configurable sections."
                  showSubsections={false}
                />
              )}
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
                emptyMessage: 'No related customer is linked to this invoice receipt.',
                rows: [
                  {
                    id: receipt.invoice.customer.id,
                    type: 'Customer',
                    reference: receipt.invoice.customer.customerId ?? receipt.invoice.customer.id,
                    name: receipt.invoice.customer.name,
                    details:
                      [receipt.invoice.customer.email, receipt.invoice.customer.phone].filter(Boolean).join(' | ') || '-',
                    href: `/customers/${receipt.invoice.customer.id}`,
                  },
                ],
              },
            ]}
          />
        )}
        relatedRecordsCount={1}
        relatedDocuments={isCustomizing ? null : (
          <InvoiceReceiptRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={receiptCurrencyCode}
            invoice={{
              id: receipt.invoice.id,
              number: receipt.invoice.number,
              status: receipt.invoice.status,
              total: Number(receipt.invoice.total),
              currencyCode: invoiceReferenceCurrencyCode,
            }}
            salesOrder={
              receipt.invoice.salesOrder
                ? {
                    id: receipt.invoice.salesOrder.id,
                    number: receipt.invoice.salesOrder.number,
                    status: receipt.invoice.salesOrder.status,
                    total: Number(receipt.invoice.salesOrder.total),
                    currencyCode: receiptCurrencyCode,
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
                    currencyCode: receiptCurrencyCode,
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
                    currencyCode: receiptCurrencyCode,
                  }
                : null
            }
            linkedDocuments={linkedDocuments}
            moneySettings={moneySettings}
          />
        )}
        relatedDocumentsCount={
          1 +
          (receipt.invoice.salesOrder ? 1 : 0) +
          (receipt.invoice.salesOrder?.quote ? 1 : 0) +
          (receipt.invoice.salesOrder?.quote?.opportunity ? 1 : 0) +
          linkedDocuments.length
        }
        supplementarySections={
          isCustomizing ? null : (
            <>
              {!isEditing ? (
                <InvoiceReceiptApplicationsSection
                  invoices={invoices.map((invoice) => ({
                    id: invoice.id,
                    number: invoice.number,
                    customerId: invoice.customer.id,
                    customerName: invoice.customer.name,
                    status: invoice.status,
                    total: Number(invoice.total),
                    date: invoice.createdAt,
                    subsidiaryId: invoice.subsidiaryId ?? null,
                    currencyId: invoice.currencyId ?? null,
                    currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                    userId: invoice.userId ?? null,
                    openAmount: roundMoney(Number(invoice.total) - invoice.cashReceiptApplications.reduce((sum, application) => {
                      if (application.cashReceiptId === receipt.id) return sum
                      return sum + Number(application.appliedAmount)
                    }, 0) - invoice.cashReceipts.reduce((sum, cashReceipt) => {
                      if (cashReceipt.id === receipt.id) return sum
                      if (cashReceipt.applications.length > 0) return sum
                      return sum + Number(cashReceipt.amount)
                    }, 0)),
                  }))}
                  selectedCustomerId={receipt.invoice.customer.id}
                  receiptAmount={Number(receipt.amount)}
                  applications={receiptApplications}
                  requiresFullApplication={receipt.status.toLowerCase() === 'posted'}
                  overpaymentHandling={receipt.overpaymentHandling ?? ''}
                  moneySettings={moneySettings}
                  receiptCurrencyCode={receiptCurrencyCode}
                />
              ) : null}
              <InvoiceReceiptGlImpactSection
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
            </>
          )
        }
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId={communicationsToolbarTargetId}
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: receipt.id,
              number: receipt.number ?? receipt.id,
              counterpartyName: receipt.invoice.customer.name,
              counterpartyEmail: receipt.invoice.customer.email ?? null,
              status: formattedStatus,
                total: fmtCurrency(receipt.amount, receiptCurrencyCode ?? undefined, moneySettings),
              lineItems: [],
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
