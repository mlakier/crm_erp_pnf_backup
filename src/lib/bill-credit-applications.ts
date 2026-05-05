export type BillCreditApplicationCandidate = {
  id: string
  number: string
  vendorId: string
  vendorName: string
  status: string
  total: number
  date: Date | string
  subsidiaryId: string | null
  currencyId: string | null
  currencyCode?: string | null
  userId: string | null
  openAmount: number
}

export type BillCreditApplicationInput = {
  billId: string
  appliedAmount: number
}

export function normalizeBillCreditApplications(
  applications: Array<Partial<BillCreditApplicationInput>> | null | undefined,
) {
  return (applications ?? [])
    .map((application) => ({
      billId: typeof application.billId === 'string' ? application.billId.trim() : '',
      appliedAmount: Number(application.appliedAmount ?? 0),
    }))
    .filter(
      (application) =>
        application.billId.length > 0
        && Number.isFinite(application.appliedAmount)
        && application.appliedAmount > 0,
    )
}

export function sumBillCreditApplications(applications: Array<BillCreditApplicationInput>) {
  return applications.reduce((sum, application) => sum + application.appliedAmount, 0)
}

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}
