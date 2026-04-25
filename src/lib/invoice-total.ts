import { prisma } from '@/lib/prisma'
import { sumMoney } from '@/lib/money'
import { toNumericValue } from '@/lib/format'

export async function syncInvoiceTotal(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: {
        select: {
          lineTotal: true,
        },
      },
    },
  })

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  const total = invoice.lineItems.length
    ? sumMoney(invoice.lineItems.map((line) => toNumericValue(line.lineTotal)))
    : 0

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { total },
  })
}
