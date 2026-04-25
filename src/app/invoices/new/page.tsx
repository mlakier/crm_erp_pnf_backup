import { prisma } from '@/lib/prisma'
import InvoiceCreatePageClient from '@/components/InvoiceCreatePageClient'
import { loadInvoiceDetailCustomization } from '@/lib/invoice-detail-customization-store'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [salesOrdersWithoutInvoices, customers, subsidiaries, currencies, customization, sourceInvoice] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { invoices: { none: {} } },
      include: {
        customer: {
          include: {
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
          },
        },
        user: {
          select: { id: true, userId: true, name: true, email: true },
        },
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
        quote: {
          include: {
            opportunity: {
              select: { id: true, opportunityNumber: true, name: true },
            },
          },
        },
        lineItems: {
          orderBy: { createdAt: 'asc' },
          include: {
            item: { select: { id: true, itemId: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.customer.findMany({
      include: {
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
      },
      orderBy: [{ inactive: 'asc' }, { name: 'asc' }],
      take: 500,
    }),
    prisma.subsidiary.findMany({
      where: { active: true },
      select: { id: true, subsidiaryId: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.currency.findMany({
      where: { active: true },
      select: { id: true, currencyId: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 200,
    }),
    loadInvoiceDetailCustomization(),
    duplicateFrom
      ? prisma.invoice.findUnique({
          where: { id: duplicateFrom },
          include: {
            customer: {
              include: {
                subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
                currency: { select: { id: true, currencyId: true, code: true, name: true } },
              },
            },
            user: {
              select: { id: true, userId: true, name: true, email: true },
            },
            salesOrder: {
              include: {
                quote: {
                  include: {
                    opportunity: {
                      select: { id: true, opportunityNumber: true, name: true },
                    },
                  },
                },
              },
            },
            subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
            currency: { select: { id: true, currencyId: true, code: true, name: true } },
            lineItems: {
              orderBy: { createdAt: 'asc' },
              include: {
                item: { select: { id: true, itemId: true, name: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  return (
    <InvoiceCreatePageClient
      salesOrders={salesOrdersWithoutInvoices.map((salesOrder) => ({
        id: salesOrder.id,
        number: salesOrder.number,
        customer: {
          id: salesOrder.customer.id,
          customerId: salesOrder.customer.customerId,
          name: salesOrder.customer.name,
          email: salesOrder.customer.email,
          phone: salesOrder.customer.phone,
          address: salesOrder.customer.address,
          inactive: salesOrder.customer.inactive,
          subsidiary: salesOrder.customer.subsidiary,
          currency: salesOrder.customer.currency,
        },
        user: salesOrder.user,
        subsidiary: salesOrder.subsidiary,
        currency: salesOrder.currency,
        quote: salesOrder.quote
          ? {
              id: salesOrder.quote.id,
              number: salesOrder.quote.number,
              opportunity: salesOrder.quote.opportunity
                ? {
                    id: salesOrder.quote.opportunity.id,
                    opportunityNumber: salesOrder.quote.opportunity.opportunityNumber,
                    name: salesOrder.quote.opportunity.name,
                  }
                : null,
            }
          : null,
        lineItems: salesOrder.lineItems.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.lineTotal),
          item: line.item
            ? {
                id: line.item.id,
                itemId: line.item.itemId,
                name: line.item.name,
              }
            : null,
        })),
        total: Number(salesOrder.total),
      }))}
      customers={customers.map((customer) => ({
        id: customer.id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        inactive: customer.inactive,
        subsidiary: customer.subsidiary,
        currency: customer.currency,
      }))}
      subsidiaries={subsidiaries}
      currencies={currencies}
      customization={customization}
      duplicateFrom={duplicateFrom}
      duplicateInvoice={
        sourceInvoice
          ? {
              id: sourceInvoice.id,
              number: sourceInvoice.number,
              status: sourceInvoice.status,
              dueDate: sourceInvoice.dueDate ? sourceInvoice.dueDate.toISOString().slice(0, 10) : null,
              paidDate: sourceInvoice.paidDate ? sourceInvoice.paidDate.toISOString().slice(0, 10) : null,
              total: Number(sourceInvoice.total),
              customer: {
                id: sourceInvoice.customer.id,
                customerId: sourceInvoice.customer.customerId,
                name: sourceInvoice.customer.name,
                email: sourceInvoice.customer.email,
                phone: sourceInvoice.customer.phone,
                address: sourceInvoice.customer.address,
                inactive: sourceInvoice.customer.inactive,
                subsidiary: sourceInvoice.customer.subsidiary,
                currency: sourceInvoice.customer.currency,
              },
              user: sourceInvoice.user,
              salesOrder: sourceInvoice.salesOrder
                ? {
                    id: sourceInvoice.salesOrder.id,
                    number: sourceInvoice.salesOrder.number,
                    quote: sourceInvoice.salesOrder.quote
                      ? {
                          id: sourceInvoice.salesOrder.quote.id,
                          number: sourceInvoice.salesOrder.quote.number,
                          opportunity: sourceInvoice.salesOrder.quote.opportunity
                            ? {
                                id: sourceInvoice.salesOrder.quote.opportunity.id,
                                opportunityNumber: sourceInvoice.salesOrder.quote.opportunity.opportunityNumber,
                                name: sourceInvoice.salesOrder.quote.opportunity.name,
                              }
                            : null,
                        }
                      : null,
                  }
                : null,
              subsidiary: sourceInvoice.subsidiary,
              currency: sourceInvoice.currency,
              lineItems: sourceInvoice.lineItems.map((line) => ({
                id: line.id,
                description: line.description,
                quantity: Number(line.quantity),
                unitPrice: Number(line.unitPrice),
                lineTotal: Number(line.lineTotal),
                item: line.item
                  ? {
                      id: line.item.id,
                      itemId: line.item.itemId,
                      name: line.item.name,
                    }
                  : null,
              })),
            }
          : null
      }
    />
  )
}
