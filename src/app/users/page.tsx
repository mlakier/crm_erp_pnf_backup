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
  { id: 'id', label: 'User ID' },
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'role', label: 'Role' },
  { id: 'department', label: 'Department' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
])

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? {
      OR: [
        { userId: { contains: query, mode: 'insensitive' as const } },
        { name: { contains: query, mode: 'insensitive' as const } },
        { email: { contains: query, mode: 'insensitive' as const } },
        { role: { name: { contains: query, mode: 'insensitive' as const } } },
      ],
    }
    : {}

  const total = await prisma.user.count({ where })
  const pagination = getPagination(total, params.page)

  const [users, companySettings, cabinetFiles, roles, departments] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { department: { select: { departmentId: true, name: true } }, role: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/users?${s.toString()}`
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
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <MasterDataCustomizeButton tableId="users-list" columns={COLS} title="Users" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search user #, name, email or role"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <ExportButton tableId="users-list" fileName="users" />
            <ColumnSelector tableId="users-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="users-list">
          <table className="min-w-full" id="users-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="id" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>User ID</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="email" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Email</th>
                <th data-column="role" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Role</th>
                <th data-column="department" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Department</th>
                <th data-column="inactive" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inactive</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="last-modified" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Last Modified</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} style={index < users.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="id" className="px-4 py-2 text-sm">
                      <Link href={`/users/${user.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {user.userId ?? 'Pending'}
                      </Link>
                    </td>
                    <td data-column="name" className="px-4 py-2 text-sm font-medium text-white">{user.name ?? '—'}</td>
                    <td data-column="email" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email || '—'}</td>
                    <td data-column="role" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.role?.name ?? '—'}</td>
                    <td data-column="department" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.department ? `${user.department.departmentId} - ${user.department.name}` : '—'}</td>
                    <td data-column="inactive" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.inactive ? 'Yes' : 'No'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(user.updatedAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="users"
                          id={user.id}
                          fields={[
                            { name: 'name', label: 'Name', value: user.name ?? '' },
                            { name: 'email', label: 'Email', value: user.email, type: 'email' },
                            {
                              name: 'roleId',
                              label: 'Role',
                              value: user.roleId ?? '',
                              type: 'select',
                              placeholder: 'Select role',
                              options: roles.map((r) => ({ value: r.id, label: r.name })),
                            },
                            {
                              name: 'departmentId',
                              label: 'Department',
                              value: user.departmentId ?? '',
                              type: 'select',
                              placeholder: 'Select department',
                              options: departments.map((d) => ({ value: d.id, label: `${d.departmentId} - ${d.name}` })),
                            },
                            { name: 'inactive', label: 'Inactive', value: user.inactive ? 'true' : 'false', type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
                          ]}
                        />
                        <DeleteButton resource="users" id={user.id} />
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
