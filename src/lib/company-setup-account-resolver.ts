import { Prisma, type PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'

type AccountResolverTransactionClient = Prisma.TransactionClient | PrismaClient

async function resolvePostingAccountId(
  accountId: string | null | undefined,
  tx: AccountResolverTransactionClient = prisma,
) {
  if (!accountId) return null
  const account = await tx.chartOfAccounts.findFirst({
    where: {
      id: accountId,
      active: true,
      isPosting: true,
    },
    select: { id: true },
  })
  return account?.id ?? null
}

export async function loadConfiguredRealizedFxPostingAccounts(tx: AccountResolverTransactionClient = prisma) {
  const settings = await loadCompanySetupSettings()

  return {
    realizedFxGainAccountId: await resolvePostingAccountId(settings.realizedFxGainAccountId, tx),
    realizedFxLossAccountId: await resolvePostingAccountId(settings.realizedFxLossAccountId, tx),
  }
}

export async function loadConfiguredUnrealizedFxPostingAccounts(tx: AccountResolverTransactionClient = prisma) {
  const settings = await loadCompanySetupSettings()

  return {
    unrealizedFxGainAccountId: await resolvePostingAccountId(settings.unrealizedFxGainAccountId, tx),
    unrealizedFxLossAccountId: await resolvePostingAccountId(settings.unrealizedFxLossAccountId, tx),
  }
}
