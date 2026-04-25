import QuoteCreatePageClient from '@/components/QuoteCreatePageClient'
import { prisma } from '@/lib/prisma'
import { generateNextQuoteNumber } from '@/lib/quote-number'
import { loadQuoteDetailCustomization } from '@/lib/quotes-detail-customization-store'
import { loadListValues } from '@/lib/load-list-values'
import { toNumericValue } from '@/lib/format'

export default async function NewQuotePage() {
  const [opportunities, customers, nextNumber, customization, statusValues] = await Promise.all([
    prisma.opportunity.findMany({
      where: { quote: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: {
          include: {
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
          },
        },
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
        lineItems: {
          orderBy: { createdAt: 'asc' },
          include: {
            item: { select: { id: true, itemId: true, name: true } },
          },
        },
      },
    }),
    prisma.customer.findMany({
      orderBy: { customerId: 'asc' },
      where: { inactive: false },
      select: { id: true, customerId: true, name: true },
    }),
    generateNextQuoteNumber(),
    loadQuoteDetailCustomization(),
    loadListValues('QUOTE-STATUS'),
  ])

  return (
    <QuoteCreatePageClient
      nextNumber={nextNumber}
      opportunities={opportunities.map((opportunity) => ({
        ...opportunity,
        amount: toNumericValue(opportunity.amount, 0),
        closeDate: opportunity.closeDate ? opportunity.closeDate.toISOString().slice(0, 10) : null,
        lineItems: opportunity.lineItems.map((line) => ({
          ...line,
          unitPrice: toNumericValue(line.unitPrice, 0),
          lineTotal: toNumericValue(line.lineTotal, 0),
        })),
      }))}
      customers={customers}
      customization={customization}
      statusOptions={statusValues.map((status) => ({
        value: status.toLowerCase(),
        label: status,
      }))}
    />
  )
}
