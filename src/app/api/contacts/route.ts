import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { generateNextContactNumber } from '@/lib/contact-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'

function normalizeBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

async function wouldLeaveSourceWithoutContacts({
  existingCustomerId,
  existingVendorId,
  nextCustomerId,
  nextVendorId,
}: {
  existingCustomerId: string | null
  existingVendorId: string | null
  nextCustomerId: string | null
  nextVendorId: string | null
}) {
  if (existingCustomerId && existingCustomerId !== nextCustomerId) {
    const remainingCustomerContacts = await prisma.contact.count({ where: { customerId: existingCustomerId } })
    if (remainingCustomerContacts <= 1) {
      return 'Customers must keep at least one contact.'
    }
  }

  if (existingVendorId && existingVendorId !== nextVendorId) {
    const remainingVendorContacts = await prisma.contact.count({ where: { vendorId: existingVendorId } })
    if (remainingVendorContacts <= 1) {
      return 'Vendors must keep at least one contact.'
    }
  }

  return null
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
    await logRecordSnapshotActivities({
      entityType: 'contact',
      entityId: contact.id,
      userId,
      action: 'create',
      context: 'Contact Details',
      fields: [
        { fieldName: 'Business Id', value: contact.contactNumber },
        { fieldName: 'First Name', value: contact.firstName },
        { fieldName: 'Last Name', value: contact.lastName },
        { fieldName: 'Email', value: contact.email },
        { fieldName: 'Phone', value: contact.phone },
        { fieldName: 'Address', value: contact.address },
        { fieldName: 'Position', value: contact.position },
        { fieldName: 'Customer', value: contact.customerId },
        { fieldName: 'Vendor', value: contact.vendorId },
        { fieldName: 'Primary for Customer', value: contact.isPrimaryForCustomer },
        { fieldName: 'Receives Quotes / Sales Orders', value: contact.receivesQuotesSalesOrders },
        { fieldName: 'Receives Invoices', value: contact.receivesInvoices },
        { fieldName: 'Receives Invoice CC', value: contact.receivesInvoiceCc },
        { fieldName: 'Active', value: contact.active },
      ],
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
      select: {
        customerId: true,
        vendorId: true,
        userId: true,
        contactNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        position: true,
        isPrimaryForCustomer: true,
        receivesQuotesSalesOrders: true,
        receivesInvoices: true,
        receivesInvoiceCc: true,
        active: true,
      },
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

    const sourceValidationError = await wouldLeaveSourceWithoutContacts({
      existingCustomerId: existing.customerId,
      existingVendorId: existing.vendorId,
      nextCustomerId: normalizedCustomerId,
      nextVendorId: normalizedVendorId,
    })
    if (sourceValidationError) {
      return NextResponse.json({ error: sourceValidationError }, { status: 400 })
    }

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
    await logFieldChangeActivities({
      entityType: 'contact',
      entityId: contact.id,
      userId: existing.userId ?? null,
      context: 'Contact Details',
      changes: [
        { fieldName: 'First Name', oldValue: existing.firstName, newValue: contact.firstName },
        { fieldName: 'Last Name', oldValue: existing.lastName, newValue: contact.lastName },
        { fieldName: 'Email', oldValue: existing.email, newValue: contact.email },
        { fieldName: 'Phone', oldValue: existing.phone, newValue: contact.phone },
        { fieldName: 'Address', oldValue: existing.address, newValue: contact.address },
        { fieldName: 'Position', oldValue: existing.position, newValue: contact.position },
        { fieldName: 'Customer', oldValue: existing.customerId, newValue: contact.customerId },
        { fieldName: 'Vendor', oldValue: existing.vendorId, newValue: contact.vendorId },
        { fieldName: 'Primary for Customer', oldValue: existing.isPrimaryForCustomer, newValue: contact.isPrimaryForCustomer },
        { fieldName: 'Receives Quotes / Sales Orders', oldValue: existing.receivesQuotesSalesOrders, newValue: contact.receivesQuotesSalesOrders },
        { fieldName: 'Receives Invoices', oldValue: existing.receivesInvoices, newValue: contact.receivesInvoices },
        { fieldName: 'Receives Invoice CC', oldValue: existing.receivesInvoiceCc, newValue: contact.receivesInvoiceCc },
        { fieldName: 'Active', oldValue: existing.active, newValue: contact.active },
      ],
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
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const sourceValidationError = await wouldLeaveSourceWithoutContacts({
      existingCustomerId: existing.customerId,
      existingVendorId: existing.vendorId,
      nextCustomerId: null,
      nextVendorId: null,
    })
    if (sourceValidationError) {
      return NextResponse.json({ error: sourceValidationError }, { status: 400 })
    }

    await prisma.contact.delete({ where: { id } })

    await logActivity({
      entityType: 'contact',
      entityId: id,
      action: 'delete',
      summary: `Deleted contact ${existing ? `${existing.contactNumber ?? `${existing.firstName} ${existing.lastName}`} ${existing.firstName} ${existing.lastName}` : id}`,
      userId: existing?.userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'contact',
      entityId: id,
      userId: existing.userId ?? null,
      action: 'delete',
      context: 'Contact Details',
      fields: [
        { fieldName: 'Business Id', value: existing.contactNumber },
        { fieldName: 'First Name', value: existing.firstName },
        { fieldName: 'Last Name', value: existing.lastName },
        { fieldName: 'Email', value: existing.email },
        { fieldName: 'Phone', value: existing.phone },
        { fieldName: 'Address', value: existing.address },
        { fieldName: 'Position', value: existing.position },
        { fieldName: 'Customer', value: existing.customerId },
        { fieldName: 'Vendor', value: existing.vendorId },
        { fieldName: 'Primary for Customer', value: existing.isPrimaryForCustomer },
        { fieldName: 'Receives Quotes / Sales Orders', value: existing.receivesQuotesSalesOrders },
        { fieldName: 'Receives Invoices', value: existing.receivesInvoices },
        { fieldName: 'Receives Invoice CC', value: existing.receivesInvoiceCc },
        { fieldName: 'Active', value: existing.active },
      ],
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}
