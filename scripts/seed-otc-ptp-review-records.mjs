import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function stampNumber(prefix) {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mi = String(now.getUTCMinutes()).padStart(2, '0')
  const ss = String(now.getUTCSeconds()).padStart(2, '0')
  return `${prefix}-${yyyy}${mm}${dd}${hh}${mi}${ss}`
}

async function main() {
  const [user, customer, vendor, subsidiary, currency, department, item] = await Promise.all([
    prisma.user.findFirst({ where: { inactive: false }, orderBy: { createdAt: 'asc' } }),
    prisma.customer.findFirst({ where: { inactive: false }, orderBy: { createdAt: 'asc' } }),
    prisma.vendor.findFirst({ where: { inactive: false }, orderBy: { createdAt: 'asc' } }),
    prisma.subsidiary.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.currency.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.department.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.item.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
  ])

  if (!user) throw new Error('No active user found for seeding review records.')
  if (!customer) throw new Error('No active customer found for seeding review records.')
  if (!vendor) throw new Error('No active vendor found for seeding review records.')

  const amount = 2500
  const quantity = 5
  const unitPrice = amount / quantity
  const sampleNote = 'Review sample seeded for OTC/PTP detail page review.'

  const lead = await prisma.lead.create({
    data: {
      leadNumber: stampNumber('LEA-REVIEW'),
      firstName: 'Review',
      lastName: 'Lead',
      email: 'review.lead@example.com',
      company: customer.name,
      title: 'Sample Buyer',
      status: 'qualified',
      notes: sampleNote,
      expectedValue: amount,
      userId: user.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      customerId: customer.id,
    },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      opportunityNumber: stampNumber('OPP-REVIEW'),
      name: `${customer.name} Review Opportunity`,
      amount,
      stage: 'proposal',
      closeDate: new Date(),
      customerId: customer.id,
      userId: user.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      leads: { connect: { id: lead.id } },
      lineItems: {
        create: {
          description: item?.name ?? 'Review OTC item',
          quantity,
          unitPrice,
          lineTotal: amount,
          notes: sampleNote,
          itemId: item?.id ?? null,
        },
      },
    },
    include: { lineItems: true },
  })

  const quote = await prisma.quote.create({
    data: {
      number: stampNumber('QUO-REVIEW'),
      status: 'draft',
      total: amount,
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      notes: sampleNote,
      customerId: customer.id,
      userId: user.id,
      opportunityId: opportunity.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lineItems: {
        create: {
          description: item?.name ?? 'Review OTC item',
          quantity,
          unitPrice,
          lineTotal: amount,
          notes: sampleNote,
          itemId: item?.id ?? null,
        },
      },
    },
    include: { lineItems: true },
  })

  const salesOrder = await prisma.salesOrder.create({
    data: {
      number: stampNumber('SO-REVIEW'),
      status: 'approved',
      total: amount,
      customerId: customer.id,
      userId: user.id,
      quoteId: quote.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lineItems: {
        create: {
          description: item?.name ?? 'Review OTC item',
          quantity,
          unitPrice,
          lineTotal: amount,
          notes: sampleNote,
          itemId: item?.id ?? null,
        },
      },
    },
    include: { lineItems: true },
  })

  const fulfillment = await prisma.fulfillment.create({
    data: {
      number: stampNumber('FUL-REVIEW'),
      status: 'pending',
      date: new Date(),
      notes: sampleNote,
      salesOrderId: salesOrder.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lines: salesOrder.lineItems[0]
        ? {
            create: {
              quantity,
              notes: sampleNote,
              salesOrderLineItemId: salesOrder.lineItems[0].id,
            },
          }
        : undefined,
    },
  })

  const invoice = await prisma.invoice.create({
    data: {
      number: stampNumber('INV-REVIEW'),
      status: 'open',
      total: amount,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      customerId: customer.id,
      salesOrderId: salesOrder.id,
      userId: user.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lineItems: {
        create: {
          description: item?.name ?? 'Review OTC item',
          quantity,
          unitPrice,
          lineTotal: amount,
          notes: sampleNote,
          itemId: item?.id ?? null,
          departmentId: department?.id ?? null,
        },
      },
    },
  })

  const cashReceipt = await prisma.cashReceipt.create({
    data: {
      number: stampNumber('IR-REVIEW'),
      amount,
      date: new Date(),
      method: 'wire',
      reference: 'review-sample',
      invoiceId: invoice.id,
    },
  })

  const requisition = await prisma.requisition.create({
    data: {
      number: stampNumber('REQ-REVIEW'),
      status: 'draft',
      title: 'Review sample requisition',
      description: sampleNote,
      priority: 'medium',
      neededByDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      notes: sampleNote,
      total: amount,
      userId: user.id,
      departmentId: department?.id ?? null,
      vendorId: vendor.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lineItems: {
        create: {
          description: item?.name ?? 'Review PTP item',
          quantity,
          unitPrice,
          lineTotal: amount,
          notes: sampleNote,
          itemId: item?.id ?? null,
        },
      },
    },
  })

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      number: stampNumber('PO-REVIEW'),
      status: 'approved',
      total: amount,
      vendorId: vendor.id,
      userId: user.id,
      requisitionId: requisition.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lineItems: {
        create: {
          description: item?.name ?? 'Review PTP item',
          quantity,
          unitPrice,
          lineTotal: amount,
          itemId: item?.id ?? null,
        },
      },
    },
  })

  const receipt = await prisma.receipt.create({
    data: {
      quantity,
      date: new Date(),
      status: 'received',
      notes: sampleNote,
      purchaseOrderId: purchaseOrder.id,
    },
  })

  const bill = await prisma.bill.create({
    data: {
      number: stampNumber('BILL-REVIEW'),
      vendorId: vendor.id,
      total: amount,
      date: new Date(),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
      status: 'received',
      notes: sampleNote,
      purchaseOrderId: purchaseOrder.id,
      userId: user.id,
      subsidiaryId: subsidiary?.id ?? null,
      currencyId: currency?.id ?? null,
      lineItems: {
        create: {
          description: item?.name ?? 'Review PTP item',
          quantity,
          unitPrice,
          lineTotal: amount,
          notes: sampleNote,
          itemId: item?.id ?? null,
          departmentId: department?.id ?? null,
        },
      },
    },
  })

  const billPayment = await prisma.billPayment.create({
    data: {
      number: stampNumber('BP-REVIEW'),
      amount,
      date: new Date(),
      method: 'wire',
      reference: 'review-sample',
      status: 'completed',
      notes: sampleNote,
      billId: bill.id,
    },
  })

  console.log(
    JSON.stringify(
      {
        leads: [{ id: lead.id, number: lead.leadNumber }],
        opportunities: [{ id: opportunity.id, number: opportunity.opportunityNumber }],
        quotes: [{ id: quote.id, number: quote.number }],
        salesOrders: [{ id: salesOrder.id, number: salesOrder.number }],
        fulfillments: [{ id: fulfillment.id, number: fulfillment.number }],
        invoices: [{ id: invoice.id, number: invoice.number }],
        invoiceReceipts: [{ id: cashReceipt.id, number: cashReceipt.number }],
        purchaseRequisitions: [{ id: requisition.id, number: requisition.number }],
        purchaseOrders: [{ id: purchaseOrder.id, number: purchaseOrder.number }],
        receipts: [{ id: receipt.id }],
        bills: [{ id: bill.id, number: bill.number }],
        billPayments: [{ id: billPayment.id, number: billPayment.number }],
      },
      null,
      2,
    ),
  )
}

main()
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
