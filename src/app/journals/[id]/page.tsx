import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import JournalEntryDetailClient from '@/components/JournalEntryDetailClient'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadJournalEntryFormOptions } from '@/lib/journal-entry-form-options'
import { loadJournalDetailCustomization } from '@/lib/journal-detail-customization-store'
import { fmtDocumentDate, toNumericValue } from '@/lib/format'
import { parseFieldChangeSummary } from '@/lib/activity'
import { loadDocumentRelationshipSummaries } from '@/lib/document-relationships'

export default async function JournalEntryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const [{ moneySettings }, formOptions, customization, entry, activities, linkedDocuments] = await Promise.all([
    loadCompanyDisplaySettings(),
    loadJournalEntryFormOptions(),
    loadJournalDetailCustomization(),
    prisma.journalEntry.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, userId: true, name: true, email: true },
        },
        lineItems: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            account: true,
            subsidiary: true,
            department: true,
            location: true,
            project: true,
            customer: true,
            vendor: true,
            item: true,
            employee: true,
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'journal-entry',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadDocumentRelationshipSummaries({
      recordType: 'journal-entry',
      recordId: id,
    }),
  ])

  if (!entry) notFound()

  const activityUserIds = Array.from(new Set(activities.map((activity) => activity.userId).filter(Boolean))) as string[]
  const activityUsers = activityUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: activityUserIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const activityUserLabelById = new Map(
    activityUsers.map((user) => [
      user.id,
      user.userId && user.name ? `${user.userId} - ${user.name}` : user.userId ?? user.name ?? user.email,
    ]),
  )
  const currencyFields = new Set(['Total', 'Debit', 'Credit'])
  const systemNotes = activities
    .map((activity) => {
      const parsed = parseFieldChangeSummary(activity.summary)
      if (!parsed) return null

      return {
        id: activity.id,
        date: fmtDocumentDate(activity.createdAt, moneySettings),
        setBy: activity.userId ? activityUserLabelById.get(activity.userId) ?? activity.userId : 'System',
        context: parsed.context,
        fieldName: parsed.fieldName,
        oldValue: formatSystemNoteValue(parsed.fieldName, parsed.oldValue, moneySettings, currencyFields),
        newValue: formatSystemNoteValue(parsed.fieldName, parsed.newValue, moneySettings, currencyFields),
      }
    })
    .filter((note): note is Exclude<typeof note, null> => Boolean(note))

  return (
    <JournalEntryDetailClient
      mode="detail"
      editing={isEditing}
      detailHref={`/journals/${entry.id}`}
      customizeHref={`/journals/${entry.id}?customize=1`}
      customizing={isCustomizing}
      customization={customization}
      entryId={entry.id}
      initialNumber={entry.number}
      initialHeaderValues={{
        number: entry.number,
        date: new Date(entry.date).toISOString().slice(0, 10),
        description: entry.description ?? '',
        journalType: entry.journalType,
        status: entry.status,
        isOpenItemRelevant: entry.isOpenItemRelevant ? 'true' : 'false',
        subsidiaryId: entry.subsidiaryId ?? '',
        currencyId: entry.currencyId ?? '',
        accountingPeriodId: entry.accountingPeriodId ?? '',
        total: entry.total.toString(),
        sourceType: entry.sourceType ?? '',
        sourceId: entry.sourceId ?? '',
        reversesJournalEntryId: entry.reversesJournalEntryId ?? '',
        reversalReasonCode: entry.reversalReasonCode ?? '',
        userId: entry.userId ?? '',
        postedByEmployeeId: entry.postedByEmployeeId ?? '',
        approvedByEmployeeId: entry.approvedByEmployeeId ?? '',
        createdAt: fmtDocumentDate(entry.createdAt, moneySettings),
        updatedAt: fmtDocumentDate(entry.updatedAt, moneySettings),
      }}
      createdByUserLabel={
        entry.user
          ? entry.user.userId && entry.user.name
            ? `${entry.user.userId} - ${entry.user.name}`
            : entry.user.userId ?? entry.user.name ?? entry.user.email
          : '-'
      }
      initialLineItems={entry.lineItems.map((line) => ({
        key: line.id,
        displayOrder: line.displayOrder,
        accountId: line.accountId,
        activityTypeCode: line.activityTypeCode ?? '',
        description: line.description ?? '',
        debit: String(toNumericValue(line.debit, 0)),
        credit: String(toNumericValue(line.credit, 0)),
        localDebit: String(toNumericValue(line.localDebit, 0)),
        localCredit: String(toNumericValue(line.localCredit, 0)),
        functionalDebit: String(toNumericValue(line.functionalDebit, 0)),
        functionalCredit: String(toNumericValue(line.functionalCredit, 0)),
        groupDebit: String(toNumericValue(line.groupDebit, 0)),
        groupCredit: String(toNumericValue(line.groupCredit, 0)),
        memo: line.memo ?? '',
        subsidiaryId: line.subsidiaryId ?? '',
        departmentId: line.departmentId ?? '',
        locationId: line.locationId ?? '',
        projectId: line.projectId ?? '',
        customerId: line.customerId ?? '',
        vendorId: line.vendorId ?? '',
        itemId: line.itemId ?? '',
        employeeId: line.employeeId ?? '',
        settlesOpenItemId: line.settlesOpenItemId ?? '',
      }))}
      linkedDocuments={linkedDocuments}
      moneySettings={moneySettings}
      systemNotes={systemNotes}
      {...formOptions}
    />
  )
}

function formatSystemNoteValue(
  fieldName: string,
  value: string,
  moneySettings: Awaited<ReturnType<typeof loadCompanyDisplaySettings>>['moneySettings'],
  currencyFields: Set<string>,
) {
  if (!value || value === '-') return '-'
  if (currencyFields.has(fieldName)) {
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) return toNumericValue(numericValue, 0).toFixed(2)
  }
  return value
}
