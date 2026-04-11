const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const lineItemTemplates = [
  [
    { description: 'Industrial control modules', quantity: 5, unitPrice: 425.0 },
    { description: 'Site installation kit', quantity: 10, unitPrice: 120.5 },
  ],
  [
    { description: 'Office workstation bundles', quantity: 12, unitPrice: 680.0 },
    { description: 'Conference room display mounts', quantity: 4, unitPrice: 220.0 },
  ],
  [
    { description: 'Sensor assemblies', quantity: 24, unitPrice: 145.25 },
    { description: 'Calibration services', quantity: 3, unitPrice: 950.0 },
  ],
  [
    { description: 'Forklift attachments', quantity: 6, unitPrice: 730.0 },
    { description: 'Operator safety package', quantity: 6, unitPrice: 180.0 },
  ],
  [
    { description: 'Packaging cartons', quantity: 150, unitPrice: 12.0 },
    { description: 'Label rolls', quantity: 40, unitPrice: 18.5 },
  ],
  [
    { description: 'Freight lane setup', quantity: 2, unitPrice: 1450.0 },
    { description: 'Dedicated carrier blocks', quantity: 8, unitPrice: 395.0 },
  ],
  [
    { description: 'PPE starter packs', quantity: 35, unitPrice: 84.0 },
    { description: 'Facility signage kits', quantity: 12, unitPrice: 46.5 },
  ],
  [
    { description: 'Managed laptop support', quantity: 15, unitPrice: 210.0 },
    { description: 'Network monitoring licenses', quantity: 15, unitPrice: 95.0 },
  ],
  [
    { description: 'Valve replacement kits', quantity: 18, unitPrice: 275.0 },
    { description: 'Pressure testing service', quantity: 5, unitPrice: 510.0 },
  ],
  [
    { description: 'Facilities maintenance bundles', quantity: 20, unitPrice: 165.0 },
    { description: 'Janitorial supply refill', quantity: 25, unitPrice: 38.0 },
  ],
]

async function main() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, number: true, userId: true },
  })

  const created = []

  for (let index = 0; index < purchaseOrders.length; index += 1) {
    const purchaseOrder = purchaseOrders[purchaseOrders.length - 1 - index]
    const existingCount = await prisma.purchaseOrderLineItem.count({ where: { purchaseOrderId: purchaseOrder.id } })

    if (existingCount > 0) {
      continue
    }

    const templates = lineItemTemplates[index % lineItemTemplates.length]
    let total = 0

    for (const template of templates) {
      const lineTotal = template.quantity * template.unitPrice
      total += lineTotal

      await prisma.purchaseOrderLineItem.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          description: template.description,
          quantity: template.quantity,
          unitPrice: template.unitPrice,
          lineTotal,
        },
      })
    }

    await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: { total },
    })

    await prisma.receipt.create({
      data: {
        purchaseOrderId: purchaseOrder.id,
        quantity: Math.max(1, Math.floor(templates[0].quantity / 2)),
        date: new Date('2026-04-10'),
        notes: 'Initial warehouse receipt',
      },
    })

    await prisma.activity.create({
      data: {
        entityType: 'purchase-order',
        entityId: purchaseOrder.id,
        action: 'update',
        summary: `Seeded line items and receipt for purchase order ${purchaseOrder.number}`,
        userId: purchaseOrder.userId,
      },
    })

    created.push({ number: purchaseOrder.number, lineItems: templates.length, total })
  }

  console.log(`Seeded operations for ${created.length} purchase orders.`)
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