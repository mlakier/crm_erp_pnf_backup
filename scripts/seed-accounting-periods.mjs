import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const yearArg = process.argv[2]
const parsedYear = Number.parseInt(yearArg ?? '2026', 10)
const year = Number.isFinite(parsedYear) ? parsedYear : 2026
const subsidiaryArg = (process.argv[3] ?? '').trim()

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function toUtcDate(yearValue, monthIndex, day) {
  return new Date(Date.UTC(yearValue, monthIndex, day))
}

async function resolveSubsidiaryId(rawValue) {
  if (!rawValue) return null

  const subsidiary = await prisma.subsidiary.findFirst({
    where: {
      OR: [
        { id: rawValue },
        { subsidiaryId: rawValue },
        { name: rawValue },
      ],
    },
    select: { id: true, subsidiaryId: true, name: true },
  })

  if (!subsidiary) {
    throw new Error(`Unable to find subsidiary "${rawValue}"`)
  }

  return subsidiary.id
}

async function main() {
  const subsidiaryId = await resolveSubsidiaryId(subsidiaryArg)
  const results = []

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const startDate = toUtcDate(year, monthIndex, 1)
    const endDate = toUtcDate(year, monthIndex + 1, 0)
    const name = `${monthNames[monthIndex]} ${year}`

    const existing = await prisma.accountingPeriod.findFirst({
      where: {
        name,
        subsidiaryId,
      },
      select: { id: true, name: true },
    })

    if (existing) {
      results.push({ action: 'skipped', name })
      continue
    }

    const created = await prisma.accountingPeriod.create({
      data: {
        name,
        startDate,
        endDate,
        subsidiaryId,
        status: 'open',
        closed: false,
        arLocked: false,
        apLocked: false,
        inventoryLocked: false,
      },
      select: { id: true, name: true },
    })

    await prisma.activity.create({
      data: {
        entityType: 'accounting-period',
        entityId: created.id,
        action: 'create',
        summary: `Seeded accounting period ${created.name}`,
        userId: null,
      },
    })

    results.push({ action: 'created', name: created.name })
  }

  console.log(JSON.stringify({ year, subsidiaryId, results }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
