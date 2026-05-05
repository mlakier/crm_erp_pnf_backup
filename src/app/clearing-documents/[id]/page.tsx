import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadListValues } from '@/lib/load-list-values'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import { RecordDetailCell, RecordDetailHeaderCell } from '@/components/RecordDetailPanels'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import SystemNotesSection, { type SystemNoteRow } from '@/components/SystemNotesSection'
import CommunicationsSection, { type CommunicationRow } from '@/components/CommunicationsSection'
import ClearingDocumentDetailCustomizeMode from '@/components/ClearingDocumentDetailCustomizeMode'
import ClearingDocumentGlImpactSection from '@/components/ClearingDocumentGlImpactSection'
import ClearingDocumentPageClient from '@/components/ClearingDocumentPageClient'
import ClearingDocumentStatusActions from '@/components/ClearingDocumentStatusActions'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'
import {
  buildConfiguredTransactionSections,
  buildTransactionGlImpactRows,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  CLEARING_DOCUMENT_LINE_COLUMNS,
  CLEARING_DOCUMENT_REFERENCE_SOURCES,
  CLEARING_DOCUMENT_DETAIL_FIELDS,
  CLEARING_DOCUMENT_STAT_CARDS,
  type ClearingDocumentDetailFieldKey,
} from '@/lib/clearing-document-detail-customization'
import { loadClearingDocumentDetailCustomization } from '@/lib/clearing-document-detail-customization-store'

export const runtime = 'nodejs'

function humanize(value: string | null | undefined) {
  if (!value) return '-'
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildEntityHref(type: string | null | undefined, id: string | null | undefined) {
  if (!type || !id) return null
  switch (type) {
    case 'invoice-receipt':
      return `/invoice-receipts/${id}`
    case 'bill-payment':
      return `/bill-payments/${id}`
    case 'customer-refund':
      return `/customer-refunds/${id}`
    case 'journal-entry':
      return `/journals/${id}`
    case 'customer':
      return `/customers/${id}`
    case 'vendor':
      return `/vendors/${id}`
    case 'employee':
      return `/employees/${id}`
    default:
      return null
  }
}

function buildCurrencyLayerDisplayValue(
  amount: unknown,
  currencyLabel: string | null | undefined,
  currencyCode: string | undefined,
  formatCurrency: (
    value: number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode?: string,
  ) => string,
) {
  if (amount == null) {
    return currencyLabel ? `Not translated yet (${currencyLabel})` : 'Not translated yet'
  }
  const formattedAmount = formatCurrency(
    amount as number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode,
  )
  return currencyLabel ? `${formattedAmount} (${currencyLabel})` : formattedAmount
}

export default async function ClearingDocumentDetailPage({
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

  const [clearingDocument, customization, accountingPeriods, openItems, statusValues, subsidiaries, currencies] = await Promise.all([
    prisma.clearingDocumentHeader.findUnique({
      where: { id },
      include: {
        accountingPeriod: true,
        lines: {
          include: {
            fromOpenItem: true,
            toOpenItem: true,
            openItemApplication: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    }),
    loadClearingDocumentDetailCustomization(),
    prisma.accountingPeriod.findMany({
      orderBy: [{ startDate: 'desc' }],
      select: { id: true, name: true },
    }),
    prisma.openItem.findMany({
      where: { isOpen: true },
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        openItemNumber: true,
        sourceNumber: true,
        openItemType: true,
        originalTransactionAmount: true,
      },
    }),
    loadListValues('CLEARING-DOCUMENT-STATUS'),
    prisma.subsidiary.findMany({
      where: { active: true },
      orderBy: [{ subsidiaryId: 'asc' }],
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      where: { active: true },
      orderBy: [{ code: 'asc' }, { currencyId: 'asc' }],
      select: { id: true, code: true, currencyId: true, name: true },
    }),
  ])

  if (!clearingDocument) notFound()
  const editableStatusValues = statusValues.filter((value) =>
    ['draft', 'pending approval', 'approved'].includes(value.toLowerCase()),
  )

  if (isEditing) {
    return (
      <ClearingDocumentPageClient
        mode="edit"
        clearingDocumentId={clearingDocument.id}
        subsidiaryOptions={subsidiaries.map((subsidiary) => ({
          value: subsidiary.id,
          label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
        }))}
        currencyOptions={currencies.map((currency) => ({
          value: currency.id,
          label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
        }))}
        accountingPeriodOptions={accountingPeriods.map((period) => ({
          value: period.id,
          label: period.name,
        }))}
        openItemOptions={openItems.map((item) => ({
          value: item.id,
          label: `${item.openItemNumber} - ${item.sourceNumber ?? item.openItemType} - ${Number(item.originalTransactionAmount).toFixed(2)}`,
        }))}
        statusOptions={editableStatusValues.map((value) => ({
          value: value.toLowerCase(),
          label: value,
        }))}
        initialHeaderValues={{
          id: clearingDocument.id,
          clearingNumber: clearingDocument.clearingNumber,
          clearingType: clearingDocument.clearingType,
          status: clearingDocument.status.toLowerCase(),
          subsidiaryId: clearingDocument.subsidiaryId ?? '',
          transactionCurrencyId: clearingDocument.transactionCurrencyId ?? '',
          localCurrencyId: clearingDocument.localCurrencyId ?? '',
          functionalCurrencyId: clearingDocument.functionalCurrencyId ?? '',
          groupCurrencyId: clearingDocument.groupCurrencyId ?? '',
          clearingDate: clearingDocument.clearingDate.toISOString().slice(0, 10),
          postingDate: clearingDocument.postingDate ? clearingDocument.postingDate.toISOString().slice(0, 10) : '',
          accountingPeriodId: clearingDocument.accountingPeriodId ?? '',
          transactionAmount: String(clearingDocument.transactionAmount),
          localAmount: String(clearingDocument.localAmount ?? ''),
          functionalAmount: String(clearingDocument.functionalAmount ?? ''),
          groupAmount: String(clearingDocument.groupAmount ?? ''),
          sourceTransactionType: clearingDocument.sourceTransactionType ?? '',
          sourceTransactionId: clearingDocument.sourceTransactionId ?? '',
          counterpartyType: clearingDocument.counterpartyType ?? '',
          counterpartyId: clearingDocument.counterpartyId ?? '',
          memo: clearingDocument.memo ?? '',
          createdAt: clearingDocument.createdAt.toISOString(),
          createdAtDisplay: fmtDocumentDate(clearingDocument.createdAt, moneySettings),
          updatedAt: clearingDocument.updatedAt.toISOString(),
          updatedAtDisplay: fmtDocumentDate(clearingDocument.updatedAt, moneySettings),
        }}
        initialLines={clearingDocument.lines.map((line) => ({
          key: line.id,
          lineRole: line.lineRole,
          fromOpenItemId: line.fromOpenItemId ?? '',
          toOpenItemId: line.toOpenItemId ?? '',
          transactionAmount: String(line.transactionAmount),
          memo: line.memo ?? '',
        }))}
      />
    )
  }

  const [sourceTransactionRecord, counterpartyRecord, glImpactEntries] = await Promise.all([
    (async () => {
      if (!clearingDocument.sourceTransactionId || !clearingDocument.sourceTransactionType) return null
      switch (clearingDocument.sourceTransactionType) {
        case 'invoice-receipt':
          return prisma.cashReceipt.findUnique({
            where: { id: clearingDocument.sourceTransactionId },
            select: {
              id: true,
              number: true,
              status: true,
              date: true,
              amount: true,
              reference: true,
            },
          })
        case 'bill-payment':
          return prisma.billPayment.findUnique({
            where: { id: clearingDocument.sourceTransactionId },
            select: {
              id: true,
              number: true,
              status: true,
              date: true,
              amount: true,
              reference: true,
            },
          })
        case 'customer-refund':
          return prisma.customerRefund.findUnique({
            where: { id: clearingDocument.sourceTransactionId },
            select: {
              id: true,
              number: true,
              status: true,
              date: true,
              amount: true,
              reference: true,
            },
          })
        case 'journal-entry':
          return prisma.journalEntry.findUnique({
            where: { id: clearingDocument.sourceTransactionId },
            select: {
              id: true,
              number: true,
              status: true,
              date: true,
              description: true,
            },
          })
        default:
          return null
      }
    })(),
    (async () => {
      if (!clearingDocument.counterpartyId || !clearingDocument.counterpartyType) return null
      switch (clearingDocument.counterpartyType) {
        case 'customer':
          return prisma.customer.findUnique({
            where: { id: clearingDocument.counterpartyId },
            select: {
              id: true,
              customerId: true,
              name: true,
              email: true,
              phone: true,
              inactive: true,
            },
          })
        case 'vendor':
          return prisma.vendor.findUnique({
            where: { id: clearingDocument.counterpartyId },
            select: {
              id: true,
              vendorNumber: true,
              name: true,
              email: true,
              phone: true,
              inactive: true,
            },
          })
        case 'employee':
          return prisma.employee.findUnique({
            where: { id: clearingDocument.counterpartyId },
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              phone: true,
              status: true,
              active: true,
            },
          })
        default:
          return null
      }
    })(),
    prisma.journalEntry.findMany({
      where: { sourceId: clearingDocument.id },
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
    }),
  ])

  const detailHref = `/clearing-documents/${clearingDocument.id}`
  const subsidiaryLabelById = new Map(
    subsidiaries.map((subsidiary) => [subsidiary.id, `${subsidiary.subsidiaryId} - ${subsidiary.name}`]),
  )
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, (currency.code ?? currency.currencyId ?? '').trim().toUpperCase()]),
  )
  const currencyLabelById = new Map(
    currencies.map((currency) => [currency.id, `${currency.code ?? currency.currencyId} - ${currency.name}`]),
  )
  const transactionCurrencyCode = clearingDocument.transactionCurrencyId
    ? currencyCodeById.get(clearingDocument.transactionCurrencyId) ?? undefined
    : undefined
  const localCurrencyCode = clearingDocument.localCurrencyId
    ? currencyCodeById.get(clearingDocument.localCurrencyId) ?? undefined
    : undefined
  const functionalCurrencyCode = clearingDocument.functionalCurrencyId
    ? currencyCodeById.get(clearingDocument.functionalCurrencyId) ?? undefined
    : undefined
  const groupCurrencyCode = clearingDocument.groupCurrencyId
    ? currencyCodeById.get(clearingDocument.groupCurrencyId) ?? undefined
    : undefined
  const glSourceNumberByKey = new Map<string, string>()
  for (const entry of glImpactEntries) {
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, clearingDocument.clearingNumber)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })
  const activities = await prisma.activity.findMany({
    where: {
      entityType: 'clearing-document',
      entityId: clearingDocument.id,
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

  const systemNotes: SystemNoteRow[] = activities
    .map((activity) => {
      const parsed = parseFieldChangeSummary(activity.summary)
      if (!parsed) return null
      return {
        id: activity.id,
        date: fmtDocumentDate(activity.createdAt, moneySettings),
        setBy: activity.userId ? activityUserLabelById.get(activity.userId) ?? activity.userId : 'System',
        context: humanize(activity.action),
        fieldName: parsed.fieldName || '-',
        oldValue: parsed.oldValue || '-',
        newValue: parsed.newValue || '-',
      }
    })
    .filter((note): note is SystemNoteRow => Boolean(note))

  const communications: CommunicationRow[] = activities
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
    .filter((row): row is CommunicationRow => Boolean(row))

  const sourceHref = buildEntityHref(clearingDocument.sourceTransactionType, clearingDocument.sourceTransactionId)
  const counterpartyHref = buildEntityHref(clearingDocument.counterpartyType, clearingDocument.counterpartyId)
  const accountingPeriodHref = clearingDocument.accountingPeriodId ? `/accounting-periods/${clearingDocument.accountingPeriodId}` : null

  const sectionDescriptions: Record<string, string> = {
    'Document Identity': 'Core identifier and lifecycle details for this clearing document.',
    'Clearing Context': 'Dates and accounting context for the clearing event.',
    'Source and Counterparty': 'Source transaction, counterparty, and orchestration traceability.',
    'Amounts and Automation': 'Amounts, FX effects, and automation markers carried on this clearing document.',
    'Record Keys and System Dates': 'Internal identifiers and system-managed timestamps.',
  }

  const sourceTransactionHeaderDisplayValue =
    sourceTransactionRecord && 'number' in sourceTransactionRecord && typeof sourceTransactionRecord.number === 'string'
      ? 'reference' in sourceTransactionRecord && typeof sourceTransactionRecord.reference === 'string' && sourceTransactionRecord.reference
        ? `${sourceTransactionRecord.number} - ${sourceTransactionRecord.reference}`
        : 'description' in sourceTransactionRecord && typeof sourceTransactionRecord.description === 'string' && sourceTransactionRecord.description
          ? `${sourceTransactionRecord.number} - ${sourceTransactionRecord.description}`
          : sourceTransactionRecord.number
      : '-'

  const counterpartyHeaderDisplayValue =
    counterpartyRecord
      ? 'customerId' in counterpartyRecord && typeof counterpartyRecord.customerId === 'string'
        ? 'name' in counterpartyRecord && typeof counterpartyRecord.name === 'string' && counterpartyRecord.name
          ? `${counterpartyRecord.customerId} - ${counterpartyRecord.name}`
          : counterpartyRecord.customerId
        : 'vendorNumber' in counterpartyRecord && typeof counterpartyRecord.vendorNumber === 'string'
          ? 'name' in counterpartyRecord && typeof counterpartyRecord.name === 'string' && counterpartyRecord.name
            ? `${counterpartyRecord.vendorNumber} - ${counterpartyRecord.name}`
            : counterpartyRecord.vendorNumber
          : 'employeeId' in counterpartyRecord && typeof counterpartyRecord.employeeId === 'string'
            ? 'displayName' in counterpartyRecord && typeof counterpartyRecord.displayName === 'string' && counterpartyRecord.displayName
              ? `${counterpartyRecord.employeeId} - ${counterpartyRecord.displayName}`
              : counterpartyRecord.employeeId
            : '-'
      : '-'

  type ClearingDocumentHeaderField = {
    key: ClearingDocumentDetailFieldKey
  } & RecordHeaderField

  const headerFieldDefinitions: Record<ClearingDocumentDetailFieldKey, ClearingDocumentHeaderField> = {
    clearingNumber: {
      key: 'clearingNumber',
      label: 'Business Id',
      value: clearingDocument.clearingNumber,
      displayValue: clearingDocument.clearingNumber,
      helpText: 'Internal operational identifier for this clearing document.',
      fieldType: 'text',
    },
    clearingType: {
      key: 'clearingType',
      label: 'Clearing Type',
      value: clearingDocument.clearingType,
      displayValue: humanize(clearingDocument.clearingType),
      helpText: 'Settlement pattern or automation type that generated this clearing document.',
      fieldType: 'list',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: clearingDocument.status,
      displayValue: humanize(clearingDocument.status),
      helpText: 'Lifecycle state for the clearing document.',
      fieldType: 'list',
    },
    subsidiary: {
      key: 'subsidiary',
      label: 'Subsidiary',
      value: clearingDocument.subsidiaryId ?? '',
      displayValue: subsidiaryLabelById.get(clearingDocument.subsidiaryId ?? '') ?? '-',
      helpText: 'Subsidiary/legal entity context for this clearing document.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
    },
    clearingDate: {
      key: 'clearingDate',
      label: 'Clearing Date',
      value: clearingDocument.clearingDate.toISOString(),
      displayValue: fmtDocumentDate(clearingDocument.clearingDate, moneySettings),
      helpText: 'Business date for the clearing event.',
      fieldType: 'date',
    },
    postingDate: {
      key: 'postingDate',
      label: 'Posting Date',
      value: clearingDocument.postingDate?.toISOString() ?? '',
      displayValue: clearingDocument.postingDate ? fmtDocumentDate(clearingDocument.postingDate, moneySettings) : '-',
      helpText: 'Posting date used for accounting traceability.',
      fieldType: 'date',
    },
    accountingPeriod: {
      key: 'accountingPeriod',
      label: 'Accounting Period',
      value: clearingDocument.accountingPeriodId ?? '',
      displayValue: clearingDocument.accountingPeriod?.name ?? '-',
      helpText: 'Accounting period associated with this clearing document.',
      fieldType: 'text',
      sourceText: 'Accounting periods',
      href: accountingPeriodHref,
    },
    sourceTransaction: {
      key: 'sourceTransaction',
      label: 'Source Transaction',
      value: clearingDocument.sourceTransactionId ?? '',
      displayValue: sourceTransactionHeaderDisplayValue,
      helpText: 'Source transaction that produced this clearing event.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      href: sourceHref,
    },
    counterparty: {
      key: 'counterparty',
      label: 'Counterparty',
      value: clearingDocument.counterpartyId ?? '',
      displayValue: counterpartyHeaderDisplayValue,
      helpText: 'Counterparty context carried on the clearing document.',
      fieldType: 'text',
      sourceText: 'Entity record',
      href: counterpartyHref,
    },
    sourceRunId: {
      key: 'sourceRunId',
      label: 'Source Run',
      value: clearingDocument.sourceRunId ?? '',
      displayValue: clearingDocument.sourceRunId ?? '-',
      helpText: 'Run or orchestration instance that generated this clearing document, when applicable.',
      fieldType: 'text',
      sourceText: 'Run engine',
    },
    transactionAmount: {
      key: 'transactionAmount',
      label: 'Transaction Amount',
      value: String(clearingDocument.transactionAmount),
      displayValue: fmtCurrency(clearingDocument.transactionAmount, transactionCurrencyCode, moneySettings),
      helpText: 'Primary amount cleared in transaction currency.',
      fieldType: 'currency',
    },
    transactionCurrency: {
      key: 'transactionCurrency',
      label: 'Transaction Currency',
      value: clearingDocument.transactionCurrencyId ?? '',
      displayValue: currencyLabelById.get(clearingDocument.transactionCurrencyId ?? '') ?? '-',
      helpText: 'Currency the clearing transaction is entered or settled in.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
    },
    localAmount: {
      key: 'localAmount',
      label: 'Local Amount',
      value: String(clearingDocument.localAmount ?? ''),
      displayValue:
        clearingDocument.localAmount == null ? '-' : fmtCurrency(clearingDocument.localAmount, localCurrencyCode, moneySettings),
      helpText: 'Amount in local/statutory currency.',
      fieldType: 'currency',
    },
    localCurrency: {
      key: 'localCurrency',
      label: 'Local Currency',
      value: clearingDocument.localCurrencyId ?? '',
      displayValue: currencyLabelById.get(clearingDocument.localCurrencyId ?? '') ?? '-',
      helpText: 'Statutory/company-code currency of the entity.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
    },
    functionalAmount: {
      key: 'functionalAmount',
      label: 'Functional Amount',
      value: String(clearingDocument.functionalAmount ?? ''),
      displayValue:
        clearingDocument.functionalAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.functionalAmount, functionalCurrencyCode, moneySettings),
      helpText: 'Amount in functional currency.',
      fieldType: 'currency',
    },
    functionalCurrency: {
      key: 'functionalCurrency',
      label: 'Functional Currency',
      value: clearingDocument.functionalCurrencyId ?? '',
      displayValue: currencyLabelById.get(clearingDocument.functionalCurrencyId ?? '') ?? '-',
      helpText: 'Primary economic-environment currency.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
    },
    groupAmount: {
      key: 'groupAmount',
      label: 'Group Amount',
      value: String(clearingDocument.groupAmount ?? ''),
      displayValue:
        clearingDocument.groupAmount == null ? '-' : fmtCurrency(clearingDocument.groupAmount, groupCurrencyCode, moneySettings),
      helpText: 'Amount in group/reporting currency.',
      fieldType: 'currency',
    },
    groupCurrency: {
      key: 'groupCurrency',
      label: 'Group Currency',
      value: clearingDocument.groupCurrencyId ?? '',
      displayValue: currencyLabelById.get(clearingDocument.groupCurrencyId ?? '') ?? '-',
      helpText: 'Consolidated group/reporting currency.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
    },
    realizedFxLocalAmount: {
      key: 'realizedFxLocalAmount',
      label: 'Realized FX Local',
      value: String(clearingDocument.realizedFxLocalAmount ?? ''),
      displayValue:
        clearingDocument.realizedFxLocalAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.realizedFxLocalAmount, localCurrencyCode, moneySettings),
      helpText: 'Realized foreign exchange effect in local currency, when populated.',
      fieldType: 'currency',
    },
    realizedFxFunctionalAmount: {
      key: 'realizedFxFunctionalAmount',
      label: 'Realized FX Functional',
      value: String(clearingDocument.realizedFxFunctionalAmount ?? ''),
      displayValue:
        clearingDocument.realizedFxFunctionalAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.realizedFxFunctionalAmount, functionalCurrencyCode, moneySettings),
      helpText: 'Realized foreign exchange effect in functional currency, when populated.',
      fieldType: 'currency',
    },
    realizedFxGroupAmount: {
      key: 'realizedFxGroupAmount',
      label: 'Realized FX Group',
      value: String(clearingDocument.realizedFxGroupAmount ?? ''),
      displayValue:
        clearingDocument.realizedFxGroupAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.realizedFxGroupAmount, groupCurrencyCode, moneySettings),
      helpText: 'Realized foreign exchange effect in group/reporting currency, when populated.',
      fieldType: 'currency',
    },
    autoGenerated: {
      key: 'autoGenerated',
      label: 'Auto Generated',
      value: String(clearingDocument.autoGenerated),
      displayValue: clearingDocument.autoGenerated ? 'Yes' : 'No',
      helpText: 'Indicates whether the clearing document was system-generated.',
      fieldType: 'checkbox',
    },
    automationSource: {
      key: 'automationSource',
      label: 'Automation Source',
      value: clearingDocument.automationSource ?? '',
      displayValue: clearingDocument.automationSource ?? '-',
      helpText: 'Subsystem or automation path that created this clearing document.',
      fieldType: 'text',
    },
    exceptionStatus: {
      key: 'exceptionStatus',
      label: 'Exception Status',
      value: clearingDocument.exceptionStatus ?? '',
      displayValue: clearingDocument.exceptionStatus ? humanize(clearingDocument.exceptionStatus) : '-',
      helpText: 'Operational exception marker for reviewable clearing outcomes.',
      fieldType: 'text',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: clearingDocument.id,
      displayValue: clearingDocument.id,
      helpText: 'Internal database identifier for this clearing document.',
      fieldType: 'text',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: clearingDocument.createdAt.toISOString(),
      displayValue: fmtDocumentDate(clearingDocument.createdAt, moneySettings),
      helpText: 'System creation timestamp.',
      fieldType: 'date',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: clearingDocument.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(clearingDocument.updatedAt, moneySettings),
      helpText: 'System last modified timestamp.',
      fieldType: 'date',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: CLEARING_DOCUMENT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: CLEARING_DOCUMENT_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      transactionAmount: fmtCurrency(clearingDocument.transactionAmount, transactionCurrencyCode, moneySettings),
      realizedFxLocalAmount:
        clearingDocument.realizedFxLocalAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.realizedFxLocalAmount, localCurrencyCode, moneySettings),
      realizedFxFunctionalAmount:
        clearingDocument.realizedFxFunctionalAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.realizedFxFunctionalAmount, functionalCurrencyCode, moneySettings),
      realizedFxGroupAmount:
        clearingDocument.realizedFxGroupAmount == null
          ? '-'
          : fmtCurrency(clearingDocument.realizedFxGroupAmount, groupCurrencyCode, moneySettings),
      clearingDate: fmtDocumentDate(clearingDocument.clearingDate, moneySettings),
      postingDate: clearingDocument.postingDate ? fmtDocumentDate(clearingDocument.postingDate, moneySettings) : '-',
      createdAt: fmtDocumentDate(clearingDocument.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(clearingDocument.updatedAt, moneySettings),
    },
  })

  const normalizedSourceRecord = sourceTransactionRecord
    ? {
        type: humanize(clearingDocument.sourceTransactionType),
        number:
          'number' in sourceTransactionRecord && typeof sourceTransactionRecord.number === 'string'
            ? sourceTransactionRecord.number
            : clearingDocument.sourceTransactionId ?? '-',
        status:
          'status' in sourceTransactionRecord && typeof sourceTransactionRecord.status === 'string'
            ? humanize(sourceTransactionRecord.status)
            : '-',
        date:
          'date' in sourceTransactionRecord && sourceTransactionRecord.date instanceof Date
            ? sourceTransactionRecord.date
            : null,
        amount:
          'amount' in sourceTransactionRecord && sourceTransactionRecord.amount != null
            ? Number(sourceTransactionRecord.amount)
            : Number(clearingDocument.transactionAmount),
        reference:
          'reference' in sourceTransactionRecord && typeof sourceTransactionRecord.reference === 'string'
            ? sourceTransactionRecord.reference
            : 'description' in sourceTransactionRecord && typeof sourceTransactionRecord.description === 'string'
              ? sourceTransactionRecord.description
              : '-',
        sourceRunId: clearingDocument.sourceRunId ?? '-',
      }
    : {
        type: humanize(clearingDocument.sourceTransactionType),
        number: clearingDocument.sourceTransactionId ?? '-',
        status: '-',
        date: null,
        amount: Number(clearingDocument.transactionAmount),
        reference: '-',
        sourceRunId: clearingDocument.sourceRunId ?? '-',
      }

  const normalizedCounterpartyRecord = counterpartyRecord
    ? {
        type: humanize(clearingDocument.counterpartyType),
        number:
          'customerId' in counterpartyRecord && typeof counterpartyRecord.customerId === 'string'
            ? counterpartyRecord.customerId
            : 'vendorNumber' in counterpartyRecord && typeof counterpartyRecord.vendorNumber === 'string'
              ? counterpartyRecord.vendorNumber
              : 'employeeId' in counterpartyRecord && typeof counterpartyRecord.employeeId === 'string'
                ? counterpartyRecord.employeeId
                : clearingDocument.counterpartyId ?? '-',
        name:
          'name' in counterpartyRecord && typeof counterpartyRecord.name === 'string'
            ? counterpartyRecord.name
            : 'displayName' in counterpartyRecord && typeof counterpartyRecord.displayName === 'string' && counterpartyRecord.displayName
              ? counterpartyRecord.displayName
              : 'firstName' in counterpartyRecord || 'lastName' in counterpartyRecord
                ? `${'firstName' in counterpartyRecord && typeof counterpartyRecord.firstName === 'string' ? counterpartyRecord.firstName : ''} ${'lastName' in counterpartyRecord && typeof counterpartyRecord.lastName === 'string' ? counterpartyRecord.lastName : ''}`.trim() || '-'
                : '-',
        email: 'email' in counterpartyRecord && typeof counterpartyRecord.email === 'string' ? counterpartyRecord.email : '-',
        phone: 'phone' in counterpartyRecord && typeof counterpartyRecord.phone === 'string' ? counterpartyRecord.phone : '-',
        status:
          'status' in counterpartyRecord && typeof counterpartyRecord.status === 'string'
            ? humanize(counterpartyRecord.status)
            : 'inactive' in counterpartyRecord
              ? counterpartyRecord.inactive
                ? 'Inactive'
                : 'Active'
              : 'active' in counterpartyRecord
                ? counterpartyRecord.active
                  ? 'Active'
                  : 'Inactive'
                : '-',
      }
    : {
        type: humanize(clearingDocument.counterpartyType),
        number: clearingDocument.counterpartyId ?? '-',
        name: '-',
        email: '-',
        phone: '-',
        status: '-',
      }

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(CLEARING_DOCUMENT_REFERENCE_SOURCES, {
    sourceTransaction: normalizedSourceRecord,
    counterparty: normalizedCounterpartyRecord,
    accountingPeriod: clearingDocument.accountingPeriod,
  })
  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    CLEARING_DOCUMENT_REFERENCE_SOURCES,
    {
      sourceTransaction: normalizedSourceRecord,
      counterparty: normalizedCounterpartyRecord,
      accountingPeriod: clearingDocument.accountingPeriod,
    },
    {
      sourceTransaction: sourceHref,
      counterparty: counterpartyHref,
      accountingPeriod: accountingPeriodHref,
    },
  )
  const allFieldDefinitions: Record<string, RecordHeaderField> = { ...headerFieldDefinitions, ...referenceFieldDefinitions }
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = CLEARING_DOCUMENT_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const visibleLineColumns = getOrderedVisibleTransactionLineColumns(CLEARING_DOCUMENT_LINE_COLUMNS, customization)

  const exportSections = headerSections.map((section) => ({
    title: section.title,
    fields: buildTransactionExportHeaderFields([section]),
  }))
  const normalizedClearingStatus = clearingDocument.status.toLowerCase()
  const canEditManualClearing =
    !clearingDocument.autoGenerated
    && ['draft', 'pending approval', 'approved'].includes(normalizedClearingStatus)
  const canDeleteManualDraft = !clearingDocument.autoGenerated && normalizedClearingStatus === 'draft'
  const canPostManualClearing = !clearingDocument.autoGenerated && normalizedClearingStatus === 'approved'
  const canReverseManualClearing =
    !clearingDocument.autoGenerated
    && normalizedClearingStatus === 'posted'
    && !clearingDocument.reversedByClearingDocumentId
  const clearingDocumentEditLockReason = clearingDocument.autoGenerated
    ? 'Auto-generated clearing documents cannot be edited directly.'
    : !canEditManualClearing
      ? 'Only manual draft, pending approval, and approved clearing documents can be edited before posting.'
      : null
  const clearingDocumentDeleteLockReason = clearingDocument.autoGenerated
    ? 'Auto-generated clearing documents cannot be deleted directly.'
    : normalizedClearingStatus !== 'draft'
      ? 'Only manual draft clearing documents can be deleted.'
      : null
  const clearingDocumentLifecycleHint = canPostManualClearing
    ? 'Approved manual clearing documents can now be posted into open-item settlement.'
    : canReverseManualClearing
      ? 'Posted manual clearing documents can be reversed from this detail page.'
      : clearingDocumentEditLockReason ?? clearingDocumentDeleteLockReason

  const stats: TransactionStatDefinition<typeof clearingDocument>[] = [
    {
      id: 'amount',
      label: 'Transaction Amount',
      accent: true,
      getValue: (record) => fmtCurrency(record.transactionAmount, transactionCurrencyCode, moneySettings),
      getValueTone: () => 'accent',
    },
    {
      id: 'date',
      label: 'Clearing Date',
      getValue: (record) => fmtDocumentDate(record.clearingDate, moneySettings),
    },
    {
      id: 'type',
      label: 'Type',
      getValue: (record) => humanize(record.clearingType),
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => humanize(record.status),
    },
  ]

  const statPreviewCards = stats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(clearingDocument),
    href: stat.getHref?.(clearingDocument) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(clearingDocument),
    cardTone: stat.getCardTone?.(clearingDocument),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
  }))

  const relatedMasterDataRows = [
    clearingDocument.counterpartyId
      ? {
          id: `counterparty-${clearingDocument.counterpartyId}`,
          type: 'Counterparty',
          reference: normalizedCounterpartyRecord.number,
          name: normalizedCounterpartyRecord.name,
          details: humanize(clearingDocument.counterpartyType) || '-',
          href: counterpartyHref,
        }
      : null,
    clearingDocument.accountingPeriod
      ? {
          id: `period-${clearingDocument.accountingPeriod.id}`,
          type: 'Accounting Period',
          reference: clearingDocument.accountingPeriod.name,
          name: clearingDocument.accountingPeriod.status ? humanize(clearingDocument.accountingPeriod.status) : 'Period',
          details:
            clearingDocument.accountingPeriod.startDate && clearingDocument.accountingPeriod.endDate
              ? `${fmtDocumentDate(clearingDocument.accountingPeriod.startDate, moneySettings)} to ${fmtDocumentDate(clearingDocument.accountingPeriod.endDate, moneySettings)}`
              : '-',
          href: accountingPeriodHref,
        }
      : null,
  ].filter(
    (
      row,
    ): row is {
      id: string
      type: string
      reference: string
      name: string
      details: string
      href: string | null
    } => Boolean(row),
  )
  const relatedDocumentMap = new Map<
    string,
    {
      id: string
      type: string
      reference: string
      name: string
      details: string
      href: string | null
    }
  >()
  if (clearingDocument.sourceTransactionId) {
    relatedDocumentMap.set(`header-source-${clearingDocument.sourceTransactionId}`, {
      id: `header-source-${clearingDocument.sourceTransactionId}`,
      type: 'Source Transaction',
      reference: normalizedSourceRecord.number,
      name: humanize(clearingDocument.sourceTransactionType) || 'Transaction',
      details:
        normalizedSourceRecord.status !== '-'
          ? normalizedSourceRecord.status
          : fmtCurrency(normalizedSourceRecord.amount, transactionCurrencyCode, moneySettings),
      href: sourceHref,
    })
  }
  for (const line of clearingDocument.lines) {
    if (line.sourceTransactionId) {
      const href = buildEntityHref(line.sourceTransactionType, line.sourceTransactionId)
      const key = `line-source-${line.sourceTransactionType ?? 'transaction'}-${line.sourceTransactionId}`
      if (!relatedDocumentMap.has(key)) {
        relatedDocumentMap.set(key, {
          id: key,
          type: 'Source Transaction',
          reference: line.sourceTransactionId,
          name: humanize(line.sourceTransactionType) || 'Transaction',
          details: line.memo ?? line.openItemApplication?.applicationNumber ?? '-',
          href,
        })
      }
    }
    if (line.settlementTransactionId) {
      const href = buildEntityHref(line.settlementTransactionType, line.settlementTransactionId)
      const key = `settlement-${line.settlementTransactionType ?? 'transaction'}-${line.settlementTransactionId}`
      if (!relatedDocumentMap.has(key)) {
        relatedDocumentMap.set(key, {
          id: key,
          type: 'Target Transaction',
          reference: line.settlementTransactionId,
          name: humanize(line.settlementTransactionType) || 'Transaction',
          details: line.memo ?? line.openItemApplication?.applicationNumber ?? '-',
          href,
        })
      }
    }
  }
  const relatedDocumentRows = Array.from(relatedDocumentMap.values())

  const lineFontSizeClass = customization.lineSettings?.fontSize === 'sm' ? 'text-sm' : 'text-xs'
  const lineColumnWidths: Record<string, string> = {
    compact: 'w-24',
    normal: 'w-36',
    wide: 'w-56',
  }
  const clearingApplicationsCount = clearingDocument.lines.filter((line) => line.openItemApplicationId).length
  const distinctOpenItemCount = new Set(
    clearingDocument.lines.flatMap((line) => [line.fromOpenItemId, line.toOpenItemId].filter(Boolean)),
  ).size
  const systemClearingNarrative = clearingDocument.autoGenerated
    ? `This clearing document was created automatically${clearingDocument.automationSource ? ` by ${humanize(clearingDocument.automationSource)}` : ''}. It is the audit record that explains which open items were settled, what source transaction triggered the settlement, and why the document is locked from direct editing.`
    : 'This manual clearing document captures user-entered settlement intent before posting into open-item applications.'
  const transactionCurrencyLabel = currencyLabelById.get(clearingDocument.transactionCurrencyId ?? '') ?? null
  const localCurrencyLabel = currencyLabelById.get(clearingDocument.localCurrencyId ?? '') ?? null
  const functionalCurrencyLabel = currencyLabelById.get(clearingDocument.functionalCurrencyId ?? '') ?? null
  const groupCurrencyLabel = currencyLabelById.get(clearingDocument.groupCurrencyId ?? '') ?? null
  const formatMonetaryValue = (
    value: number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode?: string,
  ) => fmtCurrency(value, currencyCode, moneySettings)
  const currencyReadoutDescription =
    'Transaction, local, functional, and group layers are shown separately. When a translated bucket is not truly known yet, it stays blank instead of copying the transaction amount.'
  const systemSummarySections: Array<{
    title: string
    description: string
    rows: number
    fields: RecordHeaderField[]
  }> = clearingDocument.autoGenerated
    ? [
        {
          title: 'System Clearing Summary',
          description: systemClearingNarrative,
          rows: 2,
          fields: [
            {
              key: 'system-summary-source',
              label: 'Created By Flow',
              value: clearingDocument.automationSource ?? '',
              displayValue: clearingDocument.automationSource ? humanize(clearingDocument.automationSource) : 'System',
              helpText: 'Automation path or system process that created this clearing document.',
              fieldType: 'text',
            },
            {
              key: 'system-summary-driver',
              label: 'Driver Transaction',
              value: clearingDocument.sourceTransactionId ?? '',
              displayValue: sourceTransactionHeaderDisplayValue,
              helpText: 'Primary transaction that triggered the system clearing event.',
              fieldType: 'text',
              href: sourceHref,
            },
            {
              key: 'system-summary-counterparty',
              label: 'Counterparty Context',
              value: clearingDocument.counterpartyId ?? '',
              displayValue: counterpartyHeaderDisplayValue,
              helpText: 'Customer, vendor, or employee context carried onto the clearing document.',
              fieldType: 'text',
              href: counterpartyHref,
            },
            {
              key: 'system-summary-applications',
              label: 'Settlement Applications',
              value: String(clearingApplicationsCount),
              displayValue: String(clearingApplicationsCount),
              helpText: 'Number of open-item application rows linked to this clearing document.',
              fieldType: 'text',
            },
            {
              key: 'system-summary-open-items',
              label: 'Open Items Touched',
              value: String(distinctOpenItemCount),
              displayValue: String(distinctOpenItemCount),
              helpText: 'Unique open items that were reduced, applied, or otherwise touched by this clearing event.',
              fieldType: 'text',
            },
            {
              key: 'system-summary-editability',
              label: 'Editability',
              value: clearingDocument.autoGenerated ? 'locked' : 'editable',
              displayValue: clearingDocument.autoGenerated ? 'System-generated and locked' : 'Editable while pre-post',
              helpText: 'System-generated clearing documents are intended to be read and traced, not directly edited.',
              fieldType: 'text',
            },
          ],
        },
      ]
    : []
  const currencyReadoutSections: Array<{
    title: string
    description: string
    rows: number
    fields: RecordHeaderField[]
  }> = [
    {
      title: '4-Currency Readout',
      description: currencyReadoutDescription,
      rows: 2,
      fields: [
        {
          key: 'currency-readout-transaction',
          label: 'Transaction Layer',
          value: String(clearingDocument.transactionAmount),
          displayValue: buildCurrencyLayerDisplayValue(
            clearingDocument.transactionAmount,
            transactionCurrencyLabel,
            transactionCurrencyCode,
            formatMonetaryValue,
          ),
          helpText: 'Original document amount in the transaction-entered currency.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-local',
          label: 'Local Layer',
          value: clearingDocument.localAmount == null ? '' : String(clearingDocument.localAmount),
          displayValue: buildCurrencyLayerDisplayValue(
            clearingDocument.localAmount,
            localCurrencyLabel,
            localCurrencyCode,
            formatMonetaryValue,
          ),
          helpText: 'Statutory/local-currency amount. If the transaction was not translated into local currency yet, this stays blank instead of being guessed.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-functional',
          label: 'Functional Layer',
          value: clearingDocument.functionalAmount == null ? '' : String(clearingDocument.functionalAmount),
          displayValue: buildCurrencyLayerDisplayValue(
            clearingDocument.functionalAmount,
            functionalCurrencyLabel,
            functionalCurrencyCode,
            formatMonetaryValue,
          ),
          helpText: 'Functional-currency amount for the subsidiary. It may differ from local currency when the entity mainly operates in another currency.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-group',
          label: 'Group Layer',
          value: clearingDocument.groupAmount == null ? '' : String(clearingDocument.groupAmount),
          displayValue: buildCurrencyLayerDisplayValue(
            clearingDocument.groupAmount,
            groupCurrencyLabel,
            groupCurrencyCode,
            formatMonetaryValue,
          ),
          helpText: 'Consolidated group/reporting-currency amount. This remains blank until the system has a real group-currency translation basis.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-realized-fx-local',
          label: 'Realized FX Local',
          value: clearingDocument.realizedFxLocalAmount == null ? '' : String(clearingDocument.realizedFxLocalAmount),
          displayValue:
            clearingDocument.realizedFxLocalAmount == null
              ? 'No realized FX on this clearing'
              : buildCurrencyLayerDisplayValue(
                  clearingDocument.realizedFxLocalAmount,
                  localCurrencyLabel,
                  localCurrencyCode,
                  formatMonetaryValue,
                ),
          helpText: 'Realized foreign-exchange effect recognized in local currency when settlement timing or rates create a gain/loss.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-realized-fx-functional',
          label: 'Realized FX Functional',
          value: clearingDocument.realizedFxFunctionalAmount == null ? '' : String(clearingDocument.realizedFxFunctionalAmount),
          displayValue:
            clearingDocument.realizedFxFunctionalAmount == null
              ? 'No realized FX on this clearing'
              : buildCurrencyLayerDisplayValue(
                  clearingDocument.realizedFxFunctionalAmount,
                  functionalCurrencyLabel,
                  functionalCurrencyCode,
                  formatMonetaryValue,
                ),
          helpText: 'Realized foreign-exchange effect recognized in functional currency when settlement timing or rates create a gain/loss.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-realized-fx-group',
          label: 'Realized FX Group',
          value: clearingDocument.realizedFxGroupAmount == null ? '' : String(clearingDocument.realizedFxGroupAmount),
          displayValue:
            clearingDocument.realizedFxGroupAmount == null
              ? 'No realized FX on this clearing'
              : buildCurrencyLayerDisplayValue(
                  clearingDocument.realizedFxGroupAmount,
                  groupCurrencyLabel,
                  groupCurrencyCode,
                  formatMonetaryValue,
                ),
          helpText: 'Realized foreign-exchange effect recognized in group/reporting currency when settlement timing or rates create a gain/loss.',
          fieldType: 'currency',
        },
        {
          key: 'currency-readout-translation-status',
          label: 'Translation Status',
          value: [
            clearingDocument.localAmount == null ? 'local-pending' : 'local-ready',
            clearingDocument.functionalAmount == null ? 'functional-pending' : 'functional-ready',
            clearingDocument.groupAmount == null ? 'group-pending' : 'group-ready',
          ].join('|'),
          displayValue: [
            clearingDocument.localAmount == null ? 'Local pending' : 'Local ready',
            clearingDocument.functionalAmount == null ? 'Functional pending' : 'Functional ready',
            clearingDocument.groupAmount == null ? 'Group pending' : 'Group ready',
          ].join(' | '),
          helpText: 'Quick read of which translated currency buckets are actually populated versus still awaiting real FX translation.',
          fieldType: 'text',
        },
      ],
    },
  ]

  function getLineColumnClassName(columnId: string) {
    const widthMode = customization.lineColumns?.[columnId as keyof typeof customization.lineColumns]?.widthMode ?? 'auto'
    const alignment = ['transactionAmount', 'localAmount', 'functionalAmount', 'groupAmount', 'realizedFxLocalAmount', 'realizedFxFunctionalAmount', 'realizedFxGroupAmount'].includes(columnId)
      ? 'text-right'
      : ''
    const wrapping = columnId === 'memo' ? 'max-w-[260px] whitespace-pre-wrap break-words' : ''
    return [lineColumnWidths[widthMode], alignment, wrapping].filter(Boolean).join(' ')
  }

  function getLineCellValue(line: NonNullable<typeof clearingDocument>['lines'][number], columnId: string) {
    switch (columnId) {
      case 'lineNumber':
        return line.lineNumber
      case 'lineRole':
        return humanize(line.lineRole)
      case 'transactionAmount':
        return fmtCurrency(line.transactionAmount, transactionCurrencyCode, moneySettings)
      case 'localAmount':
        return line.localAmount == null ? '-' : fmtCurrency(line.localAmount, localCurrencyCode, moneySettings)
      case 'functionalAmount':
        return line.functionalAmount == null ? '-' : fmtCurrency(line.functionalAmount, functionalCurrencyCode, moneySettings)
      case 'groupAmount':
        return line.groupAmount == null ? '-' : fmtCurrency(line.groupAmount, groupCurrencyCode, moneySettings)
      case 'realizedFxLocalAmount':
        return line.realizedFxLocalAmount == null ? '-' : fmtCurrency(line.realizedFxLocalAmount, localCurrencyCode, moneySettings)
      case 'realizedFxFunctionalAmount':
        return line.realizedFxFunctionalAmount == null ? '-' : fmtCurrency(line.realizedFxFunctionalAmount, functionalCurrencyCode, moneySettings)
      case 'realizedFxGroupAmount':
        return line.realizedFxGroupAmount == null ? '-' : fmtCurrency(line.realizedFxGroupAmount, groupCurrencyCode, moneySettings)
      case 'fromOpenItem':
        return line.fromOpenItem?.sourceNumber ?? line.fromOpenItemId ?? '-'
      case 'toOpenItem':
        return line.toOpenItem?.sourceNumber ?? line.toOpenItemId ?? '-'
      case 'application':
        return line.openItemApplication?.applicationNumber ?? line.openItemApplicationId ?? '-'
      case 'source':
        return line.sourceTransactionType && line.sourceTransactionId
          ? `${humanize(line.sourceTransactionType)} - ${line.sourceTransactionId}`
          : line.sourceTransactionId ?? line.sourceTransactionType ?? '-'
      case 'settlement':
        return line.settlementTransactionType && line.settlementTransactionId
          ? `${humanize(line.settlementTransactionType)} - ${line.settlementTransactionId}`
          : line.settlementTransactionId ?? line.settlementTransactionType ?? '-'
      case 'memo':
        return line.memo ?? '-'
      default:
        return '-'
    }
  }

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/clearing-documents'}
      backLabel={isCustomizing ? '<- Back to Clearing Document Detail' : '<- Back to Clearing Documents'}
      meta={clearingDocument.clearingNumber}
      title={clearingDocument.memo?.trim() || 'Clearing Document'}
      widthClassName="w-full max-w-none"
      actions={
          <div className="flex flex-col items-end gap-1">
            <RecordDetailActionBar
              mode={isCustomizing ? 'customize' : 'detail'}
              detailHref={detailHref}
              newHref="/clearing-documents/new"
              exportTitle={clearingDocument.clearingNumber}
              exportFileName={`clearing-document-${clearingDocument.clearingNumber}`}
              exportSections={exportSections}
              customizeHref={`${detailHref}?customize=1`}
              editHref={canEditManualClearing ? `${detailHref}?edit=1` : undefined}
              deleteResource={canDeleteManualDraft ? 'clearing-documents' : undefined}
              deleteId={canDeleteManualDraft ? clearingDocument.id : undefined}
              detailExtraActions={
                <>
                  <ClearingDocumentStatusActions
                    clearingDocumentId={clearingDocument.id}
                    canPost={canPostManualClearing}
                    canReverse={canReverseManualClearing}
                  />
                  {!canEditManualClearing || !canDeleteManualDraft ? (
                    <>
                      {!canEditManualClearing ? (
                        <button
                          type="button"
                          disabled
                          title={clearingDocumentEditLockReason ?? undefined}
                          className="inline-flex cursor-not-allowed items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white opacity-50 shadow-sm"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {!canDeleteManualDraft ? (
                        <button
                          type="button"
                          disabled
                          title={clearingDocumentDeleteLockReason ?? undefined}
                          className="inline-flex cursor-not-allowed items-center rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white opacity-50 shadow-sm"
                        >
                          Delete
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </>
              }
            />
            {clearingDocumentLifecycleHint ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {clearingDocumentLifecycleHint}
              </p>
            ) : null}
          </div>
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={isCustomizing ? null : (
          <TransactionStatsRow
            record={clearingDocument}
            stats={stats}
            visibleStatCards={customization.statCards}
            visibleStatIds={CLEARING_DOCUMENT_STAT_CARDS.map((card) => card.id)}
          />
        )}
        header={
          isCustomizing ? (
            <ClearingDocumentDetailCustomizeMode
              detailHref={detailHref}
              initialLayout={customization}
              fields={customizeFields}
              referenceSourceDefinitions={referenceSourceDefinitions}
              sectionDescriptions={sectionDescriptions}
              statPreviewCards={statPreviewCards}
            />
          ) : (
            <div className="space-y-6">
              {systemSummarySections.length > 0 ? (
                <RecordHeaderDetails
                  editing={false}
                  sections={systemSummarySections}
                  columns={3}
                  containerTitle="How To Read This Clearing"
                  containerDescription="A plain-language summary of what the system clearing did and why this record exists."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                editing={false}
                sections={currencyReadoutSections}
                columns={3}
                containerTitle="4-Currency Context"
                containerDescription="Read the transaction, local, functional, and group layers without assuming untranslated amounts exist."
                showSubsections={false}
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
                  containerDescription="Expanded context from linked records on this clearing document."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                editing={false}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Clearing Document Details"
                containerDescription="Settlement, automation, source, and traceability details for this clearing document."
                showSubsections={false}
              />
            </div>
          )
        }
        lineItems={isCustomizing ? null : (
          <div className="mb-6 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Clearing Lines</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Line-level linkage to open items, settlement applications, and source transactions.
                  </p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: '#93c5fd' }}>
                  {clearingDocument.lines.length}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className={`min-w-full ${lineFontSizeClass}`}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    {visibleLineColumns.map((column) => (
                      <th key={column.id} className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wide ${getLineColumnClassName(column.id)}`} style={{ color: 'var(--text-muted)' }}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clearingDocument.lines.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(visibleLineColumns.length, 1)} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        No clearing lines are attached to this document.
                      </td>
                    </tr>
                  ) : clearingDocument.lines.map((line, index) => (
                    <tr key={line.id} style={index < clearingDocument.lines.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                      {visibleLineColumns.map((column) => (
                        <td key={column.id} className={`px-4 py-2 ${getLineColumnClassName(column.id)}`} style={{ color: 'var(--text-secondary)' }}>
                          {getLineCellValue(line, column.id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        relatedRecords={isCustomizing ? null : (
          <div className="overflow-x-auto">
            {relatedMasterDataRows.length === 0 ? (
              <div className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                No linked master data records are attached to this clearing document yet.
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <RecordDetailHeaderCell>Type</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Reference</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Details</RecordDetailHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {relatedMasterDataRows.map((row, index) => (
                    <tr
                      key={row.id}
                      style={index < relatedMasterDataRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                    >
                      <RecordDetailCell>{row.type}</RecordDetailCell>
                      <RecordDetailCell>
                        {row.href ? (
                          <Link href={row.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                            {row.reference}
                          </Link>
                        ) : (
                          row.reference
                        )}
                      </RecordDetailCell>
                      <RecordDetailCell>{row.name}</RecordDetailCell>
                      <RecordDetailCell className="max-w-[280px] whitespace-pre-wrap break-words">{row.details}</RecordDetailCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        relatedRecordsCount={relatedMasterDataRows.length}
        relatedDocuments={isCustomizing ? null : (
          <div className="overflow-x-auto">
            {relatedDocumentRows.length === 0 ? (
              <div className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                No related transaction documents are attached to this clearing document yet.
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <RecordDetailHeaderCell>Type</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Reference</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Details</RecordDetailHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {relatedDocumentRows.map((row, index) => (
                    <tr
                      key={row.id}
                      style={index < relatedDocumentRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                    >
                      <RecordDetailCell>{row.type}</RecordDetailCell>
                      <RecordDetailCell>
                        {row.href ? (
                          <Link href={row.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                            {row.reference}
                          </Link>
                        ) : (
                          row.reference
                        )}
                      </RecordDetailCell>
                      <RecordDetailCell>{row.name}</RecordDetailCell>
                      <RecordDetailCell className="max-w-[280px] whitespace-pre-wrap break-words">{row.details}</RecordDetailCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        relatedDocumentsCount={relatedDocumentRows.length}
        supplementarySections={
          isCustomizing ? null : (
            [
              <ClearingDocumentGlImpactSection
                key="gl-impact"
                rows={glImpactRows}
                settings={customization.glImpactSettings}
                columnCustomization={customization.glImpactColumns}
              />,
            ]
          )
        }
        communications={isCustomizing ? null : <CommunicationsSection embedded showDisplayControl={false} rows={communications} />}
        communicationsCount={communications.length}
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
      />
    </RecordDetailPageShell>
  )
}
