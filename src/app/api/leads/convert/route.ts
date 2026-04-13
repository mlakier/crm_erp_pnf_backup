import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { normalizePhone } from '@/lib/format'
import { formatCustomerNumber } from '@/lib/customer-number'
import { formatContactNumber } from '@/lib/contact-number'
import { formatOpportunityNumber } from '@/lib/opportunity-number'

function leadDisplayName(lead: {
  leadNumber?: string | null
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return lead.company || fullName || lead.email || lead.leadNumber || 'lead'
}

function opportunityNameFromLead(lead: {
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  title?: string | null
}) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  const base = lead.company || fullName || lead.email || 'Converted Lead'
  return lead.title ? `${base} - ${lead.title}` : `${base} Opportunity`
}

function customerNameFromLead(lead: {
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return lead.company || fullName || lead.email || 'Converted Lead Customer'
}

async function getNextSequenceNumber(
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  model: 'customer' | 'contact' | 'opportunity',
  field: 'customerId' | 'contactNumber' | 'opportunityNumber',
  prefix: string
) {
  let raw: string | null | undefined

  if (model === 'customer' && field === 'customerId') {
    const latest = await tx.customer.findFirst({
      where: { customerId: { not: null } },
      orderBy: { customerId: 'desc' },
      select: { customerId: true },
    })
    raw = latest?.customerId
  } else if (model === 'contact' && field === 'contactNumber') {
    const latest = await tx.contact.findFirst({
      where: { contactNumber: { not: null } },
      orderBy: { contactNumber: 'desc' },
      select: { contactNumber: true },
    })
    raw = latest?.contactNumber
  } else if (model === 'opportunity' && field === 'opportunityNumber') {
    const latest = await tx.opportunity.findFirst({
      where: { opportunityNumber: { not: null } },
      orderBy: { opportunityNumber: 'desc' },
      select: { opportunityNumber: true },
    })
    raw = latest?.opportunityNumber
  } else {
    throw new Error(`Invalid sequence selector: ${model}.${field}`)
  }

  const latestSequence = raw ? Number.parseInt(raw.replace(prefix, ''), 10) : 0
  return Number.isNaN(latestSequence) ? 1 : latestSequence + 1
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('id')
    const body = await request.json().catch(() => ({}))
    const { name, amount, stage, closeDate } = body as {
      name?: string
      amount?: string | number | null
      stage?: string
      closeDate?: string | null
    }

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (lead.opportunityId) {
      return NextResponse.json(
        { error: 'Lead is already converted', opportunityId: lead.opportunityId },
        { status: 409 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      let customerId = lead.customerId

      if (!customerId) {
        const existingCustomer = lead.email
          ? await tx.customer.findFirst({
              where: { userId: lead.userId, email: lead.email },
              select: { id: true },
            })
          : lead.company
            ? await tx.customer.findFirst({
                where: { userId: lead.userId, name: lead.company },
                select: { id: true },
              })
            : null

        if (existingCustomer) {
          customerId = existingCustomer.id
        } else {
          const customerSequence = await getNextSequenceNumber(tx, 'customer', 'customerId', 'CUST-')
          const customer = await tx.customer.create({
            data: {
              customerId: formatCustomerNumber(customerSequence),
              name: customerNameFromLead(lead),
              email: lead.email || null,
              phone: normalizePhone(lead.phone),
              address: lead.address || null,
              industry: lead.industry || null,
              entityId: lead.entityId || null,
              currencyId: lead.currencyId || null,
              userId: lead.userId,
            },
            select: { id: true },
          })
          customerId = customer.id
        }
      }

      if (!customerId) {
        throw new Error('Failed to resolve customer for conversion')
      }

      let contactId = lead.contactId
      if (!contactId && (lead.firstName || lead.lastName || lead.email)) {
        const contactSequence = await getNextSequenceNumber(tx, 'contact', 'contactNumber', 'CONT-')
        const contact = await tx.contact.create({
          data: {
            contactNumber: formatContactNumber(contactSequence),
            firstName: lead.firstName || 'Primary',
            lastName: lead.lastName || 'Contact',
            email: lead.email || null,
            phone: normalizePhone(lead.phone),
            position: lead.title || null,
            customerId,
            userId: lead.userId,
          },
          select: { id: true },
        })
        contactId = contact.id
      }

      const opportunitySequence = await getNextSequenceNumber(
        tx,
        'opportunity',
        'opportunityNumber',
        'OPP-'
      )

      const parsedAmount =
        amount === '' || amount == null
          ? null
          : Number.isNaN(Number(amount))
            ? null
            : Number(amount)

      const opportunity = await tx.opportunity.create({
        data: {
          opportunityNumber: formatOpportunityNumber(opportunitySequence),
          name: (name || '').trim() || opportunityNameFromLead(lead),
          amount: parsedAmount,
          stage: stage || (lead.status === 'qualified' ? 'qualification' : 'prospecting'),
          closeDate: closeDate ? new Date(closeDate) : null,
          entityId: lead.entityId || null,
          currencyId: lead.currencyId || null,
          customerId,
          userId: lead.userId,
        },
        select: { id: true, opportunityNumber: true, name: true },
      })

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: 'converted',
          convertedAt: new Date(),
          qualifiedAt: lead.qualifiedAt ?? new Date(),
          opportunityId: opportunity.id,
          customerId,
          contactId: contactId || null,
        },
        select: { id: true, leadNumber: true },
      })

      return { opportunity, updatedLead, customerId, contactId }
    })

    await Promise.all([
      logActivity({
        entityType: 'lead',
        entityId: lead.id,
        action: 'update',
        summary: `Converted lead ${lead.leadNumber ?? leadDisplayName(lead)} to opportunity ${result.opportunity.opportunityNumber ?? result.opportunity.name}`,
        userId: lead.userId,
      }),
      logActivity({
        entityType: 'opportunity',
        entityId: result.opportunity.id,
        action: 'create',
        summary: `Created opportunity ${result.opportunity.opportunityNumber ?? result.opportunity.name} from lead ${lead.leadNumber ?? leadDisplayName(lead)}`,
        userId: lead.userId,
      }),
    ])

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      opportunityId: result.opportunity.id,
      opportunityNumber: result.opportunity.opportunityNumber,
      customerId: result.customerId,
      contactId: result.contactId,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 })
  }
}