import { Prisma } from '@prisma/client'

import { logActivity } from '@/lib/activity'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import {
  syncAutoDocumentRelationshipsForSource,
} from '@/lib/document-relationships'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { sumMoney } from '@/lib/money'
import { deriveOpenItemCurrencyContext } from '@/lib/open-item-currency-context'
import {
  applyOpenItems,
  ensureOpenItemForSource,
  findExistingOpenItemApplication,
  findOpenItemBySource,
  getOpenItemRemainingAmount,
  syncOpenItemStatus,
} from '@/lib/open-item-service'
import { prisma } from '@/lib/prisma'
import {
  buildRealizedFxJournalLines,
  computeProportionalTranslatedSettlementAmount,
  computeRealizedFxLayerAmount,
} from '@/lib/settlement-fx-journal'
import { loadConfiguredRealizedFxPostingAccounts } from '@/lib/company-setup-account-resolver'
import type { CreditMemoApplicationInput } from '@/lib/credit-memo-applications'
import type { BillCreditApplicationInput } from '@/lib/bill-credit-applications'

const MONEY_TOLERANCE = 0.005
const POSTING_STATUSES = new Set(['approved', 'applied', 'fully applied', 'partially applied'])
const AUTO_APPLICATION_STATUSES = new Set(['applied', 'fully applied', 'partially applied'])

function roundMoney(value: Prisma.Decimal.Value | number | null | undefined) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function isMaterialAmount(value: Prisma.Decimal.Value | number | null | undefined) {
  return Math.abs(roundMoney(value)) > MONEY_TOLERANCE
}

function allocateProportionalAmount(
  totalBaseAmount: number,
  totalTranslatedAmount: number | null | undefined,
  lineBaseAmount: number,
  isLastLine: boolean,
  allocatedSoFar: number,
) {
  if (!Number.isFinite(totalBaseAmount) || Math.abs(totalBaseAmount) <= MONEY_TOLERANCE) return undefined
  if (totalTranslatedAmount == null || !Number.isFinite(Number(totalTranslatedAmount))) return undefined

  const roundedTotal = roundMoney(totalTranslatedAmount)
  if (isLastLine) {
    return roundMoney(roundedTotal - allocatedSoFar)
  }
  return roundMoney((roundedTotal / totalBaseAmount) * lineBaseAmount)
}

async function findArTradeAccountId() {
  const companySettings = await loadCompanySetupSettings()
  const configuredArAccountId = companySettings.defaultArAccountId.trim() || null
  const configuredArAccount = configuredArAccountId
    ? await prisma.chartOfAccounts.findFirst({
        where: {
          id: configuredArAccountId,
          active: true,
          isPosting: true,
          accountType: 'Asset',
        },
        select: { id: true },
      })
    : null

  return (
    configuredArAccount?.id
    ?? (await prisma.chartOfAccounts.findFirst({
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
    }))?.id
    ?? (await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
      },
      select: { id: true },
    }))?.id
    ?? null
  )
}

async function findApTradeAccountId() {
  const companySettings = await loadCompanySetupSettings()
  const configuredApAccountId = companySettings.defaultApAccountId.trim() || null
  const configuredApAccount = configuredApAccountId
    ? await prisma.chartOfAccounts.findFirst({
        where: {
          id: configuredApAccountId,
          active: true,
          isPosting: true,
          accountType: 'Liability',
        },
        select: { id: true },
      })
    : null

  return (
    configuredApAccount?.id
    ?? (await prisma.chartOfAccounts.findFirst({
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
    }))?.id
    ?? (await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
      },
      select: { id: true },
    }))?.id
    ?? null
  )
}

async function findFallbackRevenueAccountId() {
  return (
    (await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Revenue',
        OR: [
          { name: { contains: 'Revenue', mode: 'insensitive' } },
          { accountId: '4000' },
        ],
      },
      select: { id: true },
    }))?.id
    ?? (await prisma.chartOfAccounts.findFirst({
      where: { active: true, isPosting: true, accountType: 'Revenue' },
      select: { id: true },
    }))?.id
    ?? null
  )
}

async function findFallbackDeferredRevenueAccountId() {
  return (
    (await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
        OR: [
          { name: { contains: 'Deferred Revenue', mode: 'insensitive' } },
          { accountId: '2200' },
        ],
      },
      select: { id: true },
    }))?.id
    ?? (await prisma.chartOfAccounts.findFirst({
      where: { active: true, isPosting: true, accountType: 'Liability' },
      select: { id: true },
    }))?.id
    ?? null
  )
}

async function findFallbackExpenseAccountId() {
  return (
    (await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Expense',
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }))?.id ?? null
  )
}

async function resetPostedArtifacts(
  sourceTransactionType: 'credit-memo' | 'bill-credit',
  sourceTransactionId: string,
  tx: Prisma.TransactionClient,
) {
  const applications = await tx.openItemApplication.findMany({
    where: {
      settlementTransactionType: sourceTransactionType,
      settlementTransactionId: sourceTransactionId,
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
  }

  await tx.clearingDocumentHeader.deleteMany({
    where: {
      sourceTransactionType,
      sourceTransactionId,
    },
  })

  const sourceOpenItems = await tx.openItem.findMany({
    where: {
      sourceTransactionType,
      sourceTransactionId,
    },
    select: { id: true },
  })
  const sourceOpenItemIds = sourceOpenItems.map((item) => item.id)

  if (sourceOpenItemIds.length) {
    await tx.openItemEntry.deleteMany({
      where: { openItemId: { in: sourceOpenItemIds } },
    })
    await tx.openItem.deleteMany({
      where: { id: { in: sourceOpenItemIds } },
    })
  }

  await tx.journalEntry.deleteMany({
    where: {
      sourceType: sourceTransactionType,
      sourceId: sourceTransactionId,
    },
  })

  await tx.documentRelationship.deleteMany({
    where: {
      sourceRecordType: sourceTransactionType,
      sourceRecordId: sourceTransactionId,
      relationshipType: 'settles',
      autoGenerated: true,
      automationSource: 'credit-document-posting',
    },
  })

  for (const openItemId of openItemIdsToResync.filter((id) => !sourceOpenItemIds.includes(id))) {
    await syncOpenItemStatus(openItemId, { tx })
  }
}

export async function clearCreditDocumentPostingArtifacts(
  sourceTransactionType: 'credit-memo' | 'bill-credit',
  sourceTransactionId: string,
) {
  return prisma.$transaction(async (tx) => {
    await resetPostedArtifacts(sourceTransactionType, sourceTransactionId, tx)
  })
}

async function resolveCreditMemoRevenueLines(
  creditMemo: Awaited<ReturnType<typeof loadCreditMemoForPosting>>,
  translationContext: Awaited<ReturnType<typeof deriveOpenItemCurrencyContext>>,
) {
  if (!creditMemo) return []

  const fallbackRevenueAccountId = await findFallbackRevenueAccountId()
  const fallbackDeferredRevenueAccountId = await findFallbackDeferredRevenueAccountId()

  let allocatedLocal = 0
  let allocatedFunctional = 0
  let allocatedGroup = 0

  return creditMemo.lineItems
    .map((line, index) => {
      const lineTotal = roundMoney(line.lineTotal)
      if (!isMaterialAmount(lineTotal)) return null

      const useDirectRevenue = line.item?.directRevenuePosting !== false
      const accountId = useDirectRevenue
        ? line.item?.incomeAccountId ?? fallbackRevenueAccountId
        : line.item?.deferredRevenueAccountId ?? fallbackDeferredRevenueAccountId

      if (!accountId) return null

      const isLastLine = index === creditMemo.lineItems.length - 1
      const localDebit = allocateProportionalAmount(
        roundMoney(creditMemo.total),
        translationContext.originalLocalAmount == null ? null : Number(translationContext.originalLocalAmount),
        lineTotal,
        isLastLine,
        allocatedLocal,
      )
      const functionalDebit = allocateProportionalAmount(
        roundMoney(creditMemo.total),
        translationContext.originalFunctionalAmount == null ? null : Number(translationContext.originalFunctionalAmount),
        lineTotal,
        isLastLine,
        allocatedFunctional,
      )
      const groupDebit = allocateProportionalAmount(
        roundMoney(creditMemo.total),
        translationContext.originalGroupAmount == null ? null : Number(translationContext.originalGroupAmount),
        lineTotal,
        isLastLine,
        allocatedGroup,
      )

      allocatedLocal += localDebit ?? 0
      allocatedFunctional += functionalDebit ?? 0
      allocatedGroup += groupDebit ?? 0

      return {
        displayOrder: index,
        description: line.description || creditMemo.number,
        memo: line.notes ?? creditMemo.notes ?? null,
        activityTypeCode: useDirectRevenue ? 'revenue_recognition' : 'deferred_revenue_addition',
        debit: lineTotal,
        credit: 0,
        localDebit,
        functionalDebit,
        groupDebit,
        accountId,
        subsidiaryId: creditMemo.subsidiaryId,
        customerId: creditMemo.customerId,
        itemId: line.itemId,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))
}

async function resolveBillCreditExpenseLines(
  billCredit: Awaited<ReturnType<typeof loadBillCreditForPosting>>,
  translationContext: Awaited<ReturnType<typeof deriveOpenItemCurrencyContext>>,
) {
  if (!billCredit) return []

  const fallbackExpenseAccountId = await findFallbackExpenseAccountId()
  const linkedBillExpenseByItemId = new Map<string, string>()
  let firstBillExpenseAccountId: string | null = null

  for (const line of billCredit.bill?.lineItems ?? []) {
    const candidateAccountId =
      line.lineType === 'expense'
        ? line.expenseAccountId
        : (line.item?.cogsExpenseAccountId ?? null)
    if (!candidateAccountId) continue
    if (!firstBillExpenseAccountId) firstBillExpenseAccountId = candidateAccountId
    if (line.itemId && !linkedBillExpenseByItemId.has(line.itemId)) {
      linkedBillExpenseByItemId.set(line.itemId, candidateAccountId)
    }
  }

  let allocatedLocal = 0
  let allocatedFunctional = 0
  let allocatedGroup = 0

  return billCredit.lineItems
    .map((line, index) => {
      const lineTotal = roundMoney(line.lineTotal)
      if (!isMaterialAmount(lineTotal)) return null

      const accountId =
        (line.itemId ? linkedBillExpenseByItemId.get(line.itemId) ?? null : null)
        ?? line.item?.cogsExpenseAccountId
        ?? firstBillExpenseAccountId
        ?? fallbackExpenseAccountId

      if (!accountId) return null

      const isLastLine = index === billCredit.lineItems.length - 1
      const localCredit = allocateProportionalAmount(
        roundMoney(billCredit.total),
        translationContext.originalLocalAmount == null ? null : Number(translationContext.originalLocalAmount),
        lineTotal,
        isLastLine,
        allocatedLocal,
      )
      const functionalCredit = allocateProportionalAmount(
        roundMoney(billCredit.total),
        translationContext.originalFunctionalAmount == null ? null : Number(translationContext.originalFunctionalAmount),
        lineTotal,
        isLastLine,
        allocatedFunctional,
      )
      const groupCredit = allocateProportionalAmount(
        roundMoney(billCredit.total),
        translationContext.originalGroupAmount == null ? null : Number(translationContext.originalGroupAmount),
        lineTotal,
        isLastLine,
        allocatedGroup,
      )

      allocatedLocal += localCredit ?? 0
      allocatedFunctional += functionalCredit ?? 0
      allocatedGroup += groupCredit ?? 0

      return {
        displayOrder: index + 1,
        description: line.description || billCredit.number,
        memo: line.notes ?? billCredit.notes ?? null,
        activityTypeCode: 'expense_recognition',
        debit: 0,
        credit: lineTotal,
        localCredit,
        functionalCredit,
        groupCredit,
        accountId,
        subsidiaryId: billCredit.subsidiaryId,
        vendorId: billCredit.vendorId,
        itemId: line.itemId,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))
}

async function loadCreditMemoForPosting(creditMemoId: string, tx: Prisma.TransactionClient) {
  return tx.creditMemo.findUnique({
    where: { id: creditMemoId },
    include: {
      customer: true,
      invoice: {
        include: {
          customer: true,
          currency: true,
        },
      },
      lineItems: {
        include: {
          item: {
            select: {
              id: true,
              itemId: true,
              name: true,
              directRevenuePosting: true,
              incomeAccountId: true,
              deferredRevenueAccountId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  })
}

async function loadBillCreditForPosting(billCreditId: string, tx: Prisma.TransactionClient) {
  return tx.billCredit.findUnique({
    where: { id: billCreditId },
    include: {
      vendor: true,
      bill: {
        include: {
          vendor: true,
          currency: true,
          lineItems: {
            include: {
              item: {
                select: {
                  id: true,
                  itemId: true,
                  name: true,
                  cogsExpenseAccountId: true,
                },
              },
            },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
      },
      lineItems: {
        include: {
          item: {
            select: {
              id: true,
              itemId: true,
              name: true,
              cogsExpenseAccountId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  })
}

async function syncCreditMemoStatus(
  creditMemoId: string,
  nextStatus: string,
  tx: Prisma.TransactionClient,
) {
  return tx.creditMemo.update({
    where: { id: creditMemoId },
    data: { status: nextStatus },
  })
}

async function syncBillCreditStatus(
  billCreditId: string,
  nextStatus: string,
  tx: Prisma.TransactionClient,
) {
  return tx.billCredit.update({
    where: { id: billCreditId },
    data: { status: nextStatus },
  })
}

export async function syncCreditMemoPosting(
  creditMemoId: string,
  desiredApplications?: CreditMemoApplicationInput[],
) {
  return prisma.$transaction(async (tx) => {
    const creditMemo = await loadCreditMemoForPosting(creditMemoId, tx)
    if (!creditMemo) {
      throw new Error('Credit memo not found')
    }

    const existingApplications = await tx.openItemApplication.findMany({
      where: {
        settlementTransactionType: 'credit-memo',
        settlementTransactionId: creditMemo.id,
      },
      select: {
        transactionAmount: true,
        toOpenItem: {
          select: {
            sourceTransactionId: true,
          },
        },
      },
    })

    await resetPostedArtifacts('credit-memo', creditMemo.id, tx)

    const normalizedStatus = (creditMemo.status ?? '').trim().toLowerCase()
    if (!POSTING_STATUSES.has(normalizedStatus)) {
      return creditMemo
    }

    const translationContext = await deriveOpenItemCurrencyContext({
      tx,
      subsidiaryId: creditMemo.subsidiaryId ?? creditMemo.invoice?.subsidiaryId ?? null,
      transactionCurrencyId: creditMemo.currencyId ?? creditMemo.invoice?.currencyId ?? null,
      transactionAmount: creditMemo.total,
      effectiveDate: creditMemo.date,
      rateType: 'spot',
    })

    const revenueLines = await resolveCreditMemoRevenueLines(creditMemo, translationContext)
    const totalDebit = sumMoney(revenueLines.map((line) => Number(line.debit ?? 0)))
    if (totalDebit <= 0) {
      throw new Error('Credit memo requires at least one postable line before it can post')
    }

    let invoiceOpenItem = creditMemo.invoiceId
      ? await findOpenItemBySource('invoice', creditMemo.invoiceId, tx)
      : null

    if (!invoiceOpenItem && creditMemo.invoice) {
      const arAccountId = await findArTradeAccountId()
      const invoiceCurrencyContext = await deriveOpenItemCurrencyContext({
        tx,
        subsidiaryId: creditMemo.invoice.subsidiaryId ?? null,
        transactionCurrencyId: creditMemo.invoice.currencyId ?? null,
        transactionAmount: creditMemo.invoice.total,
        effectiveDate: creditMemo.invoice.createdAt,
        rateType: 'spot',
      })
      invoiceOpenItem = await ensureOpenItemForSource({
        tx,
        openItemType: 'accounts_receivable',
        accountType: 'Asset',
        accountId: arAccountId,
        subsidiaryId: creditMemo.invoice.subsidiaryId ?? null,
        transactionCurrencyId: invoiceCurrencyContext.transactionCurrencyId,
        localCurrencyId: invoiceCurrencyContext.localCurrencyId,
        functionalCurrencyId: invoiceCurrencyContext.functionalCurrencyId,
        groupCurrencyId: invoiceCurrencyContext.groupCurrencyId,
        sourceTransactionType: 'invoice',
        sourceTransactionId: creditMemo.invoice.id,
        sourceNumber: creditMemo.invoice.number,
        counterpartyType: 'customer',
        counterpartyId: creditMemo.invoice.customerId,
        documentDate: creditMemo.invoice.createdAt,
        postingDate: creditMemo.invoice.createdAt,
        dueDate: null,
        originalTransactionAmount: creditMemo.invoice.total,
        originalLocalAmount: invoiceCurrencyContext.originalLocalAmount,
        originalFunctionalAmount: invoiceCurrencyContext.originalFunctionalAmount,
        originalGroupAmount: invoiceCurrencyContext.originalGroupAmount,
        createdById: creditMemo.invoice.userId ?? null,
      })
    }

    const arAccountId = invoiceOpenItem?.accountId ?? (await findArTradeAccountId())
    if (!arAccountId) {
      throw new Error('Accounts receivable posting account is not configured')
    }

    const applicationPlan =
      desiredApplications && desiredApplications.length > 0
        ? desiredApplications
        : existingApplications
            .map((application) => ({
              invoiceId: application.toOpenItem?.sourceTransactionId ?? '',
              appliedAmount: Number(application.transactionAmount),
            }))
            .filter((application) => application.invoiceId && application.appliedAmount > 0)

    const plannedApplications =
      AUTO_APPLICATION_STATUSES.has(normalizedStatus)
        ? (applicationPlan.length > 0
            ? applicationPlan
            : creditMemo.invoiceId && invoiceOpenItem
              ? [{
                  invoiceId: creditMemo.invoiceId,
                  appliedAmount: roundMoney(
                    Math.min(roundMoney(creditMemo.total), roundMoney((await getOpenItemRemainingAmount(invoiceOpenItem.id, tx)).transactionAmount)),
                  ),
                }]
              : [])
        : []

    const settlementPlans: Array<{
      invoiceId: string
      targetOpenItem: NonNullable<typeof invoiceOpenItem>
      transactionAmount: number
      localAmount: number | null
      functionalAmount: number | null
      groupAmount: number | null
      realizedFxLocalAmount: number | null
      realizedFxFunctionalAmount: number | null
      realizedFxGroupAmount: number | null
    }> = []

    for (const application of plannedApplications) {
      const targetOpenItem = await findOpenItemBySource('invoice', application.invoiceId, tx)
      if (!targetOpenItem) continue
      const targetRemaining = await getOpenItemRemainingAmount(targetOpenItem.id, tx)
      const transactionAmount = roundMoney(
        Math.min(roundMoney(application.appliedAmount), roundMoney(targetRemaining.transactionAmount)),
      )
      if (!isMaterialAmount(transactionAmount)) continue
      const localAmount = computeProportionalTranslatedSettlementAmount(
        roundMoney(creditMemo.total),
        translationContext.originalLocalAmount == null ? null : Number(translationContext.originalLocalAmount),
        transactionAmount,
      )
      const functionalAmount = computeProportionalTranslatedSettlementAmount(
        roundMoney(creditMemo.total),
        translationContext.originalFunctionalAmount == null ? null : Number(translationContext.originalFunctionalAmount),
        transactionAmount,
      )
      const groupAmount = computeProportionalTranslatedSettlementAmount(
        roundMoney(creditMemo.total),
        translationContext.originalGroupAmount == null ? null : Number(translationContext.originalGroupAmount),
        transactionAmount,
      )
      settlementPlans.push({
        invoiceId: application.invoiceId,
        targetOpenItem,
        transactionAmount,
        localAmount,
        functionalAmount,
        groupAmount,
        realizedFxLocalAmount: computeRealizedFxLayerAmount({
          originalTransactionAmount: targetOpenItem.originalTransactionAmount == null ? null : Number(targetOpenItem.originalTransactionAmount),
          originalTranslatedAmount: targetOpenItem.originalLocalAmount == null ? null : Number(targetOpenItem.originalLocalAmount),
          settledTransactionAmount: transactionAmount,
          settledTranslatedAmount: localAmount,
        }),
        realizedFxFunctionalAmount: computeRealizedFxLayerAmount({
          originalTransactionAmount: targetOpenItem.originalTransactionAmount == null ? null : Number(targetOpenItem.originalTransactionAmount),
          originalTranslatedAmount: targetOpenItem.originalFunctionalAmount == null ? null : Number(targetOpenItem.originalFunctionalAmount),
          settledTransactionAmount: transactionAmount,
          settledTranslatedAmount: functionalAmount,
        }),
        realizedFxGroupAmount: computeRealizedFxLayerAmount({
          originalTransactionAmount: targetOpenItem.originalTransactionAmount == null ? null : Number(targetOpenItem.originalTransactionAmount),
          originalTranslatedAmount: targetOpenItem.originalGroupAmount == null ? null : Number(targetOpenItem.originalGroupAmount),
          settledTransactionAmount: transactionAmount,
          settledTranslatedAmount: groupAmount,
        }),
      })
    }

    const appliedTransactionAmount = roundMoney(settlementPlans.reduce((sum, plan) => sum + plan.transactionAmount, 0))
    const realizedFxLocalAmount = settlementPlans.reduce((sum, plan) => sum + (plan.realizedFxLocalAmount ?? 0), 0)
    const realizedFxFunctionalAmount = settlementPlans.reduce((sum, plan) => sum + (plan.realizedFxFunctionalAmount ?? 0), 0)
    const realizedFxGroupAmount = settlementPlans.reduce((sum, plan) => sum + (plan.realizedFxGroupAmount ?? 0), 0)

    const fxAccounts = await loadConfiguredRealizedFxPostingAccounts()
    const fxLines =
      settlementPlans.length > 0 &&
      (isMaterialAmount(realizedFxLocalAmount) || isMaterialAmount(realizedFxFunctionalAmount) || isMaterialAmount(realizedFxGroupAmount))
        ? buildRealizedFxJournalLines({
            description: `${creditMemo.number} realized FX`,
            memo: creditMemo.notes ?? null,
            subsidiaryId: creditMemo.subsidiaryId ?? null,
            customerId: creditMemo.customerId,
            realizedFxGainAccountId: fxAccounts.realizedFxGainAccountId,
            realizedFxLossAccountId: fxAccounts.realizedFxLossAccountId,
            orientation: 'asset',
            localAmount: realizedFxLocalAmount,
            functionalAmount: realizedFxFunctionalAmount,
            groupAmount: realizedFxGroupAmount,
            startingDisplayOrder: revenueLines.length + 1,
          })
        : []

    const journalNumber = await generateNextJournalNumber()

    await tx.journalEntry.create({
      data: {
        number: journalNumber,
        date: creditMemo.date,
        description: `Credit memo ${creditMemo.number}`,
        journalType: 'standard',
        status: 'approved',
        total: roundMoney(creditMemo.total),
        sourceType: 'credit-memo',
        sourceId: creditMemo.id,
        subsidiaryId: creditMemo.subsidiaryId,
        currencyId: creditMemo.currencyId,
        userId: creditMemo.userId,
        lineItems: {
          create: [
            ...revenueLines,
            {
              displayOrder: revenueLines.length,
              description: `${creditMemo.number} accounts receivable credit`,
              memo: creditMemo.notes ?? null,
              activityTypeCode: 'ar_settlement',
              debit: 0,
              credit: roundMoney(creditMemo.total),
              localCredit:
                translationContext.originalLocalAmount == null ? undefined : Number(translationContext.originalLocalAmount),
              functionalCredit:
                translationContext.originalFunctionalAmount == null ? undefined : Number(translationContext.originalFunctionalAmount),
              groupCredit:
                translationContext.originalGroupAmount == null ? undefined : Number(translationContext.originalGroupAmount),
              accountId: arAccountId,
              subsidiaryId: creditMemo.subsidiaryId,
              customerId: creditMemo.customerId,
            },
            ...fxLines,
          ],
        },
      },
    })

    const creditMemoOpenItem = await ensureOpenItemForSource({
      tx,
      openItemType: 'credit_memo',
      accountType: 'Asset',
      accountId: arAccountId,
      subsidiaryId: creditMemo.subsidiaryId ?? null,
      transactionCurrencyId: translationContext.transactionCurrencyId,
      localCurrencyId: translationContext.localCurrencyId,
      functionalCurrencyId: translationContext.functionalCurrencyId,
      groupCurrencyId: translationContext.groupCurrencyId,
      sourceTransactionType: 'credit-memo',
      sourceTransactionId: creditMemo.id,
      sourceNumber: creditMemo.number,
      counterpartyType: 'customer',
      counterpartyId: creditMemo.customerId,
      documentDate: creditMemo.date,
      postingDate: creditMemo.date,
      dueDate: creditMemo.date,
      originalTransactionAmount: creditMemo.total,
      originalLocalAmount: translationContext.originalLocalAmount,
      originalFunctionalAmount: translationContext.originalFunctionalAmount,
      originalGroupAmount: translationContext.originalGroupAmount,
      memo: creditMemo.notes ?? null,
      createdById: creditMemo.userId ?? null,
    })

    for (const plan of settlementPlans) {
      const existingApplication = await findExistingOpenItemApplication(
        {
          fromOpenItemId: creditMemoOpenItem.id,
          toOpenItemId: plan.targetOpenItem.id,
          settlementTransactionType: 'credit-memo',
          settlementTransactionId: creditMemo.id,
        },
        tx,
      )

      if (!existingApplication) {
        await applyOpenItems({
          tx,
          fromOpenItemId: creditMemoOpenItem.id,
          toOpenItemId: plan.targetOpenItem.id,
          applicationType: 'credit_memo_application',
          settlementTransactionType: 'credit-memo',
          settlementTransactionId: creditMemo.id,
          applicationDate: creditMemo.date,
          postingDate: creditMemo.date,
          transactionAmount: plan.transactionAmount,
          localAmount: plan.localAmount,
          functionalAmount: plan.functionalAmount,
          groupAmount: plan.groupAmount,
          memo: creditMemo.number,
          createdById: creditMemo.userId ?? null,
          createClearingDocument: true,
          clearingType: 'credit_memo_application',
          automationSource: 'credit-document-posting',
        })
      }
    }

    const refreshedCreditMemoOpenItem = await findOpenItemBySource('credit-memo', creditMemo.id, tx)
    const nextStatus = appliedTransactionAmount <= 0
      ? 'approved'
      : refreshedCreditMemoOpenItem?.isOpen
        ? 'partially applied'
        : 'fully applied'

    if (nextStatus !== creditMemo.status) {
      await syncCreditMemoStatus(creditMemo.id, nextStatus, tx)
    }

    await syncAutoDocumentRelationshipsForSource(
      {
        sourceRecordType: 'credit-memo',
        sourceRecordId: creditMemo.id,
        relationshipType: 'settles',
        automationSource: 'credit-document-posting',
        targets: settlementPlans.map((plan) => ({ recordType: 'invoice', recordId: plan.invoiceId })),
      },
      tx,
    )

    await logActivity({
      entityType: 'credit-memo',
      entityId: creditMemo.id,
      action: 'post',
      summary:
        appliedTransactionAmount > 0
          ? `Posted and applied credit memo ${creditMemo.number}`
          : `Posted credit memo ${creditMemo.number}`,
      userId: creditMemo.userId ?? null,
    })

    return tx.creditMemo.findUnique({
      where: { id: creditMemo.id },
      include: {
        customer: true,
        invoice: {
          include: {
            customer: true,
            currency: true,
          },
        },
        user: true,
        subsidiary: true,
        currency: true,
        lineItems: {
          include: {
            item: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    })
  })
}

export async function syncBillCreditPosting(
  billCreditId: string,
  desiredApplications?: BillCreditApplicationInput[],
) {
  return prisma.$transaction(async (tx) => {
    const billCredit = await loadBillCreditForPosting(billCreditId, tx)
    if (!billCredit) {
      throw new Error('Bill credit not found')
    }

    const existingApplications = await tx.openItemApplication.findMany({
      where: {
        settlementTransactionType: 'bill-credit',
        settlementTransactionId: billCredit.id,
      },
      select: {
        transactionAmount: true,
        toOpenItem: {
          select: {
            sourceTransactionId: true,
          },
        },
      },
    })

    await resetPostedArtifacts('bill-credit', billCredit.id, tx)

    const normalizedStatus = (billCredit.status ?? '').trim().toLowerCase()
    if (!POSTING_STATUSES.has(normalizedStatus)) {
      return billCredit
    }

    const translationContext = await deriveOpenItemCurrencyContext({
      tx,
      subsidiaryId: billCredit.subsidiaryId ?? billCredit.bill?.subsidiaryId ?? null,
      transactionCurrencyId: billCredit.currencyId ?? billCredit.bill?.currencyId ?? null,
      transactionAmount: billCredit.total,
      effectiveDate: billCredit.date,
      rateType: 'spot',
    })

    const expenseLines = await resolveBillCreditExpenseLines(billCredit, translationContext)
    const totalCredit = sumMoney(expenseLines.map((line) => Number(line.credit ?? 0)))
    if (totalCredit <= 0) {
      throw new Error('Bill credit requires at least one postable line before it can post')
    }

    let billOpenItem = billCredit.billId
      ? await findOpenItemBySource('bill', billCredit.billId, tx)
      : null

    if (!billOpenItem && billCredit.bill) {
      const apAccountId = await findApTradeAccountId()
      const billCurrencyContext = await deriveOpenItemCurrencyContext({
        tx,
        subsidiaryId: billCredit.bill.subsidiaryId ?? null,
        transactionCurrencyId: billCredit.bill.currencyId ?? null,
        transactionAmount: billCredit.bill.total,
        effectiveDate: billCredit.bill.date,
        rateType: 'spot',
      })
      billOpenItem = await ensureOpenItemForSource({
        tx,
        openItemType: 'accounts_payable',
        accountType: 'Liability',
        accountId: apAccountId,
        subsidiaryId: billCredit.bill.subsidiaryId ?? null,
        transactionCurrencyId: billCurrencyContext.transactionCurrencyId,
        localCurrencyId: billCurrencyContext.localCurrencyId,
        functionalCurrencyId: billCurrencyContext.functionalCurrencyId,
        groupCurrencyId: billCurrencyContext.groupCurrencyId,
        sourceTransactionType: 'bill',
        sourceTransactionId: billCredit.bill.id,
        sourceNumber: billCredit.bill.number,
        counterpartyType: 'vendor',
        counterpartyId: billCredit.bill.vendorId,
        documentDate: billCredit.bill.date,
        postingDate: billCredit.bill.date,
        dueDate: null,
        originalTransactionAmount: billCredit.bill.total,
        originalLocalAmount: billCurrencyContext.originalLocalAmount,
        originalFunctionalAmount: billCurrencyContext.originalFunctionalAmount,
        originalGroupAmount: billCurrencyContext.originalGroupAmount,
        createdById: billCredit.bill.userId ?? null,
      })
    }

    const apAccountId = billOpenItem?.accountId ?? (await findApTradeAccountId())
    if (!apAccountId) {
      throw new Error('Accounts payable posting account is not configured')
    }

    const applicationPlan =
      desiredApplications && desiredApplications.length > 0
        ? desiredApplications
        : existingApplications
            .map((application) => ({
              billId: application.toOpenItem?.sourceTransactionId ?? '',
              appliedAmount: Number(application.transactionAmount),
            }))
            .filter((application) => application.billId && application.appliedAmount > 0)

    const plannedApplications =
      AUTO_APPLICATION_STATUSES.has(normalizedStatus)
        ? (applicationPlan.length > 0
            ? applicationPlan
            : billCredit.billId && billOpenItem
              ? [{
                  billId: billCredit.billId,
                  appliedAmount: roundMoney(
                    Math.min(roundMoney(billCredit.total), roundMoney((await getOpenItemRemainingAmount(billOpenItem.id, tx)).transactionAmount)),
                  ),
                }]
              : [])
        : []

    const settlementPlans: Array<{
      billId: string
      targetOpenItem: NonNullable<typeof billOpenItem>
      transactionAmount: number
      localAmount: number | null
      functionalAmount: number | null
      groupAmount: number | null
      realizedFxLocalAmount: number | null
      realizedFxFunctionalAmount: number | null
      realizedFxGroupAmount: number | null
    }> = []

    for (const application of plannedApplications) {
      const targetOpenItem = await findOpenItemBySource('bill', application.billId, tx)
      if (!targetOpenItem) continue
      const targetRemaining = await getOpenItemRemainingAmount(targetOpenItem.id, tx)
      const transactionAmount = roundMoney(
        Math.min(roundMoney(application.appliedAmount), roundMoney(targetRemaining.transactionAmount)),
      )
      if (!isMaterialAmount(transactionAmount)) continue
      const localAmount = computeProportionalTranslatedSettlementAmount(
        roundMoney(billCredit.total),
        translationContext.originalLocalAmount == null ? null : Number(translationContext.originalLocalAmount),
        transactionAmount,
      )
      const functionalAmount = computeProportionalTranslatedSettlementAmount(
        roundMoney(billCredit.total),
        translationContext.originalFunctionalAmount == null ? null : Number(translationContext.originalFunctionalAmount),
        transactionAmount,
      )
      const groupAmount = computeProportionalTranslatedSettlementAmount(
        roundMoney(billCredit.total),
        translationContext.originalGroupAmount == null ? null : Number(translationContext.originalGroupAmount),
        transactionAmount,
      )
      settlementPlans.push({
        billId: application.billId,
        targetOpenItem,
        transactionAmount,
        localAmount,
        functionalAmount,
        groupAmount,
        realizedFxLocalAmount: computeRealizedFxLayerAmount({
          originalTransactionAmount: targetOpenItem.originalTransactionAmount == null ? null : Number(targetOpenItem.originalTransactionAmount),
          originalTranslatedAmount: targetOpenItem.originalLocalAmount == null ? null : Number(targetOpenItem.originalLocalAmount),
          settledTransactionAmount: transactionAmount,
          settledTranslatedAmount: localAmount,
        }),
        realizedFxFunctionalAmount: computeRealizedFxLayerAmount({
          originalTransactionAmount: targetOpenItem.originalTransactionAmount == null ? null : Number(targetOpenItem.originalTransactionAmount),
          originalTranslatedAmount: targetOpenItem.originalFunctionalAmount == null ? null : Number(targetOpenItem.originalFunctionalAmount),
          settledTransactionAmount: transactionAmount,
          settledTranslatedAmount: functionalAmount,
        }),
        realizedFxGroupAmount: computeRealizedFxLayerAmount({
          originalTransactionAmount: targetOpenItem.originalTransactionAmount == null ? null : Number(targetOpenItem.originalTransactionAmount),
          originalTranslatedAmount: targetOpenItem.originalGroupAmount == null ? null : Number(targetOpenItem.originalGroupAmount),
          settledTransactionAmount: transactionAmount,
          settledTranslatedAmount: groupAmount,
        }),
      })
    }

    const appliedTransactionAmount = roundMoney(settlementPlans.reduce((sum, plan) => sum + plan.transactionAmount, 0))
    const realizedFxLocalAmount = settlementPlans.reduce((sum, plan) => sum + (plan.realizedFxLocalAmount ?? 0), 0)
    const realizedFxFunctionalAmount = settlementPlans.reduce((sum, plan) => sum + (plan.realizedFxFunctionalAmount ?? 0), 0)
    const realizedFxGroupAmount = settlementPlans.reduce((sum, plan) => sum + (plan.realizedFxGroupAmount ?? 0), 0)

    const fxAccounts = await loadConfiguredRealizedFxPostingAccounts()
    const fxLines =
      settlementPlans.length > 0 &&
      (isMaterialAmount(realizedFxLocalAmount) || isMaterialAmount(realizedFxFunctionalAmount) || isMaterialAmount(realizedFxGroupAmount))
        ? buildRealizedFxJournalLines({
            description: `${billCredit.number} realized FX`,
            memo: billCredit.notes ?? null,
            subsidiaryId: billCredit.subsidiaryId ?? null,
            vendorId: billCredit.vendorId,
            realizedFxGainAccountId: fxAccounts.realizedFxGainAccountId,
            realizedFxLossAccountId: fxAccounts.realizedFxLossAccountId,
            orientation: 'liability',
            localAmount: realizedFxLocalAmount,
            functionalAmount: realizedFxFunctionalAmount,
            groupAmount: realizedFxGroupAmount,
            startingDisplayOrder: expenseLines.length + 1,
          })
        : []

    const journalNumber = await generateNextJournalNumber()

    await tx.journalEntry.create({
      data: {
        number: journalNumber,
        date: billCredit.date,
        description: `Bill credit ${billCredit.number}`,
        journalType: 'standard',
        status: 'approved',
        total: roundMoney(billCredit.total),
        sourceType: 'bill-credit',
        sourceId: billCredit.id,
        subsidiaryId: billCredit.subsidiaryId,
        currencyId: billCredit.currencyId,
        userId: billCredit.userId,
        lineItems: {
          create: [
            {
              displayOrder: 0,
              description: `${billCredit.number} accounts payable credit`,
              memo: billCredit.notes ?? null,
              activityTypeCode: 'ap_settlement',
              debit: roundMoney(billCredit.total),
              credit: 0,
              localDebit:
                translationContext.originalLocalAmount == null ? undefined : Number(translationContext.originalLocalAmount),
              functionalDebit:
                translationContext.originalFunctionalAmount == null ? undefined : Number(translationContext.originalFunctionalAmount),
              groupDebit:
                translationContext.originalGroupAmount == null ? undefined : Number(translationContext.originalGroupAmount),
              accountId: apAccountId,
              subsidiaryId: billCredit.subsidiaryId,
              vendorId: billCredit.vendorId,
            },
            ...expenseLines,
            ...fxLines,
          ],
        },
      },
    })

    const billCreditOpenItem = await ensureOpenItemForSource({
      tx,
      openItemType: 'bill_credit',
      accountType: 'Liability',
      accountId: apAccountId,
      subsidiaryId: billCredit.subsidiaryId ?? null,
      transactionCurrencyId: translationContext.transactionCurrencyId,
      localCurrencyId: translationContext.localCurrencyId,
      functionalCurrencyId: translationContext.functionalCurrencyId,
      groupCurrencyId: translationContext.groupCurrencyId,
      sourceTransactionType: 'bill-credit',
      sourceTransactionId: billCredit.id,
      sourceNumber: billCredit.number,
      counterpartyType: 'vendor',
      counterpartyId: billCredit.vendorId,
      documentDate: billCredit.date,
      postingDate: billCredit.date,
      dueDate: billCredit.date,
      originalTransactionAmount: billCredit.total,
      originalLocalAmount: translationContext.originalLocalAmount,
      originalFunctionalAmount: translationContext.originalFunctionalAmount,
      originalGroupAmount: translationContext.originalGroupAmount,
      memo: billCredit.notes ?? null,
      createdById: billCredit.userId ?? null,
    })

    for (const plan of settlementPlans) {
      const existingApplication = await findExistingOpenItemApplication(
        {
          fromOpenItemId: billCreditOpenItem.id,
          toOpenItemId: plan.targetOpenItem.id,
          settlementTransactionType: 'bill-credit',
          settlementTransactionId: billCredit.id,
        },
        tx,
      )

      if (!existingApplication) {
        await applyOpenItems({
          tx,
          fromOpenItemId: billCreditOpenItem.id,
          toOpenItemId: plan.targetOpenItem.id,
          applicationType: 'bill_credit_application',
          settlementTransactionType: 'bill-credit',
          settlementTransactionId: billCredit.id,
          applicationDate: billCredit.date,
          postingDate: billCredit.date,
          transactionAmount: plan.transactionAmount,
          localAmount: plan.localAmount,
          functionalAmount: plan.functionalAmount,
          groupAmount: plan.groupAmount,
          memo: billCredit.number,
          createdById: billCredit.userId ?? null,
          createClearingDocument: true,
          clearingType: 'bill_credit_application',
          automationSource: 'credit-document-posting',
        })
      }
    }

    const refreshedBillCreditOpenItem = await findOpenItemBySource('bill-credit', billCredit.id, tx)
    const nextStatus = appliedTransactionAmount <= 0
      ? 'approved'
      : refreshedBillCreditOpenItem?.isOpen
        ? 'partially applied'
        : 'fully applied'

    if (nextStatus !== billCredit.status) {
      await syncBillCreditStatus(billCredit.id, nextStatus, tx)
    }

    await syncAutoDocumentRelationshipsForSource(
      {
        sourceRecordType: 'bill-credit',
        sourceRecordId: billCredit.id,
        relationshipType: 'settles',
        automationSource: 'credit-document-posting',
        targets: settlementPlans.map((plan) => ({ recordType: 'bill', recordId: plan.billId })),
      },
      tx,
    )

    await logActivity({
      entityType: 'bill-credit',
      entityId: billCredit.id,
      action: 'post',
      summary:
        appliedTransactionAmount > 0
          ? `Posted and applied bill credit ${billCredit.number}`
          : `Posted bill credit ${billCredit.number}`,
      userId: billCredit.userId ?? null,
    })

    return tx.billCredit.findUnique({
      where: { id: billCredit.id },
      include: {
        vendor: true,
        bill: {
          include: {
            vendor: true,
            currency: true,
          },
        },
        user: true,
        subsidiary: true,
        currency: true,
        lineItems: {
          include: {
            item: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    })
  })
}
