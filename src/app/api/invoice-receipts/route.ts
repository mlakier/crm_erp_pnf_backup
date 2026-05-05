import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoiceReceiptNumber } from '@/lib/invoice-receipt-number'
import { parseMoneyValue } from '@/lib/money'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { generateCustomerRefundNumber } from '@/lib/customer-refund-number'
import { logActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import { loadConfiguredRealizedFxPostingAccounts } from '@/lib/company-setup-account-resolver'
import { loadListValues } from '@/lib/load-list-values'
import { deriveOpenItemCurrencyContext } from '@/lib/open-item-currency-context'
import {
  deleteDocumentRelationshipsForRecord,
  syncAutoDocumentRelationshipsForSource,
} from '@/lib/document-relationships'
import {
  applyOpenItems,
  ensureOpenItemForSource,
  findExistingOpenItemApplication,
  syncOpenItemStatus,
} from '@/lib/open-item-service'
import {
  buildRealizedFxJournalLines,
  computeRealizedFxLayerAmount,
  deriveCarriedSettlementAmount,
} from '@/lib/settlement-fx-journal'
import {
  normalizeInvoiceReceiptApplications,
  roundMoney,
  sumInvoiceReceiptApplications,
  type InvoiceReceiptApplicationInput,
} from '@/lib/invoice-receipt-applications'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

const INVOICE_RECEIPT_POSTING_STATUSES = new Set(['posted'])
const AUTO_CUSTOMER_REFUND_NOTE = 'Auto-created from invoice receipt overpayment.'

async function deleteLegacyInvoiceReceiptSettlementApplications(
  receiptId: string,
  retainedApplicationId: string,
  openItemIdsToResync: string[],
) {
  const legacyApplications = await prisma.openItemApplication.findMany({
    where: {
      settlementTransactionType: 'invoice-receipt',
      settlementTransactionId: receiptId,
      toOpenItemId: null,
      id: { not: retainedApplicationId },
    },
    select: { id: true, fromOpenItemId: true, toOpenItemId: true },
  })

  if (legacyApplications.length === 0) return

  await prisma.$transaction(async (tx) => {
    await tx.openItemEntry.deleteMany({
      where: {
        sourceApplicationId: { in: legacyApplications.map((application) => application.id) },
      },
    })
    await tx.openItemApplication.deleteMany({
      where: {
        id: { in: legacyApplications.map((application) => application.id) },
      },
    })

    const itemIds = Array.from(
      new Set(
        [...openItemIdsToResync, ...legacyApplications.map((application) => application.fromOpenItemId)].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    )
    for (const openItemId of itemIds) {
      await syncOpenItemStatus(openItemId, { tx })
    }
  })
}

async function syncInvoiceReceiptDocumentRelationships(cashReceiptId: string) {
  const receipt = await prisma.cashReceipt.findUnique({
    where: { id: cashReceiptId },
    select: {
      id: true,
      invoiceId: true,
      applications: {
        select: {
          invoiceId: true,
        },
      },
    },
  })

  if (!receipt) return

  const targetInvoiceIds = Array.from(
    new Set(
      [
        receipt.invoiceId,
        ...receipt.applications.map((application) => application.invoiceId),
      ].filter((value): value is string => Boolean(value)),
    ),
  )

  await syncAutoDocumentRelationshipsForSource({
    sourceRecordType: 'invoice-receipt',
    sourceRecordId: receipt.id,
    relationshipType: 'settles',
    automationSource: 'invoice-receipt-applications',
    targets: targetInvoiceIds.map((invoiceId) => ({
      recordType: 'invoice',
      recordId: invoiceId,
    })),
  })
}

async function loadInvoiceReceiptStatusValues() {
  const values = await loadListValues('INV-RECEIPT-STATUS')
  return values.map((value) => value.toLowerCase())
}

function normalizeInvoiceReceiptStatus(value: unknown, allowedStatuses: string[], fallback: string) {
  const normalized = typeof value === 'string' ? value.toLowerCase() : fallback
  return allowedStatuses.includes(normalized) ? normalized : fallback
}

function normalizeOverpaymentHandling(value: unknown) {
  return value === 'apply_to_future_invoices' || value === 'refund_pending'
    ? value
    : null
}

async function findInvoiceReceiptPostingAccounts(bankAccountId: string | null | undefined) {
  const companySettings = await loadCompanySetupSettings()
  const realizedFxAccounts = await loadConfiguredRealizedFxPostingAccounts()

  const arAccount =
    (companySettings.defaultArAccountId
      ? await prisma.chartOfAccounts.findFirst({
          where: {
            id: companySettings.defaultArAccountId,
            active: true,
            isPosting: true,
            accountType: 'Asset',
          },
          select: { id: true },
        })
      : null)
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
        OR: [
          { name: { contains: 'Accounts Receivable', mode: 'insensitive' } },
          { accountId: '1100' },
        ],
      },
      select: { id: true },
    })
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
      },
      select: { id: true },
    })

  const bankAccount =
    (bankAccountId
      ? await prisma.chartOfAccounts.findFirst({
          where: {
            id: bankAccountId,
            active: true,
            isPosting: true,
            accountType: 'Asset',
          },
          select: { id: true },
        })
      : null)
    ?? (await loadCashBankPostingAccounts())[0]

  return {
    arAccountId: arAccount?.id ?? null,
    bankAccountId: bankAccount?.id ?? null,
    realizedFxGainAccountId: realizedFxAccounts.realizedFxGainAccountId,
    realizedFxLossAccountId: realizedFxAccounts.realizedFxLossAccountId,
  }
}

async function loadInvoiceApplicationContext(invoiceIds: string[], currentReceiptId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
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
  })

  return new Map(
    invoices.map((invoice) => {
      const appliedViaApplications = invoice.cashReceiptApplications.reduce((sum, application) => {
        if (application.cashReceiptId === currentReceiptId) return sum
        return sum + Number(application.appliedAmount)
      }, 0)

      const appliedViaLegacyReceipts = invoice.cashReceipts.reduce((sum, receipt) => {
        if (receipt.id === currentReceiptId) return sum
        if (receipt.applications.length > 0) return sum
        return sum + Number(receipt.amount)
      }, 0)

      return [
        invoice.id,
        {
          invoice,
          openAmount: roundMoney(Number(invoice.total) - appliedViaApplications - appliedViaLegacyReceipts),
        },
      ]
    }),
  )
}

async function validateInvoiceReceiptApplications(
  applications: InvoiceReceiptApplicationInput[],
  receiptAmount: number,
  currentReceiptId?: string,
  requireFullyApplied = false,
  overpaymentHandling?: string | null,
) {
  if (!Number.isFinite(receiptAmount) || receiptAmount <= 0) {
    throw new Error('Receipt amount must be greater than zero')
  }
  if (applications.length === 0) {
    if (requireFullyApplied) {
      throw new Error('At least one invoice application is required before posting')
    }
    return {
      firstInvoice: null,
      customerId: null,
      subsidiaryId: null,
      currencyId: null,
      userId: null,
      totalApplied: 0,
    }
  }

  const contextByInvoiceId = await loadInvoiceApplicationContext(
    applications.map((application) => application.invoiceId),
    currentReceiptId,
  )

  const resolvedInvoices = applications.map((application) => {
    const context = contextByInvoiceId.get(application.invoiceId)
    if (!context) {
      throw new Error('One or more selected invoices could not be found')
    }
    if (application.appliedAmount > context.openAmount + 0.005) {
      throw new Error(`Applied amount exceeds open balance for invoice ${context.invoice.number}`)
    }
    return context.invoice
  })

  const firstInvoice = resolvedInvoices[0]
  const customerId = firstInvoice.customerId
  const subsidiaryId = firstInvoice.subsidiaryId ?? null
  const currencyId = firstInvoice.currencyId ?? null
  const userId = firstInvoice.userId ?? null

  const mixedPostingContext = resolvedInvoices.some(
    (invoice) =>
      invoice.customerId !== customerId ||
      (invoice.subsidiaryId ?? null) !== subsidiaryId ||
      (invoice.currencyId ?? null) !== currencyId ||
      (invoice.userId ?? null) !== userId,
  )

  if (mixedPostingContext) {
    throw new Error('Applied invoices must belong to the same customer and posting context')
  }

  const totalApplied = roundMoney(sumInvoiceReceiptApplications(applications))
  if (totalApplied > receiptAmount + 0.005) {
    throw new Error('Applied invoice amounts cannot exceed the entered receipt amount')
  }
  if (requireFullyApplied && roundMoney(receiptAmount - totalApplied) > 0.005 && !overpaymentHandling) {
    throw new Error('Choose how to handle the overpayment before posting this receipt')
  }

  return {
    firstInvoice,
    customerId,
    subsidiaryId,
    currencyId,
    userId,
    totalApplied,
  }
}

async function postInvoiceReceiptJournal(cashReceiptId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'invoice-receipt', sourceId: cashReceiptId },
    select: { id: true },
  })

  const receipt = await prisma.cashReceipt.findUnique({
    where: { id: cashReceiptId },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          total: true,
          createdAt: true,
          dueDate: true,
          customerId: true,
          userId: true,
          subsidiaryId: true,
          currencyId: true,
        },
      },
      applications: {
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              total: true,
              createdAt: true,
              dueDate: true,
              customerId: true,
              userId: true,
              subsidiaryId: true,
              currencyId: true,
            },
          },
        },
      },
    },
  })
  if (!receipt) return
  if (!INVOICE_RECEIPT_POSTING_STATUSES.has(receipt.status.toLowerCase())) return

  const appliedInvoices = receipt.applications.length > 0
    ? receipt.applications.map((application) => application.invoice)
    : receipt.invoice
      ? [receipt.invoice]
      : []
  const firstInvoice = appliedInvoices[0] ?? null

  const amount = Number(receipt.amount)
  if (!Number.isFinite(amount) || amount <= 0 || !firstInvoice) return

  const {
    arAccountId,
    bankAccountId,
    realizedFxGainAccountId,
    realizedFxLossAccountId,
  } = await findInvoiceReceiptPostingAccounts(receipt.bankAccountId)

  const receiptCurrencyContext = await deriveOpenItemCurrencyContext({
    subsidiaryId: firstInvoice.subsidiaryId ?? null,
    transactionCurrencyId: firstInvoice.currencyId ?? null,
    transactionAmount: amount,
    effectiveDate: receipt.date,
    rateType: 'spot',
  })

  const receiptOpenItem = await ensureOpenItemForSource({
    openItemType: 'customer_receipt',
    accountType: 'Asset',
    accountId: bankAccountId,
    subsidiaryId: firstInvoice.subsidiaryId ?? null,
    transactionCurrencyId: receiptCurrencyContext.transactionCurrencyId,
    localCurrencyId: receiptCurrencyContext.localCurrencyId,
    functionalCurrencyId: receiptCurrencyContext.functionalCurrencyId,
    groupCurrencyId: receiptCurrencyContext.groupCurrencyId,
    sourceTransactionType: 'invoice-receipt',
    sourceTransactionId: receipt.id,
    sourceNumber: receipt.number ?? receipt.id,
    counterpartyType: 'customer',
    counterpartyId: firstInvoice.customerId,
    documentDate: receipt.date,
    postingDate: receipt.date,
    originalTransactionAmount: amount,
    originalLocalAmount: receiptCurrencyContext.originalLocalAmount,
    originalFunctionalAmount: receiptCurrencyContext.originalFunctionalAmount,
    originalGroupAmount: receiptCurrencyContext.originalGroupAmount,
    memo: receipt.reference ?? null,
    createdById: firstInvoice.userId ?? null,
  })

  const applicationsToSettle = receipt.applications.length > 0
    ? receipt.applications.map((application) => ({
        invoice: application.invoice,
        appliedAmount: Number(application.appliedAmount),
      }))
    : receipt.invoice
      ? [{
          invoice: receipt.invoice,
          appliedAmount: amount,
        }]
      : []
  const settlementSummaries: Array<{
    localAmount: number | null
    functionalAmount: number | null
    groupAmount: number | null
    realizedFxLocalAmount: number | null
    realizedFxFunctionalAmount: number | null
    realizedFxGroupAmount: number | null
  }> = []

  for (const application of applicationsToSettle) {
    const invoiceCurrencyContext = await deriveOpenItemCurrencyContext({
      subsidiaryId: application.invoice.subsidiaryId ?? null,
      transactionCurrencyId: application.invoice.currencyId ?? null,
      transactionAmount: application.invoice.total,
      effectiveDate: application.invoice.createdAt,
      rateType: 'spot',
    })

    const invoiceOpenItem = await ensureOpenItemForSource({
      openItemType: 'accounts_receivable',
      accountType: 'Asset',
      accountId: arAccountId,
      subsidiaryId: application.invoice.subsidiaryId ?? null,
      transactionCurrencyId: invoiceCurrencyContext.transactionCurrencyId,
      localCurrencyId: invoiceCurrencyContext.localCurrencyId,
      functionalCurrencyId: invoiceCurrencyContext.functionalCurrencyId,
      groupCurrencyId: invoiceCurrencyContext.groupCurrencyId,
      sourceTransactionType: 'invoice',
      sourceTransactionId: application.invoice.id,
      sourceNumber: application.invoice.number,
      counterpartyType: 'customer',
      counterpartyId: application.invoice.customerId,
      documentDate: application.invoice.createdAt,
      postingDate: application.invoice.createdAt,
      dueDate: application.invoice.dueDate ?? null,
      originalTransactionAmount: application.invoice.total,
      originalLocalAmount: invoiceCurrencyContext.originalLocalAmount,
      originalFunctionalAmount: invoiceCurrencyContext.originalFunctionalAmount,
      originalGroupAmount: invoiceCurrencyContext.originalGroupAmount,
      createdById: application.invoice.userId ?? null,
    })

    const settlementCurrencyContext = await deriveOpenItemCurrencyContext({
      subsidiaryId: application.invoice.subsidiaryId ?? null,
      transactionCurrencyId: application.invoice.currencyId ?? null,
      transactionAmount: application.appliedAmount,
      effectiveDate: receipt.date,
      rateType: 'spot',
    })

    const existingApplication = await findExistingOpenItemApplication({
      fromOpenItemId: receiptOpenItem.id,
      toOpenItemId: invoiceOpenItem.id,
      settlementTransactionType: 'invoice-receipt',
      settlementTransactionId: receipt.id,
    })

    const postedApplication = existingApplication ?? (await applyOpenItems({
        fromOpenItemId: receiptOpenItem.id,
        toOpenItemId: invoiceOpenItem.id,
        applicationType: 'invoice_receipt_application',
        settlementTransactionType: 'invoice-receipt',
        settlementTransactionId: receipt.id,
        applicationDate: receipt.date,
        postingDate: receipt.date,
        transactionAmount: application.appliedAmount,
        localAmount: settlementCurrencyContext.originalLocalAmount,
        functionalAmount: settlementCurrencyContext.originalFunctionalAmount,
        groupAmount: settlementCurrencyContext.originalGroupAmount,
        memo: receipt.reference ?? null,
        createdById: application.invoice.userId ?? null,
        clearingType: 'invoice_receipt_application',
        automationSource: 'invoice-receipt-posting',
      })).application

    await deleteLegacyInvoiceReceiptSettlementApplications(receipt.id, postedApplication.id, [
      receiptOpenItem.id,
      invoiceOpenItem.id,
    ])

    settlementSummaries.push({
      localAmount: postedApplication.localAmount == null ? null : Number(postedApplication.localAmount),
      functionalAmount: postedApplication.functionalAmount == null ? null : Number(postedApplication.functionalAmount),
      groupAmount: postedApplication.groupAmount == null ? null : Number(postedApplication.groupAmount),
      realizedFxLocalAmount:
        postedApplication.realizedFxLocalAmount == null ? null : Number(postedApplication.realizedFxLocalAmount),
      realizedFxFunctionalAmount:
        postedApplication.realizedFxFunctionalAmount == null ? null : Number(postedApplication.realizedFxFunctionalAmount),
      realizedFxGroupAmount: computeRealizedFxLayerAmount({
        originalTransactionAmount: Number(application.invoice.total),
        originalTranslatedAmount:
          invoiceCurrencyContext.originalGroupAmount == null ? null : Number(invoiceCurrencyContext.originalGroupAmount),
        settledTransactionAmount: application.appliedAmount,
        settledTranslatedAmount:
          settlementCurrencyContext.originalGroupAmount == null ? null : Number(settlementCurrencyContext.originalGroupAmount),
      }),
    })
  }

  if (existingJournal) return

  if (!arAccountId || !bankAccountId) return

  const journalNumber = await generateNextJournalNumber()
  const totalAppliedAmount = roundMoney(
    applicationsToSettle.reduce((sum, application) => sum + Number(application.appliedAmount), 0),
  )
  const isFullyApplied = Math.abs(roundMoney(amount - totalAppliedAmount)) <= 0.005
  const canPopulateLocalLayer =
    isFullyApplied
    && settlementSummaries.length > 0
    && settlementSummaries.every(
      (summary) => summary.localAmount != null && summary.realizedFxLocalAmount != null,
    )
    && receiptCurrencyContext.originalLocalAmount != null
  const canPopulateFunctionalLayer =
    isFullyApplied
    && settlementSummaries.length > 0
    && settlementSummaries.every(
      (summary) => summary.functionalAmount != null && summary.realizedFxFunctionalAmount != null,
    )
    && receiptCurrencyContext.originalFunctionalAmount != null
  const canPopulateGroupLayer =
    isFullyApplied
    && settlementSummaries.length > 0
    && settlementSummaries.every(
      (summary) => summary.groupAmount != null && summary.realizedFxGroupAmount != null,
    )
    && receiptCurrencyContext.originalGroupAmount != null

  const arLocalCredit = canPopulateLocalLayer
    ? roundMoney(
        settlementSummaries.reduce(
          (sum, summary) => sum + (deriveCarriedSettlementAmount(summary.localAmount, summary.realizedFxLocalAmount) ?? 0),
          0,
        ),
      )
    : null
  const arFunctionalCredit = canPopulateFunctionalLayer
    ? roundMoney(
        settlementSummaries.reduce(
          (sum, summary) =>
            sum + (deriveCarriedSettlementAmount(summary.functionalAmount, summary.realizedFxFunctionalAmount) ?? 0),
          0,
        ),
      )
    : null
  const realizedFxLocalTotal = canPopulateLocalLayer
    ? roundMoney(settlementSummaries.reduce((sum, summary) => sum + (summary.realizedFxLocalAmount ?? 0), 0))
    : null
  const realizedFxFunctionalTotal = canPopulateFunctionalLayer
    ? roundMoney(
        settlementSummaries.reduce((sum, summary) => sum + (summary.realizedFxFunctionalAmount ?? 0), 0),
      )
    : null
  const arGroupCredit = canPopulateGroupLayer
    ? roundMoney(
        settlementSummaries.reduce(
          (sum, summary) => sum + (deriveCarriedSettlementAmount(summary.groupAmount, summary.realizedFxGroupAmount) ?? 0),
          0,
        ),
      )
    : null
  const realizedFxGroupTotal = canPopulateGroupLayer
    ? roundMoney(settlementSummaries.reduce((sum, summary) => sum + (summary.realizedFxGroupAmount ?? 0), 0))
    : null
  const fxLines = buildRealizedFxJournalLines({
    description: `${receipt.number ?? receipt.id} realized FX`,
    memo: receipt.reference ?? null,
    subsidiaryId: firstInvoice.subsidiaryId,
    customerId: firstInvoice.customerId,
    realizedFxGainAccountId,
    realizedFxLossAccountId,
    orientation: 'asset',
    localAmount: realizedFxLocalTotal,
    functionalAmount: realizedFxFunctionalTotal,
    groupAmount: realizedFxGroupTotal,
    startingDisplayOrder: 2,
  })

  await prisma.journalEntry.create({
    data: {
      number: journalNumber,
      date: receipt.date,
      description: `Invoice receipt ${receipt.number ?? receipt.id}`,
      journalType: 'standard',
      status: 'approved',
      total: amount,
      sourceType: 'invoice-receipt',
      sourceId: receipt.id,
      subsidiaryId: firstInvoice.subsidiaryId,
      currencyId: firstInvoice.currencyId,
      userId: firstInvoice.userId,
      lineItems: {
        create: [
          {
            displayOrder: 0,
            description: `${receipt.number ?? receipt.id} cash receipt`,
            memo: receipt.reference ?? null,
            activityTypeCode: 'cash_receipt',
            debit: amount,
            credit: 0,
            localDebit:
              canPopulateLocalLayer && receiptCurrencyContext.originalLocalAmount != null
                ? Number(receiptCurrencyContext.originalLocalAmount)
                : undefined,
            functionalDebit:
              canPopulateFunctionalLayer && receiptCurrencyContext.originalFunctionalAmount != null
                ? Number(receiptCurrencyContext.originalFunctionalAmount)
                : undefined,
            groupDebit:
              canPopulateGroupLayer && receiptCurrencyContext.originalGroupAmount != null
                ? Number(receiptCurrencyContext.originalGroupAmount)
                : undefined,
            accountId: bankAccountId,
            subsidiaryId: firstInvoice.subsidiaryId,
            customerId: firstInvoice.customerId,
          },
          {
            displayOrder: 1,
            description: `${receipt.number ?? receipt.id} AR application`,
            memo: receipt.reference ?? null,
            activityTypeCode: 'ar_settlement',
            debit: 0,
            credit: amount,
            localCredit: arLocalCredit,
            functionalCredit: arFunctionalCredit,
            groupCredit: arGroupCredit,
            accountId: arAccountId,
            subsidiaryId: firstInvoice.subsidiaryId,
            customerId: firstInvoice.customerId,
          },
          ...fxLines,
        ],
      },
    },
  })

  await prisma.cashReceipt.update({
    where: { id: receipt.id },
    data: {
      fxRateType: receiptCurrencyContext.translationAudit?.rateType ?? 'spot',
      fxRateSource: receiptCurrencyContext.translationAudit?.sourceSummary ?? 'Configured exchange rates',
      fxEffectiveDate: receiptCurrencyContext.translationAudit?.effectiveDate ?? receipt.date,
    },
  })

  await logActivity({
    entityType: 'invoice-receipt',
    entityId: receipt.id,
    action: 'post',
    summary: `Posted invoice receipt ${receipt.number ?? receipt.id} to GL`,
    userId: firstInvoice.userId,
  })
}

async function unpostInvoiceReceiptJournal(cashReceiptId: string) {
  await prisma.journalEntry.deleteMany({
    where: { sourceType: 'invoice-receipt', sourceId: cashReceiptId },
  })
  await prisma.cashReceipt.update({
    where: { id: cashReceiptId },
    data: {
      fxRateType: null,
      fxRateSource: null,
      fxEffectiveDate: null,
    },
  })
}

async function syncInvoiceReceiptRefundHandoff(cashReceiptId: string, status: string) {
  const receipt = await prisma.cashReceipt.findUnique({
    where: { id: cashReceiptId },
    include: {
      invoice: {
        select: {
          customerId: true,
          subsidiaryId: true,
          currencyId: true,
          userId: true,
        },
      },
      applications: {
        select: {
          appliedAmount: true,
        },
      },
      customerRefunds: {
        select: {
          id: true,
          number: true,
          amount: true,
          status: true,
          notes: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  })
  if (!receipt?.invoice) return

  const autoDraftRefund =
    receipt.customerRefunds.find(
      (refund) =>
        refund.notes === AUTO_CUSTOMER_REFUND_NOTE && (refund.status ?? '').toLowerCase() === 'draft',
    ) ?? null

  const appliedAmount = roundMoney(
    receipt.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0),
  )
  const otherCommittedRefundAmount = roundMoney(
    receipt.customerRefunds.reduce((sum, refund) => {
      if (autoDraftRefund && refund.id === autoDraftRefund.id) return sum
      if ((refund.status ?? '').toLowerCase() === 'void') return sum
      return sum + Number(refund.amount)
    }, 0),
  )

  const shouldCreateRefund =
    INVOICE_RECEIPT_POSTING_STATUSES.has(status.toLowerCase()) &&
    (receipt.overpaymentHandling ?? '').toLowerCase() === 'refund_pending'
  const refundAmount = shouldCreateRefund
    ? roundMoney(Number(receipt.amount) - appliedAmount - otherCommittedRefundAmount)
    : 0

  if (refundAmount > 0.005) {
    const refundData = {
      customerId: receipt.invoice.customerId,
      cashReceiptId: receipt.id,
      bankAccountId: receipt.bankAccountId ?? null,
      amount: refundAmount,
      date: receipt.date,
      method: receipt.method,
      reference: receipt.reference || `Auto refund for ${receipt.number ?? receipt.id}`,
      notes: AUTO_CUSTOMER_REFUND_NOTE,
      status: 'draft',
      subsidiaryId: receipt.invoice.subsidiaryId ?? null,
      currencyId: receipt.invoice.currencyId ?? null,
      userId: receipt.invoice.userId ?? null,
    }

    if (autoDraftRefund) {
      await prisma.customerRefund.update({
        where: { id: autoDraftRefund.id },
        data: refundData,
      })
      return
    }

    const number = await generateCustomerRefundNumber()
    await prisma.customerRefund.create({
      data: {
        number,
        ...refundData,
      },
    })
    return
  }

  if (autoDraftRefund) {
    await prisma.customerRefund.delete({
      where: { id: autoDraftRefund.id },
    })
  }
}

async function syncInvoiceReceiptPosting(cashReceiptId: string, status: string) {
  if (INVOICE_RECEIPT_POSTING_STATUSES.has(status.toLowerCase())) {
    await postInvoiceReceiptJournal(cashReceiptId)
  } else {
    await unpostInvoiceReceiptJournal(cashReceiptId)
  }
  await syncInvoiceReceiptRefundHandoff(cashReceiptId, status)
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.cashReceipt.findUnique({
      where: { id },
      include: {
        bankAccount: true,
        invoice: { include: { customer: true } },
        applications: {
          include: {
            invoice: {
              include: { customer: true },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.cashReceipt.findMany({
    include: {
      bankAccount: true,
      invoice: { include: { customer: true } },
      applications: { include: { invoice: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoiceId, amount, date, method, reference } = body
    if (!invoiceId || !amount || !date || !method) {
      return NextResponse.json({ error: 'invoiceId, amount, date, method required' }, { status: 400 })
    }

    const statusValues = await loadInvoiceReceiptStatusValues()
    const normalizedStatus = normalizeInvoiceReceiptStatus(body.status, statusValues, 'draft')
    const overpaymentHandling = normalizeOverpaymentHandling(body.overpaymentHandling)
    const applications = normalizeInvoiceReceiptApplications(body.applications)
    const normalizedAmount = parseMoneyValue(amount)
    const hasApplicationsPayload = body.applications !== undefined
    const fallbackApplications =
      hasApplicationsPayload
        ? applications
        : applications.length > 0
          ? applications
          : [{ invoiceId, appliedAmount: normalizedAmount }]

    const postingContext = await validateInvoiceReceiptApplications(
      fallbackApplications,
      normalizedAmount,
      undefined,
      INVOICE_RECEIPT_POSTING_STATUSES.has(normalizedStatus),
      overpaymentHandling,
    )

    if (
      body.subsidiaryId
      && postingContext.subsidiaryId
      && body.subsidiaryId !== postingContext.subsidiaryId
    ) {
      return NextResponse.json({ error: 'Invoice receipt subsidiary must match the linked invoice subsidiary' }, { status: 400 })
    }

    if (
      body.currencyId
      && postingContext.currencyId
      && body.currencyId !== postingContext.currencyId
    ) {
      return NextResponse.json({ error: 'Invoice receipt currency must match the linked invoice currency' }, { status: 400 })
    }

    const number = await generateInvoiceReceiptNumber()
    const row = await prisma.cashReceipt.create({
      data: {
        number,
        status: normalizedStatus,
        overpaymentHandling,
        invoiceId: fallbackApplications[0]?.invoiceId ?? invoiceId,
        subsidiaryId: postingContext.subsidiaryId,
        currencyId: postingContext.currencyId,
        bankAccountId: body.bankAccountId || null,
        amount: normalizedAmount,
        date: new Date(date),
        method,
        reference: reference || null,
        applications: {
          create: fallbackApplications.map((application) => ({
            invoiceId: application.invoiceId,
            appliedAmount: application.appliedAmount,
          })),
        },
      },
    })
    await syncInvoiceReceiptDocumentRelationships(row.id)
    await syncInvoiceReceiptPosting(row.id, normalizedStatus)
    await logActivity({
      entityType: 'invoice-receipt',
      entityId: row.id,
      action: 'create',
      summary: `Created invoice receipt ${row.number ?? row.id}`,
    })
    await logRecordSnapshotActivities({
      entityType: 'invoice-receipt',
      entityId: row.id,
      action: 'create',
      context: 'Invoice Receipt Details',
      fields: [
        { fieldName: 'Business Id', value: row.number },
        { fieldName: 'Invoice', value: row.invoiceId },
        { fieldName: 'Subsidiary', value: row.subsidiaryId ?? '-' },
        { fieldName: 'Currency', value: row.currencyId ?? '-' },
        { fieldName: 'Bank Account', value: row.bankAccountId },
        { fieldName: 'Amount', value: row.amount },
        { fieldName: 'Date', value: row.date },
        { fieldName: 'Method', value: row.method },
        { fieldName: 'Reference', value: row.reference },
        { fieldName: 'Status', value: row.status },
        { fieldName: 'Overpayment Handling', value: row.overpaymentHandling },
      ],
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create invoice receipt'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json()
    const statusValues = await loadInvoiceReceiptStatusValues()
    const before = await prisma.cashReceipt.findUnique({
      where: { id },
      include: {
        applications: {
          select: {
            invoiceId: true,
            appliedAmount: true,
          },
        },
      },
    })
    if (!before) return NextResponse.json({ error: 'Invoice receipt not found' }, { status: 404 })

    const applications = normalizeInvoiceReceiptApplications(body.applications)
    const normalizedAmount = body.amount !== undefined ? parseMoneyValue(body.amount) : Number(before.amount)
    const normalizedStatus = normalizeInvoiceReceiptStatus(body.status, statusValues, before.status.toLowerCase())
    const overpaymentHandling =
      body.overpaymentHandling !== undefined
        ? normalizeOverpaymentHandling(body.overpaymentHandling)
        : before.overpaymentHandling ?? null
    const hasApplicationsPayload = body.applications !== undefined
    const fallbackApplications =
      hasApplicationsPayload
        ? applications
        : applications.length > 0
          ? applications
          : before.applications.length > 0
            ? before.applications.map((application) => ({
                invoiceId: application.invoiceId,
                appliedAmount: Number(application.appliedAmount),
              }))
            : [{ invoiceId: body.invoiceId ?? before.invoiceId, appliedAmount: normalizedAmount }]

    await validateInvoiceReceiptApplications(
      fallbackApplications,
      normalizedAmount,
      before.id,
      INVOICE_RECEIPT_POSTING_STATUSES.has(normalizedStatus),
      overpaymentHandling,
    )

    const row = await prisma.cashReceipt.update({
      where: { id },
      data: {
        ...(body.invoiceId !== undefined || applications.length > 0
          ? { invoiceId: fallbackApplications[0]?.invoiceId ?? body.invoiceId ?? before.invoiceId }
          : {}),
        ...(body.bankAccountId !== undefined ? { bankAccountId: body.bankAccountId || null } : {}),
        ...(body.status !== undefined ? { status: normalizedStatus } : {}),
        ...(body.overpaymentHandling !== undefined ? { overpaymentHandling } : {}),
        ...(body.amount !== undefined ? { amount: normalizedAmount } : {}),
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.method !== undefined ? { method: body.method } : {}),
        ...(body.reference !== undefined ? { reference: body.reference || null } : {}),
        ...(body.applications !== undefined
          ? {
              applications: {
                deleteMany: {},
                create: fallbackApplications.map((application) => ({
                  invoiceId: application.invoiceId,
                  appliedAmount: application.appliedAmount,
                })),
              },
            }
          : {}),
      },
    })
    await syncInvoiceReceiptDocumentRelationships(row.id)
    await syncInvoiceReceiptPosting(row.id, normalizedStatus)
    await logActivity({
      entityType: 'invoice-receipt',
      entityId: row.id,
      action: 'update',
      summary: `Updated invoice receipt ${row.number ?? row.id}`,
    })
    await logFieldChangeActivities({
      entityType: 'invoice-receipt',
      entityId: row.id,
      context: 'Invoice Receipt Details',
      changes: [
        { fieldName: 'Invoice', oldValue: before.invoiceId, newValue: row.invoiceId },
        { fieldName: 'Bank Account', oldValue: before.bankAccountId, newValue: row.bankAccountId },
        { fieldName: 'Amount', oldValue: before.amount, newValue: row.amount },
        { fieldName: 'Date', oldValue: before.date, newValue: row.date },
        { fieldName: 'Method', oldValue: before.method, newValue: row.method },
        { fieldName: 'Reference', oldValue: before.reference, newValue: row.reference },
        { fieldName: 'Status', oldValue: before.status, newValue: row.status },
        { fieldName: 'Overpayment Handling', oldValue: before.overpaymentHandling, newValue: row.overpaymentHandling },
      ],
    })
    return NextResponse.json(row)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update invoice receipt'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await prisma.cashReceipt.findUnique({ where: { id } })
  await unpostInvoiceReceiptJournal(id)
  await prisma.cashReceipt.delete({ where: { id } })
  await deleteDocumentRelationshipsForRecord('invoice-receipt', id)
  if (existing) {
    await logActivity({
      entityType: 'invoice-receipt',
      entityId: id,
      action: 'delete',
      summary: `Deleted invoice receipt ${existing.number ?? existing.id}`,
    })
    await logRecordSnapshotActivities({
      entityType: 'invoice-receipt',
      entityId: id,
      action: 'delete',
      context: 'Invoice Receipt Details',
      fields: [
        { fieldName: 'Business Id', value: existing.number },
        { fieldName: 'Invoice', value: existing.invoiceId },
        { fieldName: 'Bank Account', value: existing.bankAccountId },
        { fieldName: 'Amount', value: existing.amount },
        { fieldName: 'Date', value: existing.date },
        { fieldName: 'Method', value: existing.method },
        { fieldName: 'Reference', value: existing.reference },
        { fieldName: 'Status', value: existing.status },
        { fieldName: 'Overpayment Handling', value: existing.overpaymentHandling },
      ],
    })
  }
  return NextResponse.json({ ok: true })
}
