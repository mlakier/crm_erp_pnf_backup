import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [bill, vendors] = await Promise.all([
    prisma.bill.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    }),
    prisma.vendor.findMany({
      orderBy: { name: 'asc' },
      where: { inactive: false },
      select: { id: true, name: true },
    }),
  ])

  if (!bill) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/bills" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Bills
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{bill.number}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Bill for {bill.vendor.name}</h1>
            <BillStatusBadge status={bill.status} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="bills"
              id={bill.id}
              fields={[
                {
                  name: 'vendorId',
                  label: 'Vendor',
                  value: bill.vendorId,
                  type: 'select',
                  options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
                },
                { name: 'total', label: 'Total', value: String(bill.total), type: 'number' },
                { name: 'date', label: 'Bill Date', value: new Date(bill.date).toISOString().split('T')[0], type: 'date' },
                { name: 'dueDate', label: 'Due Date', value: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '', type: 'date' },
                {
                  name: 'status',
                  label: 'Status',
                  value: bill.status,
                  type: 'select',
                  options: [
                    { value: 'received', label: 'Received' },
                    { value: 'pending approval', label: 'Pending Approval' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'void', label: 'Void' },
                  ],
                },
                { name: 'notes', label: 'Notes', value: bill.notes ?? '' },
              ]}
            />
            <DeleteButton resource="bills" id={bill.id} />
            <Link href={`/vendors/${bill.vendor.id}`} className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
              View vendor
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Bill total" value={fmtCurrency(bill.total)} accent />
          <StatCard label="Status" value={bill.status} />
          <StatCard label="Due date" value={bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'} />
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Bill details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Bill #" value={bill.number} />
            <Field label="Vendor" value={bill.vendor.name} />
            <Field label="Bill Date" value={new Date(bill.date).toLocaleDateString()} />
            <Field label="Due Date" value={bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'} />
            <Field label="Status" value={bill.status} />
            <Field label="Created" value={new Date(bill.createdAt).toLocaleDateString()} />
            <Field label="Last Modified" value={new Date(bill.updatedAt).toLocaleDateString()} />
            <Field label="Notes" value={bill.notes ?? '—'} />
          </dl>
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{value ?? '—'}</dd>
    </div>
  )
}

function BillStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    received: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    approved: { bg: 'rgba(16,185,129,0.18)', color: '#10b981' },
    paid: { bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
    void: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
  }

  const style = styles[status] ?? { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' }

  return (
    <span className="mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-medium" style={{ backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  )
}
