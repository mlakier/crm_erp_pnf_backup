import { prisma } from '@/lib/prisma'
import { isCashBankPostingAccount } from '@/lib/chart-of-accounts-classification'

export type PostingAccountOption = {
  id: string
  accountId: string
  accountNumber: string
  name: string
  accountType?: string
  accountRole?: string | null
  rollforwardCategory?: string | null
}

export async function loadPostingAccounts(args?: {
  accountType?: string
  accountRoles?: string[]
  extraWhere?: Record<string, unknown>
}) {
  const where = {
    active: true,
    isPosting: true,
    ...(args?.accountType ? { accountType: args.accountType } : {}),
    ...(args?.accountRoles?.length ? { accountRole: { in: args.accountRoles } } : {}),
    ...(args?.extraWhere ?? {}),
  }

  return prisma.chartOfAccounts.findMany({
    where,
    orderBy: [{ accountNumber: 'asc' }, { accountId: 'asc' }],
    select: {
      id: true,
      accountId: true,
      accountNumber: true,
      name: true,
      accountType: true,
      accountRole: true,
      rollforwardCategory: true,
      parentAccount: {
        select: {
          accountId: true,
          accountNumber: true,
          name: true,
          category: true,
        },
      },
    },
  })
}

export async function loadCashBankPostingAccounts() {
  const accounts = await loadPostingAccounts({
    accountType: 'Asset',
    extraWhere: {
      OR: [
        { accountRole: { in: ['Bank Account', 'Cash Account'] } },
        { accountRole: null },
      ],
    },
  })
  return accounts.filter((account) =>
    isCashBankPostingAccount({
      accountId: account.accountId,
      accountNumber: account.accountNumber,
      name: account.name,
      accountType: account.accountType,
      accountRole: account.accountRole,
      rollforwardCategory: account.rollforwardCategory,
      parentAccountId: account.parentAccount?.accountId ?? null,
      parentAccountNumber: account.parentAccount?.accountNumber ?? null,
      parentAccountName: account.parentAccount?.name ?? null,
      parentAccountCategory: account.parentAccount?.category ?? null,
    }),
  )
}

export async function loadPostingAccountSelectOptions() {
  const accounts = await loadPostingAccounts()
  return accounts.map((account) => ({
    value: account.id,
    label: `${account.accountNumber} - ${account.name}`,
  }))
}
