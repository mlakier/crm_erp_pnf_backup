import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/custom-fields - Get all custom field definitions
export async function GET() {
  try {
    const fields = await prisma.customFieldDefinition.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(fields)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 })
  }
}

// POST /api/custom-fields - Create a new custom field definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, label, type, required, defaultValue, options, entityType } = body

    if (!name || !label || !type || !entityType) {
      return NextResponse.json({ error: 'Name, label, type, and entityType are required' }, { status: 400 })
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        name,
        label,
        type,
        required: required || false,
        defaultValue,
        options: options ? JSON.stringify(options) : null,
        entityType,
      },
    })

    return NextResponse.json(field, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 })
  }
}