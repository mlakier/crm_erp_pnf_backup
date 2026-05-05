import type { ReactNode } from 'react'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'

function FooterEmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
      {message}
    </div>
  )
}

export default function TransactionDetailFrame({
  stats,
  header,
  lineItems,
  relatedMasterData,
  relatedMasterDataLabel = 'Related Records',
  relatedMasterDataCount = 0,
  relatedMasterDataToolbarTargetId,
  relatedMasterDataToolbarPlacement = 'panel',
  relatedTransactionDocuments,
  relatedTransactionDocumentsLabel = 'Related Documents',
  relatedTransactionDocumentsCount = 0,
  relatedTransactionDocumentsToolbarTargetId,
  relatedTransactionDocumentsToolbarPlacement = 'panel',
  relatedRecords,
  relatedRecordsLabel = 'Related Records',
  relatedRecordsCount = 0,
  relatedRecordsToolbarTargetId,
  relatedRecordsToolbarPlacement = 'panel',
  relatedDocuments,
  relatedDocumentsLabel = 'Related Documents',
  relatedDocumentsCount = 0,
  relatedDocumentsToolbarTargetId,
  relatedDocumentsToolbarPlacement = 'panel',
  supplementarySections,
  communications,
  communicationsCount = 0,
  communicationsToolbarTargetId,
  communicationsToolbarPlacement = 'panel',
  systemNotes,
  systemNotesCount = 0,
  systemNotesToolbarTargetId,
  systemNotesToolbarPlacement = 'panel',
  showFooterSections = true,
}: {
  stats?: ReactNode
  header: ReactNode
  lineItems: ReactNode
  relatedMasterData?: ReactNode
  relatedMasterDataLabel?: string
  relatedMasterDataCount?: number
  relatedMasterDataToolbarTargetId?: string
  relatedMasterDataToolbarPlacement?: 'panel' | 'tab-bar'
  relatedTransactionDocuments?: ReactNode
  relatedTransactionDocumentsLabel?: string
  relatedTransactionDocumentsCount?: number
  relatedTransactionDocumentsToolbarTargetId?: string
  relatedTransactionDocumentsToolbarPlacement?: 'panel' | 'tab-bar'
  relatedRecords?: ReactNode
  relatedRecordsLabel?: string
  relatedRecordsCount?: number
  relatedRecordsToolbarTargetId?: string
  relatedRecordsToolbarPlacement?: 'panel' | 'tab-bar'
  relatedDocuments?: ReactNode
  relatedDocumentsLabel?: string
  relatedDocumentsCount?: number
  relatedDocumentsToolbarTargetId?: string
  relatedDocumentsToolbarPlacement?: 'panel' | 'tab-bar'
  supplementarySections?: ReactNode | ReactNode[]
  communications?: ReactNode
  communicationsCount?: number
  communicationsToolbarTargetId?: string
  communicationsToolbarPlacement?: 'panel' | 'tab-bar'
  systemNotes?: ReactNode
  systemNotesCount?: number
  systemNotesToolbarTargetId?: string
  systemNotesToolbarPlacement?: 'panel' | 'tab-bar'
  showFooterSections?: boolean
}) {
  const extras = Array.isArray(supplementarySections)
    ? supplementarySections.filter(Boolean)
    : supplementarySections
      ? [supplementarySections]
      : []
  const resolvedRelatedMasterData = relatedMasterData ?? relatedRecords
  const resolvedRelatedMasterDataLabel = relatedMasterDataLabel ?? relatedRecordsLabel
  const resolvedRelatedMasterDataCount = relatedMasterDataCount || relatedRecordsCount
  const resolvedRelatedMasterDataToolbarTargetId = relatedMasterDataToolbarTargetId ?? relatedRecordsToolbarTargetId
  const resolvedRelatedMasterDataToolbarPlacement = relatedMasterDataToolbarTargetId
    ? relatedMasterDataToolbarPlacement
    : relatedRecordsToolbarPlacement
  const resolvedRelatedTransactionDocuments = relatedTransactionDocuments ?? relatedDocuments
  const resolvedRelatedTransactionDocumentsLabel = relatedTransactionDocumentsLabel ?? relatedDocumentsLabel
  const resolvedRelatedTransactionDocumentsCount = relatedTransactionDocumentsCount || relatedDocumentsCount
  const resolvedRelatedTransactionDocumentsToolbarTargetId =
    relatedTransactionDocumentsToolbarTargetId ?? relatedDocumentsToolbarTargetId
  const resolvedRelatedTransactionDocumentsToolbarPlacement = relatedTransactionDocumentsToolbarTargetId
    ? relatedTransactionDocumentsToolbarPlacement
    : relatedDocumentsToolbarPlacement
  const shouldUseSharedBottomContainer = Boolean(showFooterSections)
  const footerTabs = shouldUseSharedBottomContainer
    ? [
        {
          key: 'related-records',
          label: resolvedRelatedMasterDataLabel,
          count: resolvedRelatedMasterDataCount,
          content: resolvedRelatedMasterData ?? <FooterEmptyState message="No linked master data records." />,
          toolbarTargetId: resolvedRelatedMasterDataToolbarTargetId,
          toolbarPlacement: resolvedRelatedMasterDataToolbarPlacement,
        },
        {
          key: 'related-documents',
          label: resolvedRelatedTransactionDocumentsLabel,
          count: resolvedRelatedTransactionDocumentsCount,
          content: resolvedRelatedTransactionDocuments ?? <FooterEmptyState message="No linked transaction records." />,
          toolbarTargetId: resolvedRelatedTransactionDocumentsToolbarTargetId,
          toolbarPlacement: resolvedRelatedTransactionDocumentsToolbarPlacement,
        },
        {
          key: 'communications',
          label: 'Communications',
          count: communicationsCount,
          content: communications ?? <FooterEmptyState message="No communications tracked for this record yet." />,
          toolbarTargetId: communicationsToolbarTargetId,
          toolbarPlacement: communicationsToolbarPlacement,
        },
        {
          key: 'system-notes',
          label: 'System Notes',
          count: systemNotesCount,
          content: systemNotes ?? <FooterEmptyState message="No system notes yet." />,
          toolbarTargetId: systemNotesToolbarTargetId,
          toolbarPlacement: systemNotesToolbarPlacement,
        },
      ]
    : []

  return (
    <>
      {stats ? <div className="mb-8">{stats}</div> : null}
      {header}
      {lineItems}
      {showFooterSections
        ? extras.map((section, index) => (
            <div key={index}>{section}</div>
          ))
        : null}
      {shouldUseSharedBottomContainer ? (
        <RecordBottomTabsSection
          defaultActiveKey={
            resolvedRelatedMasterDataCount > 0
              ? 'related-records'
              : resolvedRelatedTransactionDocumentsCount > 0
                ? 'related-documents'
                : communicationsCount > 0
                  ? 'communications'
                  : 'system-notes'
          }
          tabs={footerTabs}
        />
      ) : (
        <>
          {showFooterSections ? resolvedRelatedMasterData : null}
          {showFooterSections ? resolvedRelatedTransactionDocuments : null}
          {showFooterSections ? communications : null}
          {showFooterSections ? systemNotes : null}
        </>
      )}
    </>
  )
}
