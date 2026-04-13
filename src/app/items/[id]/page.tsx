import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import { loadListOptions } from '@/lib/list-options-store'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [item, currencies, subsidiaries, listOptions] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: {
        currency: true,
        entity: true,
        purchaseOrderLineItems: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { purchaseOrder: { select: { id: true, number: true, status: true, createdAt: true } } },
        },
      },
    }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.entity.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    loadListOptions(),
  ])

  if (!item) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/items" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Items
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{item.itemNumber ?? 'No item #'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{item.name}</h1>
            {item.itemType && (
              <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm capitalize" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {item.itemType}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="items"
              id={item.id}
              fields={[
                { name: 'name', label: 'Name', value: item.name },
                { name: 'itemNumber', label: 'Item #', value: item.itemNumber ?? '' },
                { name: 'sku', label: 'SKU', value: item.sku ?? '' },
                {
                  name: 'itemType',
                  label: 'Item Type',
                  value: item.itemType,
                  type: 'select',
                  placeholder: 'Select item type',
                  options: listOptions.item.type.map((value) => ({ value, label: value })),
                },
                { name: 'uom', label: 'UOM', value: item.uom ?? '' },
                { name: 'listPrice', label: 'List Price', value: String(item.listPrice), type: 'number' },
                { name: 'currencyId', label: 'Currency', value: item.currencyId ?? '', type: 'select', placeholder: 'Select currency', options: currencies.map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` })) },
                { name: 'entityId', label: 'Subsidiary', value: item.entityId ?? '', type: 'select', placeholder: 'Select subsidiary', options: subsidiaries.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` })) },
                { name: 'description', label: 'Description', value: item.description ?? '' },
                { name: 'inactive', label: 'Inactive', value: String(!item.active), type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
              ]}
            />
            <DeleteButton resource="items" id={item.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="List Price" value={`${item.currency?.code ?? ''} ${item.listPrice.toFixed(2)}`} accent />
          <StatCard label="PO Lines" value={item.purchaseOrderLineItems.length} />
          <StatCard label="Active" value={item.active ? 'Yes' : 'No'} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Item details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Item #" value={item.itemNumber} />
            <Field label="SKU" value={item.sku} />
            <Field label="Name" value={item.name} />
            <Field label="Type" value={item.itemType} />
            <Field label="Unit of Measure" value={item.uom} />
            <Field label="List Price" value={item.listPrice.toFixed(2)} />
            <Field label="Currency" value={item.currency ? `${item.currency.code} – ${item.currency.name}` : null} />
            <Field label="Subsidiary" value={item.entity ? `${item.entity.code} – ${item.entity.name}` : null} />
            <Field label="Description" value={item.description} />
            <Field label="Created" value={new Date(item.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        {/* PO Lines */}
        <Section title="Purchase Order Lines" count={item.purchaseOrderLineItems.length}>
          {item.purchaseOrderLineItems.length === 0 ? (
            <EmptyRow message="No purchase order lines for this item" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>PO #</Th>
                  <Th>Status</Th>
                  <Th>Qty</Th>
                  <Th>Unit Price</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {item.purchaseOrderLineItems.map((line) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/purchase-orders/${line.purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {line.purchaseOrder.number}
                      </Link>
                    </Td>
                    <Td>{line.purchaseOrder.status}</Td>
                    <Td>{line.quantity}</Td>
                    <Td>{line.unitPrice.toFixed(2)}</Td>
                    <Td>{new Date(line.purchaseOrder.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

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
