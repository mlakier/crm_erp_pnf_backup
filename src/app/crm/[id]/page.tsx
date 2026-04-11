import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import CreateModalButton from '@/components/CreateModalButton'
import CustomerDetailContactForm from '@/components/CustomerDetailContactForm'
import CustomerDetailOpportunityForm from '@/components/CustomerDetailOpportunityForm'
import QuoteCreateFromOpportunityForm from '@/components/QuoteCreateFromOpportunityForm'
import InvoiceCreateFromSalesOrderForm from '@/components/InvoiceCreateFromSalesOrderForm'
import CustomerRelatedDocs from '@/components/CustomerRelatedDocs'
import { fmtCurrency, fmtPhone, normalizePhone } from '@/lib/format'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      entity: true,
      currency: true,
      contacts: { orderBy: { createdAt: 'desc' } },
      opportunities: { orderBy: { createdAt: 'desc' } },
      quotes: { orderBy: { createdAt: 'desc' } },
      salesOrders: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!customer) notFound()

  const pipelineValue = customer.opportunities.reduce((s, o) => s + (o.amount ?? 0), 0)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/crm" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to CRM
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{customer.customerNumber ?? 'Pending'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{customer.name}</h1>
            {customer.industry && (
              <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {customer.industry}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CreateModalButton buttonLabel="Contact" title="Create Contact" buttonClassName="!text-sm !px-3 !py-1.5">
              <CustomerDetailContactForm customerId={customer.id} userId={customer.userId} />
            </CreateModalButton>
            <CreateModalButton buttonLabel="Opportunity" title="Create Opportunity" buttonClassName="!text-sm !px-3 !py-1.5">
              <CustomerDetailOpportunityForm customerId={customer.id} userId={customer.userId} />
            </CreateModalButton>
            <CreateModalButton buttonLabel="Estimate" title="Create Estimate" buttonClassName="!text-sm !px-3 !py-1.5">
              <QuoteCreateFromOpportunityForm
                opportunities={customer.opportunities.map((opportunity) => ({
                  id: opportunity.id,
                  label: `${opportunity.opportunityNumber ?? 'Pending'} - ${opportunity.name}`,
                }))}
              />
            </CreateModalButton>
            <CreateModalButton buttonLabel="Invoice" title="Create Invoice" buttonClassName="!text-sm !px-3 !py-1.5">
              <InvoiceCreateFromSalesOrderForm
                salesOrders={customer.salesOrders.map((salesOrder) => ({
                  id: salesOrder.id,
                  label: salesOrder.number,
                }))}
              />
            </CreateModalButton>
            <EditButton
              resource="customers"
              id={customer.id}
              fields={[
                { name: 'name', label: 'Name', value: customer.name },
                { name: 'email', label: 'Email', value: customer.email ?? '' },
                { name: 'phone', label: 'Phone', value: normalizePhone(customer.phone) ?? '' },
                { name: 'address', label: 'Address', value: customer.address ?? '' },
                { name: 'industry', label: 'Industry', value: customer.industry ?? '' },
                { name: 'primarySubsidiaryId', label: 'Primary Subsidiary Id', value: customer.entityId ?? '' },
                { name: 'primaryCurrencyId', label: 'Primary Currency Id', value: customer.currencyId ?? '' },
              ]}
            />
            <DeleteButton resource="customers" id={customer.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Contacts" value={customer.contacts.length} />
          <StatCard label="Opportunities" value={customer.opportunities.length} />
          <StatCard label="Pipeline value" value={fmtCurrency(pipelineValue)} accent />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customer details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer #" value={customer.customerNumber} />
            <Field label="Email" value={customer.email} />
            <Field label="Phone" value={fmtPhone(customer.phone)} />
            <Field label="Address" value={customer.address} />
            <Field label="Primary Subsidiary" value={customer.entity ? `${customer.entity.code} - ${customer.entity.name}` : null} />
            <Field label="Primary Currency" value={customer.currency?.code ?? null} />
            <Field label="Customer since" value={new Date(customer.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        {/* Contacts */}
        <Section title="Contacts" count={customer.contacts.length}>
          {customer.contacts.length === 0 ? (
            <EmptyRow message="No contacts yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Contact #</Th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Position</Th>
                </tr>
              </thead>
              <tbody>
                {customer.contacts.map((c) => (
                  <tr key={c.id} id={`contact-${c.id}`} tabIndex={-1} className="focus:outline-none transition-shadow">
                    <Td>
                      <Link href={`/contacts/${c.id}`} style={{ color: 'var(--accent-primary-strong)' }} className="hover:underline">
                        {c.contactNumber ?? 'Pending'}
                      </Link>
                    </Td>
                    <Td>{c.firstName} {c.lastName}</Td>
                    <Td>{c.email ?? '—'}</Td>
                    <Td>{fmtPhone(c.phone)}</Td>
                    <Td>{c.position ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Related Documents */}
        <CustomerRelatedDocs
          opportunities={customer.opportunities.map((o) => ({
            id: o.id,
            name: o.name,
            stage: o.stage,
            amount: o.amount,
            closeDate: o.closeDate ? o.closeDate.toISOString() : null,
          }))}
          quotes={customer.quotes.map((q) => ({
            id: q.id,
            number: q.number,
            status: q.status,
            total: q.total,
            validUntil: q.validUntil ? q.validUntil.toISOString() : null,
            createdAt: q.createdAt.toISOString(),
          }))}
          salesOrders={customer.salesOrders.map((so) => ({
            id: so.id,
            number: so.number,
            status: so.status,
            total: so.total,
            createdAt: so.createdAt.toISOString(),
          }))}
          invoices={customer.invoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            total: inv.total,
            dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
            paidDate: inv.paidDate ? inv.paidDate.toISOString() : null,
            createdAt: inv.createdAt.toISOString(),
          }))}
        />

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
