import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import LeadConvertOpportunityForm from '@/components/LeadConvertOpportunityForm'

function leadDisplayName(lead: {
  company: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return lead.company || fullName || lead.email || 'Lead'
}

function opportunityNameFromLead(lead: {
  company: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  title: string | null
}) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  const base = lead.company || fullName || lead.email || 'Converted Lead'
  return lead.title ? `${base} - ${lead.title}` : `${base} Opportunity`
}

export default async function LeadConvertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      leadNumber: true,
      company: true,
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      status: true,
      opportunityId: true,
    },
  })

  if (!lead) notFound()

  if (lead.opportunityId) {
    redirect(`/opportunities/${lead.opportunityId}`)
  }

  if (lead.status !== 'qualified') {
    redirect('/leads')
  }

  const defaultStage = 'qualification'

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-3xl">
        <div className="mb-6">
          <Link href={`/leads/${lead.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            ← Back to Lead
          </Link>
          <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {lead.leadNumber ?? 'No lead #'}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Convert {leadDisplayName(lead)} to Opportunity</h1>
        </div>

        <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <LeadConvertOpportunityForm
            leadId={lead.id}
            defaultName={opportunityNameFromLead(lead)}
            defaultStage={defaultStage}
          />
        </section>
      </div>
    </div>
  )
}