import Link from 'next/link'

import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDateOnly, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import RollforwardFilterPanel from '@/components/RollforwardFilterPanel'
import ExportButton from '@/components/ExportButton'
import {
  buildRollforwardReport,
  type RollforwardAmountLayer,
} from '@/lib/rollforward-report'
import {
  getRollforwardMovementBucketOptions,
  type RollforwardMovementBucket,
} from '@/lib/rollforward-movement-buckets'

type RollforwardsSearchParams = Promise<{
  accountingPeriodId?: string
  subsidiaryId?: string
  rollforwardCategory?: string
  accountId?: string
  amountLayer?: string
  bucket?: string
}>

const AMOUNT_LAYER_OPTIONS: Array<{ value: RollforwardAmountLayer; label: string }> = [
  { value: 'transaction', label: 'Transaction Layer' },
  { value: 'local', label: 'Local Layer' },
  { value: 'functional', label: 'Functional Layer' },
  { value: 'group', label: 'Group Layer' },
]

const PRIMARY_BUCKET_COLUMNS: RollforwardMovementBucket[] = [
  'additions',
  'releases',
  'settlements',
  'reclassifications',
  'realized_fx',
  'unrealized_fx',
  'other_activity',
]

function sanitizeAmountLayer(value: string | undefined, defaultLayer: RollforwardAmountLayer): RollforwardAmountLayer {
  if (value === 'transaction' || value === 'local' || value === 'functional' || value === 'group') return value
  return defaultLayer
}

function sanitizeBucket(value: string | undefined): RollforwardMovementBucket | null {
  const options = new Set(getRollforwardMovementBucketOptions().map((option) => option.value))
  return value && options.has(value as RollforwardMovementBucket) ? (value as RollforwardMovementBucket) : null
}

function buildQueryString(next: Record<string, string | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export default async function RollforwardsPage({ searchParams }: { searchParams: RollforwardsSearchParams }) {
  const params = await searchParams
  const [{ moneySettings }, accountingPeriods, subsidiaries, rollforwardCategoryValues] = await Promise.all([
    loadCompanyDisplaySettings(),
    prisma.accountingPeriod.findMany({
      select: { id: true, name: true, startDate: true, endDate: true, subsidiaryId: true },
      orderBy: [{ endDate: 'desc' }, { name: 'asc' }],
    }),
    prisma.subsidiary.findMany({
      where: { active: true },
      select: { id: true, subsidiaryId: true, name: true },
      orderBy: [{ subsidiaryId: 'asc' }],
    }),
    prisma.listOption.findMany({
      where: { key: 'LIST-COA-ROLLFORWARD-CATEGORY' },
      select: { value: true, label: true },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    }),
  ])

  const selectedPeriodId = params.accountingPeriodId ?? accountingPeriods[0]?.id ?? ''
  const selectedSubsidiaryId = params.subsidiaryId || ''
  const selectedRollforwardCategory = params.rollforwardCategory || ''
  const selectedBucket = sanitizeBucket(params.bucket)
  const defaultLayer: RollforwardAmountLayer = selectedSubsidiaryId ? 'functional' : 'group'
  const selectedAmountLayer = sanitizeAmountLayer(params.amountLayer, defaultLayer)

  const accountOptions = await prisma.chartOfAccounts.findMany({
    where: {
      active: true,
      rollforwardCategory: selectedRollforwardCategory
        ? selectedRollforwardCategory
        : { not: null },
      ...(selectedRollforwardCategory
        ? {}
        : {
            NOT: [
              { rollforwardCategory: '' },
              { rollforwardCategory: 'Not Applicable' },
            ],
          }),
    },
    select: { id: true, accountId: true, accountNumber: true, name: true, rollforwardCategory: true },
    orderBy: [{ accountNumber: 'asc' }, { name: 'asc' }],
  })

  const selectedAccountId = params.accountId || ''

  const report = selectedPeriodId
    ? await buildRollforwardReport({
        accountingPeriodId: selectedPeriodId,
        subsidiaryId: selectedSubsidiaryId || null,
        rollforwardCategory: selectedRollforwardCategory || null,
        accountId: selectedAccountId || null,
        amountLayer: selectedAmountLayer,
        bucket: selectedBucket,
      })
    : null

  const sharedQuery = {
    accountingPeriodId: selectedPeriodId || null,
    subsidiaryId: selectedSubsidiaryId || null,
    rollforwardCategory: selectedRollforwardCategory || null,
    accountId: selectedAccountId || null,
    amountLayer: selectedAmountLayer,
  }
  const exportAllUrl = `/api/rollforwards/export${buildQueryString(sharedQuery)}`

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Balance Sheet Rollforwards</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Controlled rollforward reporting driven by `Activity Type` and `Rollforward Category`, with journal-line drill-through.
          </p>
        </div>
        <ExportButton tableId="rollforward-summary-table" fileName="rollforwards" exportAllUrl={exportAllUrl} />
      </div>

      <RollforwardFilterPanel
        accountingPeriods={accountingPeriods.map((period) => ({
          value: period.id,
          label: period.name,
          searchText: period.name,
        }))}
        subsidiaries={subsidiaries.map((subsidiary) => ({
          value: subsidiary.id,
          label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
          searchText: `${subsidiary.subsidiaryId} ${subsidiary.name}`,
        }))}
        rollforwardCategories={rollforwardCategoryValues
          .filter((option) => option.value !== 'Not Applicable')
          .map((option) => ({
            value: option.value,
            label: option.label || option.value,
            searchText: option.label || option.value,
          }))}
        accounts={accountOptions.map((account) => ({
          value: account.id,
          label: `${account.accountId} / ${account.accountNumber} - ${account.name}`,
          searchText: `${account.accountId} ${account.accountNumber} ${account.name} ${account.rollforwardCategory ?? ''}`,
        }))}
        amountLayers={AMOUNT_LAYER_OPTIONS}
        initialAccountingPeriodId={selectedPeriodId}
        initialSubsidiaryId={selectedSubsidiaryId}
        initialRollforwardCategory={selectedRollforwardCategory}
        initialAccountId={selectedAccountId}
        initialAmountLayer={selectedAmountLayer}
      />

      {!report ? (
        <section
          className="rounded-2xl border px-6 py-10 text-center text-sm"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        >
          No accounting periods available yet.
        </section>
      ) : (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Period</p>
              <p className="mt-2 text-sm font-semibold text-white">{report.period.name}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {fmtDateOnly(report.period.startDate, moneySettings)} to {fmtDateOnly(report.period.endDate, moneySettings)}
              </p>
            </div>
            <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount Layer</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {AMOUNT_LAYER_OPTIONS.find((option) => option.value === report.amountLayer)?.label ?? report.amountLayer}
              </p>
            </div>
            <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Beginning Balance</p>
              <p className="mt-2 text-lg font-semibold text-white">{fmtCurrency(report.totals.beginningBalance, null, moneySettings)}</p>
            </div>
            <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Ending Balance</p>
              <p className="mt-2 text-lg font-semibold text-white">{fmtCurrency(report.totals.endingBalance, null, moneySettings)}</p>
            </div>
          </section>

          {report.missingLayerLineCount > 0 ? (
            <section
              className="mb-6 rounded-xl border px-4 py-3 text-sm"
              style={{ backgroundColor: 'var(--card)', borderColor: 'rgba(251, 191, 36, 0.35)', color: '#fcd34d' }}
            >
              {report.missingLayerLineCount} journal lines do not carry the selected {report.amountLayer} layer and were treated as zero in this run. That keeps the rollforward honest instead of backfilling from transaction amounts.
            </section>
          ) : null}

          <section
            className="mb-6 rounded-2xl border px-6 py-5"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Movement Totals
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Click a bucket to drill into the underlying journal lines for this filtered report.
                </p>
              </div>
              {report.selectedBucket ? (
                <Link
                  href={`/rollforwards${buildQueryString(sharedQuery)}`}
                  className="text-sm text-blue-400 hover:underline"
                >
                  Clear Drill-Through
                </Link>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              {getRollforwardMovementBucketOptions()
                .filter((bucket) => !['opening_balance', 'closing_balance'].includes(bucket.value))
                .map((bucket) => (
                  <Link
                    key={bucket.value}
                    href={`/rollforwards${buildQueryString({ ...sharedQuery, bucket: bucket.value })}`}
                    className="rounded-xl border px-4 py-3 transition"
                    style={{
                      backgroundColor: report.selectedBucket === bucket.value ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
                      borderColor: report.selectedBucket === bucket.value ? 'rgba(59, 130, 246, 0.45)' : 'var(--border-muted)',
                    }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      {bucket.label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {fmtCurrency(report.totals.movementByBucket[bucket.value] ?? 0, null, moneySettings)}
                    </p>
                  </Link>
                ))}
            </div>
          </section>

          <section
            className="mb-6 overflow-hidden rounded-2xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
          >
            <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Account Rollforward
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table id="rollforward-summary-table" className="min-w-[1400px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    {['Account', 'Category', 'Beginning', ...PRIMARY_BUCKET_COLUMNS.map((bucket) => getRollforwardMovementBucketOptions().find((option) => option.value === bucket)?.label ?? bucket), 'Ending'].map((label) => (
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
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={PRIMARY_BUCKET_COLUMNS.length + 4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        No journal activity matched these filters.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, index) => (
                      <tr key={row.accountId} style={index < report.rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-white">{row.accountNumber} - {row.accountName}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{row.accountId}</div>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {row.rollforwardCategory || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{fmtCurrency(row.beginningBalance, null, moneySettings)}</td>
                        {PRIMARY_BUCKET_COLUMNS.map((bucket) => (
                          <td key={`${row.accountId}-${bucket}`} className="px-4 py-3 text-sm text-white">
                            {fmtCurrency(row.movementByBucket[bucket] ?? 0, null, moneySettings)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm font-medium text-white">{fmtCurrency(row.endingBalance, null, moneySettings)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {report.selectedBucket ? (
            <section
              className="overflow-hidden rounded-2xl border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
            >
              <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Drill-Through: {getRollforwardMovementBucketOptions().find((option) => option.value === report.selectedBucket)?.label ?? report.selectedBucket}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1200px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                      {['Date', 'Journal', 'Account', 'Category', 'Activity Type', 'Source', 'Description', 'Amount'].map((label) => (
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
                    {report.drillLines.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                          No journal lines landed in this movement bucket for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      report.drillLines.map((line, index) => (
                        <tr key={`${line.journalEntryId}-${line.accountId}-${index}`} style={index < report.drillLines.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {fmtDocumentDate(line.journalDate, moneySettings)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Link href={`/journals/${line.journalEntryId}`} className="text-blue-400 hover:underline">
                              {line.journalNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-white">
                            {line.accountNumber} - {line.accountName}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {line.rollforwardCategory || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {line.activityTypeCode || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {line.sourceType ? `${line.sourceType}${line.sourceId ? ` / ${line.sourceId}` : ''}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {line.description || line.journalDescription || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-white">
                            {fmtCurrency(line.amount, null, moneySettings)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
