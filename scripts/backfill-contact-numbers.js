const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatContactNumber(sequence) {
  return `CONT-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const latest = await prisma.contact.findFirst({
    where: { contactNumber: { not: null } },
    orderBy: { contactNumber: 'desc' },
    select: { contactNumber: true },
  })

  if (!latest || !latest.contactNumber) {
    return 1
  }

  const parsed = Number.parseInt(latest.contactNumber.replace('CONT-', ''), 10)
  return Number.isNaN(parsed) ? 1 : parsed + 1
}

async function main() {
  const contacts = await prisma.contact.findMany({
    where: { contactNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  let sequence = await getStartingSequence()

  for (const contact of contacts) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { contactNumber: formatContactNumber(sequence) },
    })

    sequence += 1
  }

  console.log(`Backfilled ${contacts.length} contact numbers.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })