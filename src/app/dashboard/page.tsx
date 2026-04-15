import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import { prisma } from '@/lib/prisma'

function getActivityHref(entityType: string, entityId: string) {
  if (entityType === 'department') return `/departments/${entityId}`
  if (entityType === 'employee') return `/employees/${entityId}`
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

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const prismaWithActivity = prisma as typeof prisma & {
    activity?: {
      findMany: typeof prisma.activity.findMany
    }
  }

  const [customerCount, vendorCount, contactCount, opportunityCount, purchaseOrderCount, quoteCount, salesOrderCount, invoiceCount, recentActivity] = await Promise.all([
    prisma.customer.count(),
    prisma.vendor.count(),
    prisma.contact.count(),
    prisma.opportunity.count(),
    prisma.purchaseOrder.count(),
    prisma.quote.count(),
    prisma.salesOrder.count(),
    prisma.invoice.count(),
    prismaWithActivity.activity?.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }) ?? Promise.resolve([]),
  ])

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Welcome, {session.user.name?.split(' ')[0] ?? 'User'}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {session.user.email}
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={customerCount} icon={<IconUsers />} />
        <StatCard label="Vendors" value={vendorCount} icon={<IconVendor />} />
        <StatCard label="Opportunities" value={opportunityCount} icon={<IconPipeline />} />
        <StatCard label="Invoices" value={invoiceCount} icon={<IconInvoice />} />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Quotes" value={quoteCount} icon={<IconQuote />} />
        <StatCard label="Sales Orders" value={salesOrderCount} icon={<IconOrder />} />
        <StatCard label="Contacts" value={contactCount} icon={<IconContact />} />
        <StatCard label="Purchase Orders" value={purchaseOrderCount} icon={<IconPO />} />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <StatusChip label="Healthy" tone="success" />
        <StatusChip label="At risk" tone="warning" />
        <StatusChip label="Critical" tone="danger" />
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard title="Leads" description="Capture and qualify lead records" href="/leads" />
        <NavCard title="Customers" description="Manage customer master data" href="/customers" />
        <NavCard title="Contacts" description="Customer contacts and relationships" href="/contacts" />
        <NavCard title="Departments" description="Organize employee structure and ownership" href="/departments" />
        <NavCard title="Vendors" description="Manage vendor master data" href="/vendors" />
        <NavCard title="Opportunities" description="Track sales pipeline and deals" href="/opportunities" />
        <NavCard title="Quotes" description="Customer proposals from opportunities" href="/quotes" />
        <NavCard title="Sales Orders" description="Booked customer orders" href="/sales-orders" />
        <NavCard title="Invoices" description="Customer billing and payment status" href="/invoices" />
        <NavCard title="Purchase Requisitions" description="Plan and request procurement purchases" href="/purchase-requisitions" />
        <NavCard title="Purchase Orders" description="Procurement orders and receipts" href="/purchase-orders" />
        <NavCard title="Bills" description="Supplier bills and payable tracking" href="/bills" />
        <NavCard title="AP Portal" description="Accounts payable and supplier invoices" href="/ap" />
      </div>

      <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Recent Activity</h2>
          <Link href="/activity" className="text-xs font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-muted)' }}>
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Summary</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Record</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No activity yet. Actions will appear here.
                  </td>
                </tr>
              ) : (
                recentActivity.map((item, i) => {
                  const href = getActivityHref(item.entityType, item.entityId)
                  return (
                    <tr key={item.id} style={i < recentActivity.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.entityType}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.action}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground)' }}>{item.summary}</td>
                      <td className="px-4 py-3 text-xs">
                        {href && item.action !== 'delete' ? (
                          <Link href={href} className="font-medium" style={{ color: 'var(--accent-primary-strong)' }}>Open</Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div style={{ color: 'var(--accent-cyan-strong)' }}>{icon}</div>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}

function NavCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-xl p-5 transition-colors"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-muted)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-white transition-colors group-hover:text-blue-400">{title}</span>
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </Link>
  )
}

function StatusChip({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' }) {
  const toneStyles: Record<'success' | 'warning' | 'danger', { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(34, 197, 94, 0.14)', border: 'var(--success)', text: '#86efac' },
    warning: { bg: 'rgba(245, 158, 11, 0.14)', border: 'var(--warning)', text: '#fcd34d' },
    danger: { bg: 'rgba(239, 68, 68, 0.14)', border: 'var(--danger)', text: '#fca5a5' },
  }

  const style = toneStyles[tone]
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
    >
      {label}
    </span>
  )
}

function IconUsers() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconVendor() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function IconPipeline() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
}
function IconInvoice() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function IconQuote() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function IconOrder() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
}
function IconContact() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconPO() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
}
