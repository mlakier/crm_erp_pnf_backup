import { prisma } from '@/lib/prisma'

const INVOICE_NUMBER_PREFIX = 'INV-'
const INVOICE_NUMBER_WIDTH = 6

export function formatInvoiceNumber(sequence: number) {
  return `${INVOICE_NUMBER_PREFIX}${String(sequence).padStart(INVOICE_NUMBER_WIDTH, '0')}`
}

export async function generateNextInvoiceNumber() {
  const latestInvoice = await prisma.invoice.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  const latestSequence = latestInvoice?.number
    ? Number.parseInt(latestInvoice.number.replace(INVOICE_NUMBER_PREFIX, ''), 10)
    : 0

  return formatInvoiceNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}
