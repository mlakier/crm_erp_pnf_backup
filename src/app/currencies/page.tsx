import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import CurrencyCreateForm from '@/components/CurrencyCreateForm'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const COLS = [
  { id: 'code', label: 'Code' },
  { id: 'name', label: 'Name' },
  { id: 'symbol', label: 'Symbol' },
  { id: 'decimals', label: 'Decimals' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function CurrenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ code: { contains: query } }, { name: { contains: query } }] }
    : {}

  const total = await prisma.currency.count({ where })
  const pagination = getPagination(total, params.page)
  const currencies = await prisma.currency.findMany({ where, orderBy: { code: 'asc' }, skip: pagination.skip, take: pagination.pageSize })

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/currencies?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Currencies</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <CreateModalButton buttonLabel="New Currency" title="New Currency">
          <CurrencyCreateForm />
        </CreateModalButton>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search code or name"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Apply</button>
            <Link href="/currencies" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            <ColumnSelector tableId="currencies-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="currencies-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="code" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Code</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="symbol" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Symbol</th>
                <th data-column="decimals" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Decimals</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currencies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No currencies found
                  </td>
                </tr>
              ) : (
                currencies.map((currency, index) => (
                  <tr key={currency.id} style={index < currencies.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="code" className="px-4 py-2 text-sm font-medium text-white"><Link href={`/currencies/${currency.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{currency.code}</Link></td>
                    <td data-column="name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{currency.name}</td>
                    <td data-column="symbol" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{currency.symbol ?? '—'}</td>
                    <td data-column="decimals" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{currency.decimals}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(currency.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="currencies"
                          id={currency.id}
                          fields={[
                            { name: 'code', label: 'Code', value: currency.code },
                            { name: 'name', label: 'Name', value: currency.name },
                            { name: 'symbol', label: 'Symbol', value: currency.symbol ?? '' },
                          ]}
                        />
                        <DeleteButton resource="currencies" id={currency.id} />
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
