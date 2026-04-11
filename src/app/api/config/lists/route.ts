import { NextRequest, NextResponse } from 'next/server'
import { LIST_LABELS, LIST_PAGE_LABELS, ListPageKey } from '@/lib/list-options'
import { loadListOptions, updateSingleList } from '@/lib/list-options-store'

function isListPageKey(value: string): value is ListPageKey {
  return Object.prototype.hasOwnProperty.call(LIST_PAGE_LABELS, value)
}

export async function GET() {
  try {
    const config = await loadListOptions()
    return NextResponse.json({
      pageLabels: LIST_PAGE_LABELS,
      listLabels: LIST_LABELS,
      config,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load list options' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const page = String((body as { page?: unknown })?.page ?? '').trim()
    const list = String((body as { list?: unknown })?.list ?? '').trim()
    const values = (body as { values?: unknown })?.values

    if (!isListPageKey(page)) {
      return NextResponse.json({ error: 'Invalid page key' }, { status: 400 })
    }

    if (!Object.prototype.hasOwnProperty.call(LIST_LABELS[page], list)) {
      return NextResponse.json({ error: 'Invalid list key' }, { status: 400 })
    }

    const config = await updateSingleList(page, list, values)
    return NextResponse.json({
      pageLabels: LIST_PAGE_LABELS,
      listLabels: LIST_LABELS,
      config,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save list options' }, { status: 500 })
  }
}
