import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import AccountingPeriodCreateForm from '@/components/AccountingPeriodCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { prisma } from '@/lib/prisma'

export default async function NewAccountingPeriodPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [subsidiaryOptions, statusOptions, duplicatePeriod] = await Promise.all([
    loadListOptionsForSource({ sourceType: 'reference', sourceKey: 'subsidiaries' }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-ACCOUNTING-PERIOD-STATUS' }).then((options) =>
      options.map((option) => ({ value: option.value.toLowerCase(), label: option.label }))
    ),
    duplicateFrom
      ? prisma.accountingPeriod.findUnique({
          where: { id: duplicateFrom },
          select: {
            name: true,
            startDate: true,
            endDate: true,
            subsidiaryId: true,
            status: true,
            closed: true,
            arLocked: true,
            apLocked: true,
            inventoryLocked: true,
          },
        })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell
      backHref="/accounting-periods"
      backLabel="<- Back to Accounting Periods"
      title="New Accounting Period"
      formId="create-accounting-period-form"
    >
      <AccountingPeriodCreateForm
        formId="create-accounting-period-form"
        showFooterActions={false}
        redirectBasePath="/accounting-periods"
        subsidiaryOptions={subsidiaryOptions}
        statusOptions={statusOptions}
        initialValues={duplicatePeriod ? {
          name: `Copy of ${duplicatePeriod.name}`,
          startDate: duplicatePeriod.startDate.toISOString().slice(0, 10),
          endDate: duplicatePeriod.endDate.toISOString().slice(0, 10),
          subsidiaryId: duplicatePeriod.subsidiaryId,
          status: duplicatePeriod.status,
          closed: duplicatePeriod.closed,
          arLocked: duplicatePeriod.arLocked,
          apLocked: duplicatePeriod.apLocked,
          inventoryLocked: duplicatePeriod.inventoryLocked,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
