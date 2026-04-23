import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import QuoteCreateSalesOrderButton from '@/components/QuoteCreateSalesOrderButton'
import RecordStatusButton from '@/components/RecordStatusButton'

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      opportunity: true,
      salesOrder: true,
    },
  })

  if (!quote) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/quotes" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Quotes
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{quote.number}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Quote for {quote.customer.name}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quote.status !== 'sent' ? <RecordStatusButton resource="quotes" id={quote.id} status="sent" label="Mark Sent" tone="indigo" /> : null}
            {quote.status !== 'expired' ? <RecordStatusButton resource="quotes" id={quote.id} status="expired" label="Expire" tone="amber" /> : null}
            {quote.status !== 'draft' ? <RecordStatusButton resource="quotes" id={quote.id} status="draft" label="Reopen Draft" tone="gray" /> : null}
            <QuoteCreateSalesOrderButton quoteId={quote.id} existingSalesOrderId={quote.salesOrder?.id} />
            {quote.opportunity ? (
              <Link href={`/opportunities/${quote.opportunity.id}`} className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                View opportunity
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Quote total" value={fmtCurrency(quote.total)} accent />
          <StatCard label="Valid until" value={quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'} />
          <StatCard label="Status" value={quote.status} />
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Quote details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Quote Id" value={quote.number} />
            <Field label="Customer" value={quote.customer.name} />
            <Field label="Opportunity" value={quote.opportunity?.name} />
            <Field label="Sales Order" value={quote.salesOrder?.number} />
            <Field label="Created" value={new Date(quote.createdAt).toLocaleDateString()} />
            <Field label="Notes" value={quote.notes} />
          </dl>
        </div>

        {quote.salesOrder ? (
          <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-primary-strong)' }}>Generated sales order</h2>
                <p className="mt-2 text-lg font-semibold text-white">{quote.salesOrder.number}</p>
              </div>
              <Link href={`/sales-orders/${quote.salesOrder.id}`} className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
                Open sales order
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
    sent: 'bg-indigo-100 text-indigo-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-amber-100 text-amber-700',
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
