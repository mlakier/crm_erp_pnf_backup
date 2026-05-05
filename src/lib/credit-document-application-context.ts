import { prisma } from '@/lib/prisma'
import { roundMoney as roundCreditMemoApplicationMoney } from '@/lib/credit-memo-applications'
import { roundMoney as roundBillCreditApplicationMoney } from '@/lib/bill-credit-applications'

export async function loadCreditMemoApplicationCandidates() {
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: true,
      currency: true,
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
      creditMemos: {
        where: { status: { in: ['applied', 'fully applied', 'partially applied'] } },
        select: {
          total: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return invoices.map((invoice) => {
    const appliedViaReceipts = invoice.cashReceiptApplications.reduce((sum, application) => sum + Number(application.appliedAmount), 0)
    const appliedViaLegacyReceipts = invoice.cashReceipts.reduce((sum, receipt) => {
      if (receipt.applications.length > 0) return sum
      return sum + Number(receipt.amount)
    }, 0)
    const appliedViaCredits = invoice.creditMemos.reduce((sum, creditMemo) => sum + Number(creditMemo.total), 0)
    const openAmount = roundCreditMemoApplicationMoney(
      Number(invoice.total) - appliedViaReceipts - appliedViaLegacyReceipts - appliedViaCredits,
    )

    return {
      id: invoice.id,
      number: invoice.number,
      customerId: invoice.customerId,
      customerName: invoice.customer.name,
      status: invoice.status,
      total: Number(invoice.total),
      date: invoice.createdAt,
      subsidiaryId: invoice.subsidiaryId ?? null,
      currencyId: invoice.currencyId ?? null,
      currencyCode: invoice.currency?.code ?? null,
      userId: invoice.userId ?? null,
      openAmount: Math.max(openAmount, 0),
    }
  })
}

export async function loadBillCreditApplicationCandidates() {
  const bills = await prisma.bill.findMany({
    include: {
      vendor: true,
      currency: true,
      paymentApplications: {
        include: {
          billPayment: {
            select: { id: true, status: true },
          },
        },
      },
      billPayments: {
        select: {
          id: true,
          amount: true,
          status: true,
          applications: { select: { id: true } },
        },
      },
      billCredits: {
        where: { status: { in: ['applied', 'fully applied', 'partially applied'] } },
        select: {
          total: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return bills.map((bill) => {
    const appliedViaPayments = bill.paymentApplications.reduce((sum, application) => {
      if ((application.billPayment.status ?? '').toLowerCase() === 'cancelled') return sum
      return sum + Number(application.appliedAmount)
    }, 0)
    const appliedViaLegacyPayments = bill.billPayments.reduce((sum, payment) => {
      if ((payment.status ?? '').toLowerCase() === 'cancelled') return sum
      if (payment.applications.length > 0) return sum
      return sum + Number(payment.amount)
    }, 0)
    const appliedViaCredits = bill.billCredits.reduce((sum, billCredit) => sum + Number(billCredit.total), 0)
    const openAmount = roundBillCreditApplicationMoney(
      Number(bill.total) - appliedViaPayments - appliedViaLegacyPayments - appliedViaCredits,
    )

    return {
      id: bill.id,
      number: bill.number,
      vendorId: bill.vendorId,
      vendorName: bill.vendor.name,
      status: bill.status,
      total: Number(bill.total),
      date: bill.date,
      subsidiaryId: bill.subsidiaryId ?? null,
      currencyId: bill.currencyId ?? null,
      currencyCode: bill.currency?.code ?? null,
      userId: bill.userId ?? null,
      openAmount: Math.max(openAmount, 0),
    }
  })
}
