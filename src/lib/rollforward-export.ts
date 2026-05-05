import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { buildRollforwardReport, type RollforwardAmountLayer } from '@/lib/rollforward-report'
import { getRollforwardMovementBucketOptions, type RollforwardMovementBucket } from '@/lib/rollforward-movement-buckets'
import type { ExportDataset } from '@/lib/export-data'
import type { MoneySettings } from '@/lib/company-preferences-definitions'

const PRIMARY_BUCKET_COLUMNS: RollforwardMovementBucket[] = [
  'additions',
  'releases',
  'settlements',
  'reclassifications',
  'realized_fx',
  'unrealized_fx',
  'other_activity',
]

export async function buildRollforwardExportDataset(args: {
  accountingPeriodId: string
  subsidiaryId?: string | null
  rollforwardCategory?: string | null
  accountId?: string | null
  amountLayer: RollforwardAmountLayer
  moneySettings?: Partial<MoneySettings>
}) {
  const report = await buildRollforwardReport({
    accountingPeriodId: args.accountingPeriodId,
    subsidiaryId: args.subsidiaryId ?? null,
    rollforwardCategory: args.rollforwardCategory ?? null,
    accountId: args.accountId ?? null,
    amountLayer: args.amountLayer,
    bucket: null,
  })

  const movementBucketLabels = new Map(
    getRollforwardMovementBucketOptions().map((option) => [option.value, option.label]),
  )

  const summaryDataset: ExportDataset = {
    headers: [
      'Period',
      'Layer',
      'Account Number',
      'Account Name',
      'Rollforward Category',
      'Beginning Balance',
      ...PRIMARY_BUCKET_COLUMNS.map((bucket) => movementBucketLabels.get(bucket) ?? bucket),
      'Ending Balance',
    ],
    rows: report.rows.map((row) => [
      report.period.name,
      args.amountLayer,
      row.accountNumber,
      row.accountName,
      row.rollforwardCategory || '-',
      fmtCurrency(row.beginningBalance, null, args.moneySettings),
      ...PRIMARY_BUCKET_COLUMNS.map((bucket) => fmtCurrency(row.movementByBucket[bucket] ?? 0, null, args.moneySettings)),
      fmtCurrency(row.endingBalance, null, args.moneySettings),
    ]),
  }

  const drillDataset: ExportDataset = {
    headers: [
      'Period',
      'Layer',
      'Date',
      'Journal Number',
      'Account Number',
      'Account Name',
      'Rollforward Category',
      'Activity Type',
      'Movement Bucket',
      'Source Type',
      'Source Id',
      'Line Description',
      'Journal Description',
      'Amount',
    ],
    rows: report.drillLines.map((line) => [
      report.period.name,
      args.amountLayer,
      fmtDocumentDate(line.journalDate, args.moneySettings),
      line.journalNumber,
      line.accountNumber,
      line.accountName,
      line.rollforwardCategory || '-',
      line.activityTypeCode || '-',
      movementBucketLabels.get(line.movementBucket) ?? line.movementBucket,
      line.sourceType || '-',
      line.sourceId || '-',
      line.description || '-',
      line.journalDescription || '-',
      fmtCurrency(line.amount, null, args.moneySettings),
    ]),
  }

  return {
    report,
    summaryDataset,
    drillDataset,
  }
}
