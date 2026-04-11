import { prisma } from '@/lib/prisma'

const QUOTE_NUMBER_PREFIX = 'QUO-'
const QUOTE_NUMBER_WIDTH = 6

export function formatQuoteNumber(sequence: number) {
  return `${QUOTE_NUMBER_PREFIX}${String(sequence).padStart(QUOTE_NUMBER_WIDTH, '0')}`
}

export async function generateNextQuoteNumber() {
  const latestQuote = await prisma.quote.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  const latestSequence = latestQuote?.number
    ? Number.parseInt(latestQuote.number.replace(QUOTE_NUMBER_PREFIX, ''), 10)
    : 0

  return formatQuoteNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}