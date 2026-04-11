import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import EntityCreateForm from '@/components/EntityCreateForm'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const COLS = [
  { id: 'code', label: 'Code' },
  { id: 'name', label: 'Name' },
  { id: 'legal-name', label: 'Legal Name' },
  { id: 'type', label: 'Type' },
  { id: 'default-currency', label: 'Default Currency' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ code: { contains: query } }, { name: { contains: query } }] }
    : {}

  const total = await prisma.entity.count({ where })
  const pagination = getPagination(total, params.page)

  const [entities, currencies] = await Promise.all([
    prisma.entity.findMany({ where, include: { defaultCurrency: true }, orderBy: { code: 'asc' }, skip: pagination.skip, take: pagination.pageSize }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/entities?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Subsidiaries</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <CreateModalButton buttonLabel="New Subsidiary" title="New Subsidiary">
          <EntityCreateForm currencies={currencies} />
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
            <Link href="/entities" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            <ColumnSelector tableId="entities-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="entities-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="code" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Code</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="legal-name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Legal Name</th>
                <th data-column="type" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Type</th>
                <th data-column="default-currency" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Default Currency</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No subsidiaries found
                  </td>
                </tr>
              ) : (
                entities.map((entity, index) => (
                  <tr key={entity.id} style={index < entities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="code" className="px-4 py-2 text-sm font-medium text-white"><Link href={`/entities/${entity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{entity.code}</Link></td>
                    <td data-column="name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.name}</td>
                    <td data-column="legal-name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.legalName ?? '—'}</td>
                    <td data-column="type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.entityType ?? '—'}</td>
                    <td data-column="default-currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.defaultCurrency?.code ?? '—'}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="entities"
                          id={entity.id}
                          fields={[
                            { name: 'code', label: 'Code', value: entity.code },
                            { name: 'name', label: 'Name', value: entity.name },
                            { name: 'legalName', label: 'Legal Name', value: entity.legalName ?? '' },
                            { name: 'entityType', label: 'Type', value: entity.entityType ?? '' },
                          ]}
                        />
                        <DeleteButton resource="entities" id={entity.id} />
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
