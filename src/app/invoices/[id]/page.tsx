import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import InvoiceActionButton from '@/components/InvoiceActionButton'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      salesOrder: {
        include: {
          quote: {
            include: {
              opportunity: true,
            },
          },
        },
      },
      cashReceipts: {
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!invoice) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/invoices" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Invoices
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{invoice.number}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Invoice for {invoice.customer.name}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status !== 'sent' ? <InvoiceActionButton id={invoice.id} label="Mark Sent" tone="indigo" payload={{ status: 'sent' }} /> : null}
            {invoice.status !== 'paid' ? <InvoiceActionButton id={invoice.id} label="Mark Paid" tone="emerald" payload={{ status: 'paid' }} /> : null}
            {invoice.status !== 'void' ? <InvoiceActionButton id={invoice.id} label="Void" tone="amber" payload={{ status: 'void' }} /> : null}
            {invoice.status !== 'draft' ? <InvoiceActionButton id={invoice.id} label="Reset Draft" tone="gray" payload={{ status: 'draft' }} /> : null}
            <Link href={`/sales-orders/${invoice.salesOrder.id}`} className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
              View sales order
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard label="Invoice total" value={fmtCurrency(invoice.total)} accent />
          <StatCard label="Status" value={invoice.status} />
          <StatCard label="Due date" value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'} />
          <StatCard label="Paid date" value={invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : '—'} />
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Invoice details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice #" value={invoice.number} />
            <Field label="Customer" value={invoice.customer.name} />
            <Field label="Sales Order" value={invoice.salesOrder.number} />
            <Field label="Quote" value={invoice.salesOrder.quote?.number} />
            <Field label="Opportunity" value={invoice.salesOrder.quote?.opportunity?.name} />
            <Field label="Created" value={new Date(invoice.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cash receipts</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Receipts posted against this invoice appear here.</p>
            </div>
            <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{invoice.cashReceipts.length}</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>Method</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {invoice.cashReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No cash receipts posted yet.</td>
                  </tr>
                ) : (
                  invoice.cashReceipts.map((receipt, index) => (
                    <tr key={receipt.id} style={index < invoice.cashReceipts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(receipt.amount)}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(receipt.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{receipt.method}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{receipt.reference ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
    paid: 'bg-emerald-100 text-emerald-700',
    void: 'bg-amber-100 text-amber-700',
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
