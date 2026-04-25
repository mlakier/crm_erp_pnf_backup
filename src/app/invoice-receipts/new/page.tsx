import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import InvoiceReceiptCreatePageClient from '@/components/InvoiceReceiptCreatePageClient'
import { loadInvoiceReceiptDetailCustomization } from '@/lib/invoice-receipt-detail-customization-store'

export default async function NewInvoiceReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<{ duplicateFrom?: string }>
}) {
  const duplicateFrom = (await searchParams)?.duplicateFrom?.trim()

  const [invoices, paymentMethodValues, customization, duplicateSource] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        customer: {
          select: { id: true, customerId: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadListValues('PAYMENT-METHOD'),
    loadInvoiceReceiptDetailCustomization(),
    duplicateFrom
      ? prisma.cashReceipt.findUnique({
          where: { id: duplicateFrom },
        })
      : Promise.resolve(null),
  ])

  return (
    <InvoiceReceiptCreatePageClient
      invoices={invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        customer: {
          id: invoice.customer.id,
          customerId: invoice.customer.customerId,
          name: invoice.customer.name,
        },
      }))}
      methodOptions={paymentMethodValues.map((value) => ({
        value: value.toLowerCase(),
        label: value,
      }))}
      customization={customization}
      initialHeaderValues={
        duplicateSource
          ? {
              invoiceId: duplicateSource.invoiceId,
              amount: String(duplicateSource.amount),
              date: duplicateSource.date.toISOString().slice(0, 10),
              method: duplicateSource.method,
              reference: duplicateSource.reference ?? '',
            }
          : undefined
      }
    />
  )
}
