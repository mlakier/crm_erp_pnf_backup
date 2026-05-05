import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/lib/auth'
import { runFxRevaluation } from '@/lib/fx-revaluation'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json() as {
      accountingPeriodId?: string
      asOfDate?: string
      subsidiaryId?: string | null
    }

    const accountingPeriodId = String(body.accountingPeriodId ?? '').trim()
    const asOfDate = String(body.asOfDate ?? '').trim()
    const subsidiaryId = String(body.subsidiaryId ?? '').trim() || null

    if (!accountingPeriodId) {
      return NextResponse.json({ error: 'Accounting period is required.' }, { status: 400 })
    }
    if (!asOfDate) {
      return NextResponse.json({ error: 'As-of date is required.' }, { status: 400 })
    }

    const result = await runFxRevaluation({
      accountingPeriodId,
      asOfDate,
      subsidiaryId,
      requestedById: session?.user?.id ?? null,
      triggerType: 'manual',
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run FX revaluation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
