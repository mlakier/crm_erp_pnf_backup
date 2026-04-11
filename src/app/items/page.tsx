import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import ItemCreateForm from '@/components/ItemCreateForm'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const COLS = [
  { id: 'name', label: 'Name' },
  { id: 'item-number', label: 'Item #' },
  { id: 'sku', label: 'SKU' },
  { id: 'type', label: 'Type' },
  { id: 'price', label: 'Price' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ name: { contains: query } }, { itemNumber: { contains: query } }, { sku: { contains: query } }] }
    : {}

  const total = await prisma.item.count({ where })
  const pagination = getPagination(total, params.page)

  const [items, entities, currencies] = await Promise.all([
    prisma.item.findMany({ where, include: { entity: true, currency: true }, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.pageSize }),
    prisma.entity.findMany({ orderBy: { code: 'asc' } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/items?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Items</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <CreateModalButton buttonLabel="New Item" title="New Item">
          <ItemCreateForm entities={entities} currencies={currencies} />
        </CreateModalButton>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search name, item #, SKU"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Apply</button>
            <Link href="/items" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            <ColumnSelector tableId="items-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="items-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="item-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Item #</th>
                <th data-column="sku" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>SKU</th>
                <th data-column="type" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Type</th>
                <th data-column="price" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Price</th>
                <th data-column="subsidiary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Subsidiary</th>
                <th data-column="currency" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Currency</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No items found
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id} style={index < items.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="name" className="px-4 py-2 text-sm font-medium text-white">{item.name}</td>
                    <td data-column="item-number" className="px-4 py-2 text-sm"><Link href={`/items/${item.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{item.itemNumber ?? '—'}</Link></td>
                    <td data-column="sku" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.sku ?? '—'}</td>
                    <td data-column="type" className="px-4 py-2 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{item.itemType}</td>
                    <td data-column="price" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.listPrice.toFixed(2)}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.entity?.code ?? '—'}</td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.currency?.code ?? '—'}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="items"
                          id={item.id}
                          fields={[
                            { name: 'name', label: 'Name', value: item.name },
                            { name: 'itemNumber', label: 'Item #', value: item.itemNumber ?? '' },
                            { name: 'sku', label: 'SKU', value: item.sku ?? '' },
                            { name: 'itemType', label: 'Type', value: item.itemType },
                            { name: 'uom', label: 'UOM', value: item.uom ?? '' },
                            { name: 'listPrice', label: 'List Price', value: String(item.listPrice), type: 'number' },
                          ]}
                        />
                        <DeleteButton resource="items" id={item.id} />
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
