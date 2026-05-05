import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import BillDetailCustomizeMode from '@/components/BillDetailCustomizeMode'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import DeleteButton from '@/components/DeleteButton'
import BillRelatedDocuments from '@/components/BillRelatedDocuments'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import BillGlImpactSection from '@/components/BillGlImpactSection'
import TransactionFourCurrencySection from '@/components/TransactionFourCurrencySection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionGlImpactRows,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import {
  buildPostedCurrencyReadoutSection,
  CURRENCY_READOUT_SECTION_TITLE,
} from '@/lib/four-currency-readout'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  BILL_DETAIL_FIELDS,
  BILL_REFERENCE_SOURCES,
  BILL_STAT_CARDS,
  type BillDetailFieldKey,
} from '@/lib/bill-detail-customization'
import { loadBillDetailCustomization } from '@/lib/bill-detail-customization-store'

type BillHeaderField = {
  key: BillDetailFieldKey
} & RecordHeaderField

const BILL_STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'pending approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

const BILL_LINE_COLUMNS = [
  { id: 'line' as const, label: 'Line' },
  { id: 'line-type' as const, label: 'Line Type' },
  { id: 'item-id' as const, label: 'Item Id' },
  { id: 'expense-account' as const, label: 'Expense Account' },
  { id: 'description' as const, label: 'Description' },
  { id: 'quantity' as const, label: 'Qty' },
  { id: 'unit-price' as const, label: 'Unit Price' },
  { id: 'line-total' as const, label: 'Line Total' },
  { id: 'notes' as const, label: 'Notes' },
]

export default async function BillDetailPage({
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

  const [bill, billOpenItem, vendors, purchaseOrders, subsidiaries, currencies, items, expenseAccounts, customization] = await Promise.all([
    prisma.bill.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: true,
        user: {
          select: { id: true, userId: true, name: true, email: true },
        },
        subsidiary: true,
        currency: true,
        lineItems: {
          include: {
            item: true,
            expenseAccount: {
              select: { id: true, accountId: true, accountNumber: true, name: true },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        billPayments: true,
      },
    }),
    prisma.openItem.findFirst({
      where: {
        sourceTransactionType: 'bill',
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
    prisma.vendor.findMany({
      orderBy: { vendorNumber: 'asc' },
      where: { inactive: false },
      select: {
        id: true,
        name: true,
        vendorNumber: true,
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, vendorId: true },
      take: 200,
    }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
      select: { id: true, itemId: true, name: true, listPrice: true },
    }),
    prisma.chartOfAccounts.findMany({
      where: {
        active: true,
        isPosting: true,
        accountType: { contains: 'expense', mode: 'insensitive' },
      },
      orderBy: [{ accountNumber: 'asc' }, { accountId: 'asc' }],
      select: { id: true, accountId: true, accountNumber: true, name: true },
      take: 500,
    }),
    loadBillDetailCustomization(),
  ])

  if (!bill) notFound()

  const glImpactEntries = await prisma.journalEntry.findMany({
    where: { sourceId: bill.id },
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
    glSourceNumberByKey.set(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`, bill.number)
  }
  const glImpactRows = buildTransactionGlImpactRows({
    entries: glImpactEntries,
    sourceNumberByKey: glSourceNumberByKey,
    formatDate: (date) => fmtDocumentDate(date, moneySettings),
    toNumericValue: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  })

  const linkedPurchaseOrder = bill.purchaseOrderId
    ? await prisma.purchaseOrder.findUnique({
        where: { id: bill.purchaseOrderId },
        include: {
          requisition: true,
          receipts: true,
        },
      })
    : null

  const detailHref = `/bills/${bill.id}`
  const billLabel = bill.number
  const billDescription = bill.notes?.trim() || 'Bill'

  const activities = await prisma.activity.findMany({
    where: { entityType: 'bill', entityId: id },
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

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`,
  }))
  const purchaseOrderOptions = purchaseOrders
    .filter((purchaseOrder) => !bill.vendorId || purchaseOrder.vendorId === bill.vendorId)
    .map((purchaseOrder) => ({ value: purchaseOrder.id, label: purchaseOrder.number }))
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
  const relatedMasterDataTabs = [
    {
      key: 'vendors',
      label: 'Vendors',
      count: 1,
      emptyMessage: 'No linked vendors.',
      rows: [
        {
          id: bill.vendor.id,
          type: 'Vendor',
          reference: bill.vendor.vendorNumber ?? bill.vendor.id,
          name: bill.vendor.name,
          details: bill.vendor.email ?? bill.vendor.phone ?? 'Linked vendor',
          href: `/vendors/${bill.vendor.id}`,
        },
      ],
    },
    bill.subsidiary
      ? {
          key: 'subsidiaries',
          label: 'Subsidiaries',
          count: 1,
          emptyMessage: 'No linked subsidiaries.',
          rows: [
            {
              id: bill.subsidiary.id,
              type: 'Subsidiary',
              reference: bill.subsidiary.subsidiaryId ?? bill.subsidiary.id,
              name: bill.subsidiary.name,
              details: 'Linked owning subsidiary',
              href: `/subsidiaries/${bill.subsidiary.id}`,
            },
          ],
        }
      : null,
    bill.currency
      ? {
          key: 'currencies',
          label: 'Currencies',
          count: 1,
          emptyMessage: 'No linked currencies.',
          rows: [
            {
              id: bill.currency.id,
              type: 'Currency',
              reference: bill.currency.code ?? bill.currency.currencyId ?? bill.currency.id,
              name: bill.currency.name,
              details: 'Linked transaction currency',
              href: `/currencies/${bill.currency.id}`,
            },
          ],
        }
      : null,
    bill.user
      ? {
          key: 'users',
          label: 'Users',
          count: 1,
          emptyMessage: 'No linked users.',
          rows: [
            {
              id: bill.user.id,
              type: 'User',
              reference: bill.user.userId ?? bill.user.id,
              name: bill.user.name ?? bill.user.email ?? '-',
              details: bill.user.email ?? 'Bill owner',
              href: `/users/${bill.user.id}`,
            },
          ],
        }
      : null,
  ].filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))

  const sectionDescriptions: Record<string, string> = {
    'Document Identity': 'Core bill identifiers and source-document context.',
    'Workflow & Timing': 'Lifecycle status and scheduling dates for this bill.',
    'Sourcing & Financials': 'Organizational, currency, and financial context for this bill.',
    'Record Keys': 'Internal and linked-record identifiers for this bill.',
    'System Dates': 'System-managed timestamps for this bill.',
  }

  const billStats = [
    {
      id: 'total' as const,
      label: 'Total',
      getValue: () => fmtCurrency(bill.total, bill.currency?.code ?? bill.currency?.currencyId ?? undefined, moneySettings),
      getValueTone: () => 'accent' as const,
    },
    {
      id: 'status' as const,
      label: 'Status',
      getValue: () => BILL_STATUS_OPTIONS.find((option) => option.value === bill.status)?.label ?? bill.status,
      getValueTone: () =>
        bill.status === 'paid'
          ? ('green' as const)
          : bill.status === 'pending approval'
            ? ('yellow' as const)
            : bill.status === 'void'
              ? ('red' as const)
              : ('default' as const),
    },
    {
      id: 'date' as const,
      label: 'Bill Date',
      getValue: () => fmtDocumentDate(bill.date, moneySettings),
    },
    {
      id: 'purchaseOrder' as const,
      label: 'Purchase Order',
      getValue: () => bill.purchaseOrder?.number ?? '-',
      getHref: () => (bill.purchaseOrder ? `/purchase-orders/${bill.purchaseOrder.id}` : null),
      getValueTone: () => 'accent' as const,
    },
  ]

  const statPreviewCards = billStats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(),
    href: stat.getHref?.() ?? null,
    valueTone: stat.getValueTone?.(),
    supportsColorized: Boolean(stat.getValueTone),
    supportsLink: Boolean(stat.getHref),
  }))

  const headerFieldDefinitions: Record<string, BillHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: bill.id,
      helpText: 'Internal database identifier for this bill.',
      fieldType: 'text',
      subsectionTitle: 'Bill Details',
      subsectionDescription: 'Core bill fields, linked records, and document totals.',
    },
    number: {
      key: 'number',
      label: 'Business Id',
      value: bill.number,
      helpText: 'Internal operational identifier for this bill.',
      fieldType: 'text',
      subsectionTitle: 'Bill Details',
      subsectionDescription: 'Core bill fields, linked records, and document totals.',
    },
    vendorBillNumber: {
      key: 'vendorBillNumber',
      label: 'Vendor Bill Number',
      value: bill.vendorBillNumber ?? '',
      displayValue: bill.vendorBillNumber ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Vendor-provided invoice or bill reference number.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill identifiers and source-document context.',
    },
    vendorBillDate: {
      key: 'vendorBillDate',
      label: 'Vendor Bill Date',
      value: bill.vendorBillDate ? bill.vendorBillDate.toISOString().slice(0, 10) : '',
      displayValue: bill.vendorBillDate ? fmtDocumentDate(bill.vendorBillDate, moneySettings) : '-',
      editable: true,
      type: 'date',
      helpText: 'Vendor-provided source-document date for this bill.',
      fieldType: 'date',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill identifiers and source-document context.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: bill.vendorId,
      displayValue: (
        <Link href={`/vendors/${bill.vendor.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {bill.vendor.name}
        </Link>
      ),
      editable: true,
      type: 'select',
      options: vendorOptions,
      helpText: 'Vendor linked to this bill.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
      href: `/vendors/${bill.vendor.id}`,
      subsectionTitle: 'Bill Details',
      subsectionDescription: 'Core bill fields, linked records, and document totals.',
    },
    purchaseOrderId: {
      key: 'purchaseOrderId',
      label: 'Purchase Order',
      value: bill.purchaseOrderId ?? '',
      displayValue: bill.purchaseOrder ? (
        <Link href={`/purchase-orders/${bill.purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {bill.purchaseOrder.number}
        </Link>
      ) : '-',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...purchaseOrderOptions],
      helpText: 'Source purchase order for this bill.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      href: bill.purchaseOrder ? `/purchase-orders/${bill.purchaseOrder.id}` : null,
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill identifiers and source-document context.',
    },
    userId: {
      key: 'userId',
      label: 'Created By',
      value: bill.userId ?? '',
      displayValue: bill.user
        ? `${bill.user.userId ?? '-'}${bill.user.name ? ` - ${bill.user.name}` : ''}`
        : bill.userId || '-',
      helpText: 'User who created this bill.',
      fieldType: 'list',
      sourceText: 'Users master data',
      href: bill.user ? `/users/${bill.user.id}` : null,
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked-record identifiers for this bill.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: bill.subsidiaryId ?? '',
      displayValue: bill.subsidiary ? `${bill.subsidiary.subsidiaryId} - ${bill.subsidiary.name}` : '-',
      href: bill.subsidiary ? `/subsidiaries/${bill.subsidiary.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary owning this bill.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: bill.currencyId ?? '',
      displayValue: bill.currency ? `${bill.currency.code ?? bill.currency.currencyId} - ${bill.currency.name}` : '-',
      href: bill.currency ? `/currencies/${bill.currency.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Currency for this bill.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(bill.total),
      displayValue: fmtCurrency(bill.total, bill.currency?.code ?? bill.currency?.currencyId ?? undefined, moneySettings),
      helpText: 'Current bill total based on line items.',
      fieldType: 'currency',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    date: {
      key: 'date',
      label: 'Bill Date',
      value: bill.date.toISOString().slice(0, 10),
      displayValue: fmtDocumentDate(bill.date, moneySettings),
      editable: true,
      type: 'date',
      helpText: 'Date of the bill.',
      fieldType: 'date',
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Lifecycle status and scheduling dates for this bill.',
    },
    dueDate: {
      key: 'dueDate',
      label: 'Due Date',
      value: bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : '',
      displayValue: bill.dueDate ? fmtDocumentDate(bill.dueDate, moneySettings) : '-',
      editable: true,
      type: 'date',
      helpText: 'Payment due date.',
      fieldType: 'date',
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Lifecycle status and scheduling dates for this bill.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: bill.status,
      displayValue: BILL_STATUS_OPTIONS.find((option) => option.value === bill.status)?.label ?? bill.status,
      editable: true,
      type: 'select',
      options: BILL_STATUS_OPTIONS,
      helpText: 'Status of this bill.',
      fieldType: 'list',
      sourceText: 'Bill status list',
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Lifecycle status and scheduling dates for this bill.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: bill.notes ?? '',
      displayValue: bill.notes ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Free-form notes for this bill.',
      fieldType: 'text',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: bill.createdAt.toISOString(),
      displayValue: fmtDocumentDate(bill.createdAt, moneySettings),
      helpText: 'Date/time the bill record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: bill.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(bill.updatedAt, moneySettings),
      helpText: 'Date/time the bill record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill.',
    },
  }

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(
    BILL_REFERENCE_SOURCES,
    {
      purchaseOrder: bill.purchaseOrder,
      owner: bill.user,
      subsidiary: bill.subsidiary,
      currency: bill.currency,
    },
    {
      purchaseOrder: bill.purchaseOrder ? `/purchase-orders/${bill.purchaseOrder.id}` : null,
      owner: bill.user ? `/users/${bill.user.id}` : null,
      subsidiary: bill.subsidiary ? `/subsidiaries/${bill.subsidiary.id}` : null,
      currency: bill.currency ? `/currencies/${bill.currency.id}` : null,
    },
  )
  const allFieldDefinitions: Record<string, RecordHeaderField> = { ...headerFieldDefinitions, ...referenceFieldDefinitions }
  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: BILL_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      userId: bill.user
        ? `${bill.user.userId ?? '-'}${bill.user.name ? ` - ${bill.user.name}` : ''}`
        : bill.userId || '',
      total: fmtCurrency(bill.total, bill.currency?.code ?? bill.currency?.currencyId ?? undefined, moneySettings),
      date: fmtDocumentDate(bill.date, moneySettings),
      dueDate: bill.dueDate ? fmtDocumentDate(bill.dueDate, moneySettings) : '-',
      createdAt: fmtDocumentDate(bill.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(bill.updatedAt, moneySettings),
      status: BILL_STATUS_OPTIONS.find((option) => option.value === bill.status)?.label ?? bill.status,
      subsidiaryId: bill.subsidiary ? `${bill.subsidiary.subsidiaryId} - ${bill.subsidiary.name}` : '-',
      currencyId: bill.currency ? `${bill.currency.code ?? bill.currency.currencyId} - ${bill.currency.name}` : '-',
    },
  })

  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(BILL_REFERENCE_SOURCES, {
    purchaseOrder: bill.purchaseOrder,
    owner: bill.user,
    subsidiary: bill.subsidiary,
    currency: bill.currency,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = BILL_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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

  const lineRows = bill.lineItems.map((line, index) => ({
    id: line.id,
    displayOrder: index,
    lineType: (line.lineType === 'expense' ? 'expense' : 'item') as 'item' | 'expense',
    itemRecordId: line.itemId,
    itemId: line.item?.itemId ?? null,
    itemName: line.item?.name ?? null,
    expenseAccountRecordId: line.expenseAccountId,
    expenseAccountId: line.expenseAccount?.accountId ?? null,
    expenseAccountName: line.expenseAccount?.name ?? null,
    description: line.description,
    notes: line.notes,
    quantity: line.quantity,
    receivedQuantity: 0,
    billedQuantity: line.quantity,
    openQuantity: 0,
    unitPrice: Number(line.unitPrice),
    lineTotal: Number(line.lineTotal),
  }))
  const formatMonetaryValue = (
    value: number | string | null | undefined | { toString(): string; toNumber?: () => number },
    currencyCode?: string | null,
  ) => fmtCurrency(value, currencyCode ?? undefined, moneySettings)
  const currencyReadoutSection = buildPostedCurrencyReadoutSection({
    postingStatus: billOpenItem
      ? billOpenItem.isOpen
        ? `Posted to open item (${billOpenItem.status})`
        : `Posted and settled (${billOpenItem.status})`
      : 'Not posted to open items yet',
    openItemId: billOpenItem?.id ?? null,
    openItemNumber: billOpenItem?.openItemNumber ?? null,
    transactionAmount: billOpenItem?.originalTransactionAmount ?? bill.total,
    transactionCurrencyCode: currencyCodeById.get(billOpenItem?.transactionCurrencyId ?? bill.currencyId ?? '') ?? null,
    transactionCurrencyLabel:
      currencyLabelById.get(billOpenItem?.transactionCurrencyId ?? bill.currencyId ?? '') ??
      (bill.currency ? `${bill.currency.code ?? bill.currency.currencyId} - ${bill.currency.name}` : null),
    localAmount: billOpenItem?.originalLocalAmount ?? null,
    localCurrencyCode: currencyCodeById.get(billOpenItem?.localCurrencyId ?? '') ?? null,
    localCurrencyLabel: currencyLabelById.get(billOpenItem?.localCurrencyId ?? '') ?? null,
    functionalAmount: billOpenItem?.originalFunctionalAmount ?? null,
    functionalCurrencyCode: currencyCodeById.get(billOpenItem?.functionalCurrencyId ?? '') ?? null,
    functionalCurrencyLabel: currencyLabelById.get(billOpenItem?.functionalCurrencyId ?? '') ?? null,
    groupAmount: billOpenItem?.originalGroupAmount ?? null,
    groupCurrencyCode: currencyCodeById.get(billOpenItem?.groupCurrencyId ?? '') ?? null,
    groupCurrencyLabel: currencyLabelById.get(billOpenItem?.groupCurrencyId ?? '') ?? null,
    fxRateType:
      billOpenItem?.originalFunctionalAmount != null || billOpenItem?.originalGroupAmount != null ? 'spot' : null,
    fxRateSource:
      billOpenItem?.originalFunctionalAmount != null || billOpenItem?.originalGroupAmount != null
        ? 'Configured exchange rates'
        : null,
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
    fields: BILL_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: fieldDefinitionsWithCurrency,
    sectionDescriptions: {
      ...sectionDescriptions,
      [CURRENCY_READOUT_SECTION_TITLE]: 'Read the transaction, local, functional, and group amounts from the posted bill context.',
    },
  })
  const configuredCurrencySection =
    configuredHeaderSections.find((section) => section.title === CURRENCY_READOUT_SECTION_TITLE) ?? currencyReadoutSection
  const headerSections = configuredHeaderSections.filter((section) => section.title !== CURRENCY_READOUT_SECTION_TITLE)
  const transactionCurrencyCode =
    currencyCodeById.get(billOpenItem?.transactionCurrencyId ?? bill.currencyId ?? '') ?? null
  const localCurrencyCode = currencyCodeById.get(billOpenItem?.localCurrencyId ?? '') ?? null
  const functionalCurrencyCode = currencyCodeById.get(billOpenItem?.functionalCurrencyId ?? '') ?? null
  const groupCurrencyCode = currencyCodeById.get(billOpenItem?.groupCurrencyId ?? '') ?? null

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/bills'}
      backLabel={isCustomizing ? '<- Back to Bill Detail' : '<- Back to Bills'}
      meta={billLabel}
      title={billDescription}
      widthClassName="w-full max-w-none"
      actions={
        <TransactionActionStack
          mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
          cancelHref={detailHref}
          formId={`inline-record-form-${bill.id}`}
          recordId={bill.id}
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
                  newHref="/bills/new"
                  duplicateHref={`/bills/new?duplicateFrom=${encodeURIComponent(bill.id)}`}
                />
                <MasterDataDetailExportMenu
                  title={billLabel}
                  fileName={`bill-${billLabel}`}
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
                <DeleteButton endpoint="/api/bills" id={bill.id} label={billLabel} />
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
              record={bill}
              stats={billStats}
              visibleStatCards={customization.statCards}
              visibleStatIds={BILL_STAT_CARDS.map((card) => card.id)}
            />
          )
        }
        header={
          isCustomizing ? (
                <BillDetailCustomizeMode
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
                description="Read the transaction, local, functional, and group amounts from the posted bill context."
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
                  containerDescription="Expanded context from linked records on this bill."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={bill.id}
                editing={isEditing}
                updateUrl={`/api/bills?id=${encodeURIComponent(bill.id)}`}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Bill Details"
                containerDescription="Core bill fields organized into configurable sections."
                showSubsections={false}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : (
            <TransactionLineItemsSection
            rows={lineRows}
            editing={isEditing}
            purchaseOrderId={bill.id}
              userId={bill.userId ?? 'system'}
              itemOptions={items.map((item) => ({
              id: item.id,
              itemId: item.itemId ?? 'Pending',
              name: item.name,
              unitPrice: Number(item.listPrice ?? 0),
              itemDrivenValues: {
                description: item.name,
                unitPrice: String(Number(item.listPrice ?? 0)),
              },
              }))}
              accountOptions={expenseAccounts}
              currencyCode={transactionCurrencyCode}
              lineColumns={getOrderedVisibleTransactionLineColumns(BILL_LINE_COLUMNS, customization)}
            lineSettings={customization.lineSettings}
            lineColumnCustomization={customization.lineColumns}
            sectionTitle="Bill Line Items"
            lineItemApiBasePath="/api/bill-line-items"
            parentIdFieldName="billId"
            tableId={`bill-line-items-${bill.id}`}
          />
          )
        }
        relatedMasterData={isCustomizing ? null : (
          <RelatedRecordsSection embedded tabs={relatedMasterDataTabs} showDisplayControl={false} />
        )}
        relatedMasterDataCount={relatedMasterDataTabs.reduce((sum, tab) => sum + tab.count, 0)}
        relatedTransactionDocuments={isCustomizing ? null : (
          <BillRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={transactionCurrencyCode}
            purchaseRequisitions={linkedPurchaseOrder?.requisition ? [{
              id: linkedPurchaseOrder.requisition.id,
              number: linkedPurchaseOrder.requisition.number,
              status: linkedPurchaseOrder.requisition.status,
              total: Number(linkedPurchaseOrder.requisition.total),
              createdAt: linkedPurchaseOrder.requisition.createdAt,
              currencyCode: transactionCurrencyCode,
            }] : []}
            purchaseOrders={bill.purchaseOrder ? [{
              id: bill.purchaseOrder.id,
              number: bill.purchaseOrder.number,
              status: bill.purchaseOrder.status,
              total: Number(bill.purchaseOrder.total),
              createdAt: bill.purchaseOrder.createdAt,
              currencyCode: transactionCurrencyCode,
            }] : []}
            receipts={(linkedPurchaseOrder?.receipts ?? []).map((receipt) => ({
              id: receipt.id,
              number: receipt.id,
              date: receipt.date,
              status: receipt.status,
              quantity: receipt.quantity,
              notes: receipt.notes,
            }))}
            billPayments={bill.billPayments.map((payment) => ({
              id: payment.id,
              number: payment.number,
              date: payment.date,
              status: payment.status,
              amount: Number(payment.amount),
              reference: payment.reference,
              currencyCode: transactionCurrencyCode,
            }))}
            moneySettings={moneySettings}
          />
        )}
        relatedTransactionDocumentsCount={
          (linkedPurchaseOrder?.requisition ? 1 : 0) +
          (bill.purchaseOrder ? 1 : 0) +
          (linkedPurchaseOrder?.receipts.length ?? 0) +
          bill.billPayments.length
        }
        supplementarySections={
          isCustomizing ? null : (
            <BillGlImpactSection
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
            toolbarTargetId="bill-communications-toolbar"
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: bill.id,
              userId: bill.userId ?? null,
              number: bill.number,
              counterpartyName: bill.vendor.name,
              counterpartyEmail: bill.vendor.email,
              status: bill.status,
              total: fmtCurrency(bill.total, bill.currency?.code ?? bill.currency?.currencyId ?? undefined, moneySettings),
              lineItems: bill.lineItems.map((line, index) => ({
                line: index + 1,
                itemId: line.item?.itemId ?? '-',
                description: line.description,
                quantity: line.quantity,
                receivedQuantity: 0,
                openQuantity: 0,
                billedQuantity: line.quantity,
                unitPrice: Number(line.unitPrice),
                lineTotal: Number(line.lineTotal),
              })),
              sendEmailEndpoint: '/api/bills?action=send-email',
              recordIdFieldName: 'billId',
              documentLabel: 'Bill',
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId="bill-communications-toolbar"
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId="bill-system-notes-toolbar" showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId="bill-system-notes-toolbar"
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}
