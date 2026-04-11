const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('hasActivity', typeof prisma.activity)
  const rows = await prisma.activity.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  })
  console.log('count', rows.length)
  console.log(JSON.stringify(rows, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
