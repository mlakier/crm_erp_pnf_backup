import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import RecordStatusButton from '@/components/RecordStatusButton'
import SalesOrderCreateInvoiceButton from '@/components/SalesOrderCreateInvoiceButton'

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      quote: {
        include: {
          opportunity: true,
        },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!salesOrder) notFound()

  const latestInvoice = salesOrder.invoices[0]

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/sales-orders" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Sales Orders
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{salesOrder.number}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Sales Order for {salesOrder.customer.name}</h1>
            <StatusBadge status={salesOrder.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {salesOrder.status !== 'booked' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="booked" label="Book Order" tone="blue" /> : null}
            {salesOrder.status !== 'fulfilled' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="fulfilled" label="Mark Fulfilled" tone="emerald" /> : null}
            {salesOrder.status !== 'cancelled' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="cancelled" label="Cancel" tone="red" /> : null}
            {salesOrder.status !== 'draft' ? <RecordStatusButton resource="sales-orders" id={salesOrder.id} status="draft" label="Reset Draft" tone="gray" /> : null}
            <SalesOrderCreateInvoiceButton salesOrderId={salesOrder.id} existingInvoiceId={latestInvoice?.id} />
            {salesOrder.quote ? (
              <Link href={`/quotes/${salesOrder.quote.id}`} className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                View quote
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard label="Order total" value={fmtCurrency(salesOrder.total)} accent />
          <StatCard label="Status" value={salesOrder.status} />
          <StatCard label="Created" value={new Date(salesOrder.createdAt).toLocaleDateString()} />
          <StatCard label="Invoice" value={latestInvoice?.number ?? 'None'} />
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sales order details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Sales Order #" value={salesOrder.number} />
            <Field label="Customer" value={salesOrder.customer.name} />
            <Field label="Quote" value={salesOrder.quote?.number} />
            <Field label="Opportunity" value={salesOrder.quote?.opportunity?.name} />
          </dl>
        </div>

        {latestInvoice ? (
          <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-primary-strong)' }}>Generated invoice</h2>
                <p className="mt-2 text-lg font-semibold text-white">{latestInvoice.number}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Status: {latestInvoice.status}</p>
              </div>
              <Link href={`/invoices/${latestInvoice.id}`} className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
                Open invoice
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: accent ? 'var(--card-elevated)' : 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: accent ? 'var(--accent-primary-strong)' : 'var(--text-muted)' }}>{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    booked: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const key = (status ?? '').toLowerCase()
  return (
    <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-medium ${colors[key] ?? 'bg-gray-100 text-gray-700'}`}>
      {status ?? 'Unknown'}
    </span>
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