import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'

export default async function CurrencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currency = await prisma.currency.findUnique({
    where: { id },
    include: {
      entities: { orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } },
      customers: { orderBy: { name: 'asc' }, select: { id: true, name: true, customerId: true } },
      vendors: { orderBy: { name: 'asc' }, select: { id: true, name: true, vendorNumber: true } },
    },
  })

  if (!currency) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/currencies" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Currencies
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{currency.code}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{currency.name}</h1>
            {currency.symbol && (
              <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {currency.symbol}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="currencies"
              id={currency.id}
              fields={[
                { name: 'code', label: 'Code', value: currency.code },
                { name: 'name', label: 'Name', value: currency.name },
                { name: 'symbol', label: 'Symbol', value: currency.symbol ?? '' },
                { name: 'decimals', label: 'Decimal Places', value: String(currency.decimals), type: 'number' },
                {
                  name: 'isBase',
                  label: 'Base Currency',
                  value: String(currency.isBase),
                  type: 'select',
                  options: [
                    { value: 'false', label: 'No' },
                    { value: 'true', label: 'Yes' },
                  ],
                },
                {
                  name: 'inactive',
                  label: 'Inactive',
                  value: String(!currency.active),
                  type: 'select',
                  options: [
                    { value: 'false', label: 'No' },
                    { value: 'true', label: 'Yes' },
                  ],
                },
              ]}
            />
            <DeleteButton resource="currencies" id={currency.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Subsidiaries" value={currency.entities.length} />
          <StatCard label="Customers" value={currency.customers.length} />
          <StatCard label="Vendors" value={currency.vendors.length} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Currency details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" value={currency.code} />
            <Field label="Name" value={currency.name} />
            <Field label="Symbol" value={currency.symbol} />
            <Field label="Decimal Places" value={String(currency.decimals)} />
            <Field label="Base Currency" value={currency.isBase ? 'Yes' : 'No'} />
            <Field label="Active" value={currency.active ? 'Yes' : 'No'} />
            <Field label="Created" value={new Date(currency.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        {/* Subsidiaries using this currency */}
        <Section title="Subsidiaries (Default Currency)" count={currency.entities.length}>
          {currency.entities.length === 0 ? (
            <EmptyRow message="No subsidiaries use this as default currency" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {currency.entities.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/subsidiaries/${e.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {e.code}
                      </Link>
                    </Td>
                    <Td>{e.name}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Customers */}
        <Section title="Customers" count={currency.customers.length}>
          {currency.customers.length === 0 ? (
            <EmptyRow message="No customers with this primary currency" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Customer #</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {currency.customers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/customers/${c.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {c.customerId ?? 'Pending'}
                      </Link>
                    </Td>
                    <Td>{c.name}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Vendors */}
        <Section title="Vendors" count={currency.vendors.length}>
          {currency.vendors.length === 0 ? (
            <EmptyRow message="No vendors with this primary currency" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Vendor #</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {currency.vendors.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/vendors/${v.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {v.vendorNumber ?? 'Pending'}
                      </Link>
                    </Td>
                    <Td>{v.name}</Td>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
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
