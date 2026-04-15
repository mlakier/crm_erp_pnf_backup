import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import ExportButton from '@/components/ExportButton'
import { getPagination } from '@/lib/pagination'

const ACTIVITY_COLUMNS = [
  { id: 'when', label: 'When' },
  { id: 'entity', label: 'Entity' },
  { id: 'action', label: 'Action' },
  { id: 'summary', label: 'Summary' },
  { id: 'record', label: 'Record' },
]

function getActivityHref(entityType: string, entityId: string) {
  if (entityType === 'customer') return `/customers/${entityId}`
  if (entityType === 'vendor') return `/vendors/${entityId}`
  if (entityType === 'contact') return `/contacts/${entityId}`
  if (entityType === 'opportunity') return `/opportunities/${entityId}`
  if (entityType === 'quote') return `/quotes/${entityId}`
  if (entityType === 'sales-order') return `/sales-orders/${entityId}`
  if (entityType === 'invoice') return `/invoices/${entityId}`
  if (entityType === 'purchase-order') return `/purchase-orders/${entityId}`
  return null
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; page?: string }>
}) {
  const params = await searchParams
  const entity = params.entity ?? 'all'
  const action = params.action ?? 'all'

  const prismaWithActivity = prisma as typeof prisma & {
    activity?: {
      findMany: typeof prisma.activity.findMany
    }
  }

  const where = {
    entityType: entity === 'all' ? undefined : entity,
    action: action === 'all' ? undefined : action,
  }

  const totalActivities = prismaWithActivity.activity
    ? await prismaWithActivity.activity.count({ where })
    : 0

  const pagination = getPagination(totalActivities, params.page)

  const activities = prismaWithActivity.activity
    ? await prismaWithActivity.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize,
      })
    : []

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (entity !== 'all') search.set('entity', entity)
    if (action !== 'all') search.set('action', action)
    search.set('page', String(nextPage))
    return `/activity?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Activity Log</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Recent create, update, and delete events across CRM and procurement records.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form method="get" className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto_auto]">
            <select name="entity" defaultValue={entity} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All entities</option>
              <option value="customer">Customers</option>
              <option value="vendor">Vendors</option>
              <option value="contact">Contacts</option>
              <option value="opportunity">Opportunities</option>
              <option value="quote">Quotes</option>
              <option value="sales-order">Sales Orders</option>
              <option value="invoice">Invoices</option>
              <option value="purchase-order">Purchase Orders</option>
            </select>
            <select name="action" defaultValue={action} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
            <input type="hidden" name="page" value="1" />
            <ExportButton tableId="activity-list" fileName="activity" />
            <ColumnSelector tableId="activity-list" columns={ACTIVITY_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="activity-list">
          <table className="min-w-full" id="activity-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="when" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>When</th>
                <th data-column="entity" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Entity</th>
                <th data-column="action" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Action</th>
                <th data-column="summary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Summary</th>
                <th data-column="record" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Record</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No activity found for this filter.</td>
                </tr>
              ) : (
                activities.map((item, index) => {
                  const href = getActivityHref(item.entityType, item.entityId)

                  return (
                    <tr key={item.id} style={index < activities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td data-column="when" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(item.createdAt).toLocaleString()}</td>
                      <td data-column="entity" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.entityType}</td>
                      <td data-column="action" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.action}</td>
                      <td data-column="summary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.summary}</td>
                      <td data-column="record" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {href && item.action !== 'delete' ? (
                          <Link href={href} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                            Open record
                          </Link>
                        ) : href ? (
                          <span style={{ color: 'var(--text-muted)' }}>Record deleted</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>No detail page</span>
                        )}
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
          total={totalActivities}
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
