const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatCustomerNumber(sequence) {
  return `CUST-${String(sequence).padStart(6, '0')}`
}

async function main() {
  const customers = await prisma.customer.findMany({
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      customerId: true,
    },
  })

  let sequence = 1
  let updated = 0

  for (const customer of customers) {
    const nextNumber = customer.customerId ?? formatCustomerNumber(sequence)

    await prisma.customer.update({
      where: { id: customer.id },
      data: { customerId: nextNumber },
    })

    sequence += 1
    updated += 1
  }

  console.log(`Backfilled ${updated} customer numbers.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
