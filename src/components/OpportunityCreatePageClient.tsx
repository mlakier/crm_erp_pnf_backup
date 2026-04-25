'use client'

import TransactionCreatePageShell from '@/components/TransactionCreatePageShell'
import OpportunityCreateForm from '@/components/OpportunityCreateForm'
import { RecordDetailSection } from '@/components/RecordDetailPanels'
import type { SelectOption } from '@/lib/list-source'

type ItemOption = { id: string; name: string; listPrice: number; itemId: string | null }
type CustomerOption = { id: string; name: string }
type InitialLineItem = {
  itemId: string | null
  description: string
  quantity: number
  unitPrice: number
  notes: string | null
}

export default function OpportunityCreatePageClient({
  userId,
  customers,
  items,
  stageOptions,
  initialValues,
}: {
  userId: string
  customers: CustomerOption[]
  items: ItemOption[]
  stageOptions: SelectOption[]
  initialValues?: {
    name?: string
    amount?: string
    stage?: string
    closeDate?: string
    customerId?: string
    lineItems?: InitialLineItem[]
  }
}) {
  return (
    <TransactionCreatePageShell
      backHref="/opportunities"
      backLabel="<- Back to Opportunities"
      title={initialValues ? 'Duplicate Opportunity' : 'New Opportunity'}
      description="Opportunity ID is generated automatically when the record is created."
    >
      <RecordDetailSection
        title="Opportunity Details"
        count={0}
        summary="Create"
      >
        <div className="px-6 py-4">
          <OpportunityCreateForm
            userId={userId}
            customers={customers}
            items={items}
            stageOptions={stageOptions}
            fullPage
            initialValues={initialValues}
          />
        </div>
      </RecordDetailSection>
    </TransactionCreatePageShell>
  )
}
