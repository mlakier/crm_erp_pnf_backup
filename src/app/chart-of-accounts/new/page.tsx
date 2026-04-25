import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import ChartOfAccountCreateForm from '@/components/ChartOfAccountCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { generateNextChartOfAccountId } from '@/lib/chart-of-account-id'

export default async function NewChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [subsidiaries, accountOptions, accountTypeOptions, normalBalanceOptions, financialStatementCategoryOptions, nextAccountId, duplicateAccount] = await Promise.all([
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.chartOfAccounts.findMany({ orderBy: [{ accountId: 'asc' }, { accountNumber: 'asc' }], select: { id: true, accountId: true, accountNumber: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'accountType' }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'normalBalance' }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-COA-FS-CATEGORY' }),
    generateNextChartOfAccountId(),
    duplicateFrom
      ? prisma.chartOfAccounts.findUnique({
          where: { id: duplicateFrom },
          include: { subsidiaryAssignments: { select: { subsidiaryId: true } } },
        })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/chart-of-accounts" backLabel="<- Back to Chart of Accounts" title="New Chart of Accounts" formId="create-chart-of-account-form">
      <ChartOfAccountCreateForm
        formId="create-chart-of-account-form"
        showFooterActions={false}
        subsidiaries={subsidiaries}
        accountOptions={accountOptions}
        accountTypeOptions={accountTypeOptions}
        normalBalanceOptions={normalBalanceOptions}
        financialStatementCategoryOptions={financialStatementCategoryOptions}
        nextAccountId={nextAccountId}
        redirectBasePath="/chart-of-accounts"
        initialValues={duplicateAccount ? {
          accountNumber: '',
          name: `Copy of ${duplicateAccount.name}`,
          description: duplicateAccount.description,
          accountType: duplicateAccount.accountType,
          inventory: duplicateAccount.inventory,
          revalueOpenBalance: duplicateAccount.revalueOpenBalance,
          eliminateIntercoTransactions: duplicateAccount.eliminateIntercoTransactions,
          summary: duplicateAccount.summary,
          normalBalance: duplicateAccount.normalBalance,
          financialStatementSection: duplicateAccount.financialStatementSection,
          financialStatementGroup: duplicateAccount.financialStatementGroup,
          financialStatementCategory: duplicateAccount.financialStatementCategory,
          isPosting: duplicateAccount.isPosting,
          isControlAccount: duplicateAccount.isControlAccount,
          allowsManualPosting: duplicateAccount.allowsManualPosting,
          requiresSubledgerType: duplicateAccount.requiresSubledgerType,
          cashFlowCategory: duplicateAccount.cashFlowCategory,
          parentAccountId: duplicateAccount.parentAccountId,
          closeToAccountId: duplicateAccount.closeToAccountId,
          scopeMode: 'selected',
          selectedSubsidiaryIds: duplicateAccount.parentSubsidiaryId
            ? [duplicateAccount.parentSubsidiaryId]
            : duplicateAccount.subsidiaryAssignments.map((assignment) => assignment.subsidiaryId),
          includeChildren: duplicateAccount.includeChildren,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
