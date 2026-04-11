const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const US_STATE_PATTERN = /,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/
const US_COUNTRY_PATTERN = /,\s*(US|USA|United States|United States of America)$/i

function normalizeAddress(address) {
  if (!address) return null

  let next = address
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,+/g, ',')
    .trim()

  next = next.replace(/,\s*,/g, ', ')
  next = next.replace(/,$/, '')

  if (US_COUNTRY_PATTERN.test(next)) {
    next = next.replace(US_COUNTRY_PATTERN, ', US')
  } else if (US_STATE_PATTERN.test(next)) {
    next = `${next}, US`
  }

  return next
}

async function backfillCollection(label, records, updateFn) {
  let updated = 0
  const samples = []

  for (const record of records) {
    const current = record.address
    const normalized = normalizeAddress(current)

    if (!current || !normalized || normalized === current) {
      continue
    }

    await updateFn(record.id, normalized)
    updated += 1

    if (samples.length < 10) {
      samples.push({
        name: record.name ?? record.code ?? record.id,
        before: current,
        after: normalized,
      })
    }
  }

  return { label, total: records.length, updated, samples }
}

async function main() {
  const [customers, vendors, locations] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, address: true } }),
    prisma.vendor.findMany({ select: { id: true, name: true, address: true } }),
    prisma.location.findMany({ select: { id: true, code: true, address: true } }),
  ])

  const results = await Promise.all([
    backfillCollection('customers', customers, (id, address) =>
      prisma.customer.update({ where: { id }, data: { address } }),
    ),
    backfillCollection('vendors', vendors, (id, address) =>
      prisma.vendor.update({ where: { id }, data: { address } }),
    ),
    backfillCollection('locations', locations, (id, address) =>
      prisma.location.update({ where: { id }, data: { address } }),
    ),
  ])

  console.log(JSON.stringify(results, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
