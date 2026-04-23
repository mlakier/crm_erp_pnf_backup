import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatChartOfAccountId(sequence: number, config = DEFAULT_ID_SETTINGS.chartOfAccount) {
  return formatIdentifier(sequence, config)
}

export async function generateNextChartOfAccountId() {
  const config = await loadIdSetting('chartOfAccount')
  const latestAccounts = await prisma.chartOfAccounts.findMany({
    where: { accountId: { startsWith: config.prefix } },
    orderBy: { accountId: 'desc' },
    select: { accountId: true },
    take: 200,
  })

  const nextSequence = getNextSequenceFromValues(
    latestAccounts.map((account) => account.accountId),
    config,
  )

  return formatChartOfAccountId(nextSequence, config)
}
