import JournalEntryDetailClient from '@/components/JournalEntryDetailClient'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadJournalEntryFormOptions } from '@/lib/journal-entry-form-options'
import { loadJournalDetailCustomization } from '@/lib/journal-detail-customization-store'
import { generateNextIntercompanyJournalNumber } from '@/lib/journal-number'

export default async function NewIntercompanyJournalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ customize?: string }>
}) {
  const { customize } = await searchParams
  const isCustomizing = customize === '1'
  const [{ moneySettings }, formOptions, customization, nextNumber] = await Promise.all([
    loadCompanyDisplaySettings(),
    loadJournalEntryFormOptions(),
    loadJournalDetailCustomization(),
    generateNextIntercompanyJournalNumber(),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <JournalEntryDetailClient
      mode="new"
      editing
      detailHref="/intercompany-journals"
      customizeHref="/journals/intercompany/new?customize=1"
      customizing={isCustomizing}
      customization={customization}
      initialNumber={nextNumber}
      initialHeaderValues={{
        number: nextNumber,
        date: today,
        description: '',
        journalType: 'intercompany',
        status: formOptions.statusOptions[0]?.value ?? 'draft',
        subsidiaryId: '',
        currencyId: '',
        accountingPeriodId: '',
        sourceType: '',
        sourceId: '',
        postedByEmployeeId: '',
        approvedByEmployeeId: '',
        createdAt: '-',
        updatedAt: '-',
      }}
      initialLineItems={[]}
      moneySettings={moneySettings}
      {...formOptions}
    />
  )
}
