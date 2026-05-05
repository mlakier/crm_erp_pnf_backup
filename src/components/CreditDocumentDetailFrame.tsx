import type { ReactNode } from 'react'
import type { RecordHeaderSection } from '@/components/RecordHeaderDetails'
import RecordHeaderDetails from '@/components/RecordHeaderDetails'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import RelatedRecordsSection, { type RelatedRecordsTab } from '@/components/RelatedRecordsSection'
import CommunicationsSection from '@/components/CommunicationsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import type { TransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import type { TransactionStatCardSlot, TransactionStatDefinition } from '@/lib/transaction-page-config'

type ActivityLike = {
  id: string
  createdAt: Date
  summary: string
  userId: string | null
}

export default function CreditDocumentDetailFrame<TRecord>({
  backHref,
  backLabel,
  meta,
  title,
  record,
  stats,
  visibleStatCards,
  currencySection,
  referenceSections,
  referenceColumns = 2,
  headerSections,
  headerContainerTitle,
  headerContainerDescription,
  relatedRecordTabs,
  relatedDocumentTabs,
  relatedDocumentsSection,
  relatedDocumentsCount,
  activities,
  activityUserLabelById,
  compose,
  lineItemsSection,
  applicationsSection,
  glImpactSection,
  supplementarySections,
  actions,
  formatDate,
}: {
  backHref: string
  backLabel: string
  meta: string
  title: string
  record: TRecord
  stats: TransactionStatDefinition<TRecord>[]
  visibleStatCards?: Array<TransactionStatCardSlot<string>>
  currencySection?: ReactNode
  referenceSections?: RecordHeaderSection[]
  referenceColumns?: number
  headerSections: RecordHeaderSection[]
  headerContainerTitle: string
  headerContainerDescription: string
  relatedRecordTabs: RelatedRecordsTab[]
  relatedDocumentTabs: RelatedRecordsTab[]
  relatedDocumentsSection?: ReactNode
  relatedDocumentsCount?: number
  activities: ActivityLike[]
  activityUserLabelById: Record<string, string>
  compose?: TransactionCommunicationComposePayload
  lineItemsSection: ReactNode
  applicationsSection?: ReactNode
  glImpactSection?: ReactNode
  supplementarySections?: ReactNode | ReactNode[]
  actions?: ReactNode
  formatDate: (value: Date) => string
}) {
  const systemNotes = activities
    .map((activity) => {
      const parsed = parseFieldChangeSummary(activity.summary)
      if (!parsed) return null
      return {
        id: activity.id,
        date: formatDate(activity.createdAt),
        setBy: activity.userId ? activityUserLabelById[activity.userId] ?? activity.userId : 'System',
        context: parsed.context,
        fieldName: parsed.fieldName,
        oldValue: parsed.oldValue,
        newValue: parsed.newValue,
      }
    })
    .filter((note): note is Exclude<typeof note, null> => Boolean(note))

  const communications = activities
    .map((activity) => {
      const parsed = parseCommunicationSummary(activity.summary)
      if (!parsed) return null
      return {
        id: activity.id,
        date: formatDate(activity.createdAt),
        direction: parsed.direction || '-',
        channel: parsed.channel || '-',
        subject: parsed.subject || '-',
        from: parsed.from || '-',
        to: parsed.to || '-',
        status: parsed.status || '-',
      }
    })
    .filter((entry): entry is Exclude<typeof entry, null> => Boolean(entry))

  const relatedRecordCount = relatedRecordTabs.reduce((sum, tab) => sum + tab.count, 0)
  const fallbackRelatedDocumentCount = relatedDocumentTabs.reduce((sum, tab) => sum + tab.count, 0)
  const resolvedRelatedDocumentCount = relatedDocumentsCount ?? fallbackRelatedDocumentCount

  return (
    <RecordDetailPageShell
      backHref={backHref}
      backLabel={backLabel}
      meta={meta}
      title={title}
      actions={actions}
    >
      <TransactionDetailFrame
        stats={<TransactionStatsRow record={record} stats={stats} visibleStatCards={visibleStatCards} />}
        header={
          <div className="space-y-6">
            {currencySection}
            {referenceSections?.length ? (
              <RecordHeaderDetails
                editing={false}
                sections={referenceSections}
                columns={referenceColumns}
                containerTitle="Reference Details"
                containerDescription="Expanded context from linked records on this credit document."
                showSubsections={false}
              />
            ) : null}
            <RecordHeaderDetails
              editing={false}
              sections={headerSections}
              columns={4}
              containerTitle={headerContainerTitle}
              containerDescription={headerContainerDescription}
              showSubsections={false}
            />
          </div>
        }
        lineItems={lineItemsSection}
        supplementarySections={
          [
            applicationsSection,
            glImpactSection,
            ...(Array.isArray(supplementarySections)
              ? supplementarySections.filter(Boolean)
              : supplementarySections
                ? [supplementarySections]
                : []),
          ].filter(Boolean)
        }
        relatedMasterData={<RelatedRecordsSection embedded tabs={relatedRecordTabs} />}
        relatedMasterDataCount={relatedRecordCount}
        relatedTransactionDocuments={
          relatedDocumentsSection ?? <RelatedRecordsSection embedded tabs={relatedDocumentTabs} />
        }
        relatedTransactionDocumentsCount={resolvedRelatedDocumentCount}
        communications={<CommunicationsSection embedded rows={communications} compose={compose} />}
        communicationsCount={communications.length}
        systemNotes={<SystemNotesSection embedded notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
      />
    </RecordDetailPageShell>
  )
}
