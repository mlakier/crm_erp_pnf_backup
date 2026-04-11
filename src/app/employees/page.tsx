import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import EmployeeCreateForm from '@/components/EmployeeCreateForm'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const COLS = [
  { id: 'employee-number', label: 'Employee #' },
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'title', label: 'Title' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }, { email: { contains: query } }] }
    : {}

  const total = await prisma.employee.count({ where })
  const pagination = getPagination(total, params.page)

  const [employees, entities] = await Promise.all([
    prisma.employee.findMany({ where, include: { entity: true }, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.pageSize }),
    prisma.entity.findMany({ orderBy: { code: 'asc' } }),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/employees?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Employees</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <CreateModalButton buttonLabel="New Employee" title="New Employee">
          <EmployeeCreateForm entities={entities} />
        </CreateModalButton>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search name or email"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Apply</button>
            <Link href="/employees" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            <ColumnSelector tableId="employees-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="employees-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="employee-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Employee #</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="email" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Email</th>
                <th data-column="title" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Title</th>
                <th data-column="subsidiary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Subsidiary</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee, index) => (
                  <tr key={employee.id} style={index < employees.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="employee-number" className="px-4 py-2 text-sm font-medium"><Link href={`/employees/${employee.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{employee.employeeNumber ?? 'Pending'}</Link></td>
                    <td data-column="name" className="px-4 py-2 text-sm font-medium text-white">{employee.firstName} {employee.lastName}</td>
                    <td data-column="email" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{employee.email ?? '—'}</td>
                    <td data-column="title" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{employee.title ?? '—'}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{employee.entity?.code ?? '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(employee.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="employees"
                          id={employee.id}
                          fields={[
                            { name: 'firstName', label: 'First Name', value: employee.firstName },
                            { name: 'lastName', label: 'Last Name', value: employee.lastName },
                            { name: 'email', label: 'Email', value: employee.email ?? '' },
                            { name: 'title', label: 'Title', value: employee.title ?? '' },
                          ]}
                        />
                        <DeleteButton resource="employees" id={employee.id} />
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
