import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtPhone, normalizePhone } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import VendorEditButton from '@/components/VendorEditButton'
import VendorCreateMenu from '@/components/VendorCreateMenu'

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [vendor, defaultUser, subsidiaries, currencies] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id },
      include: {
        entity: true,
        currency: true,
        purchaseOrders: { orderBy: { createdAt: 'desc' } },
        bills: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.user.findFirst({ where: { email: 'admin@example.com' }, select: { id: true } }),
    prisma.entity.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { currencyId: 'asc' },
      select: { id: true, currencyId: true, name: true },
    }),
  ])

  if (!vendor) notFound()

  const totalSpend = vendor.purchaseOrders.reduce((s, po) => s + (po.total ?? 0), 0)
  const openInvoices = vendor.bills.filter((i) => i.status !== 'paid' && i.status !== 'void')

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/vendors" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Vendors
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{vendor.vendorNumber ?? 'Pending'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{vendor.name}</h1>
            {vendor.taxId && (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Tax ID: {vendor.taxId}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {defaultUser ? <VendorCreateMenu vendorId={vendor.id} userId={defaultUser.id} /> : null}
            <VendorEditButton
              vendorId={vendor.id}
              values={{
                name: vendor.name,
                email: vendor.email ?? '',
                phone: normalizePhone(vendor.phone) ?? '',
                address: vendor.address ?? '',
                taxId: vendor.taxId ?? '',
                primarySubsidiaryId: vendor.entityId ?? '',
                primaryCurrencyId: vendor.currencyId ?? '',
                inactive: vendor.inactive,
              }}
              subsidiaries={subsidiaries}
              currencies={currencies}
            />
            <DeleteButton resource="vendors" id={vendor.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Purchase orders" value={vendor.purchaseOrders.length} />
          <StatCard label="Total spend" value={fmtCurrency(totalSpend)} accent="teal" />
          <StatCard label="Open AP invoices" value={openInvoices.length} accent={openInvoices.length > 0 ? 'yellow' : undefined} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Vendor details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Vendor Id" value={vendor.vendorNumber} />
            <Field label="Email" value={vendor.email} />
            <Field label="Phone" value={fmtPhone(vendor.phone)} />
            <Field label="Address" value={vendor.address} />
            <Field label="Primary Subsidiary" value={vendor.entity ? `${vendor.entity.subsidiaryId} - ${vendor.entity.name}` : null} />
            <Field label="Primary Currency" value={vendor.currency?.currencyId ?? null} />
            <Field label="Vendor since" value={new Date(vendor.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        {/* Purchase Orders */}
        <Section title="Purchase Orders" count={vendor.purchaseOrders.length}>
          {vendor.purchaseOrders.length === 0 ? (
            <EmptyRow message="No purchase orders yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {vendor.purchaseOrders.map((po) => (
                  <tr key={po.id} id={`po-${po.id}`} tabIndex={-1} className="focus:outline-none transition-shadow">
                    <Td>
                      <Link href={`/purchase-orders/${po.id}`} style={{ color: 'var(--accent-primary-strong)' }} className="hover:underline">
                        {po.number}
                      </Link>
                    </Td>
                    <Td>{po.status}</Td>
                    <Td>{fmtCurrency(po.total)}</Td>
                    <Td>{new Date(po.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Bills */}
        {vendor.bills.length > 0 && (
          <Section title="Bills" count={vendor.bills.length}>
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Bill #</Th>
                  <Th>Amount</Th>
                  <Th>Due Date</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {vendor.bills.map((inv) => (
                  <tr key={inv.id}>
                    <Td>
                      <Link href={`/bills/${inv.id}`} style={{ color: 'var(--accent-primary-strong)' }} className="hover:underline">
                        {inv.number}
                      </Link>
                    </Td>
                    <Td>{fmtCurrency(inv.total)}</Td>
                    <Td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</Td>
                    <Td>
                      <StatusBadge status={inv.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(34,197,94,0.16)', color: '#86efac' }}>Paid</span>
  if (status === 'approved') return <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>Approved</span>
  if (status === 'void') return <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(107,114,128,0.18)', color: '#9ca3af' }}>Void</span>
  return <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(245,158,11,0.16)', color: '#fcd34d' }}>Pending</span>
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'teal' | 'yellow' }) {
  const text = accent === 'teal' ? '#5eead4' : accent === 'yellow' ? '#fcd34d' : 'var(--text-muted)'
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: accent ? 'var(--card-elevated)' : 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: text }}>{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{value ?? '—'}</dd>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{count}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function EmptyRow({ message }: { message: string }) {
  return <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</td>
}
