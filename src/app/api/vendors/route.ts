import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { generateNextVendorNumber } from '@/lib/vendor-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'
import { formatContactNumber } from '@/lib/contact-number'
import { getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

// GET /api/vendors - Get all vendors
export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany()
    return NextResponse.json(vendors)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}

// POST /api/vendors - Create a new vendor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, address, taxId, primarySubsidiaryId, primaryCurrencyId, inactive, contacts, userId } = body

    const missing: string[] = []
    if ((await isFieldRequiredServer('vendorCreate', 'name')) && !name) missing.push('name')
    if ((await isFieldRequiredServer('vendorCreate', 'email')) && !email) missing.push('email')
    if ((await isFieldRequiredServer('vendorCreate', 'phone')) && !phone) missing.push('phone')
    if ((await isFieldRequiredServer('vendorCreate', 'address')) && !address) missing.push('address')
    if ((await isFieldRequiredServer('vendorCreate', 'taxId')) && !taxId) missing.push('taxId')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const normalizedContacts = Array.isArray(contacts)
      ? contacts
          .map((contact) => ({
            firstName: String(contact?.firstName ?? '').trim(),
            lastName: String(contact?.lastName ?? '').trim(),
            email: String(contact?.email ?? '').trim(),
            phone: String(contact?.phone ?? '').trim(),
            position: String(contact?.position ?? '').trim(),
            receivesQuotesSalesOrders: String(contact?.receivesQuotesSalesOrders ?? 'false').trim().toLowerCase() === 'true' || contact?.receivesQuotesSalesOrders === true,
            receivesInvoices: String(contact?.receivesInvoices ?? 'false').trim().toLowerCase() === 'true' || contact?.receivesInvoices === true,
            receivesInvoiceCc: String(contact?.receivesInvoiceCc ?? 'false').trim().toLowerCase() === 'true' || contact?.receivesInvoiceCc === true,
          }))
          .filter((contact) => contact.firstName || contact.lastName || contact.email || contact.phone || contact.position)
      : []

    if (normalizedContacts.length < 1) {
      return NextResponse.json({ error: 'At least one contact is required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const vendorNumber = await generateNextVendorNumber()
    const contactIdConfig = await loadIdSetting('contact')
    const latestContacts = await prisma.contact.findMany({
      where: { contactNumber: { startsWith: contactIdConfig.prefix } },
      orderBy: { contactNumber: 'desc' },
      select: { contactNumber: true },
      take: 200,
    })
    const nextContactSequence = getNextSequenceFromValues(latestContacts.map((contact) => contact.contactNumber), contactIdConfig)

    const vendor = await prisma.vendor.create({
      data: {
        vendorNumber,
        name,
        email,
        phone: normalizePhone(phone),
        address,
        taxId,
        subsidiaryId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
        inactive: String(inactive).trim().toLowerCase() === 'true',
        contacts: {
          create: normalizedContacts.map((contact, index) => ({
            contactNumber: formatContactNumber(nextContactSequence + index, contactIdConfig),
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email || null,
            phone: normalizePhone(contact.phone),
            position: contact.position || null,
            receivesQuotesSalesOrders: contact.receivesQuotesSalesOrders,
            receivesInvoices: contact.receivesInvoices,
            receivesInvoiceCc: contact.receivesInvoiceCc,
            userId,
          })),
        },
      },
      include: { contacts: true },
    })

    await logActivity({
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'create',
      summary: `Created vendor ${vendor.vendorNumber ?? vendor.name} ${vendor.name}`,
    })
    await logRecordSnapshotActivities({
      entityType: 'vendor',
      entityId: vendor.id,
      userId,
      action: 'create',
      context: 'Vendor Details',
      fields: [
        { fieldName: 'Business Id', value: vendor.vendorNumber },
        { fieldName: 'Name', value: vendor.name },
        { fieldName: 'Email', value: vendor.email },
        { fieldName: 'Phone', value: vendor.phone },
        { fieldName: 'Address', value: vendor.address },
        { fieldName: 'Tax ID', value: vendor.taxId },
        { fieldName: 'Primary Subsidiary', value: vendor.subsidiaryId },
        { fieldName: 'Primary Currency', value: vendor.currencyId },
        { fieldName: 'Inactive', value: vendor.inactive },
      ],
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 })
  }
}

// PUT /api/vendors?id=<id> - Update a vendor
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 })

    const body = await request.json()
    const { name, email, phone, address, taxId, primarySubsidiaryId, primaryCurrencyId, inactive } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const existingContactCount = await prisma.contact.count({ where: { vendorId: id } })
    if (existingContactCount < 1) {
      return NextResponse.json(
        { error: 'At least one contact is required before saving this vendor. Add a contact in the Contacts section first.' },
        { status: 400 }
      )
    }

    const before = await prisma.vendor.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: normalizePhone(phone),
        address: address || null,
        taxId: taxId || null,
        subsidiaryId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
        inactive: String(inactive).trim().toLowerCase() === 'true',
      },
    })

    await logActivity({
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'update',
      summary: `Updated vendor ${vendor.vendorNumber ?? vendor.name} ${vendor.name}`,
    })
    await logFieldChangeActivities({
      entityType: 'vendor',
      entityId: vendor.id,
      context: 'Vendor Details',
      changes: [
        { fieldName: 'Name', oldValue: before.name, newValue: vendor.name },
        { fieldName: 'Email', oldValue: before.email, newValue: vendor.email },
        { fieldName: 'Phone', oldValue: before.phone, newValue: vendor.phone },
        { fieldName: 'Address', oldValue: before.address, newValue: vendor.address },
        { fieldName: 'Tax ID', oldValue: before.taxId, newValue: vendor.taxId },
        { fieldName: 'Primary Subsidiary', oldValue: before.subsidiaryId, newValue: vendor.subsidiaryId },
        { fieldName: 'Primary Currency', oldValue: before.currencyId, newValue: vendor.currencyId },
        { fieldName: 'Inactive', oldValue: before.inactive, newValue: vendor.inactive },
      ],
    })

    return NextResponse.json(vendor)
  } catch {
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 })
  }
}

// DELETE /api/vendors?id=<id> - Delete a vendor
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 })
    }

    const existing = await prisma.vendor.findUnique({ where: { id } })
    await prisma.vendor.delete({ where: { id } })

    await logActivity({
      entityType: 'vendor',
      entityId: id,
      action: 'delete',
      summary: `Deleted vendor ${existing?.name ?? id}`,
    })
    if (existing) {
      await logRecordSnapshotActivities({
        entityType: 'vendor',
        entityId: id,
        action: 'delete',
        context: 'Vendor Details',
        fields: [
          { fieldName: 'Business Id', value: existing.vendorNumber },
          { fieldName: 'Name', value: existing.name },
          { fieldName: 'Email', value: existing.email },
          { fieldName: 'Phone', value: existing.phone },
          { fieldName: 'Address', value: existing.address },
          { fieldName: 'Tax ID', value: existing.taxId },
          { fieldName: 'Primary Subsidiary', value: existing.subsidiaryId },
          { fieldName: 'Primary Currency', value: existing.currencyId },
          { fieldName: 'Inactive', value: existing.inactive },
        ],
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 })
  }
}
