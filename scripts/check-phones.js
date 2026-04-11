const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const re = /^\+1 \(\d{3}\) \d{3}-\d{4}$/

;(async () => {
  const [customers, contacts, vendors] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, phone: true } }),
    prisma.contact.findMany({ select: { id: true, firstName: true, lastName: true, phone: true } }),
    prisma.vendor.findMany({ select: { id: true, name: true, phone: true } }),
  ])

  const bad = (arr) => arr.filter((x) => x.phone && !re.test(x.phone))

  console.log(JSON.stringify({
    customers: { total: customers.length, unformatted: bad(customers).length, sample: bad(customers).slice(0, 10) },
    contacts: { total: contacts.length, unformatted: bad(contacts).length, sample: bad(contacts).slice(0, 10) },
    vendors: { total: vendors.length, unformatted: bad(vendors).length, sample: bad(vendors).slice(0, 10) },
  }, null, 2))

  await prisma.$disconnect()
})().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
