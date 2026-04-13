import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'

export default async function SubsidiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [entity, currencies, parentEntities] = await Promise.all([
    prisma.entity.findUnique({
      where: { id },
      include: {
        defaultCurrency: true,
        parentEntity: true,
        childEntities: { orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } },
        employees: { orderBy: { lastName: 'asc' }, select: { id: true, firstName: true, lastName: true, title: true, email: true } },
        customers: { orderBy: { name: 'asc' }, select: { id: true, name: true, customerId: true } },
        vendors: { orderBy: { name: 'asc' }, select: { id: true, name: true, vendorNumber: true } },
      },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.entity.findMany({
      where: { NOT: { id } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
  ])

  if (!entity) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/subsidiaries" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Subsidiaries
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{entity.code}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{entity.name}</h1>
            {entity.entityType && (
              <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {entity.entityType}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="entities"
              id={entity.id}
              fields={[
                { name: 'code', label: 'Code', value: entity.code },
                { name: 'name', label: 'Name', value: entity.name },
                {
                  name: 'parentEntityId',
                  label: 'Parent Subsidiary',
                  value: entity.parentEntityId ?? '',
                  type: 'select',
                  placeholder: 'Select parent subsidiary',
                  options: parentEntities.map((candidate) => ({ value: candidate.id, label: `${candidate.code} - ${candidate.name}` })),
                },
                { name: 'legalName', label: 'Legal Name', value: entity.legalName ?? '' },
                { name: 'entityType', label: 'Type', value: entity.entityType ?? '' },
                { name: 'taxId', label: 'Tax ID', value: entity.taxId ?? '' },
                { name: 'registrationNumber', label: 'Registration #', value: entity.registrationNumber ?? '' },
                {
                  name: 'defaultCurrencyId',
                  label: 'Default Currency',
                  value: entity.defaultCurrencyId ?? '',
                  type: 'select',
                  placeholder: 'Select currency',
                  options: currencies.map((currency) => ({
                    value: currency.id,
                    label: `${currency.code} - ${currency.name}`,
                  })),
                },
                {
                  name: 'inactive',
                  label: 'Inactive',
                  value: String(!entity.active),
                  type: 'select',
                  options: [
                    { value: 'false', label: 'No' },
                    { value: 'true', label: 'Yes' },
                  ],
                },
              ]}
            />
            <DeleteButton resource="entities" id={entity.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Employees" value={entity.employees.length} />
          <StatCard label="Customers" value={entity.customers.length} />
          <StatCard label="Vendors" value={entity.vendors.length} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Subsidiary details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" value={entity.code} />
            <Field label="Name" value={entity.name} />
            <Field label="Parent Subsidiary" value={entity.parentEntity ? `${entity.parentEntity.code} – ${entity.parentEntity.name}` : null} />
            <Field label="Legal Name" value={entity.legalName} />
            <Field label="Type" value={entity.entityType} />
            <Field label="Tax ID" value={entity.taxId} />
            <Field label="Registration #" value={entity.registrationNumber} />
            <Field label="Default Currency" value={entity.defaultCurrency ? `${entity.defaultCurrency.code} – ${entity.defaultCurrency.name}` : null} />
            <Field label="Active" value={entity.active ? 'Yes' : 'No'} />
            <Field label="Created" value={new Date(entity.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        <Section title="Child Subsidiaries" count={entity.childEntities.length}>
          {entity.childEntities.length === 0 ? (
            <EmptyRow message="No child subsidiaries" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {entity.childEntities.map((child) => (
                  <tr key={child.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/subsidiaries/${child.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {child.code}
                      </Link>
                    </Td>
                    <Td>{child.name}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Employees */}
        <Section title="Employees" count={entity.employees.length}>
          {entity.employees.length === 0 ? (
            <EmptyRow message="No employees in this subsidiary" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Title</Th>
                  <Th>Email</Th>
                </tr>
              </thead>
              <tbody>
                {entity.employees.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/employees/${e.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {e.firstName} {e.lastName}
                      </Link>
                    </Td>
                    <Td>{e.title ?? '—'}</Td>
                    <Td>{e.email ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Customers */}
        <Section title="Customers" count={entity.customers.length}>
          {entity.customers.length === 0 ? (
            <EmptyRow message="No customers in this subsidiary" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Customer #</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {entity.customers.map((c) => (
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
        <Section title="Vendors" count={entity.vendors.length}>
          {entity.vendors.length === 0 ? (
            <EmptyRow message="No vendors in this subsidiary" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Vendor #</Th>
                  <Th>Name</Th>
                </tr>
              </thead>
              <tbody>
                {entity.vendors.map((v) => (
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
