import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import ChartOfAccountCreateForm from '@/components/ChartOfAccountCreateForm'
import MasterDataCustomizeButton from '@/components/MasterDataCustomizeButton'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const COLS = [
  { id: 'account-id', label: 'Account Id' },
  { id: 'name', label: 'Name' },
  { id: 'type', label: 'Account Type' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'summary', label: 'Summary' },
  { id: 'subsidiaries', label: 'Subsidiaries' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? {
        OR: [
          { accountId: { contains: query } },
          { name: { contains: query } },
          { accountType: { contains: query } },
          { description: { contains: query } },
        ],
      }
    : {}

  const total = await prisma.chartOfAccounts.count({ where })
  const pagination = getPagination(total, params.page)

  const [accounts, subsidiaries, companySettings, cabinetFiles] = await Promise.all([
    prisma.chartOfAccounts.findMany({
      where,
      include: {
        parentSubsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        subsidiaryAssignments: {
          include: { subsidiary: { select: { id: true, subsidiaryId: true, name: true } } },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
      orderBy: { accountId: 'asc' },
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.entity.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    search.set('page', String(nextPage))
    return `/chart-of-accounts?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.url === selectedLogoValue)
    ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <img
            src={companyLogoPages.url}
            alt="Company logo"
            className="h-16 w-auto rounded"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Chart of Accounts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <MasterDataCustomizeButton tableId="chart-of-accounts-list" columns={COLS} title="Chart of Accounts" />
          <CreateModalButton buttonLabel="New Account" title="New Chart Account" modalWidthClassName="max-w-3xl">
            <ChartOfAccountCreateForm subsidiaries={subsidiaries} />
          </CreateModalButton>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search Account Id, name, type"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ExportButton tableId="chart-of-accounts-list" fileName="chart_of_accounts" />
            <ColumnSelector tableId="chart-of-accounts-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="chart-of-accounts-list">
          <table className="min-w-full" id="chart-of-accounts-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="account-id" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Account Id</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="type" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Account Type</th>
                <th data-column="inventory" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inventory</th>
                <th data-column="summary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Summary</th>
                <th data-column="subsidiaries" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Subsidiaries</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No chart accounts found
                  </td>
                </tr>
              ) : (
                accounts.map((account, index) => (
                  <tr key={account.id} style={index < accounts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="account-id" className="px-4 py-2 text-sm">
                      <Link href={`/chart-of-accounts/${account.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {account.accountId}
                      </Link>
                    </td>
                    <td data-column="name" className="px-4 py-2 text-sm text-white">{account.name}</td>
                    <td data-column="type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{account.accountType}</td>
                    <td data-column="inventory" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{account.inventory ? 'Yes' : 'No'}</td>
                    <td data-column="summary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{account.summary ? 'Yes' : 'No'}</td>
                    <td data-column="subsidiaries" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {account.parentSubsidiary
                        ? `${account.parentSubsidiary.subsidiaryId}${account.includeChildren ? ' (+children)' : ''}`
                        : account.subsidiaryAssignments.length > 0
                          ? account.subsidiaryAssignments.map((entry) => entry.subsidiary.subsidiaryId).join(', ')
                          : '—'}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(account.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="chart-of-accounts"
                          id={account.id}
                          fields={[
                            { name: 'accountId', label: 'Account Id', value: account.accountId },
                            { name: 'name', label: 'Name', value: account.name },
                            { name: 'description', label: 'Description', value: account.description ?? '' },
                            {
                              name: 'accountType',
                              label: 'Account Type',
                              value: account.accountType,
                              type: 'select',
                              options: [
                                { value: 'Asset', label: 'Asset' },
                                { value: 'Liability', label: 'Liability' },
                                { value: 'Equity', label: 'Equity' },
                                { value: 'Revenue', label: 'Revenue' },
                                { value: 'Expense', label: 'Expense' },
                                { value: 'Other', label: 'Other' },
                              ],
                            },
                            { name: 'inventory', label: 'Inventory', value: String(account.inventory), type: 'checkbox' },
                            { name: 'revalueOpenBalance', label: 'Revalue Open Balance', value: String(account.revalueOpenBalance), type: 'checkbox' },
                            { name: 'eliminateIntercoTransactions', label: 'Eliminate Interco Transactions', value: String(account.eliminateIntercoTransactions), type: 'checkbox' },
                            { name: 'summary', label: 'Summary', value: String(account.summary), type: 'checkbox' },
                          ]}
                        />
                        <DeleteButton resource="chart-of-accounts" id={account.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
      </section>
    </div>
  )
}
