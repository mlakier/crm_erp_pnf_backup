import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMoneyValue } from '@/lib/money'
import { loadListValues } from '@/lib/load-list-values'
import { generateVendorRefundNumber } from '@/lib/vendor-refund-number'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import { loadConfiguredRealizedFxPostingAccounts } from '@/lib/company-setup-account-resolver'
import { deriveOpenItemCurrencyContext } from '@/lib/open-item-currency-context'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { logActivity, logCommunicationActivity } from '@/lib/activity'
import {
  buildRealizedFxJournalLines,
  computeRealizedFxLayerAmount,
  deriveCarriedSettlementAmount,
} from '@/lib/settlement-fx-journal'
import {
  applyOpenItems,
  ensureOpenItemForSource,
  findExistingOpenItemApplication,
  syncOpenItemStatus,
} from '@/lib/open-item-service'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

const VENDOR_REFUND_POSTING_STATUSES = new Set(['processed'])

async function loadVendorRefundStatusValues() {
  const values = await loadListValues('VENDOR-REFUND-STATUS')
  return values.map((value) => value.toLowerCase())
}

function normalizeVendorRefundStatus(value: unknown, allowedStatuses: string[], fallback: string) {
  const normalized = typeof value === 'string' ? value.toLowerCase() : fallback
  return allowedStatuses.includes(normalized) ? normalized : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

async function computeBillPaymentOverpayment(billPaymentId: string, excludingRefundId?: string) {
  const payment = await prisma.billPayment.findUnique({
    where: { id: billPaymentId },
    include: {
      vendor: true,
      bill: {
        include: {
          vendor: true,
        },
      },
      applications: {
        include: {
          bill: true,
        },
      },
      vendorRefunds: {
        select: { id: true, amount: true, status: true },
      },
    },
  })
  if (!payment) {
    throw new Error('Selected bill payment could not be found')
  }

  const firstBill = payment.bill ?? payment.applications[0]?.bill ?? null
  const vendorId = payment.vendorId ?? firstBill?.vendorId ?? null
  const vendorName = payment.vendor?.name ?? payment.bill?.vendor?.name ?? null

  const appliedAmount = roundMoney(payment.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0))
  const refundedAmount = roundMoney(
    payment.vendorRefunds.reduce((sum, refund) => {
      if (excludingRefundId && refund.id === excludingRefundId) return sum
      if ((refund.status ?? '').toLowerCase() === 'void') return sum
      return sum + Number(refund.amount)
    }, 0),
  )
  const availableAmount = roundMoney(Number(payment.amount) - appliedAmount - refundedAmount)

  return {
    payment,
    firstBill,
    vendorId,
    vendorName,
    availableAmount,
  }
}

async function findVendorRefundPostingAccounts(bankAccountId: string | null | undefined) {
  const companySettings = await loadCompanySetupSettings()

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
  }
}

async function postVendorRefundJournal(refundId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'vendor-refund', sourceId: refundId },
    select: { id: true },
  })
  if (existingJournal) return

  const refund = await prisma.vendorRefund.findUnique({
    where: { id: refundId },
    include: {
      vendor: true,
      billPayment: {
        include: {
          bill: true,
          applications: {
            include: {
              bill: true,
            },
          },
        },
      },
    },
  })
  if (!refund || !VENDOR_REFUND_POSTING_STATUSES.has(refund.status.toLowerCase())) return

  const amount = Number(refund.amount)
  if (!Number.isFinite(amount) || amount <= 0) return

  const firstBill = refund.billPayment?.bill ?? refund.billPayment?.applications[0]?.bill ?? null
  if (!firstBill || !refund.billPayment) return

  const { apAccountId, bankAccountId } = await findVendorRefundPostingAccounts(refund.bankAccountId)
  const realizedFxAccounts = await loadConfiguredRealizedFxPostingAccounts()

  const paymentCurrencyContext = await deriveOpenItemCurrencyContext({
    subsidiaryId: firstBill.subsidiaryId ?? null,
    transactionCurrencyId: firstBill.currencyId ?? null,
    transactionAmount: refund.billPayment.amount,
    effectiveDate: refund.billPayment.date,
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
    sourceTransactionId: refund.billPayment.id,
    sourceNumber: refund.billPayment.number,
    counterpartyType: 'vendor',
    counterpartyId: refund.vendorId,
    documentDate: refund.billPayment.date,
    postingDate: refund.billPayment.date,
    originalTransactionAmount: refund.billPayment.amount,
    originalLocalAmount: paymentCurrencyContext.originalLocalAmount,
    originalFunctionalAmount: paymentCurrencyContext.originalFunctionalAmount,
    originalGroupAmount: paymentCurrencyContext.originalGroupAmount,
    memo: refund.billPayment.reference ?? refund.billPayment.notes ?? null,
    createdById: firstBill.userId ?? null,
  })

  const refundCurrencyContext = await deriveOpenItemCurrencyContext({
    subsidiaryId: refund.subsidiaryId ?? firstBill.subsidiaryId ?? null,
    transactionCurrencyId: refund.currencyId ?? firstBill.currencyId ?? null,
    transactionAmount: amount,
    effectiveDate: refund.date,
    rateType: 'spot',
  })

  const refundOpenItem = await ensureOpenItemForSource({
    openItemType: 'vendor_refund',
    accountType: 'Liability',
    accountId: bankAccountId,
    subsidiaryId: refund.subsidiaryId ?? firstBill.subsidiaryId ?? null,
    transactionCurrencyId: refundCurrencyContext.transactionCurrencyId,
    localCurrencyId: refundCurrencyContext.localCurrencyId,
    functionalCurrencyId: refundCurrencyContext.functionalCurrencyId,
    groupCurrencyId: refundCurrencyContext.groupCurrencyId,
    sourceTransactionType: 'vendor-refund',
    sourceTransactionId: refund.id,
    sourceNumber: refund.number,
    counterpartyType: 'vendor',
    counterpartyId: refund.vendorId,
    documentDate: refund.date,
    postingDate: refund.date,
    dueDate: refund.date,
    originalTransactionAmount: amount,
    originalLocalAmount: refundCurrencyContext.originalLocalAmount,
    originalFunctionalAmount: refundCurrencyContext.originalFunctionalAmount,
    originalGroupAmount: refundCurrencyContext.originalGroupAmount,
    memo: refund.reference ?? refund.notes ?? null,
    createdById: refund.userId ?? firstBill.userId ?? null,
  })

  const existingApplication = await findExistingOpenItemApplication({
    fromOpenItemId: refundOpenItem.id,
    toOpenItemId: paymentOpenItem.id,
    settlementTransactionType: 'vendor-refund',
    settlementTransactionId: refund.id,
  })

  const postedApplication = existingApplication ?? (
    await applyOpenItems({
      fromOpenItemId: refundOpenItem.id,
      toOpenItemId: paymentOpenItem.id,
      applicationType: 'vendor_refund_application',
      settlementTransactionType: 'vendor-refund',
      settlementTransactionId: refund.id,
      applicationDate: refund.date,
      postingDate: refund.date,
      transactionAmount: amount,
      localAmount: refundCurrencyContext.originalLocalAmount,
      functionalAmount: refundCurrencyContext.originalFunctionalAmount,
      groupAmount: refundCurrencyContext.originalGroupAmount,
      memo: refund.reference ?? refund.notes ?? null,
      createdById: refund.userId ?? null,
      clearingType: 'vendor_refund_application',
      automationSource: 'vendor-refund-posting',
    })
  ).application

  if (!apAccountId || !bankAccountId) return
  if (existingJournal) return

  const localAmount = postedApplication.localAmount == null ? null : Number(postedApplication.localAmount)
  const functionalAmount =
    postedApplication.functionalAmount == null ? null : Number(postedApplication.functionalAmount)
  const groupAmount = postedApplication.groupAmount == null ? null : Number(postedApplication.groupAmount)
  const realizedFxLocalAmount =
    postedApplication.realizedFxLocalAmount == null ? null : Number(postedApplication.realizedFxLocalAmount)
  const realizedFxFunctionalAmount =
    postedApplication.realizedFxFunctionalAmount == null ? null : Number(postedApplication.realizedFxFunctionalAmount)
  const realizedFxGroupAmount = computeRealizedFxLayerAmount({
    originalTransactionAmount:
      paymentOpenItem.originalTransactionAmount == null ? null : Number(paymentOpenItem.originalTransactionAmount),
    originalTranslatedAmount:
      paymentOpenItem.originalGroupAmount == null ? null : Number(paymentOpenItem.originalGroupAmount),
    settledTransactionAmount: amount,
    settledTranslatedAmount:
      refundCurrencyContext.originalGroupAmount == null ? null : Number(refundCurrencyContext.originalGroupAmount),
  })

  const apLocalCredit = deriveCarriedSettlementAmount(localAmount, realizedFxLocalAmount)
  const apFunctionalCredit = deriveCarriedSettlementAmount(functionalAmount, realizedFxFunctionalAmount)
  const apGroupCredit = deriveCarriedSettlementAmount(groupAmount, realizedFxGroupAmount)

  const fxLines = buildRealizedFxJournalLines({
    description: `${refund.number} realized FX`,
    memo: refund.reference ?? refund.notes ?? null,
    subsidiaryId: refund.subsidiaryId ?? firstBill.subsidiaryId ?? null,
    vendorId: refund.vendorId,
    realizedFxGainAccountId: realizedFxAccounts.realizedFxGainAccountId,
    realizedFxLossAccountId: realizedFxAccounts.realizedFxLossAccountId,
    orientation: 'liability',
    localAmount: realizedFxLocalAmount,
    functionalAmount: realizedFxFunctionalAmount,
    groupAmount: realizedFxGroupAmount,
    startingDisplayOrder: 2,
  })

  const journalNumber = await generateNextJournalNumber()
  await prisma.journalEntry.create({
    data: {
      number: journalNumber,
      date: refund.date,
      description: `Vendor refund ${refund.number}`,
      journalType: 'standard',
      status: 'approved',
      total: amount,
      sourceType: 'vendor-refund',
      sourceId: refund.id,
      subsidiaryId: refund.subsidiaryId,
      currencyId: refund.currencyId,
      userId: refund.userId,
      lineItems: {
        create: [
          {
            displayOrder: 0,
            description: `${refund.number} cash receipt`,
            memo: refund.reference ?? null,
            activityTypeCode: 'cash_receipt',
            debit: amount,
            credit: 0,
            localDebit:
              refundCurrencyContext.originalLocalAmount == null
                ? undefined
                : Number(refundCurrencyContext.originalLocalAmount),
            functionalDebit:
              refundCurrencyContext.originalFunctionalAmount == null
                ? undefined
                : Number(refundCurrencyContext.originalFunctionalAmount),
            groupDebit:
              refundCurrencyContext.originalGroupAmount == null
                ? undefined
                : Number(refundCurrencyContext.originalGroupAmount),
            accountId: bankAccountId,
            subsidiaryId: refund.subsidiaryId,
            vendorId: refund.vendorId,
          },
          {
            displayOrder: 1,
            description: `${refund.number} AP settlement`,
            memo: refund.reference ?? null,
            activityTypeCode: 'ap_settlement',
            debit: 0,
            credit: amount,
            localCredit: apLocalCredit == null ? undefined : apLocalCredit,
            functionalCredit: apFunctionalCredit == null ? undefined : apFunctionalCredit,
            groupCredit: apGroupCredit == null ? undefined : apGroupCredit,
            accountId: apAccountId,
            subsidiaryId: refund.subsidiaryId,
            vendorId: refund.vendorId,
          },
          ...fxLines,
        ],
      },
    },
  })

  await logActivity({
    entityType: 'vendor-refund',
    entityId: refund.id,
    action: 'post',
    summary: `Posted vendor refund ${refund.number} to GL`,
    userId: refund.userId ?? undefined,
  })
}

async function unpostVendorRefundJournal(refundId: string) {
  await prisma.$transaction(async (tx) => {
    const applications = await tx.openItemApplication.findMany({
      where: {
        settlementTransactionType: 'vendor-refund',
        settlementTransactionId: refundId,
      },
      select: {
        id: true,
        fromOpenItemId: true,
        toOpenItemId: true,
      },
    })

    const applicationIds = applications.map((application) => application.id)
    const openItemIdsToResync = Array.from(
      new Set(
        applications.flatMap((application) =>
          [application.fromOpenItemId, application.toOpenItemId].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ),
    )

    if (applicationIds.length) {
      await tx.openItemEntry.deleteMany({
        where: {
          sourceApplicationId: { in: applicationIds },
        },
      })
      await tx.openItemApplication.deleteMany({
        where: { id: { in: applicationIds } },
      })
      await tx.clearingDocumentHeader.deleteMany({
        where: {
          sourceTransactionType: 'vendor-refund',
          sourceTransactionId: refundId,
        },
      })
    }

    const refundOpenItems = await tx.openItem.findMany({
      where: {
        sourceTransactionType: 'vendor-refund',
        sourceTransactionId: refundId,
      },
      select: { id: true },
    })
    const refundOpenItemIds = refundOpenItems.map((item) => item.id)

    if (refundOpenItemIds.length) {
      await tx.openItemEntry.deleteMany({
        where: { openItemId: { in: refundOpenItemIds } },
      })
      await tx.openItem.deleteMany({
        where: { id: { in: refundOpenItemIds } },
      })
    }

    await tx.journalEntry.deleteMany({
      where: { sourceType: 'vendor-refund', sourceId: refundId },
    })

    for (const openItemId of openItemIdsToResync.filter((id) => !refundOpenItemIds.includes(id))) {
      await syncOpenItemStatus(openItemId, { tx })
    }
  })
}

async function syncVendorRefundPosting(refundId: string, status: string) {
  if (VENDOR_REFUND_POSTING_STATUSES.has(status.toLowerCase())) {
    await unpostVendorRefundJournal(refundId)
    await postVendorRefundJournal(refundId)
    return
  }
  await unpostVendorRefundJournal(refundId)
}

async function validateVendorRefund({
  vendorId,
  billPaymentId,
  amount,
  currentRefundId,
}: {
  vendorId: string
  billPaymentId?: string | null
  amount: number
  currentRefundId?: string
}) {
  if (!vendorId) throw new Error('Vendor is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be greater than zero')
  if (!billPaymentId) throw new Error('Refund source bill payment is required')

  const { payment, firstBill, vendorId: sourceVendorId, availableAmount } = await computeBillPaymentOverpayment(billPaymentId, currentRefundId)
  if (!sourceVendorId || sourceVendorId !== vendorId) {
    throw new Error('Selected overpayment source does not belong to the chosen vendor')
  }
  if (!firstBill?.subsidiaryId || !firstBill.currencyId) {
    throw new Error('Selected bill payment does not have complete transaction subsidiary/currency context')
  }
  if (availableAmount <= 0) {
    throw new Error('Selected bill payment does not have refundable overpayment available')
  }
  if (amount > availableAmount + 0.005) {
    throw new Error(`Refund amount exceeds available refundable balance of ${availableAmount.toFixed(2)}`)
  }

  return {
    subsidiaryId: firstBill.subsidiaryId,
    currencyId: firstBill.currencyId,
    userId: firstBill.userId ?? null,
    payment,
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.vendorRefund.findUnique({
      where: { id },
      include: {
        vendor: true,
        billPayment: {
          include: {
            bill: { include: { vendor: true } },
          },
        },
        bankAccount: true,
      },
    })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = await prisma.vendorRefund.findMany({
    include: {
      vendor: true,
      billPayment: {
        include: {
          bill: { include: { vendor: true } },
        },
      },
      bankAccount: true,
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
        vendorRefundId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        vendorRefundId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!vendorRefundId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const refund = await prisma.vendorRefund.findUnique({
        where: { id: vendorRefundId },
        select: { id: true },
      })

      if (!refund) {
        return NextResponse.json({ error: 'Vendor refund not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'vendor-refund',
        entityId: vendorRefundId,
        userId: userId ?? null,
        context: 'UI',
        channel: 'Email',
        direction: 'Outbound',
        subject: subject.trim(),
        from: from?.trim() || '-',
        to: to.trim(),
        status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
        preview: (preview?.trim() || '-').slice(0, 500),
      })

      return NextResponse.json({ ok: true })
    }

    const statusValues = await loadVendorRefundStatusValues()
    const normalizedStatus = normalizeVendorRefundStatus(body.status, statusValues, 'draft')
    const amount = parseMoneyValue(body.amount)
    const validation = await validateVendorRefund({
      vendorId: body.vendorId,
      billPaymentId: body.billPaymentId || null,
      amount,
    })
    const number = await generateVendorRefundNumber()

    const row = await prisma.vendorRefund.create({
      data: {
        number,
        vendorId: body.vendorId,
        billPaymentId: body.billPaymentId || null,
        bankAccountId: body.bankAccountId || null,
        amount,
        date: new Date(body.date),
        method: body.method,
        reference: body.reference || null,
        notes: body.notes || null,
        status: normalizedStatus,
        subsidiaryId: validation.subsidiaryId,
        currencyId: validation.currencyId,
        userId: validation.userId,
      },
    })

    await syncVendorRefundPosting(row.id, normalizedStatus)
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create vendor refund'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const before = await prisma.vendorRefund.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Vendor refund not found' }, { status: 404 })

    const statusValues = await loadVendorRefundStatusValues()
    const normalizedStatus = normalizeVendorRefundStatus(body.status, statusValues, before.status.toLowerCase())
    const amount = body.amount !== undefined ? parseMoneyValue(body.amount) : Number(before.amount)
    const vendorId = body.vendorId ?? before.vendorId
    const billPaymentId = body.billPaymentId !== undefined ? body.billPaymentId || null : before.billPaymentId

    const validation = await validateVendorRefund({
      vendorId,
      billPaymentId,
      amount,
      currentRefundId: before.id,
    })

    const row = await prisma.vendorRefund.update({
      where: { id },
      data: {
        ...(body.vendorId !== undefined ? { vendorId } : {}),
        ...(body.billPaymentId !== undefined ? { billPaymentId } : {}),
        ...(body.bankAccountId !== undefined ? { bankAccountId: body.bankAccountId || null } : {}),
        ...(body.amount !== undefined ? { amount } : {}),
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.method !== undefined ? { method: body.method } : {}),
        ...(body.reference !== undefined ? { reference: body.reference || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.status !== undefined ? { status: normalizedStatus } : {}),
        subsidiaryId: validation.subsidiaryId,
        currencyId: validation.currencyId,
        userId: validation.userId,
      },
    })

    await syncVendorRefundPosting(row.id, normalizedStatus)
    await logActivity({
      entityType: 'vendor-refund',
      entityId: row.id,
      action: 'update',
      summary: `Updated vendor refund ${row.number}`,
      userId: row.userId ?? undefined,
    })
    return NextResponse.json(row)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update vendor refund'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await unpostVendorRefundJournal(id)
  await prisma.vendorRefund.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
