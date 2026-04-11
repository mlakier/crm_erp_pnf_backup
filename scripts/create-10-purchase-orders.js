const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const sampleOrders = [
  { status: 'draft', total: 4825.75 },
  { status: 'pending approval', total: 12990.0 },
  { status: 'approved', total: 7640.5 },
  { status: 'sent', total: 15420.25 },
  { status: 'received', total: 3980.0 },
  { status: 'approved', total: 22110.4 },
  { status: 'pending approval', total: 6115.9 },
  { status: 'draft', total: 8450.0 },
  { status: 'sent', total: 17325.6 },
  { status: 'received', total: 9520.3 },
]

function formatPurchaseOrderNumber(sequence) {
  return `PO-${String(sequence).padStart(6, '0')}`
}

async function getStartingSequence() {
  const orders = await prisma.purchaseOrder.findMany({
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 50,
  })

  for (const order of orders) {
    const match = order.number.match(/(\d+)$/)
    if (match) {
      return Number.parseInt(match[1], 10) + 1
    }
  }

  return 1
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: 'admin@example.com' },
    select: { id: true },
  })

  if (!owner) {
    throw new Error('Admin user not found. Cannot create purchase orders.')
  }

  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, name: true, vendorNumber: true },
  })

  if (vendors.length < 10) {
    throw new Error(`Expected at least 10 vendors, found ${vendors.length}.`)
  }

  vendors.reverse()

  let sequence = await getStartingSequence()
  const created = []

  for (let index = 0; index < sampleOrders.length; index += 1) {
    const vendor = vendors[index]
    const order = sampleOrders[index]

    const record = await prisma.purchaseOrder.create({
      data: {
        number: formatPurchaseOrderNumber(sequence),
        status: order.status,
        total: order.total,
        vendorId: vendor.id,
        userId: owner.id,
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'purchase-order',
        entityId: record.id,
        action: 'create',
        summary: `Created purchase order ${record.number}`,
        userId: owner.id,
      },
    })

    created.push({
      id: record.id,
      number: record.number,
      vendor: vendor.name,
      vendorNumber: vendor.vendorNumber,
      total: record.total,
      status: record.status,
    })
    sequence += 1
  }

  console.log(`Created ${created.length} purchase orders.`)
  console.log(JSON.stringify(created, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })