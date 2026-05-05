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
import BillPaymentDetailCustomizeMode from '@/components/BillPaymentDetailCustomizeMode'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import SystemNotesSection from '@/components/SystemNotesSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import BillPaymentRelatedDocuments from '@/components/BillPaymentRelatedDocuments'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import BillPaymentGlImpactSection from '@/components/BillPaymentGlImpactSection'
import BillPaymentApplicationsSection from '@/components/BillPaymentApplicationsSection'
import BillPaymentDetailEditor from '@/components/BillPaymentDetailEditor'
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
  BILL_PAYMENT_DETAIL_FIELDS,
  BILL_PAYMENT_REFERENCE_SOURCES,
  BILL_PAYMENT_STAT_CARDS,
  type BillPaymentDetailFieldKey,
} from '@/lib/bill-payment-detail-customization'
import { loadBillPaymentDetailCustomization } from '@/lib/bill-payment-detail-customization-store'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'
import {
  roundMoney,
  type BillPaymentApplicationInput,
} from '@/lib/bill-payment-applications'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { loadDocumentRelationshipSummaries } from '@/lib/document-relationships'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

type BillPaymentHeaderField = {
  key: BillPaymentDetailFieldKey
} & RecordHeaderField

export default async function BillPaymentDetailPage({
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

  const [payment, paymentOpenItem, paymentApplicationFx, statusValues, methodValues, customization, cashAccounts, vendors, candidateBills, currencies, linkedDocuments] = await Promise.all([
    prisma.billPayment.findUnique({
      where: { id },
      include: {
        vendor: true,
        bankAccount: true,
        bill: {
          include: {
            vendor: true,
            subsidiary: true,
            currency: true,
            purchaseOrder: {
              include: {
                vendor: true,
                user: true,
                requisition: true,
                receipts: true,
              },
            },
          },
        },
        applications: {
          select: {
            billId: true,
            appliedAmount: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'bill-payment',
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
        settlementTransactionType: 'bill-payment',
        settlementTransactionId: id,
      },
      _sum: {
        realizedFxLocalAmount: true,
        realizedFxFunctionalAmount: true,
      },
    }),
    loadListValues('BILL-PAYMENT-STATUS'),
    loadListValues('PAYMENT-METHOD'),
    loadBillPaymentDetailCustomization(),
    loadCashBankPostingAccounts(),
    prisma.vendor.findMany({
      where: { inactive: false },
      orderBy: [{ vendorNumber: 'asc' }, { name: 'asc' }],
    }),
    prisma.bill.findMany({
      include: {
        vendor: true,
        paymentApplications: {
          include: {
            billPayment: {
              select: { id: true, status: true },
            },
          },
        },
        billPayments: {
          select: {
            id: true,
            amount: true,
            status: true,
            applications: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    loadDocumentRelationshipSummaries({
      recordType: 'bill-payment',
      recordId: id,
    }),
  ])

  if (!payment) notFound()

  const appliedBillIds = Array.from(
    new Set(
      payment.applications.map((application) => application.billId).filter(Boolean),
    ),
  )
  const allBillIds = Array.from(
    new Set([payment.billId, ...appliedBillIds].filter((value): value is string => Boolean(value))),
  )

  const [applicationBillRecords, nestedApplications, legacyBillPayments] = await Promise.all([
    allBillIds.length > 0
      ? prisma.bill.findMany({
          where: { id: { in: allBillIds } },
          include: {
            vendor: true,
            subsidiary: true,
            currency: true,
            purchaseOrder: {
              include: {
                vendor: true,
                user: true,
                requisition: true,
                receipts: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    allBillIds.length > 0
      ? prisma.billPaymentApplication.findMany({
          where: { billId: { in: allBillIds } },
          include: {
            billPayment: {
              select: { id: true, status: true },
            },
          },
        })
      : Promise.resolve([]),
    allBillIds.length > 0
      ? prisma.billPayment.findMany({
          where: { billId: { in: allBillIds } },
          select: {
            id: true,
            billId: true,
            amount: true,
            status: true,
            applications: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const billById = new Map(applicationBillRecords.map((bill) => [bill.id, bill]))
  const primaryBill = (payment.billId ? billById.get(payment.billId) : null) ?? payment.bill ?? null

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: payment.id },
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
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, payment.number)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })

  const detailHref = `/bill-payments/${payment.id}`
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`]),
  )
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]),
  )
  const paymentApplications: BillPaymentApplicationInput[] =
    payment.applications.length > 0
      ? payment.applications.map((application) => ({
          billId: application.billId,
          appliedAmount: Number(application.appliedAmount),
        }))
      : payment.billId
        ? [{ billId: payment.billId, appliedAmount: Number(payment.amount) }]
        : []

  const applicationBills =
    payment.applications.length > 0
      ? payment.applications.flatMap((application) => {
          const bill = billById.get(application.billId)
          if (!bill) return []
          const appliedViaApplications = nestedApplications.reduce((sum, nestedApplication) => {
            if (nestedApplication.billId !== application.billId) return sum
            if (nestedApplication.billPaymentId === payment.id) return sum
            if ((nestedApplication.billPayment.status ?? '').toLowerCase() === 'cancelled') return sum
            return sum + Number(nestedApplication.appliedAmount)
          }, 0)
          const appliedViaLegacyPayments = legacyBillPayments.reduce((sum, legacyPayment) => {
            if (legacyPayment.billId !== application.billId) return sum
            if (legacyPayment.id === payment.id) return sum
            if ((legacyPayment.status ?? '').toLowerCase() === 'cancelled') return sum
            if (legacyPayment.applications.length > 0) return sum
            return sum + Number(legacyPayment.amount)
          }, 0)

          return [{
            id: bill.id,
            number: bill.number,
            vendorId: bill.vendorId,
            vendorName: bill.vendor.name,
            status: bill.status,
            total: Number(bill.total),
            date: bill.date,
            subsidiaryId: bill.subsidiaryId ?? null,
            currencyId: bill.currencyId ?? null,
            currencyCode: currencyCodeById.get(bill.currencyId ?? '') ?? null,
            userId: bill.userId ?? null,
            openAmount: roundMoney(Number(bill.total) - appliedViaApplications - appliedViaLegacyPayments),
          }]
        })
      : primaryBill
        ? [{
            id: primaryBill.id,
            number: primaryBill.number,
            vendorId: primaryBill.vendorId,
            vendorName: primaryBill.vendor.name,
            status: primaryBill.status,
            total: Number(primaryBill.total),
            date: primaryBill.date,
            subsidiaryId: primaryBill.subsidiaryId ?? null,
            currencyId: primaryBill.currencyId ?? null,
            currencyCode: currencyCodeById.get(primaryBill.currencyId ?? '') ?? null,
            userId: primaryBill.userId ?? null,
            openAmount: 0,
          }]
        : []
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const formattedStatus = formatRecordLabel(payment.status, statusLabelMap)
  const paymentCurrencyCode =
    currencyCodeById.get(paymentOpenItem?.transactionCurrencyId ?? primaryBill?.currencyId ?? '') ?? null
  const statusOptions = statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))
  const methodOptions = methodValues.map((value) => ({ value: value.toLowerCase(), label: value }))
  const bankAccountOptions = cashAccounts.map((account) => ({
    value: account.id,
    label: formatGlAccountLabel(account),
  }))
  const relatedMasterDataTabs = [
    payment.vendor
      ? {
          key: 'vendors',
          label: 'Vendors',
          count: 1,
          emptyMessage: 'No linked vendors.',
          rows: [
            {
              id: payment.vendor.id,
              type: 'Vendor',
              reference: payment.vendor.vendorNumber ?? payment.vendor.id,
              name: payment.vendor.name,
              details: payment.vendor.email ?? payment.vendor.phone ?? 'Linked vendor',
              href: `/vendors/${payment.vendor.id}`,
            },
          ],
        }
      : null,
    payment.bankAccount
      ? {
          key: 'gl-accounts',
          label: 'GL Accounts',
          count: 1,
          emptyMessage: 'No linked GL accounts.',
          rows: [
            {
              id: payment.bankAccount.id,
              type: 'Posting Account',
              reference: payment.bankAccount.accountNumber ?? payment.bankAccount.accountId,
              name: payment.bankAccount.name,
              details: 'Linked bank / cash posting account',
              href: `/chart-of-accounts/${payment.bankAccount.id}`,
            },
          ],
        }
      : null,
  ].filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))

  const sectionDescriptions: Record<string, string> = {
    'Document Identity': 'Core bill payment identifiers and source-bill context.',
    'Payment Terms': 'Amount, timing, method, status, and payment notes.',
    'Record Keys': 'Internal and linked transaction identifiers for this bill payment.',
    'System Dates': 'System-managed timestamps for this bill payment.',
  }

  const billPaymentStats: TransactionStatDefinition<typeof payment>[] = [
    {
      id: 'amount',
      label: 'Payment Amount',
      accent: true,
        getValue: (record) => fmtCurrency(record.amount, paymentCurrencyCode ?? undefined, moneySettings),
      getValueTone: () => 'accent',
    },
    {
      id: 'status',
      label: 'Status',
      getValue: () => formattedStatus,
      getValueTone: () =>
        payment.status === 'completed'
          ? 'green'
          : payment.status === 'processed'
            ? 'accent'
            : payment.status === 'pending'
              ? 'yellow'
              : payment.status === 'cancelled'
                ? 'red'
                : 'default',
    },
    {
      id: 'date',
      label: 'Date',
      getValue: (record) => fmtDocumentDate(record.date, moneySettings),
    },
    {
      id: 'bill',
      label: 'Vendor',
      getValue: (record) => record.vendor?.name ?? record.bill?.vendor?.name ?? '-',
      getValueTone: () => 'accent',
    },
  ]

  const statPreviewCards = billPaymentStats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(payment),
    href: stat.getHref?.(payment) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(payment),
    cardTone: stat.getCardTone?.(payment),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
  }))

  const activities = await prisma.activity.findMany({
    where: {
      entityType: 'bill-payment',
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

  const headerFieldDefinitions: Record<string, BillPaymentHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: payment.id,
      helpText: 'Internal database identifier for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this bill payment.',
    },
    number: {
      key: 'number',
      label: 'Bill Payment Id',
      value: payment.number,
      helpText: 'Identifier for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: payment.vendorId ?? '',
      displayValue: payment.vendor ? (
        <Link href={`/vendors/${payment.vendor.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {payment.vendor.vendorNumber ? `${payment.vendor.vendorNumber} - ${payment.vendor.name}` : payment.vendor.name}
        </Link>
      ) : '-',
      helpText: 'Vendor this payment is being applied against.',
      fieldType: 'list',
      sourceText: 'Vendor record',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
      href: payment.vendor ? `/vendors/${payment.vendor.id}` : undefined,
    },
    billId: {
      key: 'billId',
      label: 'Bill',
      value: payment.billId ?? '',
      displayValue:
        payment.applications.length > 0
          ? `${payment.applications.length} applied bill${payment.applications.length === 1 ? '' : 's'}`
          : primaryBill ? (
              <Link href={`/bills/${primaryBill.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {primaryBill.number}
              </Link>
            ) : '-',
      helpText: 'Primary linked bill derived from the applied bill rows below.',
      fieldType: 'text',
      sourceText: 'Bill transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
      href: payment.applications.length === 0 && primaryBill ? `/bills/${primaryBill.id}` : undefined,
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: primaryBill?.subsidiaryId ?? '',
      displayValue: primaryBill?.subsidiary
        ? `${primaryBill.subsidiary.subsidiaryId} - ${primaryBill.subsidiary.name}`
        : '-',
      helpText: 'Subsidiary derived from the applied bill posting context.',
      fieldType: 'list',
      sourceText: 'Bill transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
      href: primaryBill?.subsidiaryId ? `/subsidiaries/${primaryBill.subsidiaryId}` : undefined,
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: primaryBill?.currencyId ?? '',
      displayValue: primaryBill?.currency
        ? `${primaryBill.currency.code ?? primaryBill.currency.currencyId} - ${primaryBill.currency.name}`
        : '-',
      helpText: 'Transaction currency derived from the applied bill posting context.',
      fieldType: 'list',
      sourceText: 'Bill transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
      href: primaryBill?.currencyId ? `/currencies/${primaryBill.currencyId}` : undefined,
    },
    bankAccountId: {
      key: 'bankAccountId',
      label: 'Bank Account',
      value: payment.bankAccountId ?? '',
      displayValue: payment.bankAccount ? formatGlAccountLabel(payment.bankAccount) : '-',
      href: payment.bankAccount ? `/chart-of-accounts/${payment.bankAccount.id}` : null,
      editable: true,
      type: 'select',
      options: bankAccountOptions,
      helpText: 'Cash or bank GL account used for this payment.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: String(payment.amount),
      displayValue: fmtCurrency(payment.amount, paymentCurrencyCode ?? undefined, moneySettings),
      helpText: paymentApplications.length > 0 ? 'Payment amount derived from the bill applications below.' : 'Payment amount applied to the bill.',
      fieldType: 'currency',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: payment.date.toISOString().slice(0, 10),
      displayValue: fmtDocumentDate(payment.date, moneySettings),
      editable: true,
      type: 'date',
      helpText: 'Date the bill payment was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    method: {
      key: 'method',
      label: 'Method',
      value: payment.method ?? '',
      displayValue: payment.method ?? '-',
      editable: true,
      type: 'select',
      options: methodOptions,
      helpText: 'Payment method used for this bill payment.',
      fieldType: 'list',
      sourceText: 'Payment method list',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    reference: {
      key: 'reference',
      label: 'Reference',
      value: payment.reference ?? '',
      displayValue: payment.reference ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Reference number or memo for this payment.',
      fieldType: 'text',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: payment.status,
      displayValue: formattedStatus,
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Status of this bill payment.',
      fieldType: 'list',
      sourceText: 'Bill payment status list',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: payment.notes ?? '',
      displayValue: payment.notes ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Free-form notes for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: payment.createdAt.toISOString(),
      displayValue: fmtDocumentDate(payment.createdAt, moneySettings),
      helpText: 'Date/time the bill payment record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill payment.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: payment.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(payment.updatedAt, moneySettings),
      helpText: 'Date/time the bill payment record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill payment.',
    },
  }

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    BILL_PAYMENT_REFERENCE_SOURCES,
    primaryBill ? { bill: primaryBill } : {},
    primaryBill ? { bill: `/bills/${primaryBill.id}` } : {},
  )

  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: BILL_PAYMENT_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
        amount: fmtCurrency(payment.amount, paymentCurrencyCode ?? undefined, moneySettings),
      date: fmtDocumentDate(payment.date, moneySettings),
      createdAt: fmtDocumentDate(payment.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(payment.updatedAt, moneySettings),
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

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(
    BILL_PAYMENT_REFERENCE_SOURCES,
    primaryBill ? { bill: primaryBill } : {},
  )

  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = BILL_PAYMENT_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
    postingStatus: paymentOpenItem
      ? paymentOpenItem.isOpen
        ? `Posted to open item (${paymentOpenItem.status})`
        : `Posted and settled (${paymentOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: paymentOpenItem?.id ?? null,
    openItemNumber: paymentOpenItem?.openItemNumber ?? null,
    transactionAmount: paymentOpenItem?.originalTransactionAmount ?? payment.amount,
    transactionCurrencyCode: currencyCodeById.get(paymentOpenItem?.transactionCurrencyId ?? primaryBill?.currencyId ?? '') ?? null,
    transactionCurrencyLabel:
      currencyLabelById.get(paymentOpenItem?.transactionCurrencyId ?? primaryBill?.currencyId ?? '') ??
      null,
    localAmount: paymentOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(paymentOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(paymentOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: paymentOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(paymentOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(paymentOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: paymentOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(paymentOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(paymentOpenItem?.groupCurrencyId ?? '') ?? null,
    realizedFxLocalAmount: paymentApplicationFx._sum.realizedFxLocalAmount,
    realizedFxFunctionalAmount: paymentApplicationFx._sum.realizedFxFunctionalAmount,
    fxRateType: payment.fxRateType ?? null,
    fxRateSource: payment.fxRateSource ?? null,
    fxEffectiveDateLabel: payment.fxEffectiveDate ? fmtDocumentDate(payment.fxEffectiveDate, moneySettings) : null,
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
    fields: BILL_PAYMENT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: fieldDefinitionsWithCurrency,
    sectionDescriptions: {
      ...sectionDescriptions,
      [CURRENCY_READOUT_SECTION_TITLE]: 'Read the transaction, local, functional, and group amounts from the posted bill payment context.',
    },
  })
  const configuredCurrencySection =
    configuredHeaderSections.find((section) => section.title === CURRENCY_READOUT_SECTION_TITLE) ?? currencyReadoutSection
  const headerSections = configuredHeaderSections.filter((section) => section.title !== CURRENCY_READOUT_SECTION_TITLE)
  const transactionCurrencyCode =
    currencyCodeById.get(paymentOpenItem?.transactionCurrencyId ?? primaryBill?.currencyId ?? '') ?? null
  const localCurrencyCode = currencyCodeById.get(paymentOpenItem?.localCurrencyId ?? '') ?? null
  const functionalCurrencyCode = currencyCodeById.get(paymentOpenItem?.functionalCurrencyId ?? '') ?? null
  const groupCurrencyCode = currencyCodeById.get(paymentOpenItem?.groupCurrencyId ?? '') ?? null

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/bill-payments'}
      backLabel={isCustomizing ? '<- Back to Bill Payment Detail' : '<- Back to Bill Payments'}
      meta={payment.number}
      title={`Bill Payment for ${payment.vendor?.name ?? primaryBill?.vendor?.name ?? 'Vendor'}`}
      widthClassName="w-full max-w-none"
      actions={
        <TransactionActionStack
          mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
          cancelHref={detailHref}
          formId={`inline-record-form-${payment.id}`}
          recordId={payment.id}
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
                  newHref="/bill-payments/new"
                  duplicateHref={`/bill-payments/new?duplicateFrom=${encodeURIComponent(payment.id)}`}
                />
                <MasterDataDetailExportMenu
                  title={payment.number}
                  fileName={`bill-payment-${payment.number}`}
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
                <DeleteButton endpoint="/api/bill-payments" id={payment.id} label={payment.number} />
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
              record={payment}
              stats={billPaymentStats}
              visibleStatCards={customization.statCards}
              visibleStatIds={BILL_PAYMENT_STAT_CARDS.map((card) => card.id)}
            />
          )
        }
        header={
          isCustomizing ? (
              <BillPaymentDetailCustomizeMode
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
                description="Read the transaction, local, functional, and group amounts from the posted bill payment context."
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
                  containerDescription="Expanded context from linked records on this bill payment."
                  showSubsections={false}
                />
              ) : null}
              {isEditing ? (
                <BillPaymentDetailEditor
                  paymentId={payment.id}
                  detailHref={detailHref}
                  customization={customization}
                  vendors={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`,
                  }))}
                  bills={candidateBills.map((bill) => {
                    const appliedViaApplications = bill.paymentApplications.reduce((sum, application) => {
                      if (application.billPaymentId === payment.id) return sum
                      if ((application.billPayment.status ?? '').toLowerCase() === 'cancelled') return sum
                      return sum + Number(application.appliedAmount)
                    }, 0)
                    const appliedViaLegacyPayments = bill.billPayments.reduce((sum, legacyPayment) => {
                      if (legacyPayment.id === payment.id) return sum
                      if ((legacyPayment.status ?? '').toLowerCase() === 'cancelled') return sum
                      if (legacyPayment.applications.length > 0) return sum
                      return sum + Number(legacyPayment.amount)
                    }, 0)

                    return {
                      id: bill.id,
                      number: bill.number,
                      vendorId: bill.vendorId,
                      vendorName: bill.vendor.name,
                      status: bill.status,
                      total: Number(bill.total),
                      date: bill.date,
                      subsidiaryId: bill.subsidiaryId ?? null,
                      currencyId: bill.currencyId ?? null,
                      userId: bill.userId ?? null,
                      openAmount: roundMoney(Number(bill.total) - appliedViaApplications - appliedViaLegacyPayments),
                    }
                  })}
                  statusOptions={statusOptions}
                  methodOptions={methodOptions}
                  bankAccountOptions={bankAccountOptions}
                  initialHeaderValues={{
                    id: payment.id,
                    number: payment.number,
                    vendorId: payment.vendorId ?? '',
                    billId: payment.billId ?? '',
                    bankAccountId: payment.bankAccountId ?? '',
                    amount: String(payment.amount),
                    date: payment.date.toISOString().slice(0, 10),
                    method: payment.method ?? '',
                    reference: payment.reference ?? '',
                    status: payment.status,
                    notes: payment.notes ?? '',
                    createdAt: payment.createdAt.toISOString(),
                    createdAtDisplay: fmtDocumentDate(payment.createdAt, moneySettings),
                    updatedAt: payment.updatedAt.toISOString(),
                    updatedAtDisplay: fmtDocumentDate(payment.updatedAt, moneySettings),
                  }}
                  initialApplications={paymentApplications}
                  moneySettings={moneySettings}
                />
              ) : (
                <RecordHeaderDetails
                  purchaseOrderId={payment.id}
                  editing={false}
                  sections={headerSections}
                  columns={customization.formColumns}
                  containerTitle="Bill Payment Details"
                  containerDescription="Core bill payment fields organized into configurable sections."
                  showSubsections={false}
                />
              )}
            </div>
          )
        }
        lineItems={null}
        relatedMasterData={isCustomizing ? null : (
          <RelatedRecordsSection embedded tabs={relatedMasterDataTabs} showDisplayControl={false} />
        )}
        relatedMasterDataCount={relatedMasterDataTabs.reduce((sum, tab) => sum + tab.count, 0)}
        relatedTransactionDocuments={isCustomizing || (!primaryBill && linkedDocuments.length === 0) ? null : (
          <BillPaymentRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={paymentCurrencyCode}
            purchaseRequisitions={
              primaryBill?.purchaseOrder?.requisition
                ? [
                    {
                      id: primaryBill.purchaseOrder.requisition.id,
                      number: primaryBill.purchaseOrder.requisition.number,
                      status: primaryBill.purchaseOrder.requisition.status,
                      total: Number(primaryBill.purchaseOrder.requisition.total),
                      createdAt: primaryBill.purchaseOrder.requisition.createdAt.toISOString(),
                      currencyCode: paymentCurrencyCode,
                    },
                  ]
                : []
            }
            purchaseOrders={
              primaryBill?.purchaseOrder
                ? [
                    {
                      id: primaryBill.purchaseOrder.id,
                      number: primaryBill.purchaseOrder.number,
                      status: primaryBill.purchaseOrder.status,
                      total: Number(primaryBill.purchaseOrder.total),
                      createdAt: primaryBill.purchaseOrder.createdAt.toISOString(),
                      currencyCode: paymentCurrencyCode,
                    },
                  ]
                : []
            }
            receipts={
              primaryBill?.purchaseOrder?.receipts.map((receipt) => ({
                id: receipt.id,
                number: receipt.id,
                date: receipt.date.toISOString(),
                status: receipt.status,
                quantity: receipt.quantity,
                notes: receipt.notes ?? null,
              })) ?? []
            }
            bills={
              primaryBill
                ? [
                    {
                      id: primaryBill.id,
                      number: primaryBill.number,
                      status: primaryBill.status,
                      total: Number(primaryBill.total),
                      date: primaryBill.date.toISOString(),
                      dueDate: primaryBill.dueDate ? primaryBill.dueDate.toISOString() : null,
                      notes: primaryBill.notes ?? null,
                      currencyCode: paymentCurrencyCode,
                    },
                  ]
                : []
            }
            linkedDocuments={linkedDocuments}
            moneySettings={moneySettings}
          />
        )}
        relatedTransactionDocumentsCount={
          (
            primaryBill
              ? (primaryBill.purchaseOrder?.requisition ? 1 : 0) +
                (primaryBill.purchaseOrder ? 1 : 0) +
                (primaryBill.purchaseOrder?.receipts.length ?? 0) +
                1
              : 0
          ) + linkedDocuments.length
        }
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId="bill-payment-communications-toolbar"
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: payment.id,
              number: payment.number,
              counterpartyName: payment.vendor?.name ?? primaryBill?.vendor?.name ?? 'Vendor',
              counterpartyEmail: payment.vendor?.email ?? primaryBill?.vendor?.email ?? null,
              status: formattedStatus,
                total: fmtCurrency(payment.amount, paymentCurrencyCode ?? undefined, moneySettings),
              lineItems: [],
              sendEmailEndpoint: '/api/bill-payments?action=send-email',
              recordIdFieldName: 'billPaymentId',
              documentLabel: 'Bill Payment',
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId="bill-payment-communications-toolbar"
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId="bill-payment-system-notes-toolbar" showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId="bill-payment-system-notes-toolbar"
        systemNotesToolbarPlacement="tab-bar"
        supplementarySections={
          isCustomizing ? null : (
            <>
              {!isEditing ? (
                <BillPaymentApplicationsSection
                  bills={applicationBills}
                  selectedVendorId={payment.vendorId ?? primaryBill?.vendorId ?? ''}
                  applications={paymentApplications}
                  moneySettings={moneySettings}
                  paymentCurrencyCode={paymentCurrencyCode}
                />
              ) : null}
              <BillPaymentGlImpactSection
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
      />
    </RecordDetailPageShell>
  )
}
