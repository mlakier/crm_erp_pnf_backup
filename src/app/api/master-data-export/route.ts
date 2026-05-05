import type { NextRequest } from 'next/server'
import { buildMasterDataExportPayload, type MasterDataExportResource } from '@/lib/master-data-export'

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get('resource') as MasterDataExportResource | null
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const sort = request.nextUrl.searchParams.get('sort') ?? 'id'
  const status = (request.nextUrl.searchParams.get('status') ?? '').trim()
  const clearingType = (request.nextUrl.searchParams.get('clearingType') ?? '').trim()
  const viewId = (request.nextUrl.searchParams.get('view') ?? '').trim()

  if (!resource) {
    return Response.json({ error: 'resource is required' }, { status: 400 })
  }

  try {
    const payload = await buildMasterDataExportPayload(resource, query, sort, { status, viewId, clearingType })
    return Response.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export master data list'
    return Response.json({ error: message }, { status: 400 })
  }
}
