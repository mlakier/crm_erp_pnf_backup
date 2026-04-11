const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const [customer, vendor, contact, opportunity, purchaseOrder] = await Promise.all([
    prisma.customer.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.vendor.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.contact.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.opportunity.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' } }),
  ])

  const activityData = []

  if (customer) {
    activityData.push(
      {
        entityType: 'customer',
        entityId: customer.id,
        action: 'create',
        summary: `Imported customer ${customer.name} from migration batch`,
        userId: customer.userId,
      },
      {
        entityType: 'customer',
        entityId: customer.id,
        action: 'update',
        summary: `Updated customer ${customer.name} industry and contact info`,
        userId: customer.userId,
      }
    )
  }

  if (vendor) {
    activityData.push(
      {
        entityType: 'vendor',
        entityId: vendor.id,
        action: 'create',
        summary: `Created vendor profile for ${vendor.name}`,
        userId: null,
      },
      {
        entityType: 'vendor',
        entityId: vendor.id,
        action: 'update',
        summary: `Reviewed tax details for vendor ${vendor.name}`,
        userId: null,
      }
    )
  }

  if (contact) {
    activityData.push({
      entityType: 'contact',
      entityId: contact.id,
      action: 'create',
      summary: `Added contact ${contact.firstName} ${contact.lastName}`,
      userId: contact.userId,
    })
  }

  if (opportunity) {
    activityData.push(
      {
        entityType: 'opportunity',
        entityId: opportunity.id,
        action: 'create',
        summary: `Opened opportunity ${opportunity.name}`,
        userId: opportunity.userId,
      },
      {
        entityType: 'opportunity',
        entityId: opportunity.id,
        action: 'update',
        summary: `Moved opportunity ${opportunity.name} to ${opportunity.stage}`,
        userId: opportunity.userId,
      }
    )
  }

  if (purchaseOrder) {
    activityData.push(
      {
        entityType: 'purchase-order',
        entityId: purchaseOrder.id,
        action: 'create',
        summary: `Created purchase order ${purchaseOrder.number}`,
        userId: purchaseOrder.userId,
      },
      {
        entityType: 'purchase-order',
        entityId: purchaseOrder.id,
        action: 'update',
        summary: `Updated status for purchase order ${purchaseOrder.number} to ${purchaseOrder.status}`,
        userId: purchaseOrder.userId,
      },
      {
        entityType: 'purchase-order',
        entityId: purchaseOrder.id,
        action: 'delete',
        summary: `Test deletion event for purchase order ${purchaseOrder.number}`,
        userId: purchaseOrder.userId,
      }
    )
  }

  if (activityData.length === 0) {
    console.log('No source records found. No test activity created.')
    return
  }

  const created = await prisma.activity.createMany({ data: activityData })
  console.log(`Inserted ${created.count} activity rows.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
