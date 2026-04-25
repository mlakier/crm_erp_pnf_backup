import { prisma } from '@/lib/prisma'
import JournalCreatePageClient from '@/components/JournalCreatePageClient'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadJournalEntryFormOptions } from '@/lib/journal-entry-form-options'
import { loadJournalDetailCustomization } from '@/lib/journal-detail-customization-store'
import { generateNextJournalNumber } from '@/lib/journal-number'

export default async function NewJournalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ customize?: string; duplicateFrom?: string }>
}) {
  const { customize, duplicateFrom } = await searchParams
  const isCustomizing = customize === '1'
  const [{ moneySettings }, formOptions, customization, nextNumber, sourceEntry] = await Promise.all([
    loadCompanyDisplaySettings(),
    loadJournalEntryFormOptions(),
    loadJournalDetailCustomization(),
    generateNextJournalNumber(),
    duplicateFrom
      ? prisma.journalEntry.findUnique({
          where: { id: duplicateFrom },
          include: {
            lineItems: {
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        })
      : Promise.resolve(null),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <JournalCreatePageClient
      mode="new"
      editing
      detailHref="/journals"
      customizeHref="/journals/new?customize=1"
      customizing={isCustomizing}
      customization={customization}
      initialNumber={nextNumber}
      initialHeaderValues={{
        number: nextNumber,
        date: today,
        description: sourceEntry?.description ?? '',
        journalType: sourceEntry?.journalType ?? 'standard',
        status: sourceEntry?.status ?? formOptions.statusOptions[0]?.value ?? 'draft',
        subsidiaryId: sourceEntry?.subsidiaryId ?? '',
        currencyId: sourceEntry?.currencyId ?? '',
        accountingPeriodId: sourceEntry?.accountingPeriodId ?? '',
        sourceType: sourceEntry?.sourceType ?? '',
        sourceId: sourceEntry?.sourceId ?? '',
        postedByEmployeeId: sourceEntry?.postedByEmployeeId ?? '',
        approvedByEmployeeId: sourceEntry?.approvedByEmployeeId ?? '',
        createdAt: '-',
        updatedAt: '-',
      }}
      initialLineItems={
        sourceEntry?.lineItems.map((line) => ({
          key: `dup-${line.id}`,
          displayOrder: line.displayOrder,
          accountId: line.accountId,
          description: line.description ?? '',
          debit: String(line.debit),
          credit: String(line.credit),
          memo: line.memo ?? '',
          subsidiaryId: line.subsidiaryId ?? '',
          departmentId: line.departmentId ?? '',
          locationId: line.locationId ?? '',
          projectId: line.projectId ?? '',
          customerId: line.customerId ?? '',
          vendorId: line.vendorId ?? '',
          itemId: line.itemId ?? '',
          employeeId: line.employeeId ?? '',
        })) ?? []
      }
      moneySettings={moneySettings}
      {...formOptions}
    />
  )
}
