const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const sampleOpportunities = [
  { name: 'Q3 Supply Chain Expansion', amount: 185000, stage: 'qualification', closeDate: '2026-06-15' },
  { name: 'Regional Distribution Upgrade', amount: 92000, stage: 'proposal', closeDate: '2026-07-01' },
  { name: 'Clinical Operations Platform', amount: 240000, stage: 'negotiation', closeDate: '2026-06-28' },
  { name: 'Field Services Renewal', amount: 67500, stage: 'prospecting', closeDate: '2026-07-20' },
  { name: 'Retail Margin Improvement Program', amount: 128000, stage: 'proposal', closeDate: '2026-08-05' },
  { name: 'Construction Cost Controls Rollout', amount: 154000, stage: 'qualification', closeDate: '2026-07-12' },
  { name: 'Food Production Traceability', amount: 111500, stage: 'negotiation', closeDate: '2026-06-30' },
  { name: 'Data Warehouse Modernization', amount: 265000, stage: 'prospecting', closeDate: '2026-08-18' },
  { name: 'Property Portfolio Analytics', amount: 89000, stage: 'qualification', closeDate: '2026-07-09' },
  { name: 'Energy Forecasting Suite', amount: 173250, stage: 'proposal', closeDate: '2026-08-01' },
]

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
  const customers = await prisma.customer.findMany({
    where: { customerId: { not: null } },
    orderBy: { customerId: 'asc' },
    select: { id: true, name: true, userId: true, customerId: true },
  })

  const targetCustomers = customers.slice(1, 11)

  if (targetCustomers.length < 10) {
    throw new Error(`Expected at least 10 seeded customers beyond the first account, found ${targetCustomers.length}.`)
  }

  let sequence = await getStartingSequence()
  const created = []

  for (let index = 0; index < sampleOpportunities.length; index += 1) {
    const opportunity = sampleOpportunities[index]
    const customer = targetCustomers[index]

    const record = await prisma.opportunity.create({
      data: {
        opportunityNumber: formatOpportunityNumber(sequence),
        name: opportunity.name,
        amount: opportunity.amount,
        stage: opportunity.stage,
        closeDate: new Date(opportunity.closeDate),
        customerId: customer.id,
        userId: customer.userId,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'opportunity',
        entityId: record.id,
        action: 'create',
        summary: `Created opportunity ${record.opportunityNumber} ${record.name}`,
        userId: customer.userId,
      },
    })

    created.push({
      id: record.id,
      opportunityNumber: record.opportunityNumber,
      name: record.name,
      customer: customer.name,
      customerId: customer.customerId,
      stage: record.stage,
      amount: record.amount,
    })

    sequence += 1
  }

  console.log(`Created ${created.length} opportunities.`)
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