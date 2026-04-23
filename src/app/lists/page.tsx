import Link from 'next/link'
import CreatePageLinkButton from '@/components/CreatePageLinkButton'
import MasterDataListSection from '@/components/MasterDataListSection'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import PaginationFooter from '@/components/PaginationFooter'
import {
  MasterDataBodyCell,
  MasterDataEmptyStateRow,
  MasterDataHeaderCell,
  MasterDataMutedCell,
} from '@/components/MasterDataTableCells'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { getMasterDataRowStyle, MASTER_DATA_TABLE_DIVIDER_STYLE } from '@/lib/master-data-table'
import { getPagination } from '@/lib/pagination'
import { managedListDefinition } from '@/lib/master-data-list-definitions'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'
import { loadManagedListsState } from '@/lib/manage-lists'

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim().toLowerCase()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const [{ lists }, companyLogoPages] = await Promise.all([
    loadManagedListsState(),
    loadCompanyPageLogo(),
  ])

  const filteredLists = query
    ? lists.filter((list) =>
        [list.key, list.label, list.whereUsed.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    : lists

  const sortedLists = [...filteredLists].sort((a, b) => {
    if (sort === 'name') return a.label.localeCompare(b.label)
    if (sort === 'oldest') return a.key.localeCompare(b.key)
    if (sort === 'newest') return b.key.localeCompare(a.key)
    return a.key.localeCompare(b.key)
  })

  const pagination = getPagination(sortedLists.length, params.page)
  const pageLists = sortedLists.slice(pagination.skip, pagination.skip + pagination.pageSize)

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/lists?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Manage Lists"
        total={filteredLists.length}
        logoUrl={companyLogoPages?.url}
        actions={<CreatePageLinkButton href="/lists/new" label="New List" />}
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={managedListDefinition.searchPlaceholder}
        tableId={managedListDefinition.tableId}
        exportFileName={managedListDefinition.exportFileName}
        columns={managedListDefinition.columns}
        sort={sort}
        sortOptions={managedListDefinition.sortOptions}
      >
        <table className="min-w-full" id={managedListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="list-key">List Key</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="list-name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="where-used">Where Used</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="values">Values</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="display-order">Display Order</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="type">Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {pageLists.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={7}>No lists found</MasterDataEmptyStateRow>
            ) : (
              pageLists.map((list, index) => (
                <tr key={list.key} style={getMasterDataRowStyle(index, pageLists.length)}>
                  <MasterDataBodyCell columnId="list-key">
                    <Link href={`/lists/${encodeURIComponent(list.key)}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {list.key}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataBodyCell columnId="list-name" className="px-4 py-2 text-sm font-medium text-white">
                    {list.label}
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="where-used">{list.whereUsed.join(', ') || '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="values">{list.valueCount}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="display-order">{list.displayOrder === 'alpha' ? 'Alphabetical' : 'List Order'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="type">{list.systemManaged ? 'Standard' : 'Custom'}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <Link
                      href={`/lists/${encodeURIComponent(list.key)}/edit`}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                      style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                    >
                      Edit
                    </Link>
                  </MasterDataBodyCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={filteredLists.length}
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
