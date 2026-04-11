const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatInvoiceNumber(sequence) {
  return `INV-${String(sequence).padStart(6, '0')}`
}

async function nextInvoiceNumber() {
  const latest = await prisma.invoice.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  if (!latest?.number) {
    return formatInvoiceNumber(1)
  }

  const parsed = Number.parseInt(latest.number.replace('INV-', ''), 10)
  return formatInvoiceNumber(Number.isNaN(parsed) ? 1 : parsed + 1)
}

async function main() {
  const salesOrders = await prisma.salesOrder.findMany({
    include: {
      invoices: true,
      customer: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const eligibleOrders = salesOrders.filter((salesOrder) => salesOrder.invoices.length === 0).slice(0, 3)

  if (eligibleOrders.length === 0) {
    console.log('No eligible sales orders found for invoice creation.')
    return
  }

  for (let index = 0; index < eligibleOrders.length; index += 1) {
    const salesOrder = eligibleOrders[index]
    const invoiceNumber = await nextInvoiceNumber()
    const createdAt = new Date()
    const dueDate = new Date(createdAt)
    dueDate.setDate(dueDate.getDate() + 30)

    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        status: index === 0 ? 'draft' : index === 1 ? 'sent' : 'paid',
        total: salesOrder.total,
        dueDate,
        paidDate: index === 2 ? createdAt : null,
        customerId: salesOrder.customerId,
        salesOrderId: salesOrder.id,
      },
    })

    if (index === 2) {
      await prisma.cashReceipt.create({
        data: {
          amount: salesOrder.total,
          date: createdAt,
          method: 'wire',
          reference: `PAY-${invoice.number}`,
          invoiceId: invoice.id,
        },
      })
    }

    console.log(`Created invoice ${invoice.number} for sales order ${salesOrder.number} (${salesOrder.customer.name})`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
