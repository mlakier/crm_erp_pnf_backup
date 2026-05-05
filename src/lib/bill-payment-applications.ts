export type BillApplicationCandidate = {
  id: string
  number: string
  vendorId: string
  vendorName: string
  status: string
  total: number
  date: Date | string
  subsidiaryId: string | null
  subsidiaryLabel?: string | null
  currencyId: string | null
  currencyCode?: string | null
  currencyLabel?: string | null
  userId: string | null
  openAmount: number
}

export type BillPaymentApplicationInput = {
  billId: string
  appliedAmount: number
}

export function normalizeBillPaymentApplications(
  applications: Array<Partial<BillPaymentApplicationInput>> | null | undefined,
) {
  return (applications ?? [])
    .map((application) => ({
      billId: typeof application.billId === 'string' ? application.billId.trim() : '',
      appliedAmount: Number(application.appliedAmount ?? 0),
    }))
    .filter((application) => application.billId.length > 0 && Number.isFinite(application.appliedAmount) && application.appliedAmount > 0)
}

export function sumBillPaymentApplications(applications: Array<BillPaymentApplicationInput>) {
  return applications.reduce((sum, application) => sum + application.appliedAmount, 0)
}

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}
