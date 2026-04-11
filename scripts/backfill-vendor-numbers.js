const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatVendorNumber(sequence) {
  return `VEND-${String(sequence).padStart(6, '0')}`
}

async function main() {
  const vendors = await prisma.vendor.findMany({
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      vendorNumber: true,
    },
  })

  let sequence = 1
  let updated = 0

  for (const vendor of vendors) {
    const nextNumber = vendor.vendorNumber ?? formatVendorNumber(sequence)

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { vendorNumber: nextNumber },
    })

    sequence += 1
    updated += 1
  }

  console.log(`Backfilled ${updated} vendor numbers.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
