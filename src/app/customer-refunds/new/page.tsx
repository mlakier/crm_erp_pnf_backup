import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import CustomerRefundPageClient from '@/components/CustomerRefundPageClient'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

export default async function NewCustomerRefundPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams

  const [customers, cashAccounts, methodValues, statusValues, refundSources, duplicateSource] = await Promise.all([
    prisma.customer.findMany({ orderBy: [{ name: 'asc' }] }),
    loadCashBankPostingAccounts(),
    loadListValues('PAYMENT-METHOD'),
    loadListValues('CUSTOMER-REFUND-STATUS'),
    prisma.cashReceipt.findMany({
      where: { overpaymentHandling: 'refund_pending' },
      include: {
        invoice: { include: { customer: true } },
        applications: true,
        customerRefunds: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    duplicateFrom
      ? prisma.customerRefund.findUnique({
          where: { id: duplicateFrom },
          include: {
            cashReceipt: {
              include: {
                invoice: { include: { customer: true } },
                applications: true,
                customerRefunds: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  const duplicateReceipt = duplicateSource?.cashReceipt ?? null
  const mappedRefundSources = [
    ...refundSources,
    ...(duplicateReceipt && !refundSources.some((receipt) => receipt.id === duplicateReceipt.id) ? [duplicateReceipt] : []),
  ].map((receipt) => {
    const appliedAmount = receipt.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0)
    const refundedAmount = receipt.customerRefunds.reduce((sum, refund) => ((refund.status ?? '').toLowerCase() === 'void' ? sum : sum + Number(refund.amount)), 0)
    return {
      id: receipt.id,
      customerId: receipt.invoice.customerId,
      customerName: receipt.invoice.customer.name,
      receiptNumber: receipt.number ?? receipt.id,
      availableAmount: Math.max(0, Number(receipt.amount) - appliedAmount - refundedAmount),
    }
  }).filter((receipt) => receipt.availableAmount > 0.005 || receipt.id === duplicateReceipt?.id)

  return (
    <CustomerRefundPageClient
      mode="create"
      customers={customers.map((customer) => ({ value: customer.id, label: `${customer.customerId ?? 'CUSTOMER'} - ${customer.name}` }))}
      bankAccountOptions={cashAccounts.map((account) => ({ value: account.id, label: formatGlAccountLabel(account) }))}
      methodOptions={methodValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
      statusOptions={statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
      refundSources={mappedRefundSources}
      initialHeaderValues={duplicateSource ? {
        customerId: duplicateSource.customerId,
        cashReceiptId: duplicateSource.cashReceiptId ?? '',
        bankAccountId: duplicateSource.bankAccountId ?? '',
        amount: String(duplicateSource.amount),
        date: new Date().toISOString().slice(0, 10),
        method: duplicateSource.method,
        reference: duplicateSource.reference ?? '',
        notes: duplicateSource.notes ?? '',
        status: 'draft',
      } : undefined}
    />
  )
}
