import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import InvoiceReceiptCreatePageClient from '@/components/InvoiceReceiptCreatePageClient'
import { loadInvoiceReceiptDetailCustomization } from '@/lib/invoice-receipt-detail-customization-store'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { roundMoney } from '@/lib/invoice-receipt-applications'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

export default async function NewInvoiceReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<{ duplicateFrom?: string }>
}) {
  const duplicateFrom = (await searchParams)?.duplicateFrom?.trim()

  const [invoices, paymentMethodValues, statusValues, customization, cashAccounts, duplicateSource] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        customer: {
          select: { id: true, customerId: true, name: true },
        },
        subsidiary: {
          select: { subsidiaryId: true, name: true },
        },
        currency: {
          select: { currencyId: true, code: true, name: true },
        },
        cashReceiptApplications: {
          include: {
            cashReceipt: {
              select: { id: true },
            },
          },
        },
        cashReceipts: {
          select: {
            id: true,
            amount: true,
            applications: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadListValues('PAYMENT-METHOD'),
    loadListValues('INV-RECEIPT-STATUS'),
    loadInvoiceReceiptDetailCustomization(),
    loadCashBankPostingAccounts(),
    duplicateFrom
      ? prisma.cashReceipt.findUnique({
          where: { id: duplicateFrom },
          include: {
            applications: {
              select: {
                invoiceId: true,
                appliedAmount: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  return (
    <InvoiceReceiptCreatePageClient
      invoices={invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        customerId: invoice.customer.id,
        customerNumber: invoice.customer.customerId,
        customerName: invoice.customer.name,
        status: invoice.status,
        total: Number(invoice.total),
        date: invoice.createdAt.toISOString(),
        subsidiaryId: invoice.subsidiaryId ?? null,
        currencyId: invoice.currencyId ?? null,
        subsidiaryLabel: invoice.subsidiary
          ? `${invoice.subsidiary.subsidiaryId} - ${invoice.subsidiary.name}`
          : null,
        currencyLabel: invoice.currency
          ? `${invoice.currency.code ?? invoice.currency.currencyId} - ${invoice.currency.name}`
          : null,
        userId: invoice.userId ?? null,
        openAmount: roundMoney(Number(invoice.total) - invoice.cashReceiptApplications.reduce((sum, application) => sum + Number(application.appliedAmount), 0) - invoice.cashReceipts.reduce((sum, receipt) => {
          if (receipt.applications.length > 0) return sum
          return sum + Number(receipt.amount)
        }, 0)),
      }))}
      methodOptions={paymentMethodValues.map((value) => ({
        value: value.toLowerCase(),
        label: value,
      }))}
      statusOptions={statusValues.map((value) => ({
        value: value.toLowerCase(),
        label: value,
      }))}
      bankAccountOptions={cashAccounts.map((account) => ({
        value: account.id,
        label: formatGlAccountLabel(account),
      }))}
      customization={customization}
      initialHeaderValues={
        duplicateSource
          ? {
              invoiceId: duplicateSource.invoiceId,
              bankAccountId: duplicateSource.bankAccountId ?? '',
              status: duplicateSource.status,
              overpaymentHandling: duplicateSource.overpaymentHandling ?? '',
              amount: String(duplicateSource.amount),
              date: duplicateSource.date.toISOString().slice(0, 10),
              method: duplicateSource.method,
              reference: duplicateSource.reference ?? '',
            }
          : undefined
      }
      initialApplications={
        duplicateSource
          ? duplicateSource.applications.length > 0
            ? duplicateSource.applications.map((application) => ({
                invoiceId: application.invoiceId,
                appliedAmount: Number(application.appliedAmount),
              }))
            : [{ invoiceId: duplicateSource.invoiceId, appliedAmount: Number(duplicateSource.amount) }]
          : undefined
      }
    />
  )
}
