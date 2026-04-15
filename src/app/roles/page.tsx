import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import MasterDataCustomizeButton from '@/components/MasterDataCustomizeButton'
import { getPagination } from '@/lib/pagination'
import { withMasterDataDefaults } from '@/lib/master-data-columns'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const COLS = withMasterDataDefaults([
  { id: 'role-id', label: 'Role Id' },
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'users', label: 'Users' },
  { id: 'inactive-users', label: 'Inactive Users' },
  { id: 'active-users', label: 'Active Users' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
])

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ roleId: { contains: query, mode: 'insensitive' as const } }, { name: { contains: query, mode: 'insensitive' as const } }] }
    : {}

  const total = await prisma.role.count({ where })
  const pagination = getPagination(total, params.page)

  const [roles, companySettings, cabinetFiles] = await Promise.all([
    prisma.role.findMany({
      where,
      include: {
        _count: { select: { users: true } },
        users: { select: { inactive: true } },
      },
      orderBy: { roleId: 'asc' },
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/roles?${s.toString()}`
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
          <h1 className="text-xl font-semibold text-white">Roles</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <MasterDataCustomizeButton tableId="roles-list" columns={COLS} title="Roles" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search role"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <ExportButton tableId="roles-list" fileName="roles" />
            <ColumnSelector tableId="roles-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="roles-list">
          <table className="min-w-full" id="roles-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="role-id" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Role Id</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="description" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Description</th>
                <th data-column="users" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Users</th>
                <th data-column="inactive-users" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inactive Users</th>
                <th data-column="active-users" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Active Users</th>
                <th data-column="inactive" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inactive</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="last-modified" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Last Modified</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No roles found
                  </td>
                </tr>
              ) : (
                roles.map((item, index) => {
                  const inactiveUsers = item.users.filter((u) => u.inactive).length
                  const activeUsers = item._count.users - inactiveUsers
                  return (
                    <tr key={item.id} style={index < roles.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td data-column="role-id" className="px-4 py-2 text-sm font-medium">
                        <Link href={`/roles/${item.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {item.roleId}
                        </Link>
                      </td>
                      <td data-column="name" className="px-4 py-2 text-sm font-medium text-white">{item.name}</td>
                      <td data-column="description" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.description ?? '—'}</td>
                      <td data-column="users" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item._count.users}</td>
                      <td data-column="inactive-users" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{inactiveUsers}</td>
                      <td data-column="active-users" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{activeUsers}</td>
                      <td data-column="inactive" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.active ? 'No' : 'Yes'}</td>
                      <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(item.updatedAt).toLocaleDateString()}</td>
                      <td data-column="actions" className="px-4 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <EditButton
                            resource="roles"
                            id={item.id}
                            fields={[
                              { name: 'name', label: 'Name', value: item.name },
                              { name: 'description', label: 'Description', value: item.description ?? '' },
                              { name: 'inactive', label: 'Inactive', value: item.active ? 'false' : 'true', type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
                            ]}
                          />
                          <DeleteButton resource="roles" id={item.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })
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
