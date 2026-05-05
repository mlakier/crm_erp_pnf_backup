export type InvoiceApplicationCandidate = {
  id: string
  number: string
  customerId: string
  customerName: string
  status: string
  total: number
  date: Date | string
  subsidiaryId: string | null
  currencyId: string | null
  currencyCode?: string | null
  userId: string | null
  openAmount: number
}

export type InvoiceReceiptApplicationInput = {
  invoiceId: string
  appliedAmount: number
}

export function normalizeInvoiceReceiptApplications(
  applications: Array<Partial<InvoiceReceiptApplicationInput>> | null | undefined,
) {
  return (applications ?? [])
    .map((application) => ({
      invoiceId: typeof application.invoiceId === 'string' ? application.invoiceId.trim() : '',
      appliedAmount: Number(application.appliedAmount ?? 0),
    }))
    .filter((application) => application.invoiceId.length > 0 && Number.isFinite(application.appliedAmount) && application.appliedAmount > 0)
}

export function sumInvoiceReceiptApplications(applications: Array<InvoiceReceiptApplicationInput>) {
  return applications.reduce((sum, application) => sum + application.appliedAmount, 0)
}

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}
