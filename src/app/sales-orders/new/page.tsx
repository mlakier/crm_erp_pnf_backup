import { prisma } from '@/lib/prisma'
import SalesOrderCreateFromQuoteForm from '@/components/SalesOrderCreateFromQuoteForm'
import TransactionCreatePageShell from '@/components/TransactionCreatePageShell'

export default async function NewSalesOrderPage() {
  const quotesWithoutSalesOrder = await prisma.quote.findMany({
    where: { salesOrder: null },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <TransactionCreatePageShell
      backHref="/sales-orders"
      backLabel="← Back to Sales Orders"
      title="New Sales Order"
      description="Create a sales order in the full-page transaction flow. Current first pass creates from an open quote."
    >
      <SalesOrderCreateFromQuoteForm
        quotes={quotesWithoutSalesOrder.map((quote) => ({
          id: quote.id,
          label: `${quote.number} - ${quote.customer.name}`,
        }))}
        fullPage
      />
    </TransactionCreatePageShell>
  )
}
