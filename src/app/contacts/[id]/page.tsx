import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtPhone, normalizePhone } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          opportunities: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      },
      user: true,
    },
  })

  if (!contact) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/contacts" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Contacts
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{contact.contactNumber ?? 'Pending'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              {contact.firstName} {contact.lastName}
            </h1>
            {contact.position ? (
              <span className="mt-2 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {contact.position}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <EditButton
              resource="contacts"
              id={contact.id}
              fields={[
                { name: 'firstName', label: 'First Name', value: contact.firstName },
                { name: 'lastName', label: 'Last Name', value: contact.lastName },
                { name: 'email', label: 'Email', value: contact.email ?? '' },
                { name: 'phone', label: 'Phone', value: normalizePhone(contact.phone) ?? '' },
                { name: 'position', label: 'Position', value: contact.position ?? '' },
                {
                  name: 'inactive',
                  label: 'Inactive',
                  value: String(!contact.active),
                  type: 'select',
                  options: [
                    { value: 'false', label: 'No' },
                    { value: 'true', label: 'Yes' },
                  ],
                },
              ]}
            />
            <DeleteButton resource="contacts" id={contact.id} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Customer" value={contact.customer.name} />
          <StatCard label="Owner" value={contact.user.name ?? contact.user.email} />
          <StatCard label="Open opportunities" value={contact.customer.opportunities.length} accent />
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Contact details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact Id" value={contact.contactNumber} />
            <Field label="Email" value={contact.email} />
            <Field label="Phone" value={fmtPhone(contact.phone)} />
            <Field label="Position" value={contact.position} />
            <Field label="Inactive" value={contact.active ? 'No' : 'Yes'} />
            <Field label="Created" value={new Date(contact.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Linked customer</h2>
            <Link href={`/customers/${contact.customer.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              View customer →
            </Link>
          </div>
          <p className="text-lg font-semibold text-white">{contact.customer.name}</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Industry" value={contact.customer.industry} />
            <Field label="Customer email" value={contact.customer.email} />
            <Field label="Customer phone" value={fmtPhone(contact.customer.phone)} />
            <Field label="Address" value={contact.customer.address} />
          </dl>
        </div>

        <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Recent customer opportunities</h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
              {contact.customer.opportunities.length}
            </span>
          </div>
          {contact.customer.opportunities.length === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No opportunities for this customer yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Stage</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Close Date</th>
                  </tr>
                </thead>
                <tbody>
                  {contact.customer.opportunities.map((opportunity, index) => (
                    <tr key={opportunity.id} style={index < contact.customer.opportunities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <Link href={`/opportunities/${opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {opportunity.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{opportunity.stage}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(opportunity.amount)}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : '—'}</td>
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
