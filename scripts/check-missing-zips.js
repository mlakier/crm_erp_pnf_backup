const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/

function missingZip(records) {
  return records.filter((record) => record.address && !ZIP_RE.test(record.address))
}

;(async () => {
  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, customerNumber: true, name: true, address: true } }),
    prisma.vendor.findMany({ select: { id: true, vendorNumber: true, name: true, address: true } }),
  ])

  console.log(JSON.stringify({
    customers: missingZip(customers),
    vendors: missingZip(vendors),
  }, null, 2))

  await prisma.$disconnect()
})().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
