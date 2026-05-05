import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { sumMoney } from '@/lib/money'
import RecordStatusButton from '@/components/RecordStatusButton'
import SalesOrderCreateInvoiceButton from '@/components/SalesOrderCreateInvoiceButton'
import SalesOrderDetailCustomizeMode from '@/components/SalesOrderDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import SalesOrderRelatedDocuments from '@/components/SalesOrderRelatedDocuments'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  SALES_ORDER_DETAIL_FIELDS,
  SALES_ORDER_LINE_COLUMNS,
  SALES_ORDER_REFERENCE_SOURCES,
  type SalesOrderDetailFieldKey,
  type SalesOrderReferenceFieldKey,
} from '@/lib/sales-order-detail-customization'
import { loadSalesOrderDetailCustomization } from '@/lib/sales-order-detail-customization-store'
import { salesOrderPageConfig, type SalesOrderPageConfigRecord } from '@/lib/transaction-page-configs/sales-order'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import { loadManagedListDetail } from '@/lib/manage-lists'
import {
  getAvailableWorkflowStatusActions,
  getWorkflowDocumentAction,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import type { TransactionStatusColorTone } from '@/lib/company-preferences-definitions'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

function formatSalesOrderStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

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

function getSalesOrderStatusToneKey(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
): TransactionVisualTone {
  return configuredTones[(status ?? '').toLowerCase()] ?? 'default'
}

function formatStatusTone(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
) {
  return getToneStyle(configuredTones[(status ?? '').toLowerCase()] ?? 'default')
}

type SalesOrderHeaderField = {
  key: SalesOrderDetailFieldKey | SalesOrderReferenceFieldKey
} & RecordHeaderField

type SalesOrderLineRow = {
  id: string
  lineNumber: number
  itemRecordId: string | null
  itemId: string | null
  itemName: string | null
  description: string
  quantity: number
  fulfilledQuantity: number
  openQuantity: number
  unitPrice: number
  lineTotal: number
}

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  await connection()
  const { id } = await params
  const { moneySettings } = await loadCompanyDisplaySettings()
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'

  const [salesOrder, activities, customization, subsidiaries, currencies, items, statusListDetail, workflow] = await Promise.all([
    prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
            contacts: {
              orderBy: [{ isPrimaryForCustomer: 'desc' }, { createdAt: 'desc' }],
              select: {
                id: true,
                contactNumber: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                position: true,
                isPrimaryForCustomer: true,
                receivesQuotesSalesOrders: true,
                receivesInvoices: true,
                receivesInvoiceCc: true,
              },
            },
          },
        },
        quote: {
          include: {
            opportunity: true,
          },
        },
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            roleId: true,
            departmentId: true,
            inactive: true,
            locked: true,
            lockedAt: true,
            lastLoginAt: true,
            passwordChangedAt: true,
            mustChangePassword: true,
            failedLoginAttempts: true,
            defaultSubsidiaryId: true,
            includeChildren: true,
            approvalLimit: true,
            approvalCurrencyId: true,
            delegatedApproverUserId: true,
            delegationStartDate: true,
            delegationEndDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        subsidiary: {
          select: {
            id: true,
            subsidiaryId: true,
            name: true,
            legalName: true,
            entityType: true,
            country: true,
            address: true,
            taxId: true,
            registrationNumber: true,
            parentSubsidiaryId: true,
            localCurrencyId: true,
            functionalCurrencyId: true,
            groupCurrencyId: true,
            fiscalCalendarId: true,
            consolidationMethod: true,
            ownershipPercent: true,
            retainedEarningsAccountId: true,
            ctaAccountId: true,
            intercompanyClearingAccountId: true,
            dueToAccountId: true,
            dueFromAccountId: true,
            periodLockDate: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        currency: {
          select: {
            id: true,
            currencyId: true,
            code: true,
            name: true,
            symbol: true,
            decimals: true,
            isBase: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        lineItems: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            item: { select: { id: true, itemId: true, name: true } },
            fulfillmentLines: {
              select: { id: true, quantity: true },
            },
          },
        },
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
              include: {
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
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'sales-order',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadSalesOrderDetailCustomization(),
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
    loadManagedListDetail('SO-STATUS'),
    loadOtcWorkflowRuntime(),
  ])

  if (!salesOrder) notFound()

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
    ])
  )

  const lineRows: SalesOrderLineRow[] = salesOrder.lineItems.map((line, index) => {
    const fulfilledQuantity = line.fulfillmentLines.reduce((sum, row) => sum + row.quantity, 0)
    return {
      id: line.id,
      lineNumber: index + 1,
      itemRecordId: line.item?.id ?? null,
      itemId: line.item?.itemId ?? null,
      itemName: line.item?.name ?? null,
      description: line.description,
      quantity: line.quantity,
      fulfilledQuantity,
      openQuantity: Math.max(0, line.quantity - fulfilledQuantity),
      unitPrice: toNumericValue(line.unitPrice, 0),
      lineTotal: toNumericValue(line.lineTotal, 0),
    }
  })
  const computedTotal = sumMoney(lineRows.map((row) => row.lineTotal))
  const latestInvoice = salesOrder.invoices[0]
  const salesOrderStatusColors = Object.fromEntries(
    (statusListDetail?.rows ?? []).map((row) => [row.value.toLowerCase(), row.colorTone ?? 'default']),
  ) as Record<string, TransactionStatusColorTone>
  const statusTone = formatStatusTone(salesOrder.status, salesOrderStatusColors)
  const detailHref = `/sales-orders/${salesOrder.id}`
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]))
  const salesOrderCurrencyCode = salesOrder.currency?.code ?? salesOrder.currency?.currencyId ?? undefined
  const quoteCurrencyCode = currencyCodeById.get(salesOrder.quote?.currencyId ?? '') ?? null
  const opportunityCurrencyCode = currencyCodeById.get(salesOrder.quote?.opportunity?.currencyId ?? '') ?? null
  const approvalCurrencyCode = currencyCodeById.get(salesOrder.user?.approvalCurrencyId ?? '') ?? null
  const statusOptions = (statusListDetail?.rows ?? []).map((row) => ({
    value: row.value.toLowerCase(),
    label: formatSalesOrderStatus(row.value),
  }))
  const itemOptions = items.map((item) => ({
    id: item.id,
    itemId: item.itemId ?? item.id,
    name: item.name,
    unitPrice: toNumericValue(item.listPrice, 0),
  }))
  const createdByLabel =
    salesOrder.user?.userId && salesOrder.user?.name
      ? `${salesOrder.user.userId} - ${salesOrder.user.name}`
      : salesOrder.user?.userId ?? salesOrder.user?.name ?? salesOrder.user?.email ?? '-'

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

  const allFieldDefinitions: Record<SalesOrderDetailFieldKey | SalesOrderReferenceFieldKey, SalesOrderHeaderField> = {
    customerDbId: {
      key: 'customerDbId',
      label: 'DB Id',
      value: salesOrder.customer.id,
      helpText: 'Internal database identifier for the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: salesOrder.customer.name,
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: salesOrder.customer.customerId ?? '',
      helpText: 'Internal customer identifier from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerEmail: {
      key: 'customerEmail',
      label: 'Email',
      value: salesOrder.customer.email ?? '',
      helpText: 'Primary customer email address.',
      fieldType: 'email',
      sourceText: 'Customers master data',
    },
    customerPhone: {
      key: 'customerPhone',
      label: 'Phone',
      value: salesOrder.customer.phone ?? '',
      helpText: 'Primary customer phone number.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerAddress: {
      key: 'customerAddress',
      label: 'Billing Address',
      value: salesOrder.customer.address ?? '',
      helpText: 'Main billing address from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerIndustry: {
      key: 'customerIndustry',
      label: 'Industry',
      value: salesOrder.customer.industry ?? '',
      helpText: 'Customer industry or segment classification.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerUserDbId: {
      key: 'customerUserDbId',
      label: 'Owner User DB Id',
      value: salesOrder.customer.userId,
      helpText: 'Internal user record linked to the customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerSubsidiaryDbId: {
      key: 'customerSubsidiaryDbId',
      label: 'Primary Subsidiary DB Id',
      value: salesOrder.customer.subsidiaryId ?? '',
      helpText: 'Internal subsidiary record linked to the customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerPrimarySubsidiary: {
      key: 'customerPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: salesOrder.customer.subsidiary ? `${salesOrder.customer.subsidiary.subsidiaryId} - ${salesOrder.customer.subsidiary.name}` : '',
      helpText: 'Default subsidiary context from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerCurrencyDbId: {
      key: 'customerCurrencyDbId',
      label: 'Primary Currency DB Id',
      value: salesOrder.customer.currencyId ?? '',
      helpText: 'Internal currency record linked to the customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerPrimaryCurrency: {
      key: 'customerPrimaryCurrency',
      label: 'Primary Currency',
      value: salesOrder.customer.currency ? `${salesOrder.customer.currency.code} - ${salesOrder.customer.currency.name}` : '',
      helpText: 'Default transaction currency from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerInactive: {
      key: 'customerInactive',
      label: 'Inactive',
      value: salesOrder.customer.inactive ? 'Yes' : 'No',
      helpText: 'Indicates whether the linked customer is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Customers master data',
    },
    customerCreatedAt: {
      key: 'customerCreatedAt',
      label: 'Created',
      value: salesOrder.customer.createdAt.toISOString(),
      displayValue: fmtDocumentDate(salesOrder.customer.createdAt, moneySettings),
      helpText: 'Date/time the linked customer record was created.',
      fieldType: 'date',
      sourceText: 'Customers master data',
    },
    customerUpdatedAt: {
      key: 'customerUpdatedAt',
      label: 'Last Modified',
      value: salesOrder.customer.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(salesOrder.customer.updatedAt, moneySettings),
      helpText: 'Date/time the linked customer record was last modified.',
      fieldType: 'date',
      sourceText: 'Customers master data',
    },
    quoteDbId: {
      key: 'quoteDbId',
      label: 'DB Id',
      value: salesOrder.quote?.id ?? '',
      helpText: 'Internal database identifier for the linked quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteNumber: {
      key: 'quoteNumber',
      label: 'Quote Id',
      value: salesOrder.quote?.number ?? '',
      displayValue: salesOrder.quote ? (
        <Link href={`/quotes/${salesOrder.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {salesOrder.quote.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Quote number linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteStatus: {
      key: 'quoteStatus',
      label: 'Quote Status',
      value: salesOrder.quote?.status ?? '',
      displayValue: salesOrder.quote?.status ? salesOrder.quote.status.charAt(0).toUpperCase() + salesOrder.quote.status.slice(1) : '-',
      helpText: 'Current status of the linked quote.',
      fieldType: 'list',
      sourceText: 'Quote status list',
    },
    quoteTotal: {
      key: 'quoteTotal',
      label: 'Quote Total',
      value: salesOrder.quote ? String(toNumericValue(salesOrder.quote.total, 0)) : '',
        displayValue: salesOrder.quote ? fmtCurrency(toNumericValue(salesOrder.quote.total, 0), quoteCurrencyCode ?? undefined, moneySettings) : '-',
      helpText: 'Current total on the linked quote.',
      fieldType: 'currency',
      sourceText: 'Source transaction',
    },
    quoteValidUntil: {
      key: 'quoteValidUntil',
      label: 'Valid Until',
      value: salesOrder.quote?.validUntil?.toISOString() ?? '',
      displayValue: salesOrder.quote?.validUntil ? fmtDocumentDate(salesOrder.quote.validUntil, moneySettings) : '-',
      helpText: 'Expiration date on the linked quote.',
      fieldType: 'date',
      sourceText: 'Source transaction',
    },
    quoteNotes: {
      key: 'quoteNotes',
      label: 'Notes',
      value: salesOrder.quote?.notes ?? '',
      helpText: 'Internal notes captured on the linked quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteCustomerDbId: {
      key: 'quoteCustomerDbId',
      label: 'Customer DB Id',
      value: salesOrder.quote?.customerId ?? '',
      helpText: 'Internal customer record linked to the quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteUserDbId: {
      key: 'quoteUserDbId',
      label: 'User DB Id',
      value: salesOrder.quote?.userId ?? '',
      helpText: 'Internal owner user record linked to the quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteOpportunityDbId: {
      key: 'quoteOpportunityDbId',
      label: 'Opportunity DB Id',
      value: salesOrder.quote?.opportunityId ?? '',
      helpText: 'Internal opportunity record linked to the quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteSubsidiaryDbId: {
      key: 'quoteSubsidiaryDbId',
      label: 'Subsidiary DB Id',
      value: salesOrder.quote?.subsidiaryId ?? '',
      helpText: 'Internal subsidiary record linked to the quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteCurrencyDbId: {
      key: 'quoteCurrencyDbId',
      label: 'Currency DB Id',
      value: salesOrder.quote?.currencyId ?? '',
      helpText: 'Internal currency record linked to the quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    quoteCreatedAt: {
      key: 'quoteCreatedAt',
      label: 'Created',
      value: salesOrder.quote?.createdAt?.toISOString() ?? '',
      displayValue: salesOrder.quote?.createdAt ? fmtDocumentDate(salesOrder.quote.createdAt, moneySettings) : '-',
      helpText: 'Date/time the linked quote record was created.',
      fieldType: 'date',
      sourceText: 'Source transaction',
    },
    quoteUpdatedAt: {
      key: 'quoteUpdatedAt',
      label: 'Last Modified',
      value: salesOrder.quote?.updatedAt?.toISOString() ?? '',
      displayValue: salesOrder.quote?.updatedAt ? fmtDocumentDate(salesOrder.quote.updatedAt, moneySettings) : '-',
      helpText: 'Date/time the linked quote record was last modified.',
      fieldType: 'date',
      sourceText: 'Source transaction',
    },
    opportunityDbId: {
      key: 'opportunityDbId',
      label: 'DB Id',
      value: salesOrder.quote?.opportunity?.id ?? '',
      helpText: 'Internal database identifier for the linked opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunityNumber: {
      key: 'opportunityNumber',
      label: 'Opportunity Id',
      value: salesOrder.quote?.opportunity?.opportunityNumber ?? '',
      displayValue: salesOrder.quote?.opportunity ? (
        <Link href={`/opportunities/${salesOrder.quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {salesOrder.quote.opportunity.opportunityNumber ?? salesOrder.quote.opportunity.name}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Identifier for the linked opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunityName: {
      key: 'opportunityName',
      label: 'Opportunity Name',
      value: salesOrder.quote?.opportunity?.name ?? '',
      helpText: 'Display name from the linked opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunityAmount: {
      key: 'opportunityAmount',
      label: 'Amount',
      value: salesOrder.quote?.opportunity ? String(toNumericValue(salesOrder.quote.opportunity.amount, 0)) : '',
      displayValue: salesOrder.quote?.opportunity
          ? fmtCurrency(toNumericValue(salesOrder.quote.opportunity.amount, 0), opportunityCurrencyCode ?? undefined, moneySettings)
        : '-',
      helpText: 'Opportunity amount captured on the linked opportunity.',
      fieldType: 'currency',
      sourceText: 'Opportunities',
    },
    opportunityStage: {
      key: 'opportunityStage',
      label: 'Stage',
      value: salesOrder.quote?.opportunity?.stage ?? '',
      displayValue: salesOrder.quote?.opportunity?.stage
        ? salesOrder.quote.opportunity.stage.charAt(0).toUpperCase() + salesOrder.quote.opportunity.stage.slice(1)
        : '-',
      helpText: 'Current sales stage of the linked opportunity.',
      fieldType: 'list',
      sourceText: 'Opportunity stages',
    },
    opportunityCloseDate: {
      key: 'opportunityCloseDate',
      label: 'Close Date',
      value: salesOrder.quote?.opportunity?.closeDate?.toISOString() ?? '',
      displayValue: salesOrder.quote?.opportunity?.closeDate ? fmtDocumentDate(salesOrder.quote.opportunity.closeDate, moneySettings) : '-',
      helpText: 'Expected close date for the linked opportunity.',
      fieldType: 'date',
      sourceText: 'Opportunities',
    },
    opportunityProbability: {
      key: 'opportunityProbability',
      label: 'Probability',
      value: salesOrder.quote?.opportunity?.probability != null ? String(salesOrder.quote.opportunity.probability) : '',
      displayValue: salesOrder.quote?.opportunity?.probability != null ? `${salesOrder.quote.opportunity.probability}%` : '-',
      helpText: 'Win probability captured on the linked opportunity.',
      fieldType: 'number',
      sourceText: 'Opportunities',
    },
    opportunityExpectedValue: {
      key: 'opportunityExpectedValue',
      label: 'Expected Value',
      value: salesOrder.quote?.opportunity ? String(toNumericValue(salesOrder.quote.opportunity.amount, 0)) : '',
      displayValue: salesOrder.quote?.opportunity
          ? fmtCurrency(toNumericValue(salesOrder.quote.opportunity.amount, 0), opportunityCurrencyCode ?? undefined, moneySettings)
        : '-',
      helpText: 'Expected value captured on the linked opportunity.',
      fieldType: 'currency',
      sourceText: 'Opportunities',
    },
    opportunityCustomerDbId: {
      key: 'opportunityCustomerDbId',
      label: 'Customer DB Id',
      value: salesOrder.quote?.opportunity?.customerId ?? '',
      helpText: 'Internal customer record linked to the opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunityUserDbId: {
      key: 'opportunityUserDbId',
      label: 'User DB Id',
      value: salesOrder.quote?.opportunity?.userId ?? '',
      helpText: 'Internal owner user record linked to the opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunitySubsidiaryDbId: {
      key: 'opportunitySubsidiaryDbId',
      label: 'Subsidiary DB Id',
      value: salesOrder.quote?.opportunity?.subsidiaryId ?? '',
      helpText: 'Internal subsidiary record linked to the opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunityCurrencyDbId: {
      key: 'opportunityCurrencyDbId',
      label: 'Currency DB Id',
      value: salesOrder.quote?.opportunity?.currencyId ?? '',
      helpText: 'Internal currency record linked to the opportunity.',
      fieldType: 'text',
      sourceText: 'Opportunities',
    },
    opportunityInactive: {
      key: 'opportunityInactive',
      label: 'Inactive',
      value: salesOrder.quote?.opportunity ? (salesOrder.quote.opportunity.inactive ? 'Yes' : 'No') : '',
      displayValue: salesOrder.quote?.opportunity ? (salesOrder.quote.opportunity.inactive ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked opportunity is inactive.',
      fieldType: 'checkbox',
      sourceText: 'Opportunities',
    },
    opportunityCreatedAt: {
      key: 'opportunityCreatedAt',
      label: 'Created',
      value: salesOrder.quote?.opportunity?.createdAt?.toISOString() ?? '',
      displayValue: salesOrder.quote?.opportunity?.createdAt ? fmtDocumentDate(salesOrder.quote.opportunity.createdAt, moneySettings) : '-',
      helpText: 'Date/time the linked opportunity record was created.',
      fieldType: 'date',
      sourceText: 'Opportunities',
    },
    opportunityUpdatedAt: {
      key: 'opportunityUpdatedAt',
      label: 'Last Modified',
      value: salesOrder.quote?.opportunity?.updatedAt?.toISOString() ?? '',
      displayValue: salesOrder.quote?.opportunity?.updatedAt ? fmtDocumentDate(salesOrder.quote.opportunity.updatedAt, moneySettings) : '-',
      helpText: 'Date/time the linked opportunity record was last modified.',
      fieldType: 'date',
      sourceText: 'Opportunities',
    },
    ownerDbId: {
      key: 'ownerDbId',
      label: 'DB Id',
      value: salesOrder.user?.id ?? '',
      helpText: 'Internal database identifier for the linked user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerUserId: {
      key: 'ownerUserId',
      label: 'User Id',
      value: salesOrder.user?.userId ?? '',
      helpText: 'User identifier for the record owner/creator.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerName: {
      key: 'ownerName',
      label: 'Name',
      value: salesOrder.user?.name ?? '',
      helpText: 'Display name for the linked user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerEmail: {
      key: 'ownerEmail',
      label: 'Email',
      value: salesOrder.user?.email ?? '',
      helpText: 'Email address for the linked user.',
      fieldType: 'email',
      sourceText: 'Users master data',
    },
    ownerRoleDbId: {
      key: 'ownerRoleDbId',
      label: 'Role DB Id',
      value: salesOrder.user?.roleId ?? '',
      helpText: 'Internal role record linked to the user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerDepartmentDbId: {
      key: 'ownerDepartmentDbId',
      label: 'Department DB Id',
      value: salesOrder.user?.departmentId ?? '',
      helpText: 'Internal department record linked to the user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerInactive: {
      key: 'ownerInactive',
      label: 'Inactive',
      value: salesOrder.user ? (salesOrder.user.inactive ? 'Yes' : 'No') : '',
      displayValue: salesOrder.user ? (salesOrder.user.inactive ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked user is inactive.',
      fieldType: 'checkbox',
      sourceText: 'Users master data',
    },
    ownerLocked: {
      key: 'ownerLocked',
      label: 'Locked',
      value: salesOrder.user ? (salesOrder.user.locked ? 'Yes' : 'No') : '',
      displayValue: salesOrder.user ? (salesOrder.user.locked ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked user account is locked.',
      fieldType: 'checkbox',
      sourceText: 'Users master data',
    },
    ownerLockedAt: {
      key: 'ownerLockedAt',
      label: 'Locked At',
      value: salesOrder.user?.lockedAt?.toISOString() ?? '',
      displayValue: salesOrder.user?.lockedAt ? fmtDocumentDate(salesOrder.user.lockedAt, moneySettings) : '-',
      helpText: 'Timestamp when the linked user account was locked.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    ownerLastLoginAt: {
      key: 'ownerLastLoginAt',
      label: 'Last Login',
      value: salesOrder.user?.lastLoginAt?.toISOString() ?? '',
      displayValue: salesOrder.user?.lastLoginAt ? fmtDocumentDate(salesOrder.user.lastLoginAt, moneySettings) : '-',
      helpText: 'Timestamp of the linked user’s last login.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    ownerPasswordChangedAt: {
      key: 'ownerPasswordChangedAt',
      label: 'Password Changed',
      value: salesOrder.user?.passwordChangedAt?.toISOString() ?? '',
      displayValue: salesOrder.user?.passwordChangedAt ? fmtDocumentDate(salesOrder.user.passwordChangedAt, moneySettings) : '-',
      helpText: 'Timestamp when the linked user last changed password.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    ownerMustChangePassword: {
      key: 'ownerMustChangePassword',
      label: 'Must Change Password',
      value: salesOrder.user ? (salesOrder.user.mustChangePassword ? 'Yes' : 'No') : '',
      displayValue: salesOrder.user ? (salesOrder.user.mustChangePassword ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked user must change password at next login.',
      fieldType: 'checkbox',
      sourceText: 'Users master data',
    },
    ownerFailedLoginAttempts: {
      key: 'ownerFailedLoginAttempts',
      label: 'Failed Login Attempts',
      value: salesOrder.user?.failedLoginAttempts != null ? String(salesOrder.user.failedLoginAttempts) : '',
      helpText: 'Current failed login attempt count for the linked user.',
      fieldType: 'number',
      sourceText: 'Users master data',
    },
    ownerDefaultSubsidiaryDbId: {
      key: 'ownerDefaultSubsidiaryDbId',
      label: 'Default Subsidiary DB Id',
      value: salesOrder.user?.defaultSubsidiaryId ?? '',
      helpText: 'Internal default subsidiary linked to the user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerIncludeChildren: {
      key: 'ownerIncludeChildren',
      label: 'Include Children',
      value: salesOrder.user ? (salesOrder.user.includeChildren ? 'Yes' : 'No') : '',
      displayValue: salesOrder.user ? (salesOrder.user.includeChildren ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the user includes child subsidiaries by default.',
      fieldType: 'checkbox',
      sourceText: 'Users master data',
    },
    ownerApprovalLimit: {
      key: 'ownerApprovalLimit',
      label: 'Approval Limit',
      value: salesOrder.user?.approvalLimit != null ? String(toNumericValue(salesOrder.user.approvalLimit, 0)) : '',
      displayValue: salesOrder.user?.approvalLimit != null ? fmtCurrency(toNumericValue(salesOrder.user.approvalLimit, 0), approvalCurrencyCode ?? undefined, moneySettings) : '-',
      helpText: 'Approval limit captured on the linked user.',
      fieldType: 'currency',
      sourceText: 'Users master data',
    },
    ownerApprovalCurrencyDbId: {
      key: 'ownerApprovalCurrencyDbId',
      label: 'Approval Currency DB Id',
      value: salesOrder.user?.approvalCurrencyId ?? '',
      helpText: 'Internal approval currency linked to the user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerDelegatedApproverDbId: {
      key: 'ownerDelegatedApproverDbId',
      label: 'Delegated Approver DB Id',
      value: salesOrder.user?.delegatedApproverUserId ?? '',
      helpText: 'Internal delegated approver user linked to the user.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    ownerDelegationStartDate: {
      key: 'ownerDelegationStartDate',
      label: 'Delegation Start',
      value: salesOrder.user?.delegationStartDate?.toISOString() ?? '',
      displayValue: salesOrder.user?.delegationStartDate ? fmtDocumentDate(salesOrder.user.delegationStartDate, moneySettings) : '-',
      helpText: 'Delegation start date on the linked user.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    ownerDelegationEndDate: {
      key: 'ownerDelegationEndDate',
      label: 'Delegation End',
      value: salesOrder.user?.delegationEndDate?.toISOString() ?? '',
      displayValue: salesOrder.user?.delegationEndDate ? fmtDocumentDate(salesOrder.user.delegationEndDate, moneySettings) : '-',
      helpText: 'Delegation end date on the linked user.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    ownerCreatedAt: {
      key: 'ownerCreatedAt',
      label: 'Created',
      value: salesOrder.user?.createdAt?.toISOString() ?? '',
      displayValue: salesOrder.user?.createdAt ? fmtDocumentDate(salesOrder.user.createdAt, moneySettings) : '-',
      helpText: 'Date/time the linked user record was created.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    ownerUpdatedAt: {
      key: 'ownerUpdatedAt',
      label: 'Last Modified',
      value: salesOrder.user?.updatedAt?.toISOString() ?? '',
      displayValue: salesOrder.user?.updatedAt ? fmtDocumentDate(salesOrder.user.updatedAt, moneySettings) : '-',
      helpText: 'Date/time the linked user record was last modified.',
      fieldType: 'date',
      sourceText: 'Users master data',
    },
    subsidiaryDbId: {
      key: 'subsidiaryDbId',
      label: 'DB Id',
      value: salesOrder.subsidiary?.id ?? '',
      helpText: 'Internal database identifier for the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryCode: {
      key: 'subsidiaryCode',
      label: 'Subsidiary Id',
      value: salesOrder.subsidiary?.subsidiaryId ?? '',
      helpText: 'Identifier for the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryName: {
      key: 'subsidiaryName',
      label: 'Subsidiary Name',
      value: salesOrder.subsidiary?.name ?? '',
      helpText: 'Display name for the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryLegalName: {
      key: 'subsidiaryLegalName',
      label: 'Legal Name',
      value: salesOrder.subsidiary?.legalName ?? '',
      helpText: 'Legal entity name for the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryEntityType: {
      key: 'subsidiaryEntityType',
      label: 'Entity Type',
      value: salesOrder.subsidiary?.entityType ?? '',
      helpText: 'Entity type captured on the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryCountry: {
      key: 'subsidiaryCountry',
      label: 'Country',
      value: salesOrder.subsidiary?.country ?? '',
      helpText: 'Country captured on the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryAddress: {
      key: 'subsidiaryAddress',
      label: 'Address',
      value: salesOrder.subsidiary?.address ?? '',
      helpText: 'Address captured on the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryTaxId: {
      key: 'subsidiaryTaxId',
      label: 'Tax Id',
      value: salesOrder.subsidiary?.taxId ?? '',
      helpText: 'Tax identifier for the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryRegistrationNumber: {
      key: 'subsidiaryRegistrationNumber',
      label: 'Registration Number',
      value: salesOrder.subsidiary?.registrationNumber ?? '',
      helpText: 'Registration number for the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryParentDbId: {
      key: 'subsidiaryParentDbId',
      label: 'Parent Subsidiary DB Id',
      value: salesOrder.subsidiary?.parentSubsidiaryId ?? '',
      helpText: 'Internal parent subsidiary linked to this subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryLocalCurrencyDbId: {
      key: 'subsidiaryLocalCurrencyDbId',
      label: 'Local Currency DB Id',
      value: salesOrder.subsidiary?.localCurrencyId ?? '',
      helpText: 'Internal local currency linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryFunctionalCurrencyDbId: {
      key: 'subsidiaryFunctionalCurrencyDbId',
      label: 'Functional Currency DB Id',
      value: salesOrder.subsidiary?.functionalCurrencyId ?? '',
      helpText: 'Internal functional currency linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryGroupCurrencyDbId: {
      key: 'subsidiaryGroupCurrencyDbId',
      label: 'Group Currency DB Id',
      value: salesOrder.subsidiary?.groupCurrencyId ?? '',
      helpText: 'Internal group currency linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryFiscalCalendarDbId: {
      key: 'subsidiaryFiscalCalendarDbId',
      label: 'Fiscal Calendar DB Id',
      value: salesOrder.subsidiary?.fiscalCalendarId ?? '',
      helpText: 'Internal fiscal calendar linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryConsolidationMethod: {
      key: 'subsidiaryConsolidationMethod',
      label: 'Consolidation Method',
      value: salesOrder.subsidiary?.consolidationMethod ?? '',
      helpText: 'Consolidation method captured on the linked subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryOwnershipPercent: {
      key: 'subsidiaryOwnershipPercent',
      label: 'Ownership %',
      value: salesOrder.subsidiary?.ownershipPercent != null ? String(salesOrder.subsidiary.ownershipPercent) : '',
      displayValue: salesOrder.subsidiary?.ownershipPercent != null ? `${salesOrder.subsidiary.ownershipPercent}%` : '-',
      helpText: 'Ownership percentage captured on the linked subsidiary.',
      fieldType: 'number',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryRetainedEarningsAccountDbId: {
      key: 'subsidiaryRetainedEarningsAccountDbId',
      label: 'Retained Earnings Account DB Id',
      value: salesOrder.subsidiary?.retainedEarningsAccountId ?? '',
      helpText: 'Internal retained earnings account linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryCtaAccountDbId: {
      key: 'subsidiaryCtaAccountDbId',
      label: 'CTA Account DB Id',
      value: salesOrder.subsidiary?.ctaAccountId ?? '',
      helpText: 'Internal CTA account linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryIntercompanyClearingAccountDbId: {
      key: 'subsidiaryIntercompanyClearingAccountDbId',
      label: 'Intercompany Clearing Account DB Id',
      value: salesOrder.subsidiary?.intercompanyClearingAccountId ?? '',
      helpText: 'Internal intercompany clearing account linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryDueToAccountDbId: {
      key: 'subsidiaryDueToAccountDbId',
      label: 'Due To Account DB Id',
      value: salesOrder.subsidiary?.dueToAccountId ?? '',
      helpText: 'Internal due-to account linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryDueFromAccountDbId: {
      key: 'subsidiaryDueFromAccountDbId',
      label: 'Due From Account DB Id',
      value: salesOrder.subsidiary?.dueFromAccountId ?? '',
      helpText: 'Internal due-from account linked to the subsidiary.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryPeriodLockDate: {
      key: 'subsidiaryPeriodLockDate',
      label: 'Period Lock Date',
      value: salesOrder.subsidiary?.periodLockDate?.toISOString() ?? '',
      displayValue: salesOrder.subsidiary?.periodLockDate ? fmtDocumentDate(salesOrder.subsidiary.periodLockDate, moneySettings) : '-',
      helpText: 'Period lock date on the linked subsidiary.',
      fieldType: 'date',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryActive: {
      key: 'subsidiaryActive',
      label: 'Active',
      value: salesOrder.subsidiary ? (salesOrder.subsidiary.active ? 'Yes' : 'No') : '',
      displayValue: salesOrder.subsidiary ? (salesOrder.subsidiary.active ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked subsidiary is active.',
      fieldType: 'checkbox',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryCreatedAt: {
      key: 'subsidiaryCreatedAt',
      label: 'Created',
      value: salesOrder.subsidiary?.createdAt?.toISOString() ?? '',
      displayValue: salesOrder.subsidiary?.createdAt ? fmtDocumentDate(salesOrder.subsidiary.createdAt, moneySettings) : '-',
      helpText: 'Date/time the linked subsidiary record was created.',
      fieldType: 'date',
      sourceText: 'Subsidiaries master data',
    },
    subsidiaryUpdatedAt: {
      key: 'subsidiaryUpdatedAt',
      label: 'Last Modified',
      value: salesOrder.subsidiary?.updatedAt?.toISOString() ?? '',
      displayValue: salesOrder.subsidiary?.updatedAt ? fmtDocumentDate(salesOrder.subsidiary.updatedAt, moneySettings) : '-',
      helpText: 'Date/time the linked subsidiary record was last modified.',
      fieldType: 'date',
      sourceText: 'Subsidiaries master data',
    },
    currencyDbId: {
      key: 'currencyDbId',
      label: 'DB Id',
      value: salesOrder.currency?.id ?? '',
      helpText: 'Internal database identifier for the linked currency.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
    },
    currencyCode: {
      key: 'currencyCode',
      label: 'Currency Code',
      value: salesOrder.currency?.code ?? salesOrder.currency?.currencyId ?? '',
      helpText: 'Transaction currency code from the linked currency record.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
    },
    currencyNumber: {
      key: 'currencyNumber',
      label: 'Currency Id',
      value: salesOrder.currency?.currencyId ?? '',
      helpText: 'Internal currency identifier from the linked currency record.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
    },
    currencyName: {
      key: 'currencyName',
      label: 'Currency Name',
      value: salesOrder.currency?.name ?? '',
      helpText: 'Display name from the linked currency record.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
    },
    currencySymbol: {
      key: 'currencySymbol',
      label: 'Symbol',
      value: salesOrder.currency?.symbol ?? '',
      helpText: 'Display symbol for the linked currency.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
    },
    currencyDecimals: {
      key: 'currencyDecimals',
      label: 'Decimals',
      value: salesOrder.currency?.decimals != null ? String(salesOrder.currency.decimals) : '',
      helpText: 'Decimal precision configured for the linked currency.',
      fieldType: 'number',
      sourceText: 'Currencies master data',
    },
    currencyIsBase: {
      key: 'currencyIsBase',
      label: 'Is Base',
      value: salesOrder.currency ? (salesOrder.currency.isBase ? 'Yes' : 'No') : '',
      displayValue: salesOrder.currency ? (salesOrder.currency.isBase ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked currency is the base currency.',
      fieldType: 'checkbox',
      sourceText: 'Currencies master data',
    },
    currencyActive: {
      key: 'currencyActive',
      label: 'Active',
      value: salesOrder.currency ? (salesOrder.currency.active ? 'Yes' : 'No') : '',
      displayValue: salesOrder.currency ? (salesOrder.currency.active ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked currency is active.',
      fieldType: 'checkbox',
      sourceText: 'Currencies master data',
    },
    currencyCreatedAt: {
      key: 'currencyCreatedAt',
      label: 'Created',
      value: salesOrder.currency?.createdAt?.toISOString() ?? '',
      displayValue: salesOrder.currency?.createdAt ? fmtDocumentDate(salesOrder.currency.createdAt, moneySettings) : '-',
      helpText: 'Date/time the linked currency record was created.',
      fieldType: 'date',
      sourceText: 'Currencies master data',
    },
    currencyUpdatedAt: {
      key: 'currencyUpdatedAt',
      label: 'Last Modified',
      value: salesOrder.currency?.updatedAt?.toISOString() ?? '',
      displayValue: salesOrder.currency?.updatedAt ? fmtDocumentDate(salesOrder.currency.updatedAt, moneySettings) : '-',
      helpText: 'Date/time the linked currency record was last modified.',
      fieldType: 'date',
      sourceText: 'Currencies master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: salesOrder.id,
      helpText: 'Internal database identifier for the sales order record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    number: {
      key: 'number',
      label: 'Sales Order Id',
      value: salesOrder.number,
      editable: true,
      type: 'text',
      helpText: 'Unique sales order number used across OTC workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer Id',
      value: salesOrder.customer.customerId ?? '',
      helpText: 'Customer identifier linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Customers master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: salesOrder.user?.userId ?? '',
      helpText: 'User identifier for the creator/owner of the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    quoteId: {
      key: 'quoteId',
      label: 'Quote Id',
      value: salesOrder.quote?.number ?? '',
      helpText: 'Quote identifier linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      helpText: 'User who created the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: salesOrder.quote?.number ?? '',
      displayValue: salesOrder.quote ? (
        <Link href={`/quotes/${salesOrder.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {salesOrder.quote.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Source quote that created this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity Id',
      value: salesOrder.quote?.opportunity?.opportunityNumber ?? '',
      displayValue: salesOrder.quote?.opportunity ? (
        <Link href={`/opportunities/${salesOrder.quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {salesOrder.quote.opportunity.opportunityNumber ?? salesOrder.quote.opportunity.name}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Opportunity linked through the source quote.',
      fieldType: 'text',
      sourceText: 'Opportunities',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: salesOrder.subsidiaryId ?? '',
      href: salesOrder.subsidiary ? `/subsidiaries/${salesOrder.subsidiary.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: salesOrder.subsidiary ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}` : '-',
      helpText: 'Subsidiary that owns the sales order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: salesOrder.currencyId ?? '',
      href: salesOrder.currency ? `/currencies/${salesOrder.currency.id}` : null,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: salesOrder.currency ? `${salesOrder.currency.code} - ${salesOrder.currency.name}` : '-',
      helpText: 'Transaction currency for the sales order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: salesOrder.status ?? '',
      displayValue: formatSalesOrderStatus(salesOrder.status),
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the sales order.',
      fieldType: 'list',
      sourceText: 'Sales order status list',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: computedTotal.toString(),
      displayValue: fmtCurrency(computedTotal, salesOrderCurrencyCode, moneySettings),
      helpText: 'Current document total based on all sales order line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: salesOrder.createdAt.toISOString(),
      displayValue: fmtDocumentDate(salesOrder.createdAt, moneySettings),
      helpText: 'Date/time the sales order record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this sales order record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: salesOrder.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(salesOrder.updatedAt, moneySettings),
      helpText: 'Date/time the sales order record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this sales order record.',
    },
  }

  const customerHref = `/customers/${salesOrder.customer.id}`
  const quoteHref = salesOrder.quote ? `/quotes/${salesOrder.quote.id}` : null
  const opportunityHref = salesOrder.quote?.opportunity ? `/opportunities/${salesOrder.quote.opportunity.id}` : null
  const ownerHref = salesOrder.user ? `/users/${salesOrder.user.id}` : null
  const subsidiaryHref = salesOrder.subsidiary ? `/subsidiaries/${salesOrder.subsidiary.id}` : null
  const currencyHref = salesOrder.currency ? `/currencies/${salesOrder.currency.id}` : null

  const assignHrefByPrefix = (prefix: string, href: string | null) => {
    if (!href) return
    for (const [key, field] of Object.entries(allFieldDefinitions)) {
      if (
        key.startsWith(prefix) &&
        (field.label.includes('Id') || field.label.includes('#') || key.toLowerCase().includes('number'))
      ) {
        field.href = href
      }
    }
  }

  assignHrefByPrefix('customer', customerHref)
  assignHrefByPrefix('quote', quoteHref)
  assignHrefByPrefix('opportunity', opportunityHref)
  assignHrefByPrefix('owner', ownerHref)
  assignHrefByPrefix('subsidiary', subsidiaryHref)
  assignHrefByPrefix('currency', currencyHref)

  allFieldDefinitions.customerId.href = customerHref
  allFieldDefinitions.userId.href = ownerHref
  allFieldDefinitions.quoteId.href = quoteHref
  allFieldDefinitions.createdFrom.href = quoteHref
  allFieldDefinitions.opportunityId.href = opportunityHref
  allFieldDefinitions.subsidiaryId.href = subsidiaryHref
  allFieldDefinitions.currencyId.href = currencyHref

  const headerSections = buildConfiguredTransactionSections({
    fields: SALES_ORDER_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: allFieldDefinitions as Record<SalesOrderDetailFieldKey, SalesOrderHeaderField>,
    sectionDescriptions: salesOrderPageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: SALES_ORDER_DETAIL_FIELDS,
    fieldDefinitions: allFieldDefinitions as Record<SalesOrderDetailFieldKey, SalesOrderHeaderField>,
    previewOverrides: {
      id: salesOrder.id,
      customerId: salesOrder.customer.customerId ?? '',
      userId: salesOrder.user?.userId ?? '',
      quoteId: salesOrder.quote?.number ?? '',
      createdBy: createdByLabel,
      createdFrom: salesOrder.quote?.number ?? '',
      opportunityId: salesOrder.quote?.opportunity?.opportunityNumber ?? '',
      subsidiaryId: salesOrder.subsidiary ? `${salesOrder.subsidiary.subsidiaryId} - ${salesOrder.subsidiary.name}` : '',
      currencyId: salesOrder.currency ? `${salesOrder.currency.code} - ${salesOrder.currency.name}` : '',
      status: formatSalesOrderStatus(salesOrder.status),
      total: fmtCurrency(computedTotal, salesOrderCurrencyCode, moneySettings),
      createdAt: fmtDocumentDate(salesOrder.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(salesOrder.updatedAt, moneySettings),
    },
  })
  const referenceSourceDefinitions = SALES_ORDER_REFERENCE_SOURCES.map((source) => ({
    ...source,
    fields: source.fields.map((field) => ({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      source: field.source,
      description: field.description,
      previewValue: allFieldDefinitions[field.id]?.value ?? '',
    })),
  }))
  const referenceSections = customization.referenceLayouts
    .map((referenceLayout) => {
      const source = SALES_ORDER_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
          id: referenceLayout.id,
          title: source.label,
          description: source.description,
          columns: referenceLayout.formColumns,
          rows: Math.max(
            1,
            ...fields.map((field) => Math.max(1, (field.order ?? 0) + 1)),
          ),
          fields,
        }
      })
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
  const referenceColumns = Math.max(1, ...referenceSections.map((section) => section.columns))

  const visibleLineColumnOrder = getOrderedVisibleTransactionLineColumns(
    SALES_ORDER_LINE_COLUMNS,
    customization
  )
  const poCompatibleLineColumns = visibleLineColumnOrder
    .map((column) => {
      if (column.id === 'fulfilled-qty') {
        return { id: 'received-qty' as const, label: column.label }
      }
      return column.id === 'line' ||
        column.id === 'item-id' ||
        column.id === 'description' ||
        column.id === 'quantity' ||
        column.id === 'open-qty' ||
        column.id === 'unit-price' ||
        column.id === 'line-total'
        ? column
        : null
    })
    .filter((column): column is { id: 'line' | 'item-id' | 'description' | 'quantity' | 'received-qty' | 'open-qty' | 'unit-price' | 'line-total'; label: string } => Boolean(column))
  const poCompatibleLineColumnCustomization = {
    line: customization.lineColumns.line,
    'item-id': customization.lineColumns['item-id'],
    description: customization.lineColumns.description,
    quantity: customization.lineColumns.quantity,
    'received-qty': customization.lineColumns['fulfilled-qty'],
    'open-qty': customization.lineColumns['open-qty'],
    'unit-price': customization.lineColumns['unit-price'],
    'line-total': customization.lineColumns['line-total'],
  }
  const statsRecord = {
    id: salesOrder.id,
    total: computedTotal,
    currencyCode: salesOrderCurrencyCode ?? null,
    createdFrom: salesOrder.quote?.number ?? null,
    lineCount: lineRows.length,
    statusLabel: formatSalesOrderStatus(salesOrder.status),
    statusTone: getSalesOrderStatusToneKey(salesOrder.status, salesOrderStatusColors),
    customerId: salesOrder.customer.customerId ?? null,
    customerHref: `/customers/${salesOrder.customer.id}`,
    userId: salesOrder.user?.userId ?? null,
    quoteId: salesOrder.quote?.number ?? null,
    quoteHref: salesOrder.quote ? `/quotes/${salesOrder.quote.id}` : null,
    opportunityId: salesOrder.quote?.opportunity?.opportunityNumber ?? null,
    opportunityHref: salesOrder.quote?.opportunity ? `/opportunities/${salesOrder.quote.opportunity.id}` : null,
    subsidiaryId: salesOrder.subsidiary?.subsidiaryId ?? null,
    currencyId: salesOrder.currency?.currencyId ?? salesOrder.currency?.code ?? null,
    createdAt: fmtDocumentDate(salesOrder.createdAt, moneySettings),
    updatedAt: fmtDocumentDate(salesOrder.updatedAt, moneySettings),
    moneySettings,
  } satisfies SalesOrderPageConfigRecord
  const statPreviewCards = salesOrderPageConfig.stats.map((stat) => ({
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
  const salesOrderStatusActions = getAvailableWorkflowStatusActions(workflow, 'sales-order', salesOrder.status)
  const createInvoiceAction = getWorkflowDocumentAction(workflow, 'sales-order', 'invoice', salesOrder.status)
  const relatedDocumentsCount =
    (salesOrder.quote?.opportunity ? 1 : 0) +
    (salesOrder.quote ? 1 : 0) +
    salesOrder.fulfillments.length +
    salesOrder.invoices.length +
    salesOrder.invoices.reduce((sum, invoice) => sum + invoice.cashReceipts.length, 0)
  const communicationsToolbarTargetId = 'sales-order-communications-toolbar'
  const systemNotesToolbarTargetId = 'sales-order-system-notes-toolbar'
  const relatedRecordTabs = [
    {
      key: 'contacts',
      label: 'Contacts',
      count: salesOrder.customer.contacts.length,
      emptyMessage: 'No customer contacts are linked to this sales order yet.',
      rows: salesOrder.customer.contacts.map((contact) => ({
        id: contact.id,
        type: contact.isPrimaryForCustomer ? 'Primary Contact' : 'Contact',
        reference: contact.contactNumber ?? contact.id,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        details:
          [
            contact.position,
            contact.email,
            contact.phone,
            contact.receivesQuotesSalesOrders ? 'Receives Quote/SO' : null,
            contact.receivesInvoices ? 'Receives Invoices' : null,
            contact.receivesInvoiceCc ? 'Invoice CC' : null,
          ]
            .filter(Boolean)
            .join(' | ') || '-',
        href: `/contacts/${contact.id}`,
      })),
    },
    {
      key: 'core-links',
      label: 'Core Links',
      count:
        1 +
        (salesOrder.user ? 1 : 0) +
        (salesOrder.subsidiary ? 1 : 0) +
        (salesOrder.currency ? 1 : 0),
      emptyMessage: 'No core linked records are available for this sales order.',
      rows: [
        {
          id: `customer-${salesOrder.customer.id}`,
          type: 'Customer',
          reference: salesOrder.customer.customerId ?? salesOrder.customer.id,
          name: salesOrder.customer.name,
          details: [salesOrder.customer.email, salesOrder.customer.phone].filter(Boolean).join(' | ') || '-',
          href: customerHref,
        },
        salesOrder.user
          ? {
              id: `user-${salesOrder.user.id}`,
              type: 'Owner',
              reference: salesOrder.user.userId ?? salesOrder.user.id,
              name: salesOrder.user.name ?? salesOrder.user.email ?? '-',
              details: salesOrder.user.email ?? '-',
              href: ownerHref,
            }
          : null,
        salesOrder.subsidiary
          ? {
              id: `subsidiary-${salesOrder.subsidiary.id}`,
              type: 'Subsidiary',
              reference: salesOrder.subsidiary.subsidiaryId,
              name: salesOrder.subsidiary.name,
              details: salesOrder.subsidiary.country ?? salesOrder.subsidiary.entityType ?? '-',
              href: subsidiaryHref,
            }
          : null,
        salesOrder.currency
          ? {
              id: `currency-${salesOrder.currency.id}`,
              type: 'Currency',
              reference: salesOrder.currency.currencyId ?? salesOrder.currency.code ?? salesOrder.currency.id,
              name: salesOrder.currency.name,
              details: salesOrder.currency.symbol ?? salesOrder.currency.code ?? '-',
              href: currencyHref,
            }
          : null,
      ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    },
  ]

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/sales-orders'}
      backLabel={isCustomizing ? '<- Back to Sales Order Detail' : '<- Back to Sales Orders'}
      meta={salesOrder.number}
      title={salesOrder.customer.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Sales Order
          </span>
          <span
            className="inline-flex rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: statusTone.bg, color: statusTone.color }}
          >
            {formatSalesOrderStatus(salesOrder.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {salesOrderStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="sales-orders"
                id={salesOrder.id}
                status={action.nextValue}
                label={action.label}
                tone={action.tone}
                fieldName={action.fieldName}
                workflowStep={action.step}
                workflowActionId={action.id}
              />
            ))}
            {createInvoiceAction || latestInvoice ? (
              <SalesOrderCreateInvoiceButton salesOrderId={salesOrder.id} existingInvoiceId={latestInvoice?.id} />
            ) : null}
          </div>
        ) : null
      }
      actions={
          <TransactionActionStack
            mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${salesOrder.id}`}
            recordId={salesOrder.id}
            primaryActions={isEditing ? (
              <Link
                href={`${detailHref}?customize=1`}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Customize
              </Link>
            ) : (
              <>
                <MasterDataDetailCreateMenu newHref="/sales-orders/new" duplicateHref={`/sales-orders/new?duplicateFrom=${salesOrder.id}`} />
                <MasterDataDetailExportMenu
                  title={salesOrder.number}
                  fileName={`sales-order-${salesOrder.number}`}
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
                <DeleteButton resource="sales-orders" id={salesOrder.id} />
              </>
            )}
          />
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={
          isCustomizing ? null : (
            <TransactionStatsRow
              record={statsRecord}
              stats={salesOrderPageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <SalesOrderDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={salesOrderPageConfig.sectionDescriptions}
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
                  containerDescription="Expanded context from linked records on this sales order."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={salesOrder.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Sales Order Details"
                containerDescription="Core sales order fields organized into configurable sections."
                showSubsections={false}
                updateUrl={`/api/sales-orders?id=${encodeURIComponent(salesOrder.id)}`}
              />
            </div>
          )
        }
        lineItems={isCustomizing ? null : (
          <TransactionLineItemsSection
            rows={lineRows.map((row, index) => ({
              id: row.id,
              displayOrder: index,
              itemRecordId: row.itemRecordId,
              itemId: row.itemId,
              itemName: row.itemName,
              description: row.description,
              quantity: row.quantity,
              receivedQuantity: row.fulfilledQuantity,
              billedQuantity: 0,
              openQuantity: row.openQuantity,
              unitPrice: row.unitPrice,
              lineTotal: row.lineTotal,
            }))}
            editing={isEditing}
            purchaseOrderId={salesOrder.id}
            userId={salesOrder.userId}
            itemOptions={itemOptions}
            lineColumns={poCompatibleLineColumns}
            lineSettings={customization.lineSettings}
            lineColumnCustomization={poCompatibleLineColumnCustomization}
            sectionTitle="Sales Order Line Items"
            lineItemApiBasePath="/api/sales-order-line-items"
            deleteResource="sales-order-line-items"
            parentIdFieldName="salesOrderId"
            tableId="sales-order-line-items"
            allowAddLines={isEditing}
          />
        )}
        relatedRecords={isCustomizing ? null : (
          <RelatedRecordsSection
            embedded
            tabs={relatedRecordTabs}
            showDisplayControl={false}
          />
        )}
        relatedRecordsCount={relatedRecordTabs.reduce((sum, tab) => sum + tab.count, 0)}
        relatedDocuments={isCustomizing ? null : (
          <SalesOrderRelatedDocuments
            embedded
            showDisplayControl={false}
            defaultCurrencyCode={salesOrderCurrencyCode ?? null}
                    opportunities={
                      salesOrder.quote?.opportunity
                        ? [
                            {
                              id: salesOrder.quote.opportunity.id,
                              number: salesOrder.quote.opportunity.opportunityNumber ?? salesOrder.quote.opportunity.name,
                              name: salesOrder.quote.opportunity.name,
                              status: salesOrder.quote.opportunity.stage,
                              total: toNumericValue(salesOrder.quote.opportunity.amount, 0),
                              currencyCode: opportunityCurrencyCode,
                            },
                          ]
                        : []
                    }
                    quotes={
                      salesOrder.quote
                        ? [
                            {
                              id: salesOrder.quote.id,
                              number: salesOrder.quote.number,
                              status: salesOrder.quote.status,
                              total: toNumericValue(salesOrder.quote.total, 0),
                              currencyCode: quoteCurrencyCode,
                              validUntil: salesOrder.quote.validUntil?.toISOString() ?? null,
                              opportunityName: salesOrder.quote.opportunity?.name ?? null,
                            },
                          ]
                        : []
                    }
                    fulfillments={salesOrder.fulfillments.map((fulfillment) => ({
                      id: fulfillment.id,
                      number: fulfillment.number,
                      status: fulfillment.status,
                      date: fulfillment.date.toISOString(),
                      notes: fulfillment.notes ?? null,
                    }))}
                    invoices={salesOrder.invoices.map((invoice) => ({
                      id: invoice.id,
                      number: invoice.number,
                      status: invoice.status,
                      total: toNumericValue(invoice.total, 0),
                      currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                      dueDate: invoice.dueDate?.toISOString() ?? null,
                      createdAt: invoice.createdAt.toISOString(),
                    }))}
                    cashReceipts={salesOrder.invoices.flatMap((invoice) =>
                      invoice.cashReceipts.map((receipt) => ({
                        id: receipt.id,
                        number: receipt.number ?? null,
                        amount: toNumericValue(receipt.amount, 0),
                        currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                        date: receipt.date.toISOString(),
                        method: receipt.method ?? null,
                        reference: receipt.reference ?? null,
                        invoiceNumber: invoice.number,
                      }))
                    )}
          />
        )}
        relatedDocumentsCount={relatedDocumentsCount}
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId={communicationsToolbarTargetId}
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: salesOrder.id,
              userId: salesOrder.userId,
              number: salesOrder.number,
              counterpartyName: salesOrder.customer.name,
              counterpartyEmail: salesOrder.customer.email ?? null,
              fromEmail: salesOrder.user?.email ?? null,
              status: formatSalesOrderStatus(salesOrder.status),
                total: fmtCurrency(computedTotal, salesOrderCurrencyCode, moneySettings),
              lineItems: lineRows.map((row) => ({
                line: row.lineNumber,
                itemId: row.itemId ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: row.fulfilledQuantity,
                openQuantity: row.openQuantity,
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
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId={systemNotesToolbarTargetId} notes={systemNotes} showDisplayControl={false} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId={systemNotesToolbarTargetId}
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}

