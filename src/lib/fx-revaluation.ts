import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { deriveOpenItemCurrencyContext, type TranslationAuditSourceSummary } from '@/lib/open-item-currency-context'
import { getOpenItemRemainingAmount } from '@/lib/open-item-service'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { loadConfiguredUnrealizedFxPostingAccounts } from '@/lib/company-setup-account-resolver'

const MONEY_TOLERANCE = 0.005

type RunFxRevaluationInput = {
  accountingPeriodId: string
  asOfDate: Date | string
  subsidiaryId?: string | null
  requestedById?: string | null
  triggerType?: string | null
}

type LayerKey = 'local' | 'functional' | 'group'

type LayerDelta = {
  layer: LayerKey
  currencyId: string
  carryingAmount: number
  revaluedAmount: number
  delta: number
}

type AggregatedJournalLine = {
  accountId: string
  subsidiaryId: string | null
  description: string
  memo: string | null
  localDebit: number
  localCredit: number
  functionalDebit: number
  functionalCredit: number
  groupDebit: number
  groupCredit: number
}

function roundMoney(value: Prisma.Decimal.Value | number | null | undefined) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100
}

function generateFxRevaluationRunNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `FXRV-${stamp}-${suffix}`
}

function normalizeDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('A valid as-of date is required for FX revaluation.')
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isAssetAccountType(accountType: string) {
  return accountType.toLowerCase().includes('asset')
}

function isLiabilityAccountType(accountType: string) {
  return accountType.toLowerCase().includes('liability')
}

function ensureJournalLine(
  lines: Map<string, AggregatedJournalLine>,
  accountId: string,
  subsidiaryId: string | null,
  description: string,
  memo: string | null,
) {
  const key = `${accountId}:${subsidiaryId ?? ''}`
  const existing = lines.get(key)
  if (existing) return existing

  const created: AggregatedJournalLine = {
    accountId,
    subsidiaryId,
    description,
    memo,
    localDebit: 0,
    localCredit: 0,
    functionalDebit: 0,
    functionalCredit: 0,
    groupDebit: 0,
    groupCredit: 0,
  }
  lines.set(key, created)
  return created
}

function addLayerAmount(
  line: AggregatedJournalLine,
  layer: LayerKey,
  side: 'debit' | 'credit',
  amount: number,
) {
  if (amount <= MONEY_TOLERANCE) return

  if (layer === 'local') {
    if (side === 'debit') line.localDebit = roundMoney(line.localDebit + amount)
    else line.localCredit = roundMoney(line.localCredit + amount)
    return
  }

  if (layer === 'functional') {
    if (side === 'debit') line.functionalDebit = roundMoney(line.functionalDebit + amount)
    else line.functionalCredit = roundMoney(line.functionalCredit + amount)
    return
  }

  if (side === 'debit') line.groupDebit = roundMoney(line.groupDebit + amount)
  else line.groupCredit = roundMoney(line.groupCredit + amount)
}

function computeLayerDeltas(args: {
  transactionCurrencyId: string | null
  localCurrencyId: string | null
  functionalCurrencyId: string | null
  groupCurrencyId: string | null
  carryingLocalAmount: number | null
  carryingFunctionalAmount: number | null
  carryingGroupAmount: number | null
  revaluedLocalAmount: number | null
  revaluedFunctionalAmount: number | null
  revaluedGroupAmount: number | null
}) {
  const deltas: LayerDelta[] = []

  const candidates: Array<{
    layer: LayerKey
    currencyId: string | null
    carryingAmount: number | null
    revaluedAmount: number | null
  }> = [
    {
      layer: 'local',
      currencyId: args.localCurrencyId,
      carryingAmount: args.carryingLocalAmount,
      revaluedAmount: args.revaluedLocalAmount,
    },
    {
      layer: 'functional',
      currencyId: args.functionalCurrencyId,
      carryingAmount: args.carryingFunctionalAmount,
      revaluedAmount: args.revaluedFunctionalAmount,
    },
    {
      layer: 'group',
      currencyId: args.groupCurrencyId,
      carryingAmount: args.carryingGroupAmount,
      revaluedAmount: args.revaluedGroupAmount,
    },
  ]

  for (const candidate of candidates) {
    if (!candidate.currencyId) continue
    if (candidate.currencyId === args.transactionCurrencyId) continue
    if (candidate.carryingAmount == null || candidate.revaluedAmount == null) continue
    const delta = roundMoney(candidate.revaluedAmount - candidate.carryingAmount)
    if (Math.abs(delta) <= MONEY_TOLERANCE) continue
    deltas.push({
      layer: candidate.layer,
      currencyId: candidate.currencyId,
      carryingAmount: candidate.carryingAmount,
      revaluedAmount: candidate.revaluedAmount,
      delta,
    })
  }

  return deltas
}

function buildScopeSummary(period: {
  id: string
  name: string
  subsidiaryId: string | null
}) {
  return {
    accountingPeriodId: period.id,
    accountingPeriodName: period.name,
    subsidiaryId: period.subsidiaryId,
  }
}

export async function runFxRevaluation(input: RunFxRevaluationInput) {
  const asOfDate = normalizeDateOnly(input.asOfDate)
  const triggerType = input.triggerType?.trim() || 'manual'

  return prisma.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findUnique({
      where: { id: input.accountingPeriodId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        closed: true,
        subsidiaryId: true,
      },
    })

    if (!period) {
      throw new Error('Accounting period not found for FX revaluation.')
    }
    if (period.closed) {
      throw new Error('The selected accounting period is closed and cannot accept FX revaluation postings.')
    }
    if (asOfDate < period.startDate || asOfDate > period.endDate) {
      throw new Error('The FX revaluation as-of date must fall inside the selected accounting period.')
    }

    const effectiveSubsidiaryId = input.subsidiaryId ?? period.subsidiaryId ?? null
    if (input.subsidiaryId && period.subsidiaryId && input.subsidiaryId !== period.subsidiaryId) {
      throw new Error('The selected accounting period belongs to a different subsidiary than the chosen FX revaluation scope.')
    }

    const { unrealizedFxGainAccountId, unrealizedFxLossAccountId } =
      await loadConfiguredUnrealizedFxPostingAccounts(tx)

    if (!unrealizedFxGainAccountId || !unrealizedFxLossAccountId) {
      throw new Error('Configure Unrealized FX Gain and Unrealized FX Loss accounts in Company Setup before running FX revaluation.')
    }

    const runHeader = await tx.runHeader.create({
      data: {
        runNumber: generateFxRevaluationRunNumber(),
        runType: 'fx_revaluation',
        triggerType,
        scopeType: effectiveSubsidiaryId ? 'subsidiary_period' : 'global_period',
        scopeJson: JSON.stringify({
          ...buildScopeSummary({
            id: period.id,
            name: period.name,
            subsidiaryId: effectiveSubsidiaryId,
          }),
          asOfDate: asOfDate.toISOString(),
        }),
        status: 'running',
        requestedAt: new Date(),
        startedAt: new Date(),
        asOfDate,
        accountingPeriodId: period.id,
        subsidiaryScope: effectiveSubsidiaryId,
        requestedById: input.requestedById ?? null,
        startedById: input.requestedById ?? null,
        message: 'FX revaluation run started.',
      },
    })

    const candidates = await tx.openItem.findMany({
      where: {
        isOpen: true,
        openItemEligible: true,
        accountId: { not: null },
        ...(effectiveSubsidiaryId ? { subsidiaryId: effectiveSubsidiaryId } : {}),
        account: {
          revalueOpenBalance: true,
          active: true,
          isPosting: true,
        },
      },
      select: {
        id: true,
        openItemNumber: true,
        openItemType: true,
        accountType: true,
        accountId: true,
        subsidiaryId: true,
        transactionCurrencyId: true,
        localCurrencyId: true,
        functionalCurrencyId: true,
        groupCurrencyId: true,
        sourceTransactionType: true,
        sourceTransactionId: true,
        sourceTransactionLineId: true,
        sourceNumber: true,
        memo: true,
        account: {
          select: {
            id: true,
            accountNumber: true,
            name: true,
            accountType: true,
          },
        },
      },
      orderBy: [{ subsidiaryId: 'asc' }, { accountId: 'asc' }, { openItemNumber: 'asc' }],
    })

    const journalLines = new Map<string, AggregatedJournalLine>()
    const translationSources = new Set<string>()
    let revaluedItemCount = 0
    let skippedItemCount = 0
    let failedItemCount = 0
    let localDeltaTotal = 0
    let functionalDeltaTotal = 0
    let groupDeltaTotal = 0

    for (const [index, openItem] of candidates.entries()) {
      const runItem = await tx.runItem.create({
        data: {
          runHeaderId: runHeader.id,
          itemNumber: index + 1,
          itemType: 'open_item_revaluation',
          status: 'running',
          sourceRecordType: 'open_item',
          sourceRecordId: openItem.id,
          sourceLineId: openItem.sourceTransactionLineId ?? null,
          requestPayloadJson: JSON.stringify({
            openItemNumber: openItem.openItemNumber,
            sourceTransactionType: openItem.sourceTransactionType,
            sourceTransactionId: openItem.sourceTransactionId,
            accountId: openItem.accountId,
            asOfDate: asOfDate.toISOString(),
          }),
          startedAt: new Date(),
        },
      })

      try {
        if (!openItem.accountId || !openItem.account) {
          throw new Error('Open item is missing a linked GL account.')
        }

        const accountType = openItem.account.accountType || openItem.accountType
        const assetAccount = isAssetAccountType(accountType)
        const liabilityAccount = isLiabilityAccountType(accountType)
        if (!assetAccount && !liabilityAccount) {
          throw new Error('Only asset and liability open items are eligible for unrealized FX revaluation.')
        }

        const remaining = await getOpenItemRemainingAmount(openItem.id, tx)
        if (Math.abs(remaining.transactionAmount) <= MONEY_TOLERANCE) {
          skippedItemCount += 1
          await tx.runItem.update({
            where: { id: runItem.id },
            data: {
              status: 'completed',
              completedAt: new Date(),
              message: 'Skipped because the open item no longer has a remaining balance.',
              resultPayloadJson: JSON.stringify({ remaining }),
            },
          })
          continue
        }

        const revaluedContext = await deriveOpenItemCurrencyContext({
          tx,
          subsidiaryId: openItem.subsidiaryId ?? null,
          transactionCurrencyId: openItem.transactionCurrencyId ?? null,
          transactionAmount: remaining.transactionAmount,
          effectiveDate: asOfDate,
          rateType: 'spot',
        })

        const translationAudit = revaluedContext.translationAudit as TranslationAuditSourceSummary | null
        if (translationAudit?.sourceSummary) translationSources.add(translationAudit.sourceSummary)

        const deltas = computeLayerDeltas({
          transactionCurrencyId: openItem.transactionCurrencyId,
          localCurrencyId: openItem.localCurrencyId,
          functionalCurrencyId: openItem.functionalCurrencyId,
          groupCurrencyId: openItem.groupCurrencyId,
          carryingLocalAmount: remaining.localAmount,
          carryingFunctionalAmount: remaining.functionalAmount,
          carryingGroupAmount: remaining.groupAmount,
          revaluedLocalAmount: revaluedContext.originalLocalAmount,
          revaluedFunctionalAmount: revaluedContext.originalFunctionalAmount,
          revaluedGroupAmount: revaluedContext.originalGroupAmount,
        })

        if (deltas.length === 0) {
          skippedItemCount += 1
          await tx.runItem.update({
            where: { id: runItem.id },
            data: {
              status: 'completed',
              completedAt: new Date(),
              message: 'No unrealized FX delta for this open item on the selected as-of date.',
              resultPayloadJson: JSON.stringify({
                remaining,
                revaluedContext,
              }),
            },
          })
          continue
        }

        const sourceLine = ensureJournalLine(
          journalLines,
          openItem.accountId,
          openItem.subsidiaryId ?? null,
          `${openItem.account.accountNumber} ${openItem.account.name} FX revaluation`,
          `Open item ${openItem.openItemNumber}`,
        )

        for (const delta of deltas) {
          const absDelta = Math.abs(delta.delta)
          const useGainOffset =
            (assetAccount && delta.delta > 0) || (liabilityAccount && delta.delta < 0)
          const offsetAccountId = useGainOffset ? unrealizedFxGainAccountId : unrealizedFxLossAccountId
          const offsetLine = ensureJournalLine(
            journalLines,
            offsetAccountId,
            openItem.subsidiaryId ?? null,
            useGainOffset ? 'Unrealized FX gain' : 'Unrealized FX loss',
            `FX revaluation ${delta.layer} layer`,
          )

          if (assetAccount) {
            if (delta.delta > 0) {
              addLayerAmount(sourceLine, delta.layer, 'debit', absDelta)
              addLayerAmount(offsetLine, delta.layer, 'credit', absDelta)
            } else {
              addLayerAmount(sourceLine, delta.layer, 'credit', absDelta)
              addLayerAmount(offsetLine, delta.layer, 'debit', absDelta)
            }
          } else {
            if (delta.delta > 0) {
              addLayerAmount(sourceLine, delta.layer, 'credit', absDelta)
              addLayerAmount(offsetLine, delta.layer, 'debit', absDelta)
            } else {
              addLayerAmount(sourceLine, delta.layer, 'debit', absDelta)
              addLayerAmount(offsetLine, delta.layer, 'credit', absDelta)
            }
          }

          if (delta.layer === 'local') localDeltaTotal = roundMoney(localDeltaTotal + delta.delta)
          if (delta.layer === 'functional') functionalDeltaTotal = roundMoney(functionalDeltaTotal + delta.delta)
          if (delta.layer === 'group') groupDeltaTotal = roundMoney(groupDeltaTotal + delta.delta)
        }

        revaluedItemCount += 1
        await tx.runItem.update({
          where: { id: runItem.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            message: `Calculated ${deltas.length} unrealized FX delta${deltas.length === 1 ? '' : 's'}.`,
            resultPayloadJson: JSON.stringify({
              remaining,
              revaluedContext,
              deltas,
            }),
          },
        })
      } catch (error) {
        failedItemCount += 1
        const message = error instanceof Error ? error.message : 'FX revaluation failed for this open item.'

        await tx.runItem.update({
          where: { id: runItem.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            message,
          },
        })

        await tx.runException.create({
          data: {
            runHeaderId: runHeader.id,
            runItemId: runItem.id,
            severity: 'error',
            exceptionType: 'fx_revaluation_item_error',
            status: 'open',
            sourceRecordType: 'open_item',
            sourceRecordId: openItem.id,
            message,
            detailsJson: JSON.stringify({
              openItemNumber: openItem.openItemNumber,
              sourceTransactionType: openItem.sourceTransactionType,
              sourceTransactionId: openItem.sourceTransactionId,
              accountId: openItem.accountId,
            }),
          },
        })
      }
    }

    let journalEntryId: string | null = null
    const journalLineCreates = Array.from(journalLines.values()).filter((line) => {
      return (
        Math.abs(line.localDebit - line.localCredit) > MONEY_TOLERANCE
        || Math.abs(line.functionalDebit - line.functionalCredit) > MONEY_TOLERANCE
        || Math.abs(line.groupDebit - line.groupCredit) > MONEY_TOLERANCE
      )
    })

    if (journalLineCreates.length > 0) {
      const journalNumber = await generateNextJournalNumber()
      const journalEntry = await tx.journalEntry.create({
        data: {
          number: journalNumber,
          date: asOfDate,
          description: `FX revaluation as of ${asOfDate.toISOString().slice(0, 10)}`,
          journalType: 'fx_revaluation',
          status: 'approved',
          total: 0,
          accountingPeriodId: period.id,
          sourceType: 'fx-revaluation',
          sourceId: runHeader.id,
          subsidiaryId: effectiveSubsidiaryId,
          userId: input.requestedById ?? null,
          lineItems: {
            create: journalLineCreates.map((line, index) => ({
              displayOrder: index,
              description: line.description,
              memo: line.memo,
              activityTypeCode: 'fx_unrealized_revaluation',
              debit: 0,
              credit: 0,
              localDebit: line.localDebit > MONEY_TOLERANCE ? line.localDebit : null,
              localCredit: line.localCredit > MONEY_TOLERANCE ? line.localCredit : null,
              functionalDebit: line.functionalDebit > MONEY_TOLERANCE ? line.functionalDebit : null,
              functionalCredit: line.functionalCredit > MONEY_TOLERANCE ? line.functionalCredit : null,
              groupDebit: line.groupDebit > MONEY_TOLERANCE ? line.groupDebit : null,
              groupCredit: line.groupCredit > MONEY_TOLERANCE ? line.groupCredit : null,
              accountId: line.accountId,
              subsidiaryId: line.subsidiaryId,
            })),
          },
        },
        select: { id: true, number: true },
      })

      journalEntryId = journalEntry.id

      await tx.runOutputLink.create({
        data: {
          runHeaderId: runHeader.id,
          outputType: 'journal_entry',
          outputRecordType: 'journal_entry',
          outputRecordId: journalEntry.id,
          glHeaderId: journalEntry.id,
        },
      })
    }

    const status =
      failedItemCount === 0
        ? 'completed'
        : revaluedItemCount > 0 || skippedItemCount > 0
          ? 'completed_with_exceptions'
          : 'failed'

    const summary = {
      asOfDate: asOfDate.toISOString(),
      accountingPeriodId: period.id,
      subsidiaryId: effectiveSubsidiaryId,
      eligibleOpenItems: candidates.length,
      revaluedItems: revaluedItemCount,
      skippedItems: skippedItemCount,
      failedItems: failedItemCount,
      journalEntryId,
      localDeltaTotal,
      functionalDeltaTotal,
      groupDeltaTotal,
      translationSourceSummary:
        translationSources.size === 0
          ? null
          : translationSources.size === 1
            ? Array.from(translationSources)[0]
            : 'Mixed exchange-rate sources',
    }

    const completedRun = await tx.runHeader.update({
      where: { id: runHeader.id },
      data: {
        status,
        completedAt: new Date(),
        completedById: input.requestedById ?? null,
        message:
          journalEntryId
            ? `FX revaluation completed. Journal ${journalEntryId} created for ${revaluedItemCount} open item${revaluedItemCount === 1 ? '' : 's'}.`
            : `FX revaluation completed with no posting deltas for the selected scope.`,
        summaryJson: JSON.stringify(summary),
      },
      select: {
        id: true,
        runNumber: true,
        status: true,
        message: true,
      },
    })

    return {
      runId: completedRun.id,
      runNumber: completedRun.runNumber,
      status: completedRun.status,
      message: completedRun.message,
      summary,
    }
  })
}
