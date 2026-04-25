import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { chartOfAccountsListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { loadListOptionsForSource } from '@/lib/list-source'
import { CHART_OF_ACCOUNTS_FORM_FIELDS } from '@/lib/chart-of-accounts-form-customization'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const fieldMetaById = Object.fromEntries(
    CHART_OF_ACCOUNTS_FORM_FIELDS.map((field) => [field.id, field])
  ) as Record<(typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]['id'], (typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]>

  const where = query
    ? {
        OR: [
          { accountId: { contains: query, mode: 'insensitive' as const } },
          { accountNumber: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { accountType: { contains: query, mode: 'insensitive' as const } },
          { financialStatementCategory: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const total = await prisma.chartOfAccounts.count({ where })
  const pagination = getPagination(total, params.page)

  const [accounts, accountOptions, accountTypeOptions, normalBalanceOptions, financialStatementCategoryOptions, companyLogoPages] = await Promise.all([
    prisma.chartOfAccounts.findMany({
      where,
      include: {
        parentAccount: { select: { id: true, accountId: true, accountNumber: true, name: true } },
        parentSubsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        subsidiaryAssignments: {
          include: { subsidiary: { select: { id: true, subsidiaryId: true, name: true } } },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
      orderBy:
        sort === 'id'
          ? [{ accountId: 'asc' as const }, { accountNumber: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.chartOfAccounts.findMany({ orderBy: [{ accountId: 'asc' }, { accountNumber: 'asc' }], select: { id: true, accountId: true, accountNumber: true, name: true } }),
    loadListOptionsForSource(fieldMetaById.accountType),
    loadListOptionsForSource(fieldMetaById.normalBalance),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-COA-FS-CATEGORY' }),
    loadCompanyPageLogo(),
  ])

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/chart-of-accounts?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Chart of Accounts"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/chart-of-accounts/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Account
          </Link>
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={chartOfAccountsListDefinition.searchPlaceholder}
        tableId={chartOfAccountsListDefinition.tableId}
        exportFileName={chartOfAccountsListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('chart-of-accounts', params.q, sort)}
        columns={chartOfAccountsListDefinition.columns}
        sort={sort}
        sortOptions={chartOfAccountsListDefinition.sortOptions}
      >
        <table className="min-w-full" id={chartOfAccountsListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="account-id">Account Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="account-number">Account Number</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="description">Description</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="type">Account Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="normal-balance">Normal Balance</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="fs-section">FS Section</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="fs-group">FS Group</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="fs-category">FS Category</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="parent-account">Parent Account</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="posting">Posting</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="control">Control</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inventory">Inventory</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="summary">Summary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiaries">Subsidiaries</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="include-children">Include Children</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={chartOfAccountsListDefinition.columns.length}>No chart accounts found</MasterDataEmptyStateRow>
            ) : (
              accounts.map((account, index) => (
                <tr key={account.id} style={getMasterDataRowStyle(index, accounts.length)}>
                  <MasterDataBodyCell columnId="account-id">
                    <Link href={`/chart-of-accounts/${account.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {account.accountId}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="account-number">{account.accountNumber}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm text-white">{account.name}</MasterDataBodyCell>
                  <MasterDataMutedCell columnId="description">{account.description ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="type">{account.accountType}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="normal-balance">{account.normalBalance ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="fs-section">{account.financialStatementSection ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="fs-group">{account.financialStatementGroup ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="fs-category">{account.financialStatementCategory ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="parent-account">
                    {account.parentAccount
                      ? `${account.parentAccount.accountId} - ${account.parentAccount.name}`
                      : '-'}
                  </MasterDataMutedCell>
                  <MasterDataMutedCell columnId="posting">{account.isPosting ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="control">{account.isControlAccount ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="inventory">{account.inventory ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="summary">{account.summary ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="subsidiaries">
                    {account.parentSubsidiary
                      ? account.parentSubsidiary.subsidiaryId
                      : account.subsidiaryAssignments.length > 0
                        ? account.subsidiaryAssignments.map((entry) => entry.subsidiary.subsidiaryId).join(', ')
                        : '-'}
                  </MasterDataMutedCell>
                  <MasterDataMutedCell columnId="include-children">{account.includeChildren ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="created">{formatMasterDataDate(account.createdAt)}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <div className="flex items-center gap-2">
                      <EditButton
                        resource="chart-of-accounts"
                        id={account.id}
                        fields={[
                          { name: 'accountId', label: 'Account Id', value: account.accountId },
                          { name: 'accountNumber', label: 'Account Number', value: account.accountNumber },
                          { name: 'name', label: 'Name', value: account.name },
                          { name: 'description', label: 'Description', value: account.description ?? '' },
                          {
                            name: 'accountType',
                            label: 'Account Type',
                            value: account.accountType,
                            type: 'select',
                            options: accountTypeOptions,
                          },
                          { name: 'normalBalance', label: 'Normal Balance', value: account.normalBalance ?? '', type: 'select', options: normalBalanceOptions },
                          { name: 'financialStatementSection', label: 'FS Section', value: account.financialStatementSection ?? '' },
                          { name: 'financialStatementGroup', label: 'FS Group', value: account.financialStatementGroup ?? '' },
                          { name: 'financialStatementCategory', label: 'FS Category', value: account.financialStatementCategory ?? '', type: 'select', options: financialStatementCategoryOptions },
                          { name: 'isPosting', label: 'Posting Account', value: String(account.isPosting), type: 'checkbox' },
                          { name: 'isControlAccount', label: 'Control Account', value: String(account.isControlAccount), type: 'checkbox' },
                          { name: 'allowsManualPosting', label: 'Allow Manual Posting', value: String(account.allowsManualPosting), type: 'checkbox' },
                          { name: 'requiresSubledgerType', label: 'Requires Subledger Type', value: account.requiresSubledgerType ?? '' },
                          { name: 'cashFlowCategory', label: 'Cash Flow Category', value: account.cashFlowCategory ?? '' },
                          { name: 'parentAccountId', label: 'Parent Account', value: account.parentAccountId ?? '', type: 'select', placeholder: 'Select parent account', options: accountOptions.filter((option) => option.id !== account.id).map((option) => ({ value: option.id, label: `${option.accountId} - ${option.accountNumber} - ${option.name}` })) },
                          { name: 'closeToAccountId', label: 'Close To Account', value: account.closeToAccountId ?? '', type: 'select', placeholder: 'Select close-to account', options: accountOptions.filter((option) => option.id !== account.id).map((option) => ({ value: option.id, label: `${option.accountId} - ${option.accountNumber} - ${option.name}` })) },
                          { name: 'inventory', label: 'Inventory', value: String(account.inventory), type: 'checkbox' },
                          { name: 'revalueOpenBalance', label: 'Revalue Open Balance', value: String(account.revalueOpenBalance), type: 'checkbox' },
                          { name: 'eliminateIntercoTransactions', label: 'Eliminate Interco Transactions', value: String(account.eliminateIntercoTransactions), type: 'checkbox' },
                          { name: 'summary', label: 'Summary', value: String(account.summary), type: 'checkbox' },
                        ]}
                      />
                      <DeleteButton resource="chart-of-accounts" id={account.id} />
                    </div>
                  </MasterDataBodyCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={total}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          hasPrevPage={pagination.hasPrevPage}
          hasNextPage={pagination.hasNextPage}
          prevHref={buildPageHref(pagination.currentPage - 1)}
          nextHref={buildPageHref(pagination.currentPage + 1)}
        />
      </MasterDataListSection>
    </div>
  )
}
