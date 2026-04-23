import { NextRequest, NextResponse } from 'next/server'
import {
  createManagedList,
  loadManagedListsState,
  replaceManagedListRows,
  updateManagedListDisplayOrder,
  updateManagedListMetadata,
} from '@/lib/manage-lists'

export async function GET() {
  try {
    return NextResponse.json(await loadManagedListsState())
  } catch (error) {
    console.error('Failed to load list options', error)
    return NextResponse.json({ error: 'Failed to load list options' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const key = String((body as { key?: unknown })?.key ?? '').trim()
    const incomingRows = (body as { rows?: unknown })?.rows
    const incomingDisplayOrder = (body as { displayOrder?: unknown })?.displayOrder
    const action = String((body as { action?: unknown })?.action ?? '').trim()

    if (!key) {
      return NextResponse.json({ error: 'Missing list key' }, { status: 400 })
    }

    if (action === 'create-list') {
      const label = String((body as { label?: unknown })?.label ?? '').trim()
      const whereUsed = Array.isArray((body as { whereUsed?: unknown })?.whereUsed)
        ? (body as { whereUsed: string[] }).whereUsed
        : []
      await createManagedList({ key, label, whereUsed })
      return NextResponse.json(await loadManagedListsState())
    }

    if (action === 'update-list') {
      const label = String((body as { label?: unknown })?.label ?? '').trim()
      const whereUsed = Array.isArray((body as { whereUsed?: unknown })?.whereUsed)
        ? (body as { whereUsed: string[] }).whereUsed
        : []
      await updateManagedListMetadata({ key, label, whereUsed })
    }

    if (typeof incomingDisplayOrder === 'string') {
      await updateManagedListDisplayOrder(key, incomingDisplayOrder)
    }

    if (incomingRows !== undefined) {
      if (!Array.isArray(incomingRows)) {
        return NextResponse.json({ error: 'Missing rows array' }, { status: 400 })
      }
      await replaceManagedListRows(key, incomingRows)
    }

    return NextResponse.json(await loadManagedListsState())
  } catch (error) {
    console.error('Failed to save list options', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save list options' },
      { status: 500 },
    )
  }
}
