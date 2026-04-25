import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import LeadEditButton from '@/components/LeadEditButton'
import DeleteButton from '@/components/DeleteButton'
import { loadListOptionsForSource } from '@/lib/list-source'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'

function leadName(lead: { firstName: string | null; lastName: string | null; email: string | null }) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return fullName || lead.email || 'Unnamed Lead'
}

function fmtDate(value: Date | null | undefined, moneySettings?: Parameters<typeof fmtDocumentDate>[1]) {
  return value ? fmtDocumentDate(value, moneySettings) : '-'
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { moneySettings } = await loadCompanyDisplaySettings()

  const [lead, entities, currencies, leadSourceOptions, leadRatingOptions, leadStatusOptions] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        currency: true,
        customer: { select: { id: true, name: true, customerId: true } },
        contact: { select: { id: true, firstName: true, lastName: true, contactNumber: true } },
        opportunity: { select: { id: true, name: true, opportunityNumber: true } },
      },
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-LEAD-SRC' }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-LEAD-RAT' }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-LEAD-STATUS' }),
  ])

  if (!lead) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/leads" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Leads
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {lead.leadNumber ?? 'No lead #'}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{leadName(lead)}</h1>
            <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm capitalize" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
              {lead.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LeadEditButton
              leadId={lead.id}
              entities={entities}
              currencies={currencies}
              leadSourceOptions={leadSourceOptions}
              leadRatingOptions={leadRatingOptions}
              leadStatusOptions={leadStatusOptions}
              values={{
                firstName: lead.firstName ?? '',
                lastName: lead.lastName ?? '',
                company: lead.company ?? '',
                email: lead.email ?? '',
                phone: lead.phone ?? '',
                title: lead.title ?? '',
                website: lead.website ?? '',
                industry: lead.industry ?? '',
                status: lead.status ?? 'new',
                source: lead.source ?? '',
                rating: lead.rating ?? '',
                expectedValue: lead.expectedValue?.toString() ?? '',
                entityId: lead.subsidiaryId ?? '',
                currencyId: lead.currencyId ?? '',
                lastContactedAt: lead.lastContactedAt ? new Date(lead.lastContactedAt).toISOString().split('T')[0] : '',
                qualifiedAt: lead.qualifiedAt ? new Date(lead.qualifiedAt).toISOString().split('T')[0] : '',
                convertedAt: lead.convertedAt ? new Date(lead.convertedAt).toISOString().split('T')[0] : '',
                notes: lead.notes ?? '',
                address: lead.address ?? '',
              }}
            />
            <DeleteButton resource="leads" id={lead.id} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Company" value={lead.company ?? '—'} />
          <StatCard label="Source" value={lead.source ?? '—'} />
          <StatCard label="Expected Value" value={lead.expectedValue != null ? lead.expectedValue.toFixed(2) : '—'} />
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Lead details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Lead Id" value={lead.leadNumber} />
            <Field label="Name" value={leadName(lead)} />
            <Field label="Email" value={lead.email} />
            <Field label="Phone" value={lead.phone} />
            <Field label="Company" value={lead.company} />
            <Field label="Title" value={lead.title} />
            <Field label="Status" value={lead.status} />
            <Field label="Source" value={lead.source} />
            <Field label="Rating" value={lead.rating} />
            <Field label="Subsidiary" value={lead.subsidiary ? `${lead.subsidiary.subsidiaryId} – ${lead.subsidiary.name}` : null} />
            <Field label="Currency" value={lead.currency ? `${lead.currency.code} – ${lead.currency.name}` : null} />
            <Field label="Created" value={fmtDate(lead.createdAt, moneySettings)} />
            <Field label="Last Contacted" value={fmtDate(lead.lastContactedAt, moneySettings)} />
            <Field label="Qualified At" value={fmtDate(lead.qualifiedAt, moneySettings)} />
            <Field label="Converted At" value={fmtDate(lead.convertedAt, moneySettings)} />
            <Field label="Website" value={lead.website} />
            <Field label="Industry" value={lead.industry} />
            <Field label="Address" value={lead.address} />
            <Field label="Notes" value={lead.notes} />
          </dl>
        </div>

        <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Related Records</h2>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-3">
            <RelatedLink
              label="Customer"
              href={lead.customer ? `/customers/${lead.customer.id}` : null}
              value={lead.customer ? `${lead.customer.customerId ?? 'Pending'} ${lead.customer.name}` : '—'}
            />
            <RelatedLink
              label="Contact"
              href={lead.contact ? `/contacts/${lead.contact.id}` : null}
              value={lead.contact ? `${lead.contact.contactNumber ?? 'Pending'} ${lead.contact.firstName} ${lead.contact.lastName}` : '—'}
            />
            <RelatedLink
              label="Opportunity"
              href={lead.opportunity ? `/opportunities/${lead.opportunity.id}` : null}
              value={lead.opportunity ? `${lead.opportunity.opportunityNumber ?? 'Pending'} ${lead.opportunity.name}` : '—'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-3 text-lg font-semibold text-white break-words">{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-1 text-sm break-words" style={{ color: 'var(--text-secondary)' }}>{value ?? '—'}</dd>
    </div>
  )
}

function RelatedLink({ label, href, value }: { label: string; href: string | null; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {href ? (
        <Link href={href} className="mt-1 inline-block text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {value}
        </Link>
      ) : (
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{value}</p>
      )}
    </div>
  )
}

