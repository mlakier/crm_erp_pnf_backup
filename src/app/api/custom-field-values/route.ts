import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/custom-field-values?entityType=Customer&recordId=123
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const recordId = searchParams.get('recordId')

    if (!entityType || !recordId) {
      return NextResponse.json({ error: 'entityType and recordId are required' }, { status: 400 })
    }

    const values = await prisma.customFieldValue.findMany({
      where: {
        entityType,
        recordId,
      },
      include: {
        field: true,
      },
    })

    return NextResponse.json(values)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch custom field values' }, { status: 500 })
  }
}

// POST /api/custom-field-values - Create or update custom field value
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fieldId, recordId, entityType, value } = body

    if (!fieldId || !recordId || !entityType) {
      return NextResponse.json({ error: 'fieldId, recordId, and entityType are required' }, { status: 400 })
    }

    const existing = await prisma.customFieldValue.findFirst({
      where: {
        fieldId,
        recordId,
        entityType,
      },
    })

    if (existing) {
      const updated = await prisma.customFieldValue.update({
        where: { id: existing.id },
        data: { value },
      })
      return NextResponse.json(updated)
    } else {
      const created = await prisma.customFieldValue.create({
        data: {
          fieldId,
          recordId,
          entityType,
          value,
        },
      })
      return NextResponse.json(created, { status: 201 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save custom field value' }, { status: 500 })
  }
}