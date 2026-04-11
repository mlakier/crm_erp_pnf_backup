const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatSalesOrderNumber(sequence) {
  return `SO-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.salesOrder.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  if (!latest || !latest.number) {
    return 1
  }

  const parsed = Number.parseInt(latest.number.replace('SO-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  const quotes = await prisma.quote.findMany({
    where: {
      salesOrder: null,
    },
    include: {
      customer: true,
      opportunity: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  if (quotes.length === 0) {
    console.log('No eligible quotes found.')
    return
  }

  let sequence = await getStartingSequence()
  const created = []

  for (const quote of quotes) {
    const salesOrder = await prisma.salesOrder.create({
      data: {
        number: formatSalesOrderNumber(sequence),
        status: 'draft',
        total: quote.total,
        customerId: quote.customerId,
        userId: quote.userId,
        quoteId: quote.id,
      },
    })

    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted' },
    })

    await prisma.activity.create({
      data: {
        entityType: 'sales-order',
        entityId: salesOrder.id,
        action: 'create',
        summary: `Created sales order ${salesOrder.number} from quote ${quote.number}`,
        userId: quote.userId,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'quote',
        entityId: quote.id,
        action: 'update',
        summary: `Accepted quote ${quote.number} and created sales order ${salesOrder.number}`,
        userId: quote.userId,
      },
    })

    created.push({
      id: salesOrder.id,
      number: salesOrder.number,
      customer: quote.customer.name,
      quote: quote.number,
      opportunity: quote.opportunity?.name ?? null,
      total: salesOrder.total,
    })

    sequence += 1
  }

  console.log(`Created ${created.length} sales orders.`)
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