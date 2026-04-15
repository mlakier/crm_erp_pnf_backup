import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextCustomerNumber } from '@/lib/customer-number'
import { generateNextContactNumber } from '@/lib/contact-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'

// GET /api/customers - Get all customers
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        contacts: true,
      },
    })
    return NextResponse.json(customers)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, address, industry, userId, contacts, primarySubsidiaryId, primaryCurrencyId } = body

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

    const requiresPrimaryContact = await isFieldRequiredServer('customerCreate', 'primaryContact')
    if (requiresPrimaryContact && (!Array.isArray(contacts) || contacts.length < 1)) {
      return NextResponse.json({ error: 'At least one contact is required' }, { status: 400 })
    }

    const primaryContact = Array.isArray(contacts) ? contacts[0] : null
    if (
      requiresPrimaryContact &&
      (((await isFieldRequiredServer('customerCreate', 'contactFirstName')) && !primaryContact?.firstName) ||
        ((await isFieldRequiredServer('customerCreate', 'contactLastName')) && !primaryContact?.lastName))
    ) {
      return NextResponse.json({ error: 'Primary contact first name and last name are required' }, { status: 400 })
    }

    const customerNumber = await generateNextCustomerNumber()
    const contactNumber = primaryContact ? await generateNextContactNumber() : null

    const customer = await prisma.customer.create({
      data: {
        customerId: customerNumber,
        name,
        email,
        phone: normalizePhone(phone),
        address,
        industry,
        entityId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
        userId,
        ...(primaryContact
          ? {
              contacts: {
                create: {
                  contactNumber,
                  firstName: primaryContact.firstName,
                  lastName: primaryContact.lastName,
                  email: primaryContact.email || null,
                  phone: normalizePhone(primaryContact.phone),
                  position: primaryContact.position || null,
                  userId,
                },
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

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
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

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: normalizePhone(phone),
        address: address || null,
        industry: industry || null,
        entityId: primarySubsidiaryId || null,
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

    return NextResponse.json(customer)
  } catch (error) {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}