import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/format'
import CustomerCreateForm from '@/components/CustomerCreateForm'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import CreateModalButton from '@/components/CreateModalButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const CUSTOMER_COLUMNS = [
  { id: 'number', label: 'Number' },
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status' },
  { id: 'subsidiary', label: 'Primary Subsidiary' },
  { id: 'currency', label: 'Primary Currency' },
  { id: 'address', label: 'Address' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? 'newest'

  const where = query
    ? {
        OR: [
          { customerNumber: { contains: query } },
          { name: { contains: query } },
          { email: { contains: query } },
          { industry: { contains: query } },
        ],
      }
    : {}

  const orderBy =
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'name'
        ? [{ name: 'asc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }]

  const [totalCustomers, adminUser, subsidiaries, currencies] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    }),
    prisma.entity.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
  ])

  const pagination = getPagination(totalCustomers, params.page)

  const customers = await prisma.customer.findMany({
    where,
    include: { entity: true, currency: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/crm?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Customers</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalCustomers} total</p>
        </div>
        {adminUser ? (
          <CreateModalButton buttonLabel="New Customer" title="New Customer">
            <CustomerCreateForm ownerUserId={adminUser.id} subsidiaries={subsidiaries} currencies={currencies} />
          </CreateModalButton>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search customer #, name, email, industry"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
            </select>
            <input type="hidden" name="page" value="1" />
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium" style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }}>
              Apply
            </button>
            <Link href="/crm" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
              Reset
            </Link>
            <ColumnSelector tableId="customers-list" columns={CUSTOMER_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="customers-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Number</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="subsidiary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Primary Subsidiary</th>
                <th data-column="currency" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Primary Currency</th>
                <th data-column="address" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Address</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer, index) => (
                  <tr key={customer.id} style={index < customers.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="number" className="px-4 py-2 text-sm">
                      <Link href={`/crm/${customer.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {customer.customerNumber ?? 'Pending'}
                      </Link>
                    </td>
                    <td data-column="name" className="px-4 py-2 text-sm text-white">{customer.name}</td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>active</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {customer.entity ? `${customer.entity.code} (${customer.entity.name})` : '—'}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{customer.currency?.code ?? '—'}</td>
                    <td data-column="address" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{customer.address ?? '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(customer.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="customers"
                          id={customer.id}
                          fields={[
                            { name: 'name', label: 'Name', value: customer.name },
                            { name: 'email', label: 'Email', value: customer.email ?? '' },
                            { name: 'phone', label: 'Phone', value: normalizePhone(customer.phone) ?? '' },
                            { name: 'address', label: 'Address', value: customer.address ?? '' },
                            { name: 'industry', label: 'Industry', value: customer.industry ?? '' },
                          ]}
                        />
                        <DeleteButton resource="customers" id={customer.id} />
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
          total={totalCustomers}
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
