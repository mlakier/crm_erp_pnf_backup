const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatQuoteNumber(sequence) {
  return `QUO-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.quote.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  if (!latest || !latest.number) {
    return 1
  }

  const parsed = Number.parseInt(latest.number.replace('QUO-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  const opportunities = await prisma.opportunity.findMany({
    where: {
      quote: null,
    },
    include: {
      customer: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (opportunities.length === 0) {
    console.log('No eligible opportunities found.')
    return
  }

  let sequence = await getStartingSequence()
  const created = []

  for (const opportunity of opportunities) {
    const validUntil = opportunity.closeDate
      ? new Date(opportunity.closeDate)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)

    const quote = await prisma.quote.create({
      data: {
        number: formatQuoteNumber(sequence),
        status: 'draft',
        total: opportunity.amount ?? 0,
        validUntil,
        notes: `Generated from opportunity ${opportunity.opportunityNumber ?? opportunity.name}`,
        customerId: opportunity.customerId,
        userId: opportunity.userId,
        opportunityId: opportunity.id,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'quote',
        entityId: quote.id,
        action: 'create',
        summary: `Created quote ${quote.number} from opportunity ${opportunity.opportunityNumber ?? opportunity.name}`,
        userId: opportunity.userId,
      },
    })

    created.push({
      id: quote.id,
      number: quote.number,
      customer: opportunity.customer.name,
      opportunity: opportunity.name,
      opportunityNumber: opportunity.opportunityNumber,
      total: quote.total,
    })

    sequence += 1
  }

  console.log(`Created ${created.length} quotes.`)
  console.log(JSON.stringify(created, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })