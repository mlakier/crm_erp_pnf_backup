import { Prisma, type PrismaClient } from '@prisma/client'

import { logActivity } from '@/lib/activity'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'
import { prisma } from '@/lib/prisma'

type OpenItemTransactionClient = Prisma.TransactionClient | PrismaClient

const OPEN_ITEM_NUMBER_PREFIX = 'OI-'
const OPEN_ITEM_APPLICATION_NUMBER_PREFIX = 'OIA-'
const MONEY_TOLERANCE = 0.005

function roundMoney(value: Prisma.Decimal.Value | number | null | undefined) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function toDecimal(value: Prisma.Decimal.Value | number | null | undefined) {
  return new Prisma.Decimal(roundMoney(value ?? 0))
}

function computeProportionalTranslatedAmount(
  originalTransactionAmount: Prisma.Decimal.Value | number | null | undefined,
  originalTranslatedAmount: Prisma.Decimal.Value | number | null | undefined,
  appliedTransactionAmount: number,
) {
  const originalTxn = roundMoney(originalTransactionAmount)
  const originalTranslated = originalTranslatedAmount == null ? null : roundMoney(originalTranslatedAmount)
  if (!Number.isFinite(originalTxn) || Math.abs(originalTxn) <= MONEY_TOLERANCE) return null
  if (originalTranslated == null || !Number.isFinite(originalTranslated)) return null
  return roundMoney((originalTranslated / originalTxn) * appliedTransactionAmount)
}

function computeRealizedFxAmounts(input: {
  fromItem: {
    transactionCurrencyId: string | null
  }
  toItem: {
    transactionCurrencyId: string | null
    originalTransactionAmount: Prisma.Decimal.Value | number | null | undefined
    originalLocalAmount: Prisma.Decimal.Value | number | null | undefined
    originalFunctionalAmount: Prisma.Decimal.Value | number | null | undefined
    originalGroupAmount: Prisma.Decimal.Value | number | null | undefined
  } | null
  transactionAmount: number
  settlementLocalAmount?: Prisma.Decimal.Value | number | null
  settlementFunctionalAmount?: Prisma.Decimal.Value | number | null
  settlementGroupAmount?: Prisma.Decimal.Value | number | null
}) {
  const { fromItem, toItem, transactionAmount, settlementLocalAmount, settlementFunctionalAmount, settlementGroupAmount } = input
  if (!toItem) {
    return {
      realizedFxLocalAmount: null,
      realizedFxFunctionalAmount: null,
      realizedFxGroupAmount: null,
    }
  }

  if (
    fromItem.transactionCurrencyId &&
    toItem.transactionCurrencyId &&
    fromItem.transactionCurrencyId !== toItem.transactionCurrencyId
  ) {
    return {
      realizedFxLocalAmount: null,
      realizedFxFunctionalAmount: null,
      realizedFxGroupAmount: null,
    }
  }

  const carriedLocalAmount = computeProportionalTranslatedAmount(
    toItem.originalTransactionAmount,
    toItem.originalLocalAmount,
    transactionAmount,
  )
  const carriedFunctionalAmount = computeProportionalTranslatedAmount(
    toItem.originalTransactionAmount,
    toItem.originalFunctionalAmount,
    transactionAmount,
  )
  const carriedGroupAmount = computeProportionalTranslatedAmount(
    toItem.originalTransactionAmount,
    toItem.originalGroupAmount,
    transactionAmount,
  )

  const settledLocalAmount = settlementLocalAmount == null ? null : roundMoney(settlementLocalAmount)
  const settledFunctionalAmount = settlementFunctionalAmount == null ? null : roundMoney(settlementFunctionalAmount)
  const settledGroupAmount = settlementGroupAmount == null ? null : roundMoney(settlementGroupAmount)

  return {
    realizedFxLocalAmount:
      carriedLocalAmount == null || settledLocalAmount == null
        ? null
        : roundMoney(settledLocalAmount - carriedLocalAmount),
    realizedFxFunctionalAmount:
      carriedFunctionalAmount == null || settledFunctionalAmount == null
        ? null
        : roundMoney(settledFunctionalAmount - carriedFunctionalAmount),
    realizedFxGroupAmount:
      carriedGroupAmount == null || settledGroupAmount == null
        ? null
        : roundMoney(settledGroupAmount - carriedGroupAmount),
  }
}

async function generateSequentialIdentifier(
  values: Array<string | null | undefined>,
  prefix: string,
) {
  let maxSequence = 0

  for (const rawValue of values) {
    if (!rawValue?.startsWith(prefix)) continue
    const match = rawValue.match(/(\d+)$/)
    if (!match) continue
    const sequence = Number.parseInt(match[1], 10)
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence)
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(6, '0')}`
}

async function generateOpenItemNumber(tx: OpenItemTransactionClient) {
  const records = await tx.openItem.findMany({
    where: { openItemNumber: { startsWith: OPEN_ITEM_NUMBER_PREFIX } },
    select: { openItemNumber: true },
    orderBy: { openItemNumber: 'desc' },
    take: 200,
  })
  return generateSequentialIdentifier(
    records.map((record) => record.openItemNumber),
    OPEN_ITEM_NUMBER_PREFIX,
  )
}

async function generateOpenItemApplicationNumber(tx: OpenItemTransactionClient) {
  const records = await tx.openItemApplication.findMany({
    where: { applicationNumber: { startsWith: OPEN_ITEM_APPLICATION_NUMBER_PREFIX } },
    select: { applicationNumber: true },
    orderBy: { applicationNumber: 'desc' },
    take: 200,
  })
  return generateSequentialIdentifier(
    records.map((record) => record.applicationNumber),
    OPEN_ITEM_APPLICATION_NUMBER_PREFIX,
  )
}

export function formatClearingDocumentNumber(
  sequence: number,
  config = DEFAULT_ID_SETTINGS.clearingDocument,
) {
  return formatIdentifier(sequence, config)
}

async function generateClearingDocumentNumber(tx: OpenItemTransactionClient) {
  const config = await loadIdSetting('clearingDocument')
  const records = await tx.clearingDocumentHeader.findMany({
    where: { clearingNumber: { startsWith: config.prefix } },
    select: { clearingNumber: true },
    orderBy: { clearingNumber: 'desc' },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(records.map((record) => record.clearingNumber), config)
  return formatClearingDocumentNumber(nextSequence, config)
}

async function getNextOpenItemEntryNumber(tx: OpenItemTransactionClient, openItemId: string) {
  const latestEntry = await tx.openItemEntry.findFirst({
    where: { openItemId },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  })

  return (latestEntry?.entryNumber ?? 0) + 1
}

export async function getOpenItemRemainingAmount(
  openItemId: string,
  tx: OpenItemTransactionClient = prisma,
) {
  const aggregate = await tx.openItemEntry.aggregate({
    where: { openItemId },
    _sum: { transactionAmount: true, localAmount: true, functionalAmount: true, groupAmount: true },
  })

  return {
    transactionAmount: roundMoney(aggregate._sum.transactionAmount),
    localAmount:
      aggregate._sum.localAmount == null ? null : roundMoney(aggregate._sum.localAmount),
    functionalAmount:
      aggregate._sum.functionalAmount == null ? null : roundMoney(aggregate._sum.functionalAmount),
    groupAmount:
      aggregate._sum.groupAmount == null ? null : roundMoney(aggregate._sum.groupAmount),
  }
}

export async function findOpenItemBySource(
  sourceTransactionType: string,
  sourceTransactionId: string,
  tx: OpenItemTransactionClient = prisma,
) {
  return tx.openItem.findFirst({
    where: {
      sourceTransactionType,
      sourceTransactionId,
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function syncOpenItemStatus(
  openItemId: string,
  options?: {
    closedById?: string | null
    tx?: OpenItemTransactionClient
  },
) {
  const tx = options?.tx ?? prisma
  const item = await tx.openItem.findUnique({
    where: { id: openItemId },
    select: {
      id: true,
      status: true,
      isOpen: true,
    },
  })
  if (!item) throw new Error('Open item not found')

  const remaining = await getOpenItemRemainingAmount(openItemId, tx)
  const shouldBeOpen = Math.abs(remaining.transactionAmount) > MONEY_TOLERANCE
  const nextStatus = shouldBeOpen ? 'open' : 'closed'

  if (item.isOpen === shouldBeOpen && item.status === nextStatus) {
    return {
      ...item,
      status: nextStatus,
      isOpen: shouldBeOpen,
      remaining,
    }
  }

  return tx.openItem.update({
    where: { id: openItemId },
    data: {
      status: nextStatus,
      isOpen: shouldBeOpen,
      closedAt: shouldBeOpen ? null : new Date(),
      closedById: shouldBeOpen ? null : (options?.closedById ?? null),
    },
    select: {
      id: true,
      status: true,
      isOpen: true,
      closedAt: true,
      closedById: true,
    },
  }).then((updated) => ({
    ...updated,
    remaining,
  }))
}

export async function createOpenItem(
  input: {
    openItemType: string
    accountType: string
    accountId?: string | null
    subsidiaryId?: string | null
    transactionCurrencyId?: string | null
    localCurrencyId?: string | null
    functionalCurrencyId?: string | null
    groupCurrencyId?: string | null
    sourceTransactionType?: string | null
    sourceTransactionId?: string | null
    sourceTransactionLineId?: string | null
    sourceNumber?: string | null
    counterpartyType?: string | null
    counterpartyId?: string | null
    documentDate?: Date | string | null
    postingDate?: Date | string | null
    dueDate?: Date | string | null
    originalTransactionAmount: Prisma.Decimal.Value | number
    originalLocalAmount?: Prisma.Decimal.Value | number | null
    originalFunctionalAmount?: Prisma.Decimal.Value | number | null
    originalGroupAmount?: Prisma.Decimal.Value | number | null
    memo?: string | null
    createdById?: string | null
    openingEntryType?: string
    accountingPeriodId?: string | null
    status?: string
    openItemEligible?: boolean
    tx?: OpenItemTransactionClient
  },
) {
  const tx = input.tx ?? prisma
  const openItemNumber = await generateOpenItemNumber(tx)
  const openingEntryType = input.openingEntryType ?? 'opening_balance'
  const status = input.status ?? 'open'

  const item = await tx.openItem.create({
    data: {
      openItemNumber,
      openItemType: input.openItemType,
      status,
      accountType: input.accountType,
      accountId: input.accountId ?? null,
      subsidiaryId: input.subsidiaryId ?? null,
      transactionCurrencyId: input.transactionCurrencyId ?? null,
      localCurrencyId: input.localCurrencyId ?? null,
      functionalCurrencyId: input.functionalCurrencyId ?? null,
      groupCurrencyId: input.groupCurrencyId ?? null,
      sourceTransactionType: input.sourceTransactionType ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      sourceTransactionLineId: input.sourceTransactionLineId ?? null,
      sourceNumber: input.sourceNumber ?? null,
      counterpartyType: input.counterpartyType ?? null,
      counterpartyId: input.counterpartyId ?? null,
      documentDate: input.documentDate ? new Date(input.documentDate) : null,
      postingDate: input.postingDate ? new Date(input.postingDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      originalTransactionAmount: toDecimal(input.originalTransactionAmount),
      originalLocalAmount:
        input.originalLocalAmount == null ? null : toDecimal(input.originalLocalAmount),
      originalFunctionalAmount:
        input.originalFunctionalAmount == null ? null : toDecimal(input.originalFunctionalAmount),
      originalGroupAmount:
        input.originalGroupAmount == null ? null : toDecimal(input.originalGroupAmount),
      memo: input.memo ?? null,
      openItemEligible: input.openItemEligible ?? true,
      isOpen: true,
    },
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: item.id,
      entryNumber: 1,
      entryType: openingEntryType,
      effectiveDate: input.documentDate ? new Date(input.documentDate) : new Date(),
      postingDate: input.postingDate ? new Date(input.postingDate) : null,
      accountingPeriodId: input.accountingPeriodId ?? null,
      transactionAmount: toDecimal(input.originalTransactionAmount),
      localAmount:
        input.originalLocalAmount == null ? null : toDecimal(input.originalLocalAmount),
      functionalAmount:
        input.originalFunctionalAmount == null ? null : toDecimal(input.originalFunctionalAmount),
      groupAmount:
        input.originalGroupAmount == null ? null : toDecimal(input.originalGroupAmount),
      sourceTransactionType: input.sourceTransactionType ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      sourceTransactionLineId: input.sourceTransactionLineId ?? null,
      memo: input.memo ?? null,
      createdById: input.createdById ?? null,
    },
  })

  return item
}

export async function ensureOpenItemForSource(
  input: Parameters<typeof createOpenItem>[0],
) {
  if (!input.sourceTransactionType || !input.sourceTransactionId) {
    throw new Error('Source transaction type and id are required to ensure an open item')
  }

  const tx = input.tx ?? prisma
  const existing = await findOpenItemBySource(input.sourceTransactionType, input.sourceTransactionId, tx)
  if (existing) return existing
  return createOpenItem(input)
}

export async function appendOpenItemEntry(
  input: {
    openItemId: string
    entryType: string
    effectiveDate: Date | string
    postingDate?: Date | string | null
    accountingPeriodId?: string | null
    transactionAmount: Prisma.Decimal.Value | number
    localAmount?: Prisma.Decimal.Value | number | null
    functionalAmount?: Prisma.Decimal.Value | number | null
    groupAmount?: Prisma.Decimal.Value | number | null
    sourceTransactionType?: string | null
    sourceTransactionId?: string | null
    sourceTransactionLineId?: string | null
    sourceApplicationId?: string | null
    sourceGlLineId?: string | null
    sourceRunId?: string | null
    memo?: string | null
    createdById?: string | null
    tx?: OpenItemTransactionClient
  },
) {
  const tx = input.tx ?? prisma
  const entryNumber = await getNextOpenItemEntryNumber(tx, input.openItemId)

  return tx.openItemEntry.create({
    data: {
      openItemId: input.openItemId,
      entryNumber,
      entryType: input.entryType,
      effectiveDate: new Date(input.effectiveDate),
      postingDate: input.postingDate ? new Date(input.postingDate) : null,
      accountingPeriodId: input.accountingPeriodId ?? null,
      transactionAmount: toDecimal(input.transactionAmount),
      localAmount: input.localAmount == null ? null : toDecimal(input.localAmount),
      functionalAmount:
        input.functionalAmount == null ? null : toDecimal(input.functionalAmount),
      groupAmount: input.groupAmount == null ? null : toDecimal(input.groupAmount),
      sourceTransactionType: input.sourceTransactionType ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      sourceTransactionLineId: input.sourceTransactionLineId ?? null,
      sourceApplicationId: input.sourceApplicationId ?? null,
      sourceGlLineId: input.sourceGlLineId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      memo: input.memo ?? null,
      createdById: input.createdById ?? null,
    },
  })
}

export async function createClearingDocument(
  input: {
    clearingType: string
    status?: string
    subsidiaryId?: string | null
    transactionCurrencyId?: string | null
    localCurrencyId?: string | null
    functionalCurrencyId?: string | null
    groupCurrencyId?: string | null
    clearingDate: Date | string
    postingDate?: Date | string | null
    accountingPeriodId?: string | null
    sourceTransactionType?: string | null
    sourceTransactionId?: string | null
    sourceRunId?: string | null
    counterpartyType?: string | null
    counterpartyId?: string | null
    transactionAmount: Prisma.Decimal.Value | number
    localAmount?: Prisma.Decimal.Value | number | null
    functionalAmount?: Prisma.Decimal.Value | number | null
    groupAmount?: Prisma.Decimal.Value | number | null
    realizedFxLocalAmount?: Prisma.Decimal.Value | number | null
    realizedFxFunctionalAmount?: Prisma.Decimal.Value | number | null
    realizedFxGroupAmount?: Prisma.Decimal.Value | number | null
    memo?: string | null
    autoGenerated?: boolean
    automationSource?: string | null
    exceptionStatus?: string | null
    reversesClearingDocumentId?: string | null
    reversedByClearingDocumentId?: string | null
    createdById?: string | null
    lines: Array<{
      lineRole: string
      fromOpenItemId?: string | null
      toOpenItemId?: string | null
      sourceTransactionType?: string | null
      sourceTransactionId?: string | null
      sourceTransactionLineId?: string | null
      settlementTransactionType?: string | null
      settlementTransactionId?: string | null
      settlementTransactionLineId?: string | null
      originalExchangeRateContextId?: string | null
      settlementExchangeRateContextId?: string | null
      transactionAmount: Prisma.Decimal.Value | number
      localAmount?: Prisma.Decimal.Value | number | null
      functionalAmount?: Prisma.Decimal.Value | number | null
      groupAmount?: Prisma.Decimal.Value | number | null
      realizedFxLocalAmount?: Prisma.Decimal.Value | number | null
      realizedFxFunctionalAmount?: Prisma.Decimal.Value | number | null
      realizedFxGroupAmount?: Prisma.Decimal.Value | number | null
      openItemApplicationId?: string | null
      sourceGlLineId?: string | null
      settlementGlLineId?: string | null
      memo?: string | null
    }>
    tx?: OpenItemTransactionClient
  },
) {
  const tx = input.tx ?? prisma
  const clearingNumber = await generateClearingDocumentNumber(tx)

  return tx.clearingDocumentHeader.create({
    data: {
      clearingNumber,
      clearingType: input.clearingType,
      status: input.status ?? 'posted',
      subsidiaryId: input.subsidiaryId ?? null,
      transactionCurrencyId: input.transactionCurrencyId ?? null,
      localCurrencyId: input.localCurrencyId ?? null,
      functionalCurrencyId: input.functionalCurrencyId ?? null,
      groupCurrencyId: input.groupCurrencyId ?? null,
      clearingDate: new Date(input.clearingDate),
      postingDate: input.postingDate ? new Date(input.postingDate) : null,
      accountingPeriodId: input.accountingPeriodId ?? null,
      sourceTransactionType: input.sourceTransactionType ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      counterpartyType: input.counterpartyType ?? null,
      counterpartyId: input.counterpartyId ?? null,
      transactionAmount: toDecimal(input.transactionAmount),
      localAmount: input.localAmount == null ? null : toDecimal(input.localAmount),
      functionalAmount:
        input.functionalAmount == null ? null : toDecimal(input.functionalAmount),
      groupAmount: input.groupAmount == null ? null : toDecimal(input.groupAmount),
      realizedFxLocalAmount:
        input.realizedFxLocalAmount == null ? null : toDecimal(input.realizedFxLocalAmount),
      realizedFxFunctionalAmount:
        input.realizedFxFunctionalAmount == null ? null : toDecimal(input.realizedFxFunctionalAmount),
      realizedFxGroupAmount:
        input.realizedFxGroupAmount == null ? null : toDecimal(input.realizedFxGroupAmount),
      memo: input.memo ?? null,
      autoGenerated: input.autoGenerated ?? false,
      automationSource: input.automationSource ?? null,
      exceptionStatus: input.exceptionStatus ?? null,
      reversesClearingDocumentId: input.reversesClearingDocumentId ?? null,
      reversedByClearingDocumentId: input.reversedByClearingDocumentId ?? null,
      createdById: input.createdById ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          lineNumber: index + 1,
          lineRole: line.lineRole,
          fromOpenItemId: line.fromOpenItemId ?? null,
          toOpenItemId: line.toOpenItemId ?? null,
          sourceTransactionType: line.sourceTransactionType ?? null,
          sourceTransactionId: line.sourceTransactionId ?? null,
          sourceTransactionLineId: line.sourceTransactionLineId ?? null,
          settlementTransactionType: line.settlementTransactionType ?? null,
          settlementTransactionId: line.settlementTransactionId ?? null,
          settlementTransactionLineId: line.settlementTransactionLineId ?? null,
          originalExchangeRateContextId: line.originalExchangeRateContextId ?? null,
          settlementExchangeRateContextId: line.settlementExchangeRateContextId ?? null,
          transactionAmount: toDecimal(line.transactionAmount),
          localAmount: line.localAmount == null ? null : toDecimal(line.localAmount),
          functionalAmount:
            line.functionalAmount == null ? null : toDecimal(line.functionalAmount),
          groupAmount: line.groupAmount == null ? null : toDecimal(line.groupAmount),
          realizedFxLocalAmount:
            line.realizedFxLocalAmount == null ? null : toDecimal(line.realizedFxLocalAmount),
          realizedFxFunctionalAmount:
            line.realizedFxFunctionalAmount == null ? null : toDecimal(line.realizedFxFunctionalAmount),
          realizedFxGroupAmount:
            line.realizedFxGroupAmount == null ? null : toDecimal(line.realizedFxGroupAmount),
          openItemApplicationId: line.openItemApplicationId ?? null,
          sourceGlLineId: line.sourceGlLineId ?? null,
          settlementGlLineId: line.settlementGlLineId ?? null,
          memo: line.memo ?? null,
        })),
      },
    },
    include: {
      lines: true,
    },
  })
}

export async function applyOpenItems(
  input: {
    fromOpenItemId: string
    toOpenItemId?: string | null
    applicationType: string
    status?: string
    settlementTransactionType?: string | null
    settlementTransactionId?: string | null
    applicationDate: Date | string
    postingDate?: Date | string | null
    accountingPeriodId?: string | null
    transactionAmount: Prisma.Decimal.Value | number
    localAmount?: Prisma.Decimal.Value | number | null
    functionalAmount?: Prisma.Decimal.Value | number | null
    groupAmount?: Prisma.Decimal.Value | number | null
    exchangeRateContextId?: string | null
    memo?: string | null
    createdById?: string | null
    createClearingDocument?: boolean
    clearingType?: string
    automationSource?: string | null
    sourceGlLineId?: string | null
    settlementGlLineId?: string | null
    tx?: OpenItemTransactionClient
  },
) {
  const run = async (tx: OpenItemTransactionClient) => {
    const fromItem = await tx.openItem.findUnique({
      where: { id: input.fromOpenItemId },
    })
    if (!fromItem) throw new Error('Source open item not found')

    const toItem = input.toOpenItemId
      ? await tx.openItem.findUnique({
          where: { id: input.toOpenItemId },
        })
      : null

    if (input.toOpenItemId && !toItem) {
      throw new Error('Target open item not found')
    }

    const transactionAmount = roundMoney(input.transactionAmount)
    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      throw new Error('Application amount must be greater than zero')
    }

    const fromRemaining = await getOpenItemRemainingAmount(fromItem.id, tx)
    if (transactionAmount > fromRemaining.transactionAmount + MONEY_TOLERANCE) {
      throw new Error('Application amount exceeds the remaining balance of the source open item')
    }

    if (toItem) {
      const toRemaining = await getOpenItemRemainingAmount(toItem.id, tx)
      if (transactionAmount > toRemaining.transactionAmount + MONEY_TOLERANCE) {
        throw new Error('Application amount exceeds the remaining balance of the target open item')
      }
    }

    const realizedFx = computeRealizedFxAmounts({
      fromItem,
      toItem,
      transactionAmount,
      settlementLocalAmount: input.localAmount ?? null,
      settlementFunctionalAmount: input.functionalAmount ?? null,
      settlementGroupAmount: input.groupAmount ?? null,
    })

    const application = await tx.openItemApplication.create({
      data: {
        applicationNumber: await generateOpenItemApplicationNumber(tx),
        applicationType: input.applicationType,
        status: input.status ?? 'posted',
        fromOpenItemId: fromItem.id,
        toOpenItemId: toItem?.id ?? null,
        settlementTransactionType: input.settlementTransactionType ?? null,
        settlementTransactionId: input.settlementTransactionId ?? null,
        applicationDate: new Date(input.applicationDate),
        postingDate: input.postingDate ? new Date(input.postingDate) : null,
        transactionAmount: toDecimal(transactionAmount),
        localAmount: input.localAmount == null ? null : toDecimal(input.localAmount),
        functionalAmount:
          input.functionalAmount == null ? null : toDecimal(input.functionalAmount),
        groupAmount: input.groupAmount == null ? null : toDecimal(input.groupAmount),
        realizedFxLocalAmount:
          realizedFx.realizedFxLocalAmount == null ? null : toDecimal(realizedFx.realizedFxLocalAmount),
        realizedFxFunctionalAmount:
          realizedFx.realizedFxFunctionalAmount == null ? null : toDecimal(realizedFx.realizedFxFunctionalAmount),
        realizedFxGroupAmount:
          realizedFx.realizedFxGroupAmount == null ? null : toDecimal(realizedFx.realizedFxGroupAmount),
        exchangeRateContextId: input.exchangeRateContextId ?? null,
        memo: input.memo ?? null,
        createdById: input.createdById ?? null,
      },
    })

    await appendOpenItemEntry({
      tx,
      openItemId: fromItem.id,
      entryType: 'application',
      effectiveDate: input.applicationDate,
      postingDate: input.postingDate ?? null,
      accountingPeriodId: input.accountingPeriodId ?? null,
      transactionAmount: -transactionAmount,
      localAmount: input.localAmount == null ? null : -roundMoney(input.localAmount),
      functionalAmount:
        input.functionalAmount == null ? null : -roundMoney(input.functionalAmount),
      groupAmount: input.groupAmount == null ? null : -roundMoney(input.groupAmount),
      sourceApplicationId: application.id,
      sourceTransactionType: input.settlementTransactionType ?? null,
      sourceTransactionId: input.settlementTransactionId ?? null,
      sourceGlLineId: input.sourceGlLineId ?? null,
      memo: input.memo ?? null,
      createdById: input.createdById ?? null,
    })

    if (toItem) {
      await appendOpenItemEntry({
        tx,
        openItemId: toItem.id,
        entryType: 'application',
        effectiveDate: input.applicationDate,
        postingDate: input.postingDate ?? null,
        accountingPeriodId: input.accountingPeriodId ?? null,
        transactionAmount: -transactionAmount,
        localAmount: input.localAmount == null ? null : -roundMoney(input.localAmount),
        functionalAmount:
          input.functionalAmount == null ? null : -roundMoney(input.functionalAmount),
        groupAmount: input.groupAmount == null ? null : -roundMoney(input.groupAmount),
        sourceApplicationId: application.id,
        sourceTransactionType: input.settlementTransactionType ?? null,
        sourceTransactionId: input.settlementTransactionId ?? null,
        sourceGlLineId: input.settlementGlLineId ?? null,
        memo: input.memo ?? null,
        createdById: input.createdById ?? null,
      })
    }

    const fromStatus = await syncOpenItemStatus(fromItem.id, {
      tx,
      closedById: input.createdById ?? null,
    })
    const toStatus = toItem
      ? await syncOpenItemStatus(toItem.id, {
          tx,
          closedById: input.createdById ?? null,
        })
      : null

    const clearingDocument =
      input.createClearingDocument !== false
        ? await createClearingDocument({
            tx,
            clearingType: input.clearingType ?? input.applicationType,
            status: 'posted',
            subsidiaryId: fromItem.subsidiaryId ?? toItem?.subsidiaryId ?? null,
            transactionCurrencyId:
              fromItem.transactionCurrencyId ?? toItem?.transactionCurrencyId ?? null,
            localCurrencyId: fromItem.localCurrencyId ?? toItem?.localCurrencyId ?? null,
            functionalCurrencyId:
              fromItem.functionalCurrencyId ?? toItem?.functionalCurrencyId ?? null,
            groupCurrencyId: fromItem.groupCurrencyId ?? toItem?.groupCurrencyId ?? null,
            clearingDate: input.applicationDate,
            postingDate: input.postingDate ?? null,
            accountingPeriodId: input.accountingPeriodId ?? null,
            sourceTransactionType: input.settlementTransactionType ?? null,
            sourceTransactionId: input.settlementTransactionId ?? null,
            counterpartyType: fromItem.counterpartyType ?? toItem?.counterpartyType ?? null,
            counterpartyId: fromItem.counterpartyId ?? toItem?.counterpartyId ?? null,
            transactionAmount,
            localAmount: input.localAmount ?? null,
            functionalAmount: input.functionalAmount ?? null,
            groupAmount: input.groupAmount ?? null,
            realizedFxLocalAmount: realizedFx.realizedFxLocalAmount,
            realizedFxFunctionalAmount: realizedFx.realizedFxFunctionalAmount,
            realizedFxGroupAmount: realizedFx.realizedFxGroupAmount,
            memo: input.memo ?? null,
            autoGenerated: true,
            automationSource: input.automationSource ?? 'open-item-service',
            createdById: input.createdById ?? null,
            lines: [
              {
                lineRole: 'source',
                fromOpenItemId: fromItem.id,
                sourceTransactionType: fromItem.sourceTransactionType ?? null,
                sourceTransactionId: fromItem.sourceTransactionId ?? null,
                sourceTransactionLineId: fromItem.sourceTransactionLineId ?? null,
                settlementTransactionType: input.settlementTransactionType ?? null,
                settlementTransactionId: input.settlementTransactionId ?? null,
                transactionAmount,
                localAmount: input.localAmount ?? null,
                functionalAmount: input.functionalAmount ?? null,
                groupAmount: input.groupAmount ?? null,
                realizedFxLocalAmount: realizedFx.realizedFxLocalAmount,
                realizedFxFunctionalAmount: realizedFx.realizedFxFunctionalAmount,
                realizedFxGroupAmount: realizedFx.realizedFxGroupAmount,
                openItemApplicationId: application.id,
                sourceGlLineId: input.sourceGlLineId ?? null,
                settlementGlLineId: input.settlementGlLineId ?? null,
                memo: input.memo ?? null,
              },
              ...(toItem
                ? [
                    {
                      lineRole: 'target',
                      toOpenItemId: toItem.id,
                      sourceTransactionType: toItem.sourceTransactionType ?? null,
                      sourceTransactionId: toItem.sourceTransactionId ?? null,
                      sourceTransactionLineId: toItem.sourceTransactionLineId ?? null,
                      settlementTransactionType: input.settlementTransactionType ?? null,
                      settlementTransactionId: input.settlementTransactionId ?? null,
                      transactionAmount,
                      localAmount: input.localAmount ?? null,
                      functionalAmount: input.functionalAmount ?? null,
                      groupAmount: input.groupAmount ?? null,
                      realizedFxLocalAmount: realizedFx.realizedFxLocalAmount,
                      realizedFxFunctionalAmount: realizedFx.realizedFxFunctionalAmount,
                      realizedFxGroupAmount: realizedFx.realizedFxGroupAmount,
                      openItemApplicationId: application.id,
                      sourceGlLineId: input.sourceGlLineId ?? null,
                      settlementGlLineId: input.settlementGlLineId ?? null,
                      memo: input.memo ?? null,
                    },
                  ]
                : []),
            ],
          })
        : null

    await logActivity({
      entityType: 'open-item-application',
      entityId: application.id,
      action: 'create',
      summary: `Applied ${application.applicationNumber} for ${transactionAmount.toFixed(2)}`,
      userId: input.createdById ?? null,
    })

    return {
      application,
      clearingDocument,
      fromStatus,
      toStatus,
    }
  }

  return input.tx ? run(input.tx) : prisma.$transaction((tx) => run(tx))
}

export async function findExistingOpenItemApplication(
  input: {
    fromOpenItemId: string
    toOpenItemId?: string | null
    settlementTransactionType?: string | null
    settlementTransactionId?: string | null
  },
  tx: OpenItemTransactionClient = prisma,
) {
  return tx.openItemApplication.findFirst({
    where: {
      fromOpenItemId: input.fromOpenItemId,
      toOpenItemId: input.toOpenItemId ?? null,
      settlementTransactionType: input.settlementTransactionType ?? null,
      settlementTransactionId: input.settlementTransactionId ?? null,
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function findOpenItemApplicationsForSettlement(
  settlementTransactionType: string,
  settlementTransactionId: string,
  tx: OpenItemTransactionClient = prisma,
) {
  return tx.openItemApplication.findMany({
    where: {
      settlementTransactionType,
      settlementTransactionId,
    },
    orderBy: [{ createdAt: 'asc' }],
  })
}

export async function reverseOpenItemApplication(
  applicationId: string,
  input?: {
    reversalDate?: Date | string | null
    postingDate?: Date | string | null
    accountingPeriodId?: string | null
    memo?: string | null
    createdById?: string | null
    automationSource?: string | null
    createClearingDocument?: boolean
    tx?: OpenItemTransactionClient
  },
) {
  const run = async (tx: OpenItemTransactionClient) => {
    const original = await tx.openItemApplication.findUnique({
      where: { id: applicationId },
      include: {
        fromOpenItem: true,
        toOpenItem: true,
      },
    })
    if (!original) throw new Error('Open item application not found')

    const existingReversal = await tx.openItemApplication.findFirst({
      where: { reversesApplicationId: original.id },
      orderBy: { createdAt: 'asc' },
    })
    if (existingReversal) {
      return { application: existingReversal, alreadyReversed: true as const }
    }

    const reversalDate = input?.reversalDate ? new Date(input.reversalDate) : new Date()
    const postingDate = input?.postingDate ? new Date(input.postingDate) : null
    const memo = input?.memo ?? `Reversal of ${original.applicationNumber}`

    const reversal = await tx.openItemApplication.create({
      data: {
        applicationNumber: await generateOpenItemApplicationNumber(tx),
        applicationType: `${original.applicationType}_reversal`,
        status: 'posted',
        fromOpenItemId: original.fromOpenItemId,
        toOpenItemId: original.toOpenItemId,
        settlementTransactionType: original.settlementTransactionType,
        settlementTransactionId: original.settlementTransactionId,
        applicationDate: reversalDate,
        postingDate,
        transactionAmount: original.transactionAmount,
        localAmount: original.localAmount,
        functionalAmount: original.functionalAmount,
        groupAmount: original.groupAmount,
        realizedFxLocalAmount:
          original.realizedFxLocalAmount == null ? null : toDecimal(-roundMoney(original.realizedFxLocalAmount)),
        realizedFxFunctionalAmount:
          original.realizedFxFunctionalAmount == null ? null : toDecimal(-roundMoney(original.realizedFxFunctionalAmount)),
        realizedFxGroupAmount:
          original.realizedFxGroupAmount == null ? null : toDecimal(-roundMoney(original.realizedFxGroupAmount)),
        exchangeRateContextId: original.exchangeRateContextId,
        reversesApplicationId: original.id,
        memo,
        createdById: input?.createdById ?? null,
      },
    })

    await appendOpenItemEntry({
      tx,
      openItemId: original.fromOpenItemId,
      entryType: 'reversal',
      effectiveDate: reversalDate,
      postingDate,
      accountingPeriodId: input?.accountingPeriodId ?? null,
      transactionAmount: roundMoney(original.transactionAmount),
      localAmount: original.localAmount == null ? null : roundMoney(original.localAmount),
      functionalAmount:
        original.functionalAmount == null ? null : roundMoney(original.functionalAmount),
      groupAmount: original.groupAmount == null ? null : roundMoney(original.groupAmount),
      sourceApplicationId: reversal.id,
      sourceTransactionType: original.settlementTransactionType ?? null,
      sourceTransactionId: original.settlementTransactionId ?? null,
      memo,
      createdById: input?.createdById ?? null,
    })

    if (original.toOpenItemId) {
      await appendOpenItemEntry({
        tx,
        openItemId: original.toOpenItemId,
        entryType: 'reversal',
        effectiveDate: reversalDate,
        postingDate,
        accountingPeriodId: input?.accountingPeriodId ?? null,
        transactionAmount: roundMoney(original.transactionAmount),
        localAmount: original.localAmount == null ? null : roundMoney(original.localAmount),
        functionalAmount:
          original.functionalAmount == null ? null : roundMoney(original.functionalAmount),
        groupAmount: original.groupAmount == null ? null : roundMoney(original.groupAmount),
        sourceApplicationId: reversal.id,
        sourceTransactionType: original.settlementTransactionType ?? null,
        sourceTransactionId: original.settlementTransactionId ?? null,
        memo,
        createdById: input?.createdById ?? null,
      })
    }

    await syncOpenItemStatus(original.fromOpenItemId, { tx })
    if (original.toOpenItemId) {
      await syncOpenItemStatus(original.toOpenItemId, { tx })
    }

    if (input?.createClearingDocument !== false) {
      await createClearingDocument({
        tx,
        clearingType: `${original.applicationType}_reversal`,
        status: 'reversed',
        subsidiaryId: original.fromOpenItem.subsidiaryId ?? original.toOpenItem?.subsidiaryId ?? null,
        transactionCurrencyId:
          original.fromOpenItem.transactionCurrencyId ?? original.toOpenItem?.transactionCurrencyId ?? null,
        localCurrencyId: original.fromOpenItem.localCurrencyId ?? original.toOpenItem?.localCurrencyId ?? null,
        functionalCurrencyId:
          original.fromOpenItem.functionalCurrencyId ?? original.toOpenItem?.functionalCurrencyId ?? null,
        groupCurrencyId: original.fromOpenItem.groupCurrencyId ?? original.toOpenItem?.groupCurrencyId ?? null,
        clearingDate: reversalDate,
        postingDate,
        accountingPeriodId: input?.accountingPeriodId ?? null,
        sourceTransactionType: original.settlementTransactionType ?? null,
        sourceTransactionId: original.settlementTransactionId ?? null,
        counterpartyType: original.fromOpenItem.counterpartyType ?? original.toOpenItem?.counterpartyType ?? null,
        counterpartyId: original.fromOpenItem.counterpartyId ?? original.toOpenItem?.counterpartyId ?? null,
        transactionAmount: -roundMoney(original.transactionAmount),
        localAmount: original.localAmount == null ? null : -roundMoney(original.localAmount),
        functionalAmount:
          original.functionalAmount == null ? null : -roundMoney(original.functionalAmount),
        groupAmount: original.groupAmount == null ? null : -roundMoney(original.groupAmount),
        realizedFxLocalAmount:
          original.realizedFxLocalAmount == null ? null : -roundMoney(original.realizedFxLocalAmount),
        realizedFxFunctionalAmount:
          original.realizedFxFunctionalAmount == null ? null : -roundMoney(original.realizedFxFunctionalAmount),
        realizedFxGroupAmount:
          original.realizedFxGroupAmount == null ? null : -roundMoney(original.realizedFxGroupAmount),
        memo,
        autoGenerated: true,
        automationSource: input?.automationSource ?? 'open-item-reversal',
        createdById: input?.createdById ?? null,
        lines: [
          {
            lineRole: 'reversal_source',
            fromOpenItemId: original.fromOpenItemId,
            sourceTransactionType: original.fromOpenItem.sourceTransactionType ?? null,
            sourceTransactionId: original.fromOpenItem.sourceTransactionId ?? null,
            sourceTransactionLineId: original.fromOpenItem.sourceTransactionLineId ?? null,
            settlementTransactionType: original.settlementTransactionType ?? null,
            settlementTransactionId: original.settlementTransactionId ?? null,
            transactionAmount: -roundMoney(original.transactionAmount),
            localAmount: original.localAmount == null ? null : -roundMoney(original.localAmount),
            functionalAmount:
              original.functionalAmount == null ? null : -roundMoney(original.functionalAmount),
            groupAmount: original.groupAmount == null ? null : -roundMoney(original.groupAmount),
            realizedFxLocalAmount:
              original.realizedFxLocalAmount == null ? null : -roundMoney(original.realizedFxLocalAmount),
            realizedFxFunctionalAmount:
              original.realizedFxFunctionalAmount == null ? null : -roundMoney(original.realizedFxFunctionalAmount),
            realizedFxGroupAmount:
              original.realizedFxGroupAmount == null ? null : -roundMoney(original.realizedFxGroupAmount),
            openItemApplicationId: reversal.id,
            memo,
          },
          ...(original.toOpenItemId
            ? [
                {
                  lineRole: 'reversal_target',
                  toOpenItemId: original.toOpenItemId,
                  sourceTransactionType: original.toOpenItem?.sourceTransactionType ?? null,
                  sourceTransactionId: original.toOpenItem?.sourceTransactionId ?? null,
                  sourceTransactionLineId: original.toOpenItem?.sourceTransactionLineId ?? null,
                  settlementTransactionType: original.settlementTransactionType ?? null,
                  settlementTransactionId: original.settlementTransactionId ?? null,
                  transactionAmount: -roundMoney(original.transactionAmount),
                  localAmount: original.localAmount == null ? null : -roundMoney(original.localAmount),
                  functionalAmount:
                    original.functionalAmount == null ? null : -roundMoney(original.functionalAmount),
                  groupAmount: original.groupAmount == null ? null : -roundMoney(original.groupAmount),
                  realizedFxLocalAmount:
                    original.realizedFxLocalAmount == null ? null : -roundMoney(original.realizedFxLocalAmount),
                  realizedFxFunctionalAmount:
                    original.realizedFxFunctionalAmount == null ? null : -roundMoney(original.realizedFxFunctionalAmount),
                  realizedFxGroupAmount:
                    original.realizedFxGroupAmount == null ? null : -roundMoney(original.realizedFxGroupAmount),
                  openItemApplicationId: reversal.id,
                  memo,
                },
              ]
            : []),
        ],
      })
    }

    await logActivity({
      entityType: 'open-item-application',
      entityId: reversal.id,
      action: 'reverse',
      summary: `Reversed ${original.applicationNumber} with ${reversal.applicationNumber}`,
      userId: input?.createdById ?? null,
    })

    return { application: reversal, alreadyReversed: false as const }
  }

  return input?.tx ? run(input.tx) : prisma.$transaction((tx) => run(tx))
}
