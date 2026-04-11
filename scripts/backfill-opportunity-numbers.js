const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatOpportunityNumber(sequence) {
  return `OPP-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.opportunity.findFirst({
    where: { opportunityNumber: { not: null } },
    orderBy: { opportunityNumber: 'desc' },
    select: { opportunityNumber: true },
  })

  if (!latest || !latest.opportunityNumber) {
    return 1
  }

  const parsed = Number.parseInt(latest.opportunityNumber.replace('OPP-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  const opportunities = await prisma.opportunity.findMany({
    where: { opportunityNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  let sequence = await getStartingSequence()

  for (const opportunity of opportunities) {
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { opportunityNumber: formatOpportunityNumber(sequence) },
    })

    sequence += 1
  }

  console.log(`Backfilled ${opportunities.length} opportunity numbers.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })