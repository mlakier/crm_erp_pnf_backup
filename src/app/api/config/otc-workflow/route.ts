import { NextRequest, NextResponse } from 'next/server'
import { loadOtcWorkflow, saveOtcWorkflow } from '@/lib/otc-workflow-store'

export async function GET() {
  try {
    const config = await loadOtcWorkflow()
    return NextResponse.json({ config })
  } catch {
    return NextResponse.json({ error: 'Failed to load OTC workflow config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const config = (body as { config?: unknown })?.config
    const saved = await saveOtcWorkflow(config)
    return NextResponse.json({ config: saved })
  } catch {
    return NextResponse.json({ error: 'Failed to save OTC workflow config' }, { status: 500 })
  }
}
