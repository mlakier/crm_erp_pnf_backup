import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import RequisitionLineItemForm from '@/components/RequisitionLineItemForm'

export default async function PurchaseRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const req = await prisma.requisition.findUnique({
    where: { id },
    include: {
      vendor: true,
      department: true,
      entity: true,
      currency: true,
      lineItems: { orderBy: { createdAt: 'asc' } },
      purchaseOrder: { select: { id: true, number: true, status: true } },
    },
  })

  if (!req) notFound()

  const items = await prisma.item.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, listPrice: true },
  })

  const vendors = await prisma.vendor.findMany({
    where: { inactive: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  })

  const lineCount = req.lineItems.length

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">

        {/* Back + Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/purchase-requisitions" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Purchase Requisitions
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">{req.number}</h1>
            {req.title ? <p className="mt-1 text-base" style={{ color: 'var(--text-secondary)' }}>{req.title}</p> : null}
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={req.status} />
              <PriorityBadge priority={req.priority} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditButton
              resource="purchase-requisitions"
              id={req.id}
              fields={[
                { name: 'title', label: 'Title', value: req.title ?? '' },
                {
                  name: 'status',
                  label: 'Status',
                  value: req.status,
                  type: 'select',
                  options: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'pending approval', label: 'Pending Approval' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'ordered', label: 'Ordered' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ],
                },
                {
                  name: 'priority',
                  label: 'Priority',
                  value: req.priority,
                  type: 'select',
                  options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                  ],
                },
                {
                  name: 'vendorId',
                  label: 'Preferred Vendor',
                  value: req.vendorId ?? '',
                  type: 'select',
                  placeholder: 'None',
                  options: vendors.map((v) => ({ value: v.id, label: v.name })),
                },
                {
                  name: 'departmentId',
                  label: 'Department',
                  value: req.departmentId ?? '',
                  type: 'select',
                  placeholder: 'None',
                  options: departments.map((d) => ({ value: d.id, label: `${d.code} – ${d.name}` })),
                },
                { name: 'neededByDate', label: 'Needed By', value: req.neededByDate ? new Date(req.neededByDate).toISOString().split('T')[0] : '', type: 'date' },
                { name: 'notes', label: 'Notes', value: req.notes ?? '' },
              ]}
            />
            <DeleteButton resource="purchase-requisitions" id={req.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Total" value={fmtCurrency(req.total)} accent />
          <StatCard label="Line items" value={lineCount} />
          <StatCard label="Status" value={req.status} />
        </div>

        {/* Add Line Item */}
        <div className="mb-8">
          <RequisitionLineItemForm requisitionId={req.id} items={items} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Requisition details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Number" value={req.number} />
            <Field label="Status" value={req.status} />
            <Field label="Priority" value={req.priority} />
            <Field label="Needed by" value={req.neededByDate ? new Date(req.neededByDate).toLocaleDateString() : undefined} />
            <Field label="Department" value={req.department ? `${req.department.code} – ${req.department.name}` : undefined} />
            <Field label="Preferred vendor" value={req.vendor?.name} />
            <Field label="Subsidiary" value={req.entity ? `${req.entity.code} – ${req.entity.name}` : undefined} />
            <Field label="Currency" value={req.currency ? `${req.currency.code} – ${req.currency.name}` : undefined} />
            <Field label="Total" value={fmtCurrency(req.total)} />
            <Field label="Created" value={new Date(req.createdAt).toLocaleDateString()} />
            <Field label="Last modified" value={new Date(req.updatedAt).toLocaleDateString()} />
          </dl>
          {req.description ? (
            <div className="mt-4">
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Description</dt>
              <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{req.description}</dd>
            </div>
          ) : null}
          {req.notes ? (
            <div className="mt-4">
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Notes</dt>
              <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{req.notes}</dd>
            </div>
          ) : null}
        </div>

        {/* Line Items */}
        <div className="mb-8 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Line Items</h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
              {lineCount}
            </span>
          </div>
          {lineCount === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No line items yet. Add one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Th>Description</Th>
                    <Th>Qty</Th>
                    <Th>Unit Price</Th>
                    <Th>Line Total</Th>
                    <Th>Notes</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {req.lineItems.map((item, index) => (
                    <tr
                      key={item.id}
                      id={`req-line-item-${item.id}`}
                      tabIndex={-1}
                      className="focus:outline-none transition-shadow"
                      style={index < req.lineItems.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                    >
                      <Td>{item.description}</Td>
                      <Td>{item.quantity}</Td>
                      <Td>{fmtCurrency(item.unitPrice)}</Td>
                      <Td>{fmtCurrency(item.lineTotal)}</Td>
                      <Td>{item.notes ?? '—'}</Td>
                      <Td>
                        <DeleteButton resource="purchase-requisitions/line-items" id={item.id} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-muted)' }}>
                    <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Total</td>
                    <td className="px-4 py-2 text-sm font-semibold text-white">{fmtCurrency(req.total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Linked PO */}
        {req.purchaseOrder ? (
          <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Linked Purchase Order</h2>
            <div className="flex items-center gap-4">
              <Link href={`/purchase-orders/${req.purchaseOrder.id}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {req.purchaseOrder.number}
              </Link>
              <StatusBadge status={req.purchaseOrder.status} />
            </div>
          </div>
        ) : null}

      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-0.5 text-sm text-white">{value ?? '—'}</dd>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? '' : 'text-white'}`} style={accent ? { color: 'var(--accent-primary-strong)' } : {}}>
        {value}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    draft:              { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)',  color: '#f59e0b' },
    approved:           { bg: 'rgba(16,185,129,0.18)',  color: '#10b981' },
    ordered:            { bg: 'rgba(59,130,246,0.18)',  color: 'var(--accent-primary-strong)' },
    cancelled:          { bg: 'rgba(239,68,68,0.18)',   color: '#ef4444' },
  }
  const s = styles[status] ?? styles.draft
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ backgroundColor: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    low:    { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    medium: { bg: 'rgba(59,130,246,0.18)',  color: 'var(--accent-primary-strong)' },
    high:   { bg: 'rgba(245,158,11,0.18)',  color: '#f59e0b' },
    urgent: { bg: 'rgba(239,68,68,0.18)',   color: '#ef4444' },
  }
  const s = styles[priority] ?? styles.medium
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ backgroundColor: s.bg, color: s.color }}>
      {priority}
    </span>
  )
}
