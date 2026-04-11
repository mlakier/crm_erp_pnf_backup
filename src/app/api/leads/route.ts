import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextLeadNumber } from '@/lib/lead-number'
import { normalizePhone } from '@/lib/format'

function resolveLeadLabel(lead: {
  leadNumber?: string | null
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const personName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return lead.company || personName || lead.email || lead.leadNumber || 'lead'
}

function hasLeadIdentity(body: {
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const personName = [body.firstName, body.lastName].filter(Boolean).join(' ').trim()
  return Boolean(body.company || personName || body.email)
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        entity: true,
        currency: true,
        customer: true,
        contact: true,
        opportunity: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(leads)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      title,
      website,
      industry,
      address,
      status,
      source,
      rating,
      notes,
      expectedValue,
      entityId,
      currencyId,
      userId,
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!hasLeadIdentity({ company, firstName, lastName, email })) {
      return NextResponse.json({ error: 'Company, contact name, or email is required' }, { status: 400 })
    }

    const leadNumber = await generateNextLeadNumber()

    const lead = await prisma.lead.create({
      data: {
        leadNumber,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: normalizePhone(phone),
        company: company || null,
        title: title || null,
        website: website || null,
        industry: industry || null,
        address: address || null,
        status: status || 'new',
        source: source || null,
        rating: rating || null,
        notes: notes || null,
        expectedValue: expectedValue === '' || expectedValue == null ? null : Number(expectedValue),
        entityId: entityId || null,
        currencyId: currencyId || null,
        userId,
      },
    })

    await logActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'create',
      summary: `Created lead ${lead.leadNumber ?? resolveLeadLabel(lead)} ${resolveLeadLabel(lead)}`,
      userId,
    })

    return NextResponse.json(lead, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })

    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      title,
      website,
      industry,
      address,
      status,
      source,
      rating,
      notes,
      expectedValue,
      entityId,
      currencyId,
      qualifiedAt,
      convertedAt,
      lastContactedAt,
    } = body

    if (!hasLeadIdentity({ company, firstName, lastName, email })) {
      return NextResponse.json({ error: 'Company, contact name, or email is required' }, { status: 400 })
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: normalizePhone(phone),
        company: company || null,
        title: title || null,
        website: website || null,
        industry: industry || null,
        address: address || null,
        status: status || 'new',
        source: source || null,
        rating: rating || null,
        notes: notes || null,
        expectedValue: expectedValue === '' || expectedValue == null ? null : Number(expectedValue),
        entityId: entityId || null,
        currencyId: currencyId || null,
        qualifiedAt: qualifiedAt ? new Date(qualifiedAt) : null,
        convertedAt: convertedAt ? new Date(convertedAt) : null,
        lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null,
      },
    })

    await logActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'update',
      summary: `Updated lead ${lead.leadNumber ?? resolveLeadLabel(lead)} ${resolveLeadLabel(lead)}`,
      userId: lead.userId,
    })

    return NextResponse.json(lead)
  } catch {
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })

    const existing = await prisma.lead.findUnique({ where: { id } })
    await prisma.lead.delete({ where: { id } })

    await logActivity({
      entityType: 'lead',
      entityId: id,
      action: 'delete',
      summary: `Deleted lead ${existing ? resolveLeadLabel(existing) : id}`,
      userId: existing?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}