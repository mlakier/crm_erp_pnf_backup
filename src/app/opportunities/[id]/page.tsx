import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtPhone } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import OpportunityCreateQuoteButton from '@/components/OpportunityCreateQuoteButton'
import OpportunityLineItemForm from '@/components/OpportunityLineItemForm'

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      quote: true,
      lineItems: {
        orderBy: { createdAt: 'asc' },
        include: { item: true },
      },
      customer: {
        include: {
          contacts: { orderBy: { firstName: 'asc' } },
        },
      },
    },
  })

  const items = await prisma.item.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, listPrice: true, itemId: true },
  })

  if (!opportunity) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/opportunities" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Opportunities
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{opportunity.opportunityNumber ?? 'Pending'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{opportunity.name}</h1>
            <StageBadge stage={opportunity.stage} />
          </div>
          <div className="flex items-center gap-2">
            <OpportunityCreateQuoteButton opportunityId={opportunity.id} existingQuoteId={opportunity.quote?.id} />
            <EditButton
              resource="opportunities"
              id={opportunity.id}
              fields={[
                { name: 'name', label: 'Name', value: opportunity.name },
                { name: 'stage', label: 'Stage', value: opportunity.stage ?? '' },
                { name: 'amount', label: 'Amount', value: opportunity.amount?.toString() ?? '', type: 'number' },
                { name: 'closeDate', label: 'Close Date', value: opportunity.closeDate ? new Date(opportunity.closeDate).toISOString().split('T')[0] : '', type: 'date' },
              ]}
            />
            <DeleteButton resource="opportunities" id={opportunity.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Amount" value={fmtCurrency(opportunity.amount)} accent />
          <StatCard label="Close date" value={opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : '—'} />
          <StatCard label="Line Items" value={opportunity.lineItems.length} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Opportunity details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Opportunity Id" value={opportunity.opportunityNumber} />
            <Field label="Stage" value={opportunity.stage} />
            <Field label="Amount" value={fmtCurrency(opportunity.amount)} />
            <Field label="Close date" value={opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : null} />
            <Field label="Quote" value={opportunity.quote?.number} />
            <Field label="Created" value={new Date(opportunity.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        <div className="mb-8">
          <OpportunityLineItemForm opportunityId={opportunity.id} items={items} />
        </div>

        <div className="mb-8 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Line Items</h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
              {opportunity.lineItems.length}
            </span>
          </div>
          {opportunity.lineItems.length === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No line items yet. Add one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Th>Item</Th>
                    <Th>Description</Th>
                    <Th>Qty</Th>
                    <Th>Unit Price</Th>
                    <Th>Line Total</Th>
                    <Th>Notes</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {opportunity.lineItems.map((line, index) => (
                    <tr key={line.id} style={index < opportunity.lineItems.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <Td>{line.item ? (line.item.itemId ? `${line.item.itemId} - ${line.item.name}` : line.item.name) : '—'}</Td>
                      <Td>{line.description}</Td>
                      <Td>{line.quantity}</Td>
                      <Td>{fmtCurrency(line.unitPrice)}</Td>
                      <Td>{fmtCurrency(line.lineTotal)}</Td>
                      <Td>{line.notes ?? '—'}</Td>
                      <Td>
                        <DeleteButton resource="opportunities/line-items" id={line.id} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-muted)' }}>
                    <td colSpan={4} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-white">{fmtCurrency(opportunity.amount)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {opportunity.quote ? (
          <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-primary-strong)' }}>Generated quote</h2>
                <p className="mt-2 text-lg font-semibold text-white">{opportunity.quote.number}</p>
              </div>
              <Link href={`/quotes/${opportunity.quote.id}`} className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
                Open quote
              </Link>
            </div>
          </div>
        ) : null}

        {/* Customer */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customer</h2>
            <Link href={`/customers/${opportunity.customer.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              View customer →
            </Link>
          </div>
          <p className="text-lg font-semibold text-white">{opportunity.customer.name}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Email" value={opportunity.customer.email} />
            <Field label="Phone" value={fmtPhone(opportunity.customer.phone)} />
            <Field label="Industry" value={opportunity.customer.industry} />
          </dl>
        </div>

        {/* Customer contacts */}
        {opportunity.customer.contacts.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
              <h2 className="text-base font-semibold text-white">Customer contacts</h2>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {opportunity.customer.contacts.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Contact #</Th>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Position</Th>
                  </tr>
                </thead>
                <tbody>
                  {opportunity.customer.contacts.map((c, index) => (
                    <tr key={c.id} style={index < opportunity.customer.contacts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <Td>
                        <Link href={`/contacts/${c.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {c.contactNumber ?? 'Pending'}
                        </Link>
                      </Td>
                      <Td>{c.firstName} {c.lastName}</Td>
                      <Td>{c.email ?? '—'}</Td>
                      <Td>{c.position ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string | null }) {
  const colors: Record<string, string> = {
    prospecting: 'bg-gray-100 text-gray-700',
    qualified: 'bg-blue-100 text-blue-700',
    proposal: 'bg-purple-100 text-purple-700',
    negotiation: 'bg-orange-100 text-orange-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
  }
  const key = (stage ?? '').toLowerCase()
  const cls = colors[key] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-medium ${cls}`}>
      {stage ?? 'Unknown'}
    </span>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: true | 'red' }) {
  const text = accent === true ? 'var(--accent-primary-strong)' : accent === 'red' ? '#fca5a5' : 'var(--text-muted)'
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: accent ? 'var(--card-elevated)' : 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: text }}>{label}</p>
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
