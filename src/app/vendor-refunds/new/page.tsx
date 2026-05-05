import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import VendorRefundPageClient from '@/components/VendorRefundPageClient'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

export const runtime = 'nodejs'

export default async function NewVendorRefundPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams

  const [vendors, cashAccounts, methodValues, statusValues, refundSources, duplicateSource] = await Promise.all([
    prisma.vendor.findMany({ orderBy: [{ name: 'asc' }] }),
    loadCashBankPostingAccounts(),
    loadListValues('PAYMENT-METHOD'),
    loadListValues('VENDOR-REFUND-STATUS'),
    prisma.billPayment.findMany({
      include: {
        vendor: true,
        bill: {
          include: {
            vendor: true,
          },
        },
        applications: true,
        vendorRefunds: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    duplicateFrom
      ? prisma.vendorRefund.findUnique({
          where: { id: duplicateFrom },
          include: {
            billPayment: {
              include: {
                vendor: true,
                bill: {
                  include: {
                    vendor: true,
                  },
                },
                applications: true,
                vendorRefunds: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ])

  const duplicatePayment = duplicateSource?.billPayment ?? null
  const mappedRefundSources = [
    ...refundSources,
    ...(duplicatePayment && !refundSources.some((payment) => payment.id === duplicatePayment.id) ? [duplicatePayment] : []),
  ].map((payment) => {
    const appliedAmount = payment.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0)
    const refundedAmount = payment.vendorRefunds.reduce((sum, refund) => ((refund.status ?? '').toLowerCase() === 'void' ? sum : sum + Number(refund.amount)), 0)
    return {
      id: payment.id,
      vendorId: payment.vendorId ?? payment.bill?.vendorId ?? '',
      vendorName: payment.vendor?.name ?? payment.bill?.vendor?.name ?? 'Vendor',
      paymentNumber: payment.number,
      billNumber: payment.bill?.number ?? null,
      availableAmount: Math.max(0, Number(payment.amount) - appliedAmount - refundedAmount),
    }
  }).filter((payment) => payment.availableAmount > 0.005 || payment.id === duplicatePayment?.id)

  return (
    <VendorRefundPageClient
      mode="create"
      vendors={vendors.map((vendor) => ({ value: vendor.id, label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}` }))}
      bankAccountOptions={cashAccounts.map((account) => ({ value: account.id, label: formatGlAccountLabel(account) }))}
      methodOptions={methodValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
      statusOptions={statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))}
      refundSources={mappedRefundSources}
      initialHeaderValues={duplicateSource ? {
        vendorId: duplicateSource.vendorId,
        billPaymentId: duplicateSource.billPaymentId ?? '',
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
