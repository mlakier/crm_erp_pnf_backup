import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtPhone } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import PurchaseOrderLineItemForm from '@/components/PurchaseOrderLineItemForm'
import PurchaseOrderReceiptForm from '@/components/PurchaseOrderReceiptForm'

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { createdAt: 'desc' } },
      vendor: true,
      receipts: { orderBy: { date: 'desc' } },
    },
  })

  if (!po) notFound()

  const orderedQuantity = po.lineItems.reduce((sum, item) => sum + item.quantity, 0)
  const receivedQuantity = po.receipts.reduce((sum, receipt) => sum + receipt.quantity, 0)
  const openQuantity = Math.max(orderedQuantity - receivedQuantity, 0)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/purchase-orders" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Purchase Orders
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">PO #{po.number}</h1>
            <StatusBadge status={po.status} />
          </div>
          <div className="flex items-center gap-2">
            <EditButton
              resource="purchase-orders"
              id={po.id}
              fields={[
                { name: 'status', label: 'Status', value: po.status ?? '' },
                { name: 'total', label: 'Total', value: po.total?.toString() ?? '', type: 'number' },
              ]}
            />
            <DeleteButton resource="purchase-orders" id={po.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard label="Total" value={fmtCurrency(po.total)} accent />
          <StatCard label="Line items" value={po.lineItems.length} />
          <StatCard label="Receipts" value={po.receipts.length} />
          <StatCard label="Open qty" value={openQuantity} />
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <PurchaseOrderLineItemForm purchaseOrderId={po.id} userId={po.userId} />
          <PurchaseOrderReceiptForm purchaseOrderId={po.id} userId={po.userId} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Order details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Purchase Order #" value={po.number} />
            <Field label="Status" value={po.status} />
            <Field label="Total" value={fmtCurrency(po.total)} />
            <Field label="Ordered quantity" value={String(orderedQuantity)} />
            <Field label="Received quantity" value={String(receivedQuantity)} />
            <Field label="Created" value={new Date(po.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        <div className="mb-8 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Line Items</h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{po.lineItems.length}</span>
          </div>
          {po.lineItems.length === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No line items yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th>Qty</Th>
                    <Th>Unit Price</Th>
                    <Th>Line Total</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {po.lineItems.map((item, index) => (
                    <tr key={item.id} id={`line-item-${item.id}`} tabIndex={-1} className="focus:outline-none transition-shadow" style={index < po.lineItems.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <Td>{item.description}</Td>
                      <Td>{item.quantity}</Td>
                      <Td>{fmtCurrency(item.unitPrice)}</Td>
                      <Td>{fmtCurrency(item.lineTotal)}</Td>
                      <Td>
                        <DeleteButton resource="purchase-order-line-items" id={item.id} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vendor */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Vendor</h2>
            <Link href={`/vendors/${po.vendor.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              View vendor →
            </Link>
          </div>
          <p className="text-lg font-semibold text-white">{po.vendor.name}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Email" value={po.vendor.email} />
            <Field label="Phone" value={fmtPhone(po.vendor.phone)} />
            <Field label="Tax ID" value={po.vendor.taxId} />
          </dl>
        </div>

        {/* Receipts */}
        <div className="mb-6 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Receipts</h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{po.receipts.length}</span>
          </div>
          {po.receipts.length === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No receipts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Quantity</Th>
                    <Th>Notes</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {po.receipts.map((r, index) => (
                    <tr key={r.id} id={`receipt-${r.id}`} tabIndex={-1} className="focus:outline-none transition-shadow" style={index < po.receipts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <Td>{new Date(r.date).toLocaleDateString()}</Td>
                      <Td>{r.quantity}</Td>
                      <Td>{r.notes ?? '—'}</Td>
                      <Td>
                        <DeleteButton resource="receipts" id={r.id} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    received: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const key = (status ?? '').toLowerCase()
  return (
    <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-medium ${colors[key] ?? 'bg-gray-100 text-gray-700'}`}>
      {status ?? 'Unknown'}
    </span>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</td>
}
