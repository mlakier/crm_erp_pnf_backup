import { prisma } from '@/lib/prisma'
import SalesOrderCreateFromQuoteForm from '@/components/SalesOrderCreateFromQuoteForm'
import TransactionCreatePageShell from '@/components/TransactionCreatePageShell'
import SalesOrderCreatePageClient from '@/components/SalesOrderCreatePageClient'
import { generateNextSalesOrderNumber } from '@/lib/sales-order-number'
import { loadSalesOrderDetailCustomization } from '@/lib/sales-order-detail-customization-store'
import { loadListValues } from '@/lib/load-list-values'

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [nextNumber, customization, statusValues, customers, users, quotesWithoutSalesOrder, subsidiaries, currencies, items] = await Promise.all([
    generateNextSalesOrderNumber(),
    loadSalesOrderDetailCustomization(),
    loadListValues('SO-STATUS'),
    prisma.customer.findMany({
      orderBy: { customerId: 'asc' },
      include: {
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
      },
      take: 500,
    }),
    prisma.user.findMany({
      orderBy: { userId: 'asc' },
      select: { id: true, userId: true, name: true, email: true },
      take: 500,
    }),
    duplicateFrom
      ? Promise.resolve([])
      : prisma.quote.findMany({
          where: { salesOrder: null },
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: { itemId: 'asc' },
      select: { id: true, itemId: true, name: true, listPrice: true },
      take: 500,
    }),
  ])

  if (!duplicateFrom) {
    return (
      <SalesOrderCreatePageClient
        nextNumber={nextNumber}
        customers={customers.map((customer) => ({
          id: customer.id,
          customerId: customer.customerId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          inactive: customer.inactive,
          subsidiary: customer.subsidiary,
          currency: customer.currency,
        }))}
        users={users}
        quotes={quotesWithoutSalesOrder.map((quote) => ({
          id: quote.id,
          label: `${quote.number} - ${quote.customer.name}`,
        }))}
        subsidiaries={subsidiaries}
        currencies={currencies}
        items={items.map((item) => ({
          id: item.id,
          itemId: item.itemId ?? item.id,
          name: item.name,
          unitPrice: Number(item.listPrice ?? 0),
        }))}
        customization={customization}
        statusOptions={statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
      />
    )
  }

  return (
    <TransactionCreatePageShell
      backHref="/sales-orders"
      backLabel="<- Back to Sales Orders"
      title="New Sales Order"
      description="Create a sales order in the full-page transaction flow. Current first pass creates from an open quote."
      formId="create-sales-order-form"
    >
      <SalesOrderCreateFromQuoteForm
        formId="create-sales-order-form"
        quotes={quotesWithoutSalesOrder.map((quote) => ({
          id: quote.id,
          label: `${quote.number} - ${quote.customer.name}`,
        }))}
        duplicateFrom={duplicateFrom}
        fullPage
      />
    </TransactionCreatePageShell>
  )
}
