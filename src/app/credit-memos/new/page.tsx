import { connection } from 'next/server'
import CreditDocumentPageClient from '@/components/CreditDocumentPageClient'
import { loadCreditMemoApplicationCandidates } from '@/lib/credit-document-application-context'
import { prisma } from '@/lib/prisma'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { generateNextCreditMemoNumber } from '@/lib/credit-memo-number'

export const runtime = 'nodejs'

export default async function NewCreditMemoPage() {
  await connection()
  const { moneySettings } = await loadCompanyDisplaySettings()
  const [nextNumber, user, customers, invoices, subsidiaries, currencies, items] = await Promise.all([
    generateNextCreditMemoNumber(),
    prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, name: true, email: true } }),
    prisma.customer.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        customerId: true,
        name: true,
        email: true,
        subsidiary: { select: { id: true } },
        currency: { select: { id: true } },
      },
    }),
    loadCreditMemoApplicationCandidates(),
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
      kind="credit-memo"
      mode="create"
      nextNumber={nextNumber}
      userId={user?.id ?? ''}
      userLabel={userLabel}
      counterparties={customers.map((customer) => ({
        id: customer.id,
        reference: customer.customerId ?? customer.id,
        name: customer.name,
        email: customer.email,
        subsidiaryId: customer.subsidiary?.id ?? null,
        currencyId: customer.currency?.id ?? null,
      }))}
      sourceDocuments={invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        counterpartyId: invoice.customerId,
        subsidiaryId: invoice.subsidiaryId ?? null,
        currencyId: invoice.currencyId ?? null,
        total: Number(invoice.total),
        status: invoice.status,
        date: new Date(invoice.date).toISOString(),
        openAmount: invoice.openAmount,
        currencyCode: invoice.currencyCode ?? null,
        userId: invoice.userId ?? null,
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
