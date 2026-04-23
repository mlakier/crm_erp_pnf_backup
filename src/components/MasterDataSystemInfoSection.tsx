import { RecordDetailField, RecordDetailSection } from '@/components/RecordDetailPanels'
import type { MasterDataSystemInfo } from '@/lib/master-data-system-info'

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

export default function MasterDataSystemInfoSection({
  info,
}: {
  info: MasterDataSystemInfo
}) {
  return (
    <RecordDetailSection title="System Information" count={4}>
      <dl className="grid gap-4 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <RecordDetailField label="Date Created">{formatDateTime(info.createdAt)}</RecordDetailField>
        <RecordDetailField label="Created By">{info.createdBy}</RecordDetailField>
        <RecordDetailField label="Last Modified">{formatDateTime(info.updatedAt)}</RecordDetailField>
        <RecordDetailField label="Last Modified By">{info.lastModifiedBy}</RecordDetailField>
      </dl>
    </RecordDetailSection>
  )
}
