import { Prisma, type PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type OpenItemCurrencyTransactionClient = Prisma.TransactionClient | PrismaClient

type DeriveOpenItemCurrencyContextInput = {
  subsidiaryId?: string | null
  transactionCurrencyId?: string | null
  transactionAmount: Prisma.Decimal.Value | number
  effectiveDate?: Date | string | null
  rateType?: string | null
  tx?: OpenItemCurrencyTransactionClient
}

export type TranslationAuditSourceSummary = {
  rateType: string
  effectiveDate: Date | null
  sourceSummary: string | null
}

function roundMoney(value: Prisma.Decimal.Value | number | null | undefined) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function normalizeDateOnly(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function deriveOpenItemCurrencyContext(
  input: DeriveOpenItemCurrencyContextInput,
) {
  const tx = input.tx ?? prisma
  const transactionCurrencyId = input.transactionCurrencyId ?? null
  const transactionAmount = roundMoney(input.transactionAmount)

  const subsidiary = input.subsidiaryId
    ? await tx.subsidiary.findUnique({
        where: { id: input.subsidiaryId },
        select: {
          localCurrencyId: true,
          functionalCurrencyId: true,
          groupCurrencyId: true,
        },
      })
    : null

  const localCurrencyId = subsidiary?.localCurrencyId ?? null
  const functionalCurrencyId = subsidiary?.functionalCurrencyId ?? null
  const groupCurrencyId = subsidiary?.groupCurrencyId ?? null
  const effectiveDate = normalizeDateOnly(input.effectiveDate)
  const normalizedRateType = String(input.rateType ?? 'spot').trim().toLowerCase() || 'spot'
  const rateTypeCandidates = Array.from(new Set([normalizedRateType, `${normalizedRateType.charAt(0).toUpperCase()}${normalizedRateType.slice(1)}`]))

  const targetCurrencyIds = Array.from(
    new Set(
      [transactionCurrencyId, localCurrencyId, functionalCurrencyId, groupCurrencyId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  )

  const baseCurrency = effectiveDate
    ? await tx.currency.findFirst({
        where: { active: true },
        orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
        select: { id: true, code: true, isBase: true },
      })
    : null

  const rateCurrencyIds = Array.from(
    new Set(
      [
        ...targetCurrencyIds,
        ...(baseCurrency?.id ? [baseCurrency.id] : []),
      ],
    ),
  )

  const rateRows =
    effectiveDate && rateCurrencyIds.length >= 2
      ? await tx.exchangeRate.findMany({
          where: {
            active: true,
            effectiveDate: { lte: effectiveDate },
            rateType: { in: rateTypeCandidates },
            OR: [
              {
                baseCurrencyId: { in: rateCurrencyIds },
                quoteCurrencyId: { in: rateCurrencyIds },
              },
              ...(baseCurrency?.id
                ? [
                    {
                      baseCurrencyId: baseCurrency.id,
                      quoteCurrencyId: { in: rateCurrencyIds },
                    },
                    {
                      baseCurrencyId: { in: rateCurrencyIds },
                      quoteCurrencyId: baseCurrency.id,
                    },
                  ]
                : []),
            ],
          },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          select: {
            baseCurrencyId: true,
            quoteCurrencyId: true,
            effectiveDate: true,
            rate: true,
            source: true,
          },
        })
      : []

  const latestRateByPair = new Map<string, number>()
  const rateSourceByPair = new Map<string, string | null>()
  for (const row of rateRows) {
    const key = `${row.baseCurrencyId}:${row.quoteCurrencyId}`
    if (!latestRateByPair.has(key)) {
      latestRateByPair.set(key, Number(row.rate))
      rateSourceByPair.set(key, row.source ?? null)
    }
  }

  const auditSources = new Set<string>()

  const translateAmount = (
    fromCurrencyId: string | null,
    targetCurrencyId: string | null,
    amount: number,
    visited = new Set<string>(),
  ): number | null => {
    if (!fromCurrencyId || !targetCurrencyId) return null
    if (fromCurrencyId === targetCurrencyId) return amount
    const visitKey = `${fromCurrencyId}:${targetCurrencyId}`
    if (visited.has(visitKey)) return null
    visited.add(visitKey)

    const directRate = latestRateByPair.get(`${fromCurrencyId}:${targetCurrencyId}`)
    if (directRate && Number.isFinite(directRate) && directRate > 0) {
      const source = rateSourceByPair.get(`${fromCurrencyId}:${targetCurrencyId}`)
      if (source) auditSources.add(source)
      return roundMoney(amount * directRate)
    }

    const inverseRate = latestRateByPair.get(`${targetCurrencyId}:${fromCurrencyId}`)
    if (inverseRate && Number.isFinite(inverseRate) && inverseRate > 0) {
      const source = rateSourceByPair.get(`${targetCurrencyId}:${fromCurrencyId}`)
      if (source) auditSources.add(source)
      return roundMoney(amount / inverseRate)
    }

    if (baseCurrency?.id && fromCurrencyId !== baseCurrency.id && targetCurrencyId !== baseCurrency.id) {
      const amountInBase = translateAmount(fromCurrencyId, baseCurrency.id, amount, visited)
      if (amountInBase == null) return null
      return translateAmount(baseCurrency.id, targetCurrencyId, amountInBase, visited)
    }

    return null
  }

  const buildAuditSummary = (): TranslationAuditSourceSummary | null => {
    if (!effectiveDate) return null
    const distinctSources = Array.from(auditSources).filter(Boolean)
    return {
      rateType: normalizedRateType,
      effectiveDate,
      sourceSummary:
        distinctSources.length === 0
          ? 'Configured exchange rates'
          : distinctSources.length === 1
            ? distinctSources[0]
            : 'Mixed exchange-rate sources',
    }
  }

  return {
    transactionCurrencyId,
    localCurrencyId,
    functionalCurrencyId,
    groupCurrencyId,
    originalLocalAmount: translateAmount(transactionCurrencyId, localCurrencyId, transactionAmount),
    originalFunctionalAmount: translateAmount(transactionCurrencyId, functionalCurrencyId, transactionAmount),
    originalGroupAmount: translateAmount(transactionCurrencyId, groupCurrencyId, transactionAmount),
    translationAudit: buildAuditSummary(),
  }
}
