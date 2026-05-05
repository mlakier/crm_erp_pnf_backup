import type { NextRequest } from 'next/server'

import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { buildRollforwardExportDataset } from '@/lib/rollforward-export'
import type { RollforwardAmountLayer } from '@/lib/rollforward-report'

function sanitizeAmountLayer(value: string | null): RollforwardAmountLayer {
  if (value === 'transaction' || value === 'local' || value === 'functional' || value === 'group') return value
  return 'group'
}

export async function GET(request: NextRequest) {
  const accountingPeriodId = (request.nextUrl.searchParams.get('accountingPeriodId') ?? '').trim()
  const subsidiaryId = (request.nextUrl.searchParams.get('subsidiaryId') ?? '').trim()
  const rollforwardCategory = (request.nextUrl.searchParams.get('rollforwardCategory') ?? '').trim()
  const accountId = (request.nextUrl.searchParams.get('accountId') ?? '').trim()
  const amountLayer = sanitizeAmountLayer(request.nextUrl.searchParams.get('amountLayer'))
  const datasetType = (request.nextUrl.searchParams.get('dataset') ?? 'summary').trim().toLowerCase()

  if (!accountingPeriodId) {
    return Response.json({ error: 'accountingPeriodId is required' }, { status: 400 })
  }

  try {
    const [{ moneySettings }, payload] = await Promise.all([
      loadCompanyDisplaySettings(),
      buildRollforwardExportDataset({
        accountingPeriodId,
        subsidiaryId: subsidiaryId || null,
        rollforwardCategory: rollforwardCategory || null,
        accountId: accountId || null,
        amountLayer,
      }),
    ])

    const dataset = datasetType === 'drill' ? payload.drillDataset : payload.summaryDataset

    return Response.json({
      headers: dataset.headers,
      rows: dataset.rows,
      detail: {
        period: payload.report.period.name,
        amountLayer,
        missingLayerLineCount: payload.report.missingLayerLineCount,
        locale: moneySettings.locale,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export rollforward report'
    return Response.json({ error: message }, { status: 400 })
  }
}
