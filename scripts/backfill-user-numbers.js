const { PrismaClient } = require('@prisma/client')

const USER_NUMBER_PREFIX = 'USER-'
const USER_NUMBER_WIDTH = 6

function formatUserNumber(sequence) {
  return `${USER_NUMBER_PREFIX}${String(sequence).padStart(USER_NUMBER_WIDTH, '0')}`
}

async function main() {
  const prisma = new PrismaClient()

  try {
    const users = await prisma.user.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (users.length === 0) {
      console.log('All users already have a userId. Nothing to backfill.')
      return
    }

    // Find the current max sequence
    const latest = await prisma.user.findFirst({
      where: { userId: { not: null } },
      orderBy: { userId: 'desc' },
      select: { userId: true },
    })

    let nextSequence = 1
    if (latest?.userId) {
      const parsed = Number.parseInt(latest.userId.replace(USER_NUMBER_PREFIX, ''), 10)
      if (!Number.isNaN(parsed)) nextSequence = parsed + 1
    }

    console.log(`Backfilling ${users.length} users starting at ${formatUserNumber(nextSequence)}...`)

    for (const user of users) {
      const userId = formatUserNumber(nextSequence)
      await prisma.user.update({
        where: { id: user.id },
        data: { userId },
      })
      console.log(`  ${user.id} -> ${userId}`)
      nextSequence += 1
    }

    console.log('Done.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
