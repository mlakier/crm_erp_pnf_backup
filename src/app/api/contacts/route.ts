import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextContactNumber } from '@/lib/contact-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'

function normalizeBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({ include: { customer: true, vendor: true } })
    return NextResponse.json(contacts)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phone, address, position, customerId, vendorId, userId } = body
    const inactive = normalizeBoolean(body?.inactive)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const missing: string[] = []
    if ((await isFieldRequiredServer('contactCreate', 'firstName')) && !firstName) missing.push('firstName')
    if ((await isFieldRequiredServer('contactCreate', 'lastName')) && !lastName) missing.push('lastName')
    if ((await isFieldRequiredServer('contactCreate', 'email')) && !email) missing.push('email')
    if ((await isFieldRequiredServer('contactCreate', 'phone')) && !phone) missing.push('phone')
    if ((await isFieldRequiredServer('contactCreate', 'address')) && !address) missing.push('address')
    if ((await isFieldRequiredServer('contactCreate', 'position')) && !position) missing.push('position')
    if ((await isFieldRequiredServer('contactCreate', 'customerId')) && !customerId) missing.push('customerId')
    if ((await isFieldRequiredServer('contactCreate', 'vendorId')) && !vendorId) missing.push('vendorId')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    if ((customerId && vendorId) || (!customerId && !vendorId)) {
      return NextResponse.json({ error: 'Contact must be linked to either a customer or a vendor' }, { status: 400 })
    }

    const contactNumber = await generateNextContactNumber()

    const contact = await prisma.contact.create({
      data: {
        contactNumber,
        firstName,
        lastName,
        email,
        phone: normalizePhone(phone),
        address: address || null,
        position,
        isPrimaryForCustomer: normalizeBoolean(body?.isPrimaryForCustomer),
        receivesQuotesSalesOrders: normalizeBoolean(body?.receivesQuotesSalesOrders),
        receivesInvoices: normalizeBoolean(body?.receivesInvoices),
        receivesInvoiceCc: normalizeBoolean(body?.receivesInvoiceCc),
        active: !inactive,
        customerId: customerId || null,
        vendorId: vendorId || null,
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
  } catch {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })

    const body = await request.json()
    const { firstName, lastName, email, phone, address, position, customerId, vendorId } = body
    const inactive = body?.inactive !== undefined
      ? normalizeBoolean(body.inactive)
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? normalizeBoolean(body.active)
        : undefined
    if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })

    const existing = await prisma.contact.findUnique({
      where: { id },
      select: { customerId: true, vendorId: true, userId: true, contactNumber: true, firstName: true, lastName: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const normalizedCustomerId =
      body.customerId !== undefined
        ? customerId || null
        : existing.customerId
    const normalizedVendorId =
      body.vendorId !== undefined
        ? vendorId || null
        : existing.vendorId

    if ((normalizedCustomerId && normalizedVendorId) || (!normalizedCustomerId && !normalizedVendorId)) {
      return NextResponse.json({ error: 'Contact must be linked to either a customer or a vendor' }, { status: 400 })
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: normalizePhone(phone),
        address: address || null,
        position: position || null,
        customerId: normalizedCustomerId,
        vendorId: normalizedVendorId,
        ...(body.isPrimaryForCustomer !== undefined ? { isPrimaryForCustomer: normalizeBoolean(body.isPrimaryForCustomer) } : {}),
        ...(body.receivesQuotesSalesOrders !== undefined ? { receivesQuotesSalesOrders: normalizeBoolean(body.receivesQuotesSalesOrders) } : {}),
        ...(body.receivesInvoices !== undefined ? { receivesInvoices: normalizeBoolean(body.receivesInvoices) } : {}),
        ...(body.receivesInvoiceCc !== undefined ? { receivesInvoiceCc: normalizeBoolean(body.receivesInvoiceCc) } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    await logActivity({
      entityType: 'contact',
      entityId: contact.id,
      action: 'update',
      summary: `Updated contact ${contact.contactNumber ?? `${contact.firstName} ${contact.lastName}`} ${contact.firstName} ${contact.lastName}`,
      userId: existing.userId,
    })

    return NextResponse.json(contact)
  } catch {
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
  } catch {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}
