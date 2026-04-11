import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextContactNumber } from '@/lib/contact-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'

export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({ include: { customer: true } })
    return NextResponse.json(contacts)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phone, position, customerId, userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const missing: string[] = []
    if ((await isFieldRequiredServer('contactCreate', 'firstName')) && !firstName) missing.push('firstName')
    if ((await isFieldRequiredServer('contactCreate', 'lastName')) && !lastName) missing.push('lastName')
    if ((await isFieldRequiredServer('contactCreate', 'email')) && !email) missing.push('email')
    if ((await isFieldRequiredServer('contactCreate', 'phone')) && !phone) missing.push('phone')
    if ((await isFieldRequiredServer('contactCreate', 'customerId')) && !customerId) missing.push('customerId')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const contactNumber = await generateNextContactNumber()

    const contact = await prisma.contact.create({
      data: {
        contactNumber,
        firstName,
        lastName,
        email,
        phone: normalizePhone(phone),
        position,
        customerId,
        userId,
      },
    })

    await logActivity({
      entityType: 'contact',
      entityId: contact.id,
      action: 'create',
      summary: `Created contact ${contact.contactNumber ?? `${contact.firstName} ${contact.lastName}`} ${contact.firstName} ${contact.lastName}`,
      userId,
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })

    const body = await request.json()
    const { firstName, lastName, email, phone, position } = body
    if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })

    const contact = await prisma.contact.update({
      where: { id },
      data: { firstName, lastName, email: email || null, phone: normalizePhone(phone), position: position || null },
    })

    await logActivity({
      entityType: 'contact',
      entityId: contact.id,
      action: 'update',
      summary: `Updated contact ${contact.contactNumber ?? `${contact.firstName} ${contact.lastName}`} ${contact.firstName} ${contact.lastName}`,
      userId: contact.userId,
    })

    return NextResponse.json(contact)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }

    const existing = await prisma.contact.findUnique({ where: { id } })
    await prisma.contact.delete({ where: { id } })

    await logActivity({
      entityType: 'contact',
      entityId: id,
      action: 'delete',
      summary: `Deleted contact ${existing ? `${existing.contactNumber ?? `${existing.firstName} ${existing.lastName}`} ${existing.firstName} ${existing.lastName}` : id}`,
      userId: existing?.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}