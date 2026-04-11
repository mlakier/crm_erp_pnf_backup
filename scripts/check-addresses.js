const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

;(async () => {
  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, customerNumber: true, name: true, address: true } }),
    prisma.vendor.findMany({ select: { id: true, vendorNumber: true, name: true, address: true } }),
  ])

  const summarize = (records) => {
    const blank = records.filter((record) => !record.address || !record.address.trim())
    const filled = records.filter((record) => record.address && record.address.trim())
    return {
      total: records.length,
      blank: blank.length,
      filled: filled.length,
      sampleFilled: filled.slice(0, 10),
      sampleBlank: blank.slice(0, 10),
    }
  }

  console.log(
    JSON.stringify(
      {
        customers: summarize(customers),
        vendors: summarize(vendors),
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()
})().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
