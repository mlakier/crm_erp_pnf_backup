import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { generateNextCustomerNumber } from '@/lib/customer-number'
import { formatContactNumber } from '@/lib/contact-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'
import { getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

// GET /api/customers - Get all customers
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        contacts: true,
      },
    })
    return NextResponse.json(customers)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, address, industry, userId, contacts, primarySubsidiaryId, primaryCurrencyId, inactive } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const missing: string[] = []
    if ((await isFieldRequiredServer('customerCreate', 'name')) && !name) missing.push('name')
    if ((await isFieldRequiredServer('customerCreate', 'email')) && !email) missing.push('email')
    if ((await isFieldRequiredServer('customerCreate', 'phone')) && !phone) missing.push('phone')
    if ((await isFieldRequiredServer('customerCreate', 'address')) && !address) missing.push('address')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    if (!Array.isArray(contacts) || contacts.length < 1) {
      return NextResponse.json({ error: 'At least one contact is required' }, { status: 400 })
    }

    const normalizedContacts = Array.isArray(contacts)
      ? contacts
          .map((contact) => ({
            firstName: String(contact?.firstName ?? '').trim(),
            lastName: String(contact?.lastName ?? '').trim(),
            email: String(contact?.email ?? '').trim(),
            phone: String(contact?.phone ?? '').trim(),
            position: String(contact?.position ?? '').trim(),
            isPrimaryForCustomer: String(contact?.isPrimaryForCustomer ?? 'false').trim().toLowerCase() === 'true' || contact?.isPrimaryForCustomer === true,
            receivesQuotesSalesOrders: String(contact?.receivesQuotesSalesOrders ?? 'false').trim().toLowerCase() === 'true' || contact?.receivesQuotesSalesOrders === true,
            receivesInvoices: String(contact?.receivesInvoices ?? 'false').trim().toLowerCase() === 'true' || contact?.receivesInvoices === true,
            receivesInvoiceCc: String(contact?.receivesInvoiceCc ?? 'false').trim().toLowerCase() === 'true' || contact?.receivesInvoiceCc === true,
          }))
          .filter((contact) => contact.firstName || contact.lastName || contact.email || contact.phone || contact.position)
      : []

    if (normalizedContacts.length > 0 && !normalizedContacts.some((contact) => contact.isPrimaryForCustomer)) {
      normalizedContacts[0].isPrimaryForCustomer = true
    }
    if (normalizedContacts.filter((contact) => contact.isPrimaryForCustomer).length > 1) {
      let primarySeen = false
      for (const contact of normalizedContacts) {
        if (!contact.isPrimaryForCustomer) continue
        if (!primarySeen) {
          primarySeen = true
        } else {
          contact.isPrimaryForCustomer = false
        }
      }
    }

    const primaryContact = normalizedContacts.find((contact) => contact.isPrimaryForCustomer) ?? normalizedContacts[0] ?? null
    if (
      (((await isFieldRequiredServer('customerCreate', 'contactFirstName')) && !primaryContact?.firstName) ||
        ((await isFieldRequiredServer('customerCreate', 'contactLastName')) && !primaryContact?.lastName))
    ) {
      return NextResponse.json({ error: 'Primary contact first name and last name are required' }, { status: 400 })
    }

    const customerNumber = await generateNextCustomerNumber()
    const contactIdConfig = await loadIdSetting('contact')
    const latestContacts = normalizedContacts.length
      ? await prisma.contact.findMany({
          where: { contactNumber: { startsWith: contactIdConfig.prefix } },
          orderBy: { contactNumber: 'desc' },
          select: { contactNumber: true },
          take: 200,
        })
      : []
    const nextContactSequence = getNextSequenceFromValues(latestContacts.map((contact) => contact.contactNumber), contactIdConfig)

    const customer = await prisma.customer.create({
      data: {
        customerId: customerNumber,
        name,
        email,
        phone: normalizePhone(phone),
        address,
        industry,
        subsidiaryId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
        inactive: String(inactive).trim().toLowerCase() === 'true',
        userId,
        ...(normalizedContacts.length > 0
          ? {
              contacts: {
                create: normalizedContacts.map((contact, index) => ({
                  contactNumber: formatContactNumber(nextContactSequence + index, contactIdConfig),
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email || null,
                  phone: normalizePhone(contact.phone),
                  position: contact.position || null,
                  isPrimaryForCustomer: contact.isPrimaryForCustomer,
                  receivesQuotesSalesOrders: contact.receivesQuotesSalesOrders,
                  receivesInvoices: contact.receivesInvoices,
                  receivesInvoiceCc: contact.receivesInvoiceCc,
                  userId,
                })),
              },
            }
          : {}),
      },
      include: {
        contacts: true,
      },
    })

    await logActivity({
      entityType: 'customer',
      entityId: customer.id,
      action: 'create',
      summary: `Created customer ${customer.customerId ?? customer.name} ${customer.name}`,
      userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'customer',
      entityId: customer.id,
      userId,
      action: 'create',
      context: 'Customer Details',
      fields: [
        { fieldName: 'Business Id', value: customer.customerId },
        { fieldName: 'Name', value: customer.name },
        { fieldName: 'Email', value: customer.email },
        { fieldName: 'Phone', value: customer.phone },
        { fieldName: 'Address', value: customer.address },
        { fieldName: 'Industry', value: customer.industry },
        { fieldName: 'Primary Subsidiary', value: customer.subsidiaryId },
        { fieldName: 'Primary Currency', value: customer.currencyId },
        { fieldName: 'Inactive', value: customer.inactive },
      ],
    })

    return NextResponse.json(customer, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}

// PUT /api/customers?id=<id> - Update a customer
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })

    const body = await request.json()
    const { name, email, phone, address, industry, primarySubsidiaryId, primaryCurrencyId, inactive } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const existingContactCount = await prisma.contact.count({ where: { customerId: id } })
    if (existingContactCount < 1) {
      return NextResponse.json(
        { error: 'At least one contact is required before saving this customer. Add a contact in the Contacts section first.' },
        { status: 400 }
      )
    }

    const before = await prisma.customer.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: normalizePhone(phone),
        address: address || null,
        industry: industry || null,
        subsidiaryId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
        ...(inactive !== undefined ? { inactive: inactive === true || inactive === 'true' } : {}),
      },
    })

    await logActivity({
      entityType: 'customer',
      entityId: customer.id,
      action: 'update',
      summary: `Updated customer ${customer.name}`,
      userId: customer.userId,
    })
    await logFieldChangeActivities({
      entityType: 'customer',
      entityId: customer.id,
      userId: customer.userId ?? null,
      context: 'Customer Details',
      changes: [
        { fieldName: 'Name', oldValue: before.name, newValue: customer.name },
        { fieldName: 'Email', oldValue: before.email, newValue: customer.email },
        { fieldName: 'Phone', oldValue: before.phone, newValue: customer.phone },
        { fieldName: 'Address', oldValue: before.address, newValue: customer.address },
        { fieldName: 'Industry', oldValue: before.industry, newValue: customer.industry },
        { fieldName: 'Primary Subsidiary', oldValue: before.subsidiaryId, newValue: customer.subsidiaryId },
        { fieldName: 'Primary Currency', oldValue: before.currencyId, newValue: customer.currencyId },
        { fieldName: 'Inactive', oldValue: before.inactive, newValue: customer.inactive },
      ],
    })

    return NextResponse.json(customer)
  } catch {
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

// DELETE /api/customers?id=<id> - Delete a customer
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
    }

    const existing = await prisma.customer.findUnique({ where: { id } })
    await prisma.customer.delete({ where: { id } })

    await logActivity({
      entityType: 'customer',
      entityId: id,
      action: 'delete',
      summary: `Deleted customer ${existing?.name ?? id}`,
      userId: existing?.userId,
    })
    if (existing) {
      await logRecordSnapshotActivities({
        entityType: 'customer',
        entityId: id,
        userId: existing.userId ?? null,
        action: 'delete',
        context: 'Customer Details',
        fields: [
          { fieldName: 'Business Id', value: existing.customerId },
          { fieldName: 'Name', value: existing.name },
          { fieldName: 'Email', value: existing.email },
          { fieldName: 'Phone', value: existing.phone },
          { fieldName: 'Address', value: existing.address },
          { fieldName: 'Industry', value: existing.industry },
          { fieldName: 'Primary Subsidiary', value: existing.subsidiaryId },
          { fieldName: 'Primary Currency', value: existing.currencyId },
          { fieldName: 'Inactive', value: existing.inactive },
        ],
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
