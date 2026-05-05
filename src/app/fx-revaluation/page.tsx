import Link from 'next/link'

import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import FxRevaluationRunPanel from '@/components/FxRevaluationRunPanel'

function parseSummaryJson(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as {
      revaluedItems?: number
      skippedItems?: number
      failedItems?: number
      journalEntryId?: string | null
      localDeltaTotal?: number
      functionalDeltaTotal?: number
      groupDeltaTotal?: number
    }
  } catch {
    return null
  }
}

export default async function FxRevaluationPage() {
  const [{ moneySettings }, accountingPeriods, subsidiaries, recentRuns] = await Promise.all([
    loadCompanyDisplaySettings(),
    prisma.accountingPeriod.findMany({
      where: { closed: false },
      select: {
        id: true,
        name: true,
        subsidiaryId: true,
        endDate: true,
      },
      orderBy: [{ endDate: 'desc' }, { name: 'asc' }],
    }),
    prisma.subsidiary.findMany({
      where: { active: true },
      select: { id: true, subsidiaryId: true, name: true },
      orderBy: [{ subsidiaryId: 'asc' }],
    }),
    prisma.runHeader.findMany({
      where: { runType: 'fx_revaluation' },
      include: {
        outputLinks: {
          where: { outputRecordType: 'journal_entry' },
          select: { outputRecordId: true },
          take: 1,
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 10,
    }),
  ])

  const defaultAsOfDate = new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">FX Revaluation</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Period-end unrealized FX remeasurement for open monetary balances on accounts flagged `Revalue Open Balance`.
        </p>
      </div>

      <FxRevaluationRunPanel
        accountingPeriods={accountingPeriods.map((period) => ({
          id: period.id,
          name: period.name,
          subsidiaryId: period.subsidiaryId ?? null,
        }))}
        subsidiaries={subsidiaries}
        defaultAsOfDate={defaultAsOfDate}
      />

      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Recent Runs
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {['Run', 'Status', 'Requested', 'As Of', 'Summary', 'Journal'].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No FX revaluation runs yet.
                  </td>
                </tr>
              ) : (
                recentRuns.map((run, index) => {
                  const summary = parseSummaryJson(run.summaryJson)
                  const journalId = run.outputLinks[0]?.outputRecordId ?? summary?.journalEntryId ?? null

                  return (
                    <tr key={run.id} style={index < recentRuns.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                        {run.runNumber}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {run.status}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {fmtDocumentDate(run.requestedAt, moneySettings)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {run.asOfDate ? fmtDocumentDate(run.asOfDate, moneySettings) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {summary
                          ? `Revalued ${summary.revaluedItems ?? 0}, skipped ${summary.skippedItems ?? 0}, failed ${summary.failedItems ?? 0}`
                          : (run.message ?? '-')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {journalId ? (
                          <Link href={`/journals/${journalId}`} className="text-blue-400 hover:underline">
                            Open Journal
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
