import { RecordDetailStatCard } from '@/components/RecordDetailPanels'
import type { TransactionStatDefinition } from '@/lib/transaction-page-config'

export default function TransactionStatsRow<TRecord>({
  record,
  stats,
  visibleStatIds,
}: {
  record: TRecord
  stats: TransactionStatDefinition<TRecord>[]
  visibleStatIds?: string[]
}) {
  const visibleStats =
    visibleStatIds && visibleStatIds.length > 0
      ? visibleStatIds
          .map((id) => stats.find((stat) => stat.id === id))
          .filter((stat): stat is TransactionStatDefinition<TRecord> => Boolean(stat))
      : stats

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {visibleStats.map((stat, index) => (
        <RecordDetailStatCard
          key={`${stat.id}-${index}`}
          label={stat.label}
          value={stat.getValue(record)}
          accent={stat.accent}
          href={stat.getHref?.(record)}
          valueTone={stat.getValueTone?.(record)}
        />
      ))}
    </div>
  )
}
