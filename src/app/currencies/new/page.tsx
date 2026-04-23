import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import CurrencyCreateForm from '@/components/CurrencyCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { prisma } from '@/lib/prisma'
import { generateNextCurrencyId } from '@/lib/currency-number'

const baseOptions = [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]

export default async function NewCurrencyPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [inactiveOptions, nextCurrencyId, duplicateCurrency] = await Promise.all([
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    generateNextCurrencyId(),
    duplicateFrom
      ? prisma.currency.findUnique({ where: { id: duplicateFrom }, select: { code: true, name: true, symbol: true, decimals: true, isBase: true, active: true } })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/currencies" backLabel="<- Back to Currencies" title="New Currency" formId="create-currency-form">
      <CurrencyCreateForm
        formId="create-currency-form"
        showFooterActions={false}
        redirectBasePath="/currencies"
        baseOptions={baseOptions}
        inactiveOptions={inactiveOptions}
        initialCurrencyId={nextCurrencyId}
        initialValues={duplicateCurrency ? {
          code: `COPY-${duplicateCurrency.code}`.slice(0, 12),
          name: `Copy of ${duplicateCurrency.name}`,
          symbol: duplicateCurrency.symbol,
          decimals: String(duplicateCurrency.decimals),
          isBase: false,
          inactive: !duplicateCurrency.active,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
