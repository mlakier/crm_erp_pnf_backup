import { connection } from 'next/server'
import CreditDocumentPageClient from '@/components/CreditDocumentPageClient'
import { loadBillCreditApplicationCandidates } from '@/lib/credit-document-application-context'
import { prisma } from '@/lib/prisma'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { generateNextBillCreditNumber } from '@/lib/bill-credit-number'

export const runtime = 'nodejs'

export default async function NewBillCreditPage() {
  await connection()
  const { moneySettings } = await loadCompanyDisplaySettings()
  const [nextNumber, user, vendors, bills, subsidiaries, currencies, items] = await Promise.all([
    generateNextBillCreditNumber(),
    prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, name: true, email: true } }),
    prisma.vendor.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        vendorNumber: true,
        name: true,
        email: true,
        subsidiary: { select: { id: true } },
        currency: { select: { id: true } },
      },
    }),
    loadBillCreditApplicationCandidates(),
    prisma.subsidiary.findMany({ orderBy: [{ subsidiaryId: 'asc' }], select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: [{ code: 'asc' }], select: { id: true, code: true, currencyId: true, name: true } }),
    prisma.item.findMany({ orderBy: [{ itemId: 'asc' }], select: { id: true, itemId: true, name: true } }),
  ])

  const userLabel = user
    ? user.userId && user.name
      ? `${user.userId} - ${user.name}`
      : user.userId ?? user.name ?? user.email
    : 'System'

  return (
    <CreditDocumentPageClient
      kind="bill-credit"
      mode="create"
      nextNumber={nextNumber}
      userId={user?.id ?? ''}
      userLabel={userLabel}
      counterparties={vendors.map((vendor) => ({
        id: vendor.id,
        reference: vendor.vendorNumber ?? vendor.id,
        name: vendor.name,
        email: vendor.email,
        subsidiaryId: vendor.subsidiary?.id ?? null,
        currencyId: vendor.currency?.id ?? null,
      }))}
      sourceDocuments={bills.map((bill) => ({
        id: bill.id,
        number: bill.number,
        counterpartyId: bill.vendorId,
        subsidiaryId: bill.subsidiaryId ?? null,
        currencyId: bill.currencyId ?? null,
        total: Number(bill.total),
        status: bill.status,
        date: new Date(bill.date).toISOString(),
        openAmount: bill.openAmount,
        currencyCode: bill.currencyCode ?? null,
        userId: bill.userId ?? null,
      }))}
      subsidiaries={subsidiaries.map((subsidiary) => ({
        value: subsidiary.id,
        label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
      }))}
      currencies={currencies.map((currency) => ({
        value: currency.id,
        label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
      }))}
      items={items}
      moneySettings={moneySettings}
    />
  )
}
