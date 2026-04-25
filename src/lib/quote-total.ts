import { prisma } from '@/lib/prisma'
import { sumMoney } from '@/lib/money'

export async function syncQuoteTotal(quoteId: string) {
  const lineItems = await prisma.quoteLineItem.findMany({
    where: { quoteId },
    select: { lineTotal: true },
  })

  const total = sumMoney(lineItems.map((item) => item.lineTotal))

  return prisma.quote.update({
    where: { id: quoteId },
    data: { total },
  })
}
