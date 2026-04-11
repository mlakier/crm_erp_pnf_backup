import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextVendorNumber } from '@/lib/vendor-number'
import { normalizePhone } from '@/lib/format'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'

// GET /api/vendors - Get all vendors
export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany()
    return NextResponse.json(vendors)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}

// POST /api/vendors - Create a new vendor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, address, taxId, primarySubsidiaryId, primaryCurrencyId } = body

    const missing: string[] = []
    if ((await isFieldRequiredServer('vendorCreate', 'name')) && !name) missing.push('name')
    if ((await isFieldRequiredServer('vendorCreate', 'email')) && !email) missing.push('email')
    if ((await isFieldRequiredServer('vendorCreate', 'phone')) && !phone) missing.push('phone')
    if ((await isFieldRequiredServer('vendorCreate', 'address')) && !address) missing.push('address')
    if ((await isFieldRequiredServer('vendorCreate', 'taxId')) && !taxId) missing.push('taxId')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const vendorNumber = await generateNextVendorNumber()

    const vendor = await prisma.vendor.create({
      data: {
        vendorNumber,
        name,
        email,
        phone: normalizePhone(phone),
        address,
        taxId,
        entityId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
      },
    })

    await logActivity({
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'create',
      summary: `Created vendor ${vendor.vendorNumber ?? vendor.name} ${vendor.name}`,
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
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
    const { name, email, phone, address, taxId, primarySubsidiaryId, primaryCurrencyId } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: normalizePhone(phone),
        address: address || null,
        taxId: taxId || null,
        entityId: primarySubsidiaryId || null,
        currencyId: primaryCurrencyId || null,
      },
    })

    await logActivity({
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'update',
      summary: `Updated vendor ${vendor.vendorNumber ?? vendor.name} ${vendor.name}`,
    })

    return NextResponse.json(vendor)
  } catch (error) {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 })
  }
}