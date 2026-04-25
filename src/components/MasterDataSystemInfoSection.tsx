import { RecordDetailField, RecordDetailSection } from '@/components/RecordDetailPanels'
import CopyableSystemValue from '@/components/CopyableSystemValue'
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
  internalId,
}: {
  info: MasterDataSystemInfo
  internalId?: string
}) {
  const count = internalId ? 5 : 4

  return (
    <RecordDetailSection title="System Information" count={count}>
      <dl className="grid gap-4 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
        {internalId ? (
          <RecordDetailField label="Internal DB ID">
            <CopyableSystemValue value={internalId} />
          </RecordDetailField>
        ) : null}
        <RecordDetailField label="Date Created">{formatDateTime(info.createdAt)}</RecordDetailField>
        <RecordDetailField label="Created By">{info.createdBy}</RecordDetailField>
        <RecordDetailField label="Last Modified">{formatDateTime(info.updatedAt)}</RecordDetailField>
        <RecordDetailField label="Last Modified By">{info.lastModifiedBy}</RecordDetailField>
      </dl>
    </RecordDetailSection>
  )
}
