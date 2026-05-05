import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import ClearingDocumentPageClient from '@/components/ClearingDocumentPageClient'

export const runtime = 'nodejs'

export default async function NewClearingDocumentPage() {
  await connection()
  const [accountingPeriods, openItems, statusValues, subsidiaries, currencies] = await Promise.all([
    prisma.accountingPeriod.findMany({
      orderBy: [{ startDate: 'desc' }],
      select: { id: true, name: true },
    }),
    prisma.openItem.findMany({
      where: { isOpen: true },
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        openItemNumber: true,
        sourceNumber: true,
        openItemType: true,
        originalTransactionAmount: true,
      },
    }),
    loadListValues('CLEARING-DOCUMENT-STATUS'),
    prisma.subsidiary.findMany({
      where: { active: true },
      orderBy: [{ subsidiaryId: 'asc' }],
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      where: { active: true },
      orderBy: [{ code: 'asc' }, { currencyId: 'asc' }],
      select: { id: true, code: true, currencyId: true, name: true },
    }),
  ])
  const editableStatusValues = statusValues.filter((value) =>
    ['draft', 'pending approval', 'approved'].includes(value.toLowerCase()),
  )

  return (
    <ClearingDocumentPageClient
      mode="create"
      subsidiaryOptions={subsidiaries.map((subsidiary) => ({
        value: subsidiary.id,
        label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
      }))}
      currencyOptions={currencies.map((currency) => ({
        value: currency.id,
        label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
      }))}
      accountingPeriodOptions={accountingPeriods.map((period) => ({
        value: period.id,
        label: period.name,
      }))}
      openItemOptions={openItems.map((item) => ({
        value: item.id,
        label: `${item.openItemNumber} - ${item.sourceNumber ?? item.openItemType} - ${Number(item.originalTransactionAmount).toFixed(2)}`,
      }))}
      statusOptions={editableStatusValues.map((value) => ({
        value: value.toLowerCase(),
        label: value,
      }))}
      initialHeaderValues={{
        status: 'draft',
        clearingType: 'manual-clearing',
        transactionAmount: '0.00',
        localAmount: '0.00',
        functionalAmount: '0.00',
        groupAmount: '0.00',
      }}
    />
  )
}
