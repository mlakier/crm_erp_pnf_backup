import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { loadRoleFormCustomization } from '@/lib/role-form-customization-store'
import { roleListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { loadListOptionsForSource } from '@/lib/list-source'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT

  const where = query
    ? { OR: [{ roleId: { contains: query, mode: 'insensitive' as const } }, { name: { contains: query, mode: 'insensitive' as const } }] }
    : {}

  const total = await prisma.role.count({ where })
  const pagination = getPagination(total, params.page)

  const [roles, companyLogoPages, inactiveOptions, formCustomization] = await Promise.all([
    prisma.role.findMany({
      where,
      include: {
        _count: { select: { users: true } },
        users: { select: { inactive: true } },
      },
      orderBy:
        sort === 'id'
          ? [{ roleId: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    loadCompanyPageLogo(),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadRoleFormCustomization(),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/roles?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Roles"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/roles/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Role
          </Link>
        }
      />
      <MasterDataListSection
        query={params.q}
        searchPlaceholder={roleListDefinition.searchPlaceholder}
        tableId={roleListDefinition.tableId}
        exportFileName={roleListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('roles', params.q, sort)}
        columns={roleListDefinition.columns}
        sort={sort}
        sortOptions={roleListDefinition.sortOptions}
      >
        <table className="min-w-full" id={roleListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="role-id">Role Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="description">Description</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="users">Users</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive-users">Inactive Users</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="active-users">Active Users</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={10}>No roles found</MasterDataEmptyStateRow>
            ) : (
              roles.map((item, index) => {
                const inactiveUsers = item.users.filter((u) => u.inactive).length
                const activeUsers = item._count.users - inactiveUsers
                return (
                  <tr key={item.id} style={getMasterDataRowStyle(index, roles.length)}>
                    <MasterDataBodyCell columnId="role-id" className="px-4 py-2 text-sm font-medium">
                      <Link href={`/roles/${item.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {item.roleId}
                      </Link>
                    </MasterDataBodyCell>
                    <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm font-medium text-white">{item.name}</MasterDataBodyCell>
                    <MasterDataMutedCell columnId="description">{item.description ?? '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="users">{item._count.users}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="inactive-users">{inactiveUsers}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="active-users">{activeUsers}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="inactive">{item.active ? 'No' : 'Yes'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="created">{formatMasterDataDate(item.createdAt)}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(item.updatedAt)}</MasterDataMutedCell>
                    <MasterDataBodyCell columnId="actions">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="roles"
                          id={item.id}
                          fields={[
                            ...(formCustomization.fields.name.visible ? [{ name: 'name', label: 'Name', value: item.name }] : []),
                            ...(formCustomization.fields.description.visible ? [{ name: 'description', label: 'Description', value: item.description ?? '' }] : []),
                            ...(formCustomization.fields.inactive.visible ? [{ name: 'inactive', label: 'Inactive', value: item.active ? 'false' : 'true', type: 'select' as const, options: inactiveOptions }] : []),
                          ]}
                        />
                        <DeleteButton resource="roles" id={item.id} />
                      </div>
                    </MasterDataBodyCell>
                  </tr>
                )
              })
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
