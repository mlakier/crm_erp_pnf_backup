const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/
const CITY_STATE_COUNTRY_RE = /,\s*([^,]+),\s*([A-Z]{2}),\s*US$/

const ZIP_BY_CITY_STATE = {
  'Chicago,IL': '60606',
  'Long Beach,CA': '90802',
  'Denver,CO': '80202',
  'Dallas,TX': '75207',
  'Seattle,WA': '98104',
  'Phoenix,AZ': '85004',
  'Portland,OR': '97204',
  'Austin,TX': '78701',
  'Miami,FL': '33131',
  'Houston,TX': '77002',
  'Cleveland,OH': '44114',
  'Columbus,OH': '43215',
  'San Jose,CA': '95113',
  'Pittsburgh,PA': '15222',
  'Atlanta,GA': '30303',
  'Memphis,TN': '38103',
  'Tulsa,OK': '74103',
  'Raleigh,NC': '27601',
  'Tampa,FL': '33602',
  'Nashville,TN': '37201',
}

function withZip(address) {
  if (!address || ZIP_RE.test(address)) return address

  const match = address.match(CITY_STATE_COUNTRY_RE)
  if (!match) return address

  const city = match[1].trim()
  const state = match[2].trim()
  const zip = ZIP_BY_CITY_STATE[`${city},${state}`]
  if (!zip) return address

  return address.replace(/,\s*([A-Z]{2}),\s*US$/, `, $1 ${zip}, US`)
}

async function backfillRecords(label, records, update) {
  let updated = 0
  const samples = []

  for (const record of records) {
    const nextAddress = withZip(record.address)
    if (!record.address || nextAddress === record.address) continue

    await update(record.id, nextAddress)
    updated += 1

    if (samples.length < 10) {
      samples.push({
        name: record.name,
        before: record.address,
        after: nextAddress,
      })
    }
  }

  return { label, total: records.length, updated, samples }
}

async function main() {
  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, address: true } }),
    prisma.vendor.findMany({ select: { id: true, name: true, address: true } }),
  ])

  const results = await Promise.all([
    backfillRecords('customers', customers, (id, address) =>
      prisma.customer.update({ where: { id }, data: { address } }),
    ),
    backfillRecords('vendors', vendors, (id, address) =>
      prisma.vendor.update({ where: { id }, data: { address } }),
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
