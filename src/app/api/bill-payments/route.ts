import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBillPaymentNumber } from '@/lib/bill-payment-number'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { parseMoneyValue } from '@/lib/money'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import { loadConfiguredRealizedFxPostingAccounts } from '@/lib/company-setup-account-resolver'
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
  normalizeBillPaymentApplications,
  roundMoney,
  sumBillPaymentApplications,
  type BillPaymentApplicationInput,
} from '@/lib/bill-payment-applications'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

const BILL_PAYMENT_POSTING_STATUSES = new Set(['processed', 'cleared'])

async function deleteLegacyBillPaymentSettlementApplications(
  billPaymentId: string,
  retainedApplicationId: string,
  openItemIdsToResync: string[],
) {
  const legacyApplications = await prisma.openItemApplication.findMany({
    where: {
      settlementTransactionType: 'bill-payment',
      settlementTransactionId: billPaymentId,
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

async function syncBillPaymentDocumentRelationships(billPaymentId: string) {
  const payment = await prisma.billPayment.findUnique({
    where: { id: billPaymentId },
    select: {
      id: true,
      billId: true,
      applications: {
        select: {
          billId: true,
        },
      },
    },
  })

  if (!payment) return

  const targetBillIds = Array.from(
    new Set(
      [
        payment.billId,
        ...payment.applications.map((application) => application.billId),
      ].filter((value): value is string => Boolean(value)),
    ),
  )

  await syncAutoDocumentRelationshipsForSource({
    sourceRecordType: 'bill-payment',
    sourceRecordId: payment.id,
    relationshipType: 'settles',
    automationSource: 'bill-payment-applications',
    targets: targetBillIds.map((billId) => ({
      recordType: 'bill',
      recordId: billId,
    })),
  })
}

async function loadBillApplicationContext(
  billIds: string[],
  currentPaymentId?: string,
) {
  const bills = await prisma.bill.findMany({
    where: { id: { in: billIds } },
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
  })

  return new Map(
    bills.map((bill) => {
      const appliedViaApplications = bill.paymentApplications.reduce((sum, application) => {
        if (application.billPaymentId === currentPaymentId) return sum
        if ((application.billPayment.status ?? '').toLowerCase() === 'cancelled') return sum
        return sum + Number(application.appliedAmount)
      }, 0)

      const appliedViaLegacyPayments = bill.billPayments.reduce((sum, payment) => {
        if (payment.id === currentPaymentId) return sum
        if ((payment.status ?? '').toLowerCase() === 'cancelled') return sum
        if (payment.applications.length > 0) return sum
        return sum + Number(payment.amount)
      }, 0)

      return [
        bill.id,
        {
          bill,
          openAmount: roundMoney(Number(bill.total) - appliedViaApplications - appliedViaLegacyPayments),
        },
      ]
    }),
  )
}

async function validateBillPaymentApplications(
  vendorId: string | null | undefined,
  paymentAmount: number,
  applications: BillPaymentApplicationInput[],
  currentPaymentId?: string,
  requireFullyApplied = false,
) {
  if (!vendorId) {
    throw new Error('Vendor is required when applying a bill payment')
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than zero')
  }
  if (applications.length === 0) {
    throw new Error('At least one bill application is required')
  }

  const contextByBillId = await loadBillApplicationContext(
    applications.map((application) => application.billId),
    currentPaymentId,
  )

  const resolvedBills = applications.map((application) => {
    const context = contextByBillId.get(application.billId)
    if (!context) {
      throw new Error('One or more selected bills could not be found')
    }
    if (context.bill.vendorId !== vendorId) {
      throw new Error('All selected bills must belong to the chosen vendor')
    }
    if (application.appliedAmount > context.openAmount + 0.005) {
      throw new Error(`Applied amount exceeds open balance for bill ${context.bill.number}`)
    }
    return context.bill
  })

  const firstBill = resolvedBills[0]
  const subsidiaryId = firstBill.subsidiaryId ?? null
  const currencyId = firstBill.currencyId ?? null
  const userId = firstBill.userId ?? null

  const mixedPostingContext = resolvedBills.some(
    (bill) =>
      (bill.subsidiaryId ?? null) !== subsidiaryId
      || (bill.currencyId ?? null) !== currencyId
      || (bill.userId ?? null) !== userId,
  )

  if (mixedPostingContext) {
    throw new Error('Applied bills must share the same posting context')
  }

  const totalApplied = roundMoney(sumBillPaymentApplications(applications))
  if (totalApplied > paymentAmount + 0.005) {
    throw new Error('Applied bill amounts cannot exceed the entered payment amount')
  }
  if (requireFullyApplied && roundMoney(paymentAmount - totalApplied) > 0.005) {
    throw new Error('Posted bill payments must be fully applied before they can post to GL')
  }

  return {
    firstBill,
    subsidiaryId,
    currencyId,
    userId,
    totalApplied,
    unappliedAmount: roundMoney(paymentAmount - totalApplied),
  }
}

async function findBillPaymentPostingAccounts(bankAccountId: string | null | undefined) {
  const companySettings = await loadCompanySetupSettings()
  const realizedFxAccounts = await loadConfiguredRealizedFxPostingAccounts()

  const apAccount =
    (companySettings.defaultApAccountId
      ? await prisma.chartOfAccounts.findFirst({
          where: {
            id: companySettings.defaultApAccountId,
            active: true,
            isPosting: true,
            accountType: 'Liability',
          },
          select: { id: true },
        })
      : null)
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
        OR: [
          { name: { contains: 'Accounts Payable', mode: 'insensitive' } },
          { accountId: '2000' },
        ],
      },
      select: { id: true },
    })
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
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
    apAccountId: apAccount?.id ?? null,
    bankAccountId: bankAccount?.id ?? null,
    realizedFxGainAccountId: realizedFxAccounts.realizedFxGainAccountId,
    realizedFxLossAccountId: realizedFxAccounts.realizedFxLossAccountId,
  }
}

async function postBillPaymentJournal(billPaymentId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'bill-payment', sourceId: billPaymentId },
    select: { id: true },
  })

  const payment = await prisma.billPayment.findUnique({
    where: { id: billPaymentId },
    include: {
      vendor: true,
      bill: {
        select: {
          id: true,
          number: true,
          total: true,
          date: true,
          dueDate: true,
          vendorId: true,
          userId: true,
          subsidiaryId: true,
          currencyId: true,
        },
      },
      applications: {
        include: {
          bill: {
            select: {
              id: true,
              number: true,
              total: true,
              date: true,
              dueDate: true,
              vendorId: true,
              userId: true,
              subsidiaryId: true,
              currencyId: true,
            },
          },
        },
      },
    },
  })

  if (!payment || !BILL_PAYMENT_POSTING_STATUSES.has(payment.status.toLowerCase())) return

  const appliedBills = payment.applications.length > 0
    ? payment.applications.map((application) => application.bill)
    : payment.bill
      ? [payment.bill]
      : []
  const firstBill = appliedBills[0] ?? null

  const amount = payment.applications.length > 0
    ? roundMoney(payment.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0))
    : Number(payment.amount)
  if (!Number.isFinite(amount) || amount <= 0) return

  const {
    apAccountId,
    bankAccountId,
    realizedFxGainAccountId,
    realizedFxLossAccountId,
  } = await findBillPaymentPostingAccounts(payment.bankAccountId)

  const paymentCurrencyContext = await deriveOpenItemCurrencyContext({
    subsidiaryId: firstBill.subsidiaryId ?? null,
    transactionCurrencyId: firstBill.currencyId ?? null,
    transactionAmount: amount,
    effectiveDate: payment.date,
    rateType: 'spot',
  })

  const paymentOpenItem = await ensureOpenItemForSource({
    openItemType: 'vendor_payment',
    accountType: 'Liability',
    accountId: bankAccountId,
    subsidiaryId: firstBill.subsidiaryId ?? null,
    transactionCurrencyId: paymentCurrencyContext.transactionCurrencyId,
    localCurrencyId: paymentCurrencyContext.localCurrencyId,
    functionalCurrencyId: paymentCurrencyContext.functionalCurrencyId,
    groupCurrencyId: paymentCurrencyContext.groupCurrencyId,
    sourceTransactionType: 'bill-payment',
    sourceTransactionId: payment.id,
    sourceNumber: payment.number,
    counterpartyType: 'vendor',
    counterpartyId: payment.vendorId ?? firstBill.vendorId,
    documentDate: payment.date,
    postingDate: payment.date,
    originalTransactionAmount: amount,
    originalLocalAmount: paymentCurrencyContext.originalLocalAmount,
    originalFunctionalAmount: paymentCurrencyContext.originalFunctionalAmount,
    originalGroupAmount: paymentCurrencyContext.originalGroupAmount,
    memo: payment.reference ?? payment.notes ?? null,
    createdById: firstBill.userId ?? null,
  })

  const applicationsToSettle = payment.applications.length > 0
    ? payment.applications.map((application) => ({
        bill: application.bill,
        appliedAmount: Number(application.appliedAmount),
      }))
    : payment.bill
      ? [{
          bill: payment.bill,
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
    const billCurrencyContext = await deriveOpenItemCurrencyContext({
      subsidiaryId: application.bill.subsidiaryId ?? null,
      transactionCurrencyId: application.bill.currencyId ?? null,
      transactionAmount: application.bill.total,
      effectiveDate: application.bill.date,
      rateType: 'spot',
    })

    const billOpenItem = await ensureOpenItemForSource({
      openItemType: 'accounts_payable',
      accountType: 'Liability',
      accountId: apAccountId,
      subsidiaryId: application.bill.subsidiaryId ?? null,
      transactionCurrencyId: billCurrencyContext.transactionCurrencyId,
      localCurrencyId: billCurrencyContext.localCurrencyId,
      functionalCurrencyId: billCurrencyContext.functionalCurrencyId,
      groupCurrencyId: billCurrencyContext.groupCurrencyId,
      sourceTransactionType: 'bill',
      sourceTransactionId: application.bill.id,
      sourceNumber: application.bill.number,
      counterpartyType: 'vendor',
      counterpartyId: application.bill.vendorId,
      documentDate: application.bill.date,
      postingDate: application.bill.date,
      dueDate: application.bill.dueDate ?? null,
      originalTransactionAmount: application.bill.total,
      originalLocalAmount: billCurrencyContext.originalLocalAmount,
      originalFunctionalAmount: billCurrencyContext.originalFunctionalAmount,
      originalGroupAmount: billCurrencyContext.originalGroupAmount,
      createdById: application.bill.userId ?? null,
    })

    const settlementCurrencyContext = await deriveOpenItemCurrencyContext({
      subsidiaryId: application.bill.subsidiaryId ?? null,
      transactionCurrencyId: application.bill.currencyId ?? null,
      transactionAmount: application.appliedAmount,
      effectiveDate: payment.date,
      rateType: 'spot',
    })

    const existingApplication = await findExistingOpenItemApplication({
      fromOpenItemId: paymentOpenItem.id,
      toOpenItemId: billOpenItem.id,
      settlementTransactionType: 'bill-payment',
      settlementTransactionId: payment.id,
    })

    const postedApplication = existingApplication ?? (await applyOpenItems({
        fromOpenItemId: paymentOpenItem.id,
        toOpenItemId: billOpenItem.id,
        applicationType: 'bill_payment_application',
        settlementTransactionType: 'bill-payment',
        settlementTransactionId: payment.id,
        applicationDate: payment.date,
        postingDate: payment.date,
        transactionAmount: application.appliedAmount,
        localAmount: settlementCurrencyContext.originalLocalAmount,
        functionalAmount: settlementCurrencyContext.originalFunctionalAmount,
        groupAmount: settlementCurrencyContext.originalGroupAmount,
        memo: payment.reference ?? payment.notes ?? null,
        createdById: application.bill.userId ?? null,
        clearingType: 'bill_payment_application',
        automationSource: 'bill-payment-posting',
      })).application

    await deleteLegacyBillPaymentSettlementApplications(payment.id, postedApplication.id, [
      paymentOpenItem.id,
      billOpenItem.id,
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
        originalTransactionAmount: Number(application.bill.total),
        originalTranslatedAmount:
          billCurrencyContext.originalGroupAmount == null ? null : Number(billCurrencyContext.originalGroupAmount),
        settledTransactionAmount: application.appliedAmount,
        settledTranslatedAmount:
          settlementCurrencyContext.originalGroupAmount == null ? null : Number(settlementCurrencyContext.originalGroupAmount),
      }),
    })
  }

  if (existingJournal) return

  if (!apAccountId || !bankAccountId || !firstBill) return

  const journalNumber = await generateNextJournalNumber()
  const canPopulateLocalLayer =
    settlementSummaries.length > 0
    && settlementSummaries.every(
      (summary) => summary.localAmount != null && summary.realizedFxLocalAmount != null,
    )
    && paymentCurrencyContext.originalLocalAmount != null
  const canPopulateFunctionalLayer =
    settlementSummaries.length > 0
    && settlementSummaries.every(
      (summary) => summary.functionalAmount != null && summary.realizedFxFunctionalAmount != null,
    )
    && paymentCurrencyContext.originalFunctionalAmount != null
  const canPopulateGroupLayer =
    settlementSummaries.length > 0
    && settlementSummaries.every(
      (summary) => summary.groupAmount != null && summary.realizedFxGroupAmount != null,
    )
    && paymentCurrencyContext.originalGroupAmount != null

  const apLocalDebit = canPopulateLocalLayer
    ? roundMoney(
        settlementSummaries.reduce(
          (sum, summary) => sum + (deriveCarriedSettlementAmount(summary.localAmount, summary.realizedFxLocalAmount) ?? 0),
          0,
        ),
      )
    : null
  const apFunctionalDebit = canPopulateFunctionalLayer
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
  const apGroupDebit = canPopulateGroupLayer
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
    description: `${payment.number} realized FX`,
    memo: payment.reference ?? payment.notes ?? null,
    subsidiaryId: firstBill.subsidiaryId,
    vendorId: payment.vendorId ?? firstBill.vendorId,
    realizedFxGainAccountId,
    realizedFxLossAccountId,
    orientation: 'liability',
    localAmount: realizedFxLocalTotal,
    functionalAmount: realizedFxFunctionalTotal,
    groupAmount: realizedFxGroupTotal,
    startingDisplayOrder: 2,
  })

  await prisma.journalEntry.create({
    data: {
      number: journalNumber,
      date: payment.date,
      description: `Bill payment ${payment.number}`,
      journalType: 'standard',
      status: 'approved',
      total: amount,
      sourceType: 'bill-payment',
      sourceId: payment.id,
      subsidiaryId: firstBill.subsidiaryId,
      currencyId: firstBill.currencyId,
      userId: firstBill.userId,
      lineItems: {
        create: [
          {
            displayOrder: 0,
            description: `${payment.number} AP settlement`,
            memo: payment.notes ?? null,
            activityTypeCode: 'ap_settlement',
            debit: amount,
            credit: 0,
            localDebit: apLocalDebit,
            functionalDebit: apFunctionalDebit,
            groupDebit: apGroupDebit,
            accountId: apAccountId,
            subsidiaryId: firstBill.subsidiaryId,
            vendorId: payment.vendorId ?? firstBill.vendorId,
          },
          {
            displayOrder: 1,
            description: `${payment.number} cash disbursement`,
            memo: payment.reference ?? payment.notes ?? null,
            activityTypeCode: 'cash_disbursement',
            debit: 0,
            credit: amount,
            localCredit:
              paymentCurrencyContext.originalLocalAmount == null
                ? undefined
                : Number(paymentCurrencyContext.originalLocalAmount),
            functionalCredit:
              paymentCurrencyContext.originalFunctionalAmount == null
                ? undefined
                : Number(paymentCurrencyContext.originalFunctionalAmount),
            groupCredit:
              paymentCurrencyContext.originalGroupAmount == null
                ? undefined
                : Number(paymentCurrencyContext.originalGroupAmount),
            accountId: bankAccountId,
            subsidiaryId: firstBill.subsidiaryId,
            vendorId: payment.vendorId ?? firstBill.vendorId,
          },
          ...fxLines,
        ],
      },
    },
    })

  await prisma.billPayment.update({
    where: { id: payment.id },
    data: {
      fxRateType: paymentCurrencyContext.translationAudit?.rateType ?? 'spot',
      fxRateSource: paymentCurrencyContext.translationAudit?.sourceSummary ?? 'Configured exchange rates',
      fxEffectiveDate: paymentCurrencyContext.translationAudit?.effectiveDate ?? payment.date,
    },
  })

  await logActivity({
    entityType: 'bill-payment',
    entityId: payment.id,
    action: 'post',
    summary: `Posted bill payment ${payment.number} to GL`,
    userId: firstBill.userId,
  })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.billPayment.findUnique({
      where: { id },
      include: {
        vendor: true,
        bankAccount: true,
        bill: { include: { vendor: true } },
        applications: {
          include: {
            bill: {
              include: { vendor: true },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.billPayment.findMany({
    include: {
      vendor: true,
      bill: { include: { vendor: true } },
      applications: { include: { bill: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const body = await req.json()
    if (action === 'send-email') {
      const {
        billPaymentId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        billPaymentId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!billPaymentId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const payment = await prisma.billPayment.findUnique({
        where: { id: billPaymentId },
        select: { id: true },
      })

      if (!payment) {
        return NextResponse.json({ error: 'Bill payment not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'bill-payment',
        entityId: billPaymentId,
        userId: userId ?? null,
        context: 'UI',
        channel: 'Email',
        direction: 'Outbound',
        subject: subject.trim(),
        from: from?.trim() || '-',
        to: to.trim(),
        status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
        preview: preview?.trim() || '',
      })

      return NextResponse.json({ success: true })
    }
    const number = await generateBillPaymentNumber()
    const applications = normalizeBillPaymentApplications(body.applications)
    if (body.amount !== undefined) body.amount = parseMoneyValue(body.amount)
    if (body.date) body.date = new Date(body.date)
    const normalizedStatus = typeof body.status === 'string' ? body.status.toLowerCase() : 'pending'
    const legacyBillId = typeof body.billId === 'string' && body.billId.trim() ? body.billId.trim() : null
    const legacyVendorId = legacyBillId
      ? (
          await prisma.bill.findUnique({
            where: { id: legacyBillId },
            select: { vendorId: true },
          })
        )?.vendorId ?? null
      : null
    const resolvedVendorId = typeof body.vendorId === 'string' && body.vendorId.trim()
      ? body.vendorId.trim()
      : legacyVendorId

    if (applications.length === 0) {
      return NextResponse.json({ error: 'At least one bill application is required' }, { status: 400 })
    }

    const postingContext = await validateBillPaymentApplications(
      resolvedVendorId,
      body.amount ?? 0,
      applications,
      undefined,
      BILL_PAYMENT_POSTING_STATUSES.has(normalizedStatus),
    )

    if (
      body.subsidiaryId
      && postingContext.subsidiaryId
      && body.subsidiaryId !== postingContext.subsidiaryId
    ) {
      return NextResponse.json({ error: 'Bill payment subsidiary must match the applied bill subsidiary' }, { status: 400 })
    }

    if (
      body.currencyId
      && postingContext.currencyId
      && body.currencyId !== postingContext.currencyId
    ) {
      return NextResponse.json({ error: 'Bill payment currency must match the applied bill currency' }, { status: 400 })
    }

    const row = await prisma.billPayment.create({
      data: {
        number,
        date: body.date,
        method: body.method ?? null,
        reference: body.reference ?? null,
        status: body.status ?? 'pending',
        notes: body.notes ?? null,
        bankAccountId: body.bankAccountId ?? null,
        vendorId: resolvedVendorId,
        billId: applications[0]?.billId ?? legacyBillId,
        subsidiaryId: postingContext.subsidiaryId,
        currencyId: postingContext.currencyId,
        amount: body.amount ?? 0,
        applications: {
          create: applications.map((application) => ({
            billId: application.billId,
            appliedAmount: application.appliedAmount,
          })),
        },
      },
    })
    await syncBillPaymentDocumentRelationships(row.id)
    if (BILL_PAYMENT_POSTING_STATUSES.has((row.status ?? '').toLowerCase())) {
      await postBillPaymentJournal(row.id)
    }
    await logActivity({
      entityType: 'bill-payment',
      entityId: row.id,
      action: 'create',
      summary: `Created bill payment ${row.number}`,
    })
    await logRecordSnapshotActivities({
      entityType: 'bill-payment',
      entityId: row.id,
      action: 'create',
      context: 'Bill Payment Details',
      fields: [
        { fieldName: 'Business Id', value: row.number },
        { fieldName: 'Vendor', value: row.vendorId },
        { fieldName: 'Bill', value: row.billId },
        { fieldName: 'Subsidiary', value: row.subsidiaryId ?? '-' },
        { fieldName: 'Currency', value: row.currencyId ?? '-' },
        { fieldName: 'Amount', value: row.amount },
        { fieldName: 'Date', value: row.date },
        { fieldName: 'Method', value: row.method },
        { fieldName: 'Bank Account', value: row.bankAccountId },
        { fieldName: 'Reference', value: row.reference },
        { fieldName: 'Status', value: row.status },
        { fieldName: 'Notes', value: row.notes },
      ],
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create bill payment'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json()
    const before = await prisma.billPayment.findUnique({
      where: { id },
      include: {
        applications: {
          select: {
            billId: true,
            appliedAmount: true,
          },
        },
      },
    })
    if (!before) return NextResponse.json({ error: 'Bill payment not found' }, { status: 404 })
    const applications = normalizeBillPaymentApplications(body.applications)
    if (body.amount !== undefined) body.amount = parseMoneyValue(body.amount)
    if (body.date) body.date = new Date(body.date)
    const normalizedStatus = typeof body.status === 'string' ? body.status.toLowerCase() : before.status.toLowerCase()
    const resolvedVendorId = typeof body.vendorId === 'string' && body.vendorId.trim()
      ? body.vendorId.trim()
      : before.vendorId

    if (body.applications !== undefined && applications.length === 0) {
      return NextResponse.json({ error: 'At least one bill application is required' }, { status: 400 })
    }

    await validateBillPaymentApplications(
      resolvedVendorId,
      body.amount ?? Number(before.amount),
      applications.length > 0
        ? applications
        : before.applications.length > 0
          ? before.applications.map((application) => ({
              billId: application.billId,
              appliedAmount: Number(application.appliedAmount),
            }))
          : before.billId
            ? [{ billId: before.billId, appliedAmount: Number(before.amount) }]
            : [],
      before.id,
      BILL_PAYMENT_POSTING_STATUSES.has(normalizedStatus),
    )

    const row = await prisma.billPayment.update({
      where: { id },
      data: {
        ...(body.date !== undefined ? { date: body.date } : {}),
        ...(body.method !== undefined ? { method: body.method ?? null } : {}),
        ...(body.reference !== undefined ? { reference: body.reference ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
        ...(body.bankAccountId !== undefined ? { bankAccountId: body.bankAccountId ?? null } : {}),
        ...(body.vendorId !== undefined ? { vendorId: body.vendorId ?? null } : {}),
        ...(body.billId !== undefined || applications.length > 0
          ? { billId: applications[0]?.billId ?? (typeof body.billId === 'string' && body.billId.trim() ? body.billId.trim() : null) }
          : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.applications !== undefined
          ? {
              applications: {
                deleteMany: {},
                create: applications.map((application) => ({
                  billId: application.billId,
                  appliedAmount: application.appliedAmount,
                })),
              },
            }
        : {}),
      },
    })
    await syncBillPaymentDocumentRelationships(row.id)

    const changes = [
      body.vendorId !== undefined && (before.vendorId ?? '') !== (row.vendorId ?? '')
        ? { fieldName: 'Vendor', oldValue: before.vendorId ?? '-', newValue: row.vendorId ?? '-' }
        : null,
      body.billId !== undefined && before.billId !== row.billId
        ? { fieldName: 'Bill', oldValue: before.billId, newValue: row.billId }
        : null,
      body.amount !== undefined && String(before.amount) !== String(row.amount)
        ? { fieldName: 'Amount', oldValue: String(before.amount), newValue: String(row.amount) }
        : null,
      body.date !== undefined && before.date.toISOString() !== row.date.toISOString()
        ? { fieldName: 'Date', oldValue: before.date.toISOString().slice(0, 10), newValue: row.date.toISOString().slice(0, 10) }
        : null,
      body.method !== undefined && (before.method ?? '') !== (row.method ?? '')
        ? { fieldName: 'Method', oldValue: before.method ?? '-', newValue: row.method ?? '-' }
        : null,
      body.bankAccountId !== undefined && (before.bankAccountId ?? '') !== (row.bankAccountId ?? '')
        ? { fieldName: 'Bank Account', oldValue: before.bankAccountId ?? '-', newValue: row.bankAccountId ?? '-' }
        : null,
      body.reference !== undefined && (before.reference ?? '') !== (row.reference ?? '')
        ? { fieldName: 'Reference', oldValue: before.reference ?? '-', newValue: row.reference ?? '-' }
        : null,
      body.status !== undefined && before.status !== row.status
        ? { fieldName: 'Status', oldValue: before.status, newValue: row.status }
        : null,
      body.notes !== undefined && (before.notes ?? '') !== (row.notes ?? '')
        ? { fieldName: 'Notes', oldValue: before.notes ?? '-', newValue: row.notes ?? '-' }
        : null,
    ].filter((change): change is { fieldName: string; oldValue: string; newValue: string } => Boolean(change))

    await logFieldChangeActivities({
      entityType: 'bill-payment',
      entityId: row.id,
      context: 'Bill Payment Details',
      changes,
    })
    await logActivity({
      entityType: 'bill-payment',
      entityId: row.id,
      action: 'update',
      summary: `Updated bill payment ${row.number}`,
    })
    if (BILL_PAYMENT_POSTING_STATUSES.has((row.status ?? '').toLowerCase())) {
      await postBillPaymentJournal(row.id)
    }
    return NextResponse.json(row)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update bill payment'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await prisma.billPayment.findUnique({
      where: { id },
      select: { id: true, number: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bill payment not found' }, { status: 404 })
    }

    const row = await prisma.billPayment.delete({ where: { id } })
    await deleteDocumentRelationshipsForRecord('bill-payment', id)
    await logActivity({
      entityType: 'bill-payment',
      entityId: row.id,
      action: 'delete',
      summary: `Deleted bill payment ${row.number}`,
    })
    await logRecordSnapshotActivities({
      entityType: 'bill-payment',
      entityId: row.id,
      action: 'delete',
      context: 'Bill Payment Details',
      fields: [
        { fieldName: 'Business Id', value: row.number },
        { fieldName: 'Vendor', value: row.vendorId },
        { fieldName: 'Bill', value: row.billId },
        { fieldName: 'Amount', value: row.amount },
        { fieldName: 'Date', value: row.date },
        { fieldName: 'Method', value: row.method },
        { fieldName: 'Bank Account', value: row.bankAccountId },
        { fieldName: 'Reference', value: row.reference },
        { fieldName: 'Status', value: row.status },
        { fieldName: 'Notes', value: row.notes },
      ],
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Transaction has the following child records:\n\nUnable to delete because dependent records exist.' },
      { status: 409 },
    )
  }
}
