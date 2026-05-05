import { prisma } from '@/lib/prisma'
import { deriveRollforwardMovementBucket, type RollforwardMovementBucket } from '@/lib/rollforward-movement-buckets'
import { toNumericValue } from '@/lib/format'

export type RollforwardAmountLayer = 'transaction' | 'local' | 'functional' | 'group'

type AmountLike =
  | number
  | string
  | null
  | undefined
  | {
      toString(): string
      toNumber?: () => number
    }

export type RollforwardReportFilters = {
  accountingPeriodId: string
  subsidiaryId?: string | null
  rollforwardCategory?: string | null
  accountId?: string | null
  amountLayer: RollforwardAmountLayer
  bucket?: RollforwardMovementBucket | null
}

type JournalLineWithContext = Awaited<ReturnType<typeof loadCurrentPeriodLines>>[number]

type RollforwardAccountRow = {
  accountId: string
  accountNumber: string
  accountName: string
  rollforwardCategory: string
  beginningBalance: number
  movementByBucket: Record<RollforwardMovementBucket, number>
  endingBalance: number
}

export type RollforwardDrillLine = {
  journalEntryId: string
  journalNumber: string
  journalDate: Date
  accountId: string
  accountNumber: string
  accountName: string
  rollforwardCategory: string
  activityTypeCode: string | null
  movementBucket: RollforwardMovementBucket
  amount: number
  description: string | null
  journalDescription: string | null
  sourceType: string | null
  sourceId: string | null
}

export type RollforwardReportData = {
  period: {
    id: string
    name: string
    startDate: Date
    endDate: Date
  }
  amountLayer: RollforwardAmountLayer
  selectedBucket: RollforwardMovementBucket | null
  missingLayerLineCount: number
  rows: RollforwardAccountRow[]
  totals: {
    beginningBalance: number
    movementByBucket: Record<RollforwardMovementBucket, number>
    endingBalance: number
  }
  drillLines: RollforwardDrillLine[]
}

const MOVEMENT_BUCKETS: RollforwardMovementBucket[] = [
  'additions',
  'releases',
  'settlements',
  'writeoffs',
  'reversals',
  'reclassifications',
  'realized_fx',
  'unrealized_fx',
  'translation',
  'cta',
  'other_activity',
]

function createEmptyBucketTotals() {
  return {
    opening_balance: 0,
    additions: 0,
    releases: 0,
    settlements: 0,
    writeoffs: 0,
    reversals: 0,
    reclassifications: 0,
    realized_fx: 0,
    unrealized_fx: 0,
    translation: 0,
    cta: 0,
    other_activity: 0,
    closing_balance: 0,
  } satisfies Record<RollforwardMovementBucket, number>
}

function normalizeCategory(value: string | null | undefined) {
  return String(value ?? '').trim()
}

function getLayerAmounts(line: {
  debit: AmountLike
  credit: AmountLike
  localDebit: AmountLike
  localCredit: AmountLike
  functionalDebit: AmountLike
  functionalCredit: AmountLike
  groupDebit: AmountLike
  groupCredit: AmountLike
}, amountLayer: RollforwardAmountLayer) {
  switch (amountLayer) {
    case 'local':
      return { debit: line.localDebit, credit: line.localCredit }
    case 'functional':
      return { debit: line.functionalDebit, credit: line.functionalCredit }
    case 'group':
      return { debit: line.groupDebit, credit: line.groupCredit }
    case 'transaction':
    default:
      return { debit: line.debit, credit: line.credit }
  }
}

function getSignedLineAmount(
  line: {
    debit: AmountLike
    credit: AmountLike
    localDebit: AmountLike
    localCredit: AmountLike
    functionalDebit: AmountLike
    functionalCredit: AmountLike
    groupDebit: AmountLike
    groupCredit: AmountLike
    account: { normalBalance: string | null }
  },
  amountLayer: RollforwardAmountLayer,
) {
  const layer = getLayerAmounts(line, amountLayer)
  const debit = toNumericValue(layer.debit, 0)
  const credit = toNumericValue(layer.credit, 0)
  const missingSelectedLayer =
    amountLayer !== 'transaction'
    && layer.debit == null
    && layer.credit == null
    && (toNumericValue(line.debit, 0) !== 0 || toNumericValue(line.credit, 0) !== 0)

  const normalBalance = String(line.account.normalBalance ?? 'debit').trim().toLowerCase()
  const amount = normalBalance === 'credit' ? credit - debit : debit - credit

  return {
    amount,
    missingSelectedLayer,
  }
}

function buildJournalLineWhere(filters: {
  periodEndDate: Date
  subsidiaryId?: string | null
  rollforwardCategory?: string | null
  accountId?: string | null
}) {
  return {
    journalEntry: {
      date: { lte: filters.periodEndDate },
      ...(filters.subsidiaryId ? { subsidiaryId: filters.subsidiaryId } : {}),
    },
    account: {
      active: true,
      ...(filters.accountId ? { id: filters.accountId } : {}),
      ...(filters.rollforwardCategory
        ? { rollforwardCategory: filters.rollforwardCategory }
        : {
            NOT: [
              { rollforwardCategory: null },
              { rollforwardCategory: '' },
              { rollforwardCategory: 'Not Applicable' },
            ],
          }),
    },
  }
}

async function loadCurrentPeriodLines(where: ReturnType<typeof buildJournalLineWhere>, periodStartDate: Date) {
  return prisma.journalEntryLineItem.findMany({
    where: {
      ...where,
      journalEntry: {
        ...where.journalEntry,
        date: {
          gte: periodStartDate,
          lte: (where.journalEntry as { date: { lte: Date } }).date.lte,
        },
      },
    },
    select: {
      id: true,
      description: true,
      debit: true,
      credit: true,
      localDebit: true,
      localCredit: true,
      functionalDebit: true,
      functionalCredit: true,
      groupDebit: true,
      groupCredit: true,
      activityTypeCode: true,
      account: {
        select: {
          id: true,
          accountId: true,
          accountNumber: true,
          name: true,
          normalBalance: true,
          rollforwardCategory: true,
        },
      },
      journalEntry: {
        select: {
          id: true,
          number: true,
          date: true,
          description: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { date: 'asc' } },
      { journalEntry: { number: 'asc' } },
      { displayOrder: 'asc' },
    ],
  })
}

async function loadBeginningBalanceLines(where: ReturnType<typeof buildJournalLineWhere>, periodStartDate: Date) {
  return prisma.journalEntryLineItem.findMany({
    where: {
      ...where,
      journalEntry: {
        ...where.journalEntry,
        date: { lt: periodStartDate },
      },
    },
    select: {
      debit: true,
      credit: true,
      localDebit: true,
      localCredit: true,
      functionalDebit: true,
      functionalCredit: true,
      groupDebit: true,
      groupCredit: true,
      account: {
        select: {
          id: true,
          normalBalance: true,
        },
      },
    },
  })
}

function ensureRow(
  rowsByAccountId: Map<string, RollforwardAccountRow>,
  line: JournalLineWithContext,
) {
  const existing = rowsByAccountId.get(line.account.id)
  if (existing) return existing

  const created: RollforwardAccountRow = {
    accountId: line.account.id,
    accountNumber: line.account.accountNumber,
    accountName: line.account.name,
    rollforwardCategory: normalizeCategory(line.account.rollforwardCategory),
    beginningBalance: 0,
    movementByBucket: createEmptyBucketTotals(),
    endingBalance: 0,
  }
  rowsByAccountId.set(line.account.id, created)
  return created
}

export async function buildRollforwardReport(filters: RollforwardReportFilters): Promise<RollforwardReportData> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { id: filters.accountingPeriodId },
    select: { id: true, name: true, startDate: true, endDate: true },
  })

  if (!period) {
    throw new Error('Accounting period not found.')
  }

  const where = buildJournalLineWhere({
    periodEndDate: period.endDate,
    subsidiaryId: filters.subsidiaryId,
    rollforwardCategory: filters.rollforwardCategory,
    accountId: filters.accountId,
  })

  const [beginningLines, currentLines] = await Promise.all([
    loadBeginningBalanceLines(where, period.startDate),
    loadCurrentPeriodLines(where, period.startDate),
  ])

  const rowsByAccountId = new Map<string, RollforwardAccountRow>()
  const beginningByAccountId = new Map<string, number>()
  let missingLayerLineCount = 0

  for (const line of beginningLines) {
    const { amount, missingSelectedLayer } = getSignedLineAmount(line, filters.amountLayer)
    if (missingSelectedLayer) missingLayerLineCount += 1
    beginningByAccountId.set(
      line.account.id,
      (beginningByAccountId.get(line.account.id) ?? 0) + amount,
    )
  }

  const drillLines: RollforwardDrillLine[] = []

  for (const line of currentLines) {
    const row = ensureRow(rowsByAccountId, line)
    const { amount, missingSelectedLayer } = getSignedLineAmount(line, filters.amountLayer)
    if (missingSelectedLayer) missingLayerLineCount += 1

    const movementBucket = deriveRollforwardMovementBucket({
      activityTypeCode: line.activityTypeCode,
      rollforwardCategory: line.account.rollforwardCategory,
    })

    row.movementByBucket[movementBucket] += amount

    if (!filters.bucket || filters.bucket === movementBucket) {
      drillLines.push({
        journalEntryId: line.journalEntry.id,
        journalNumber: line.journalEntry.number,
        journalDate: line.journalEntry.date,
        accountId: line.account.id,
        accountNumber: line.account.accountNumber,
        accountName: line.account.name,
        rollforwardCategory: normalizeCategory(line.account.rollforwardCategory),
        activityTypeCode: line.activityTypeCode,
        movementBucket,
        amount,
        description: line.description,
        journalDescription: line.journalEntry.description,
        sourceType: line.journalEntry.sourceType,
        sourceId: line.journalEntry.sourceId,
      })
    }
  }

  const beginningOnlyAccountIds = Array.from(beginningByAccountId.keys()).filter((accountId) => !rowsByAccountId.has(accountId))
  const beginningOnlyAccounts = beginningOnlyAccountIds.length > 0
    ? await prisma.chartOfAccounts.findMany({
        where: { id: { in: beginningOnlyAccountIds } },
        select: {
          id: true,
          accountNumber: true,
          name: true,
          rollforwardCategory: true,
        },
      })
    : []

  const beginningOnlyAccountMap = new Map(beginningOnlyAccounts.map((account) => [account.id, account]))

  for (const [accountId, amount] of beginningByAccountId.entries()) {
    const row = rowsByAccountId.get(accountId)
    if (row) {
      row.beginningBalance = amount
      continue
    }

    const account = beginningOnlyAccountMap.get(accountId)
    if (!account) continue

    rowsByAccountId.set(accountId, {
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      rollforwardCategory: normalizeCategory(account.rollforwardCategory),
      beginningBalance: amount,
      movementByBucket: createEmptyBucketTotals(),
      endingBalance: amount,
    })
  }

  const rows = Array.from(rowsByAccountId.values())
    .map((row) => {
      const movementTotal = MOVEMENT_BUCKETS.reduce((sum, bucket) => sum + row.movementByBucket[bucket], 0)
      return {
        ...row,
        endingBalance: row.beginningBalance + movementTotal,
      }
    })
    .sort((a, b) => {
      if (a.rollforwardCategory !== b.rollforwardCategory) {
        return a.rollforwardCategory.localeCompare(b.rollforwardCategory)
      }
      if (a.accountNumber !== b.accountNumber) {
        return a.accountNumber.localeCompare(b.accountNumber)
      }
      return a.accountName.localeCompare(b.accountName)
    })

  const totals = rows.reduce(
    (aggregate, row) => {
      aggregate.beginningBalance += row.beginningBalance
      aggregate.endingBalance += row.endingBalance
      for (const bucket of MOVEMENT_BUCKETS) {
        aggregate.movementByBucket[bucket] += row.movementByBucket[bucket]
      }
      return aggregate
    },
    {
      beginningBalance: 0,
      movementByBucket: createEmptyBucketTotals(),
      endingBalance: 0,
    },
  )

  return {
    period,
    amountLayer: filters.amountLayer,
    selectedBucket: filters.bucket ?? null,
    missingLayerLineCount,
    rows,
    totals,
    drillLines,
  }
}
