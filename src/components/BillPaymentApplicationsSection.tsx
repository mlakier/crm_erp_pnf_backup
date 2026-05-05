'use client'

import { useMemo } from 'react'
import { fmtCurrency } from '@/lib/format'
import TransactionAllocationLinesSection from '@/components/TransactionAllocationLinesSection'
import {
  roundMoney,
  sumBillPaymentApplications,
  type BillApplicationCandidate,
  type BillPaymentApplicationInput,
} from '@/lib/bill-payment-applications'

export default function BillPaymentApplicationsSection({
  bills,
  selectedVendorId,
  paymentAmount,
  applications,
  onChange,
  editing = false,
  moneySettings,
  paymentCurrencyCode,
  title = 'Bill Applications',
}: {
  bills: BillApplicationCandidate[]
  selectedVendorId: string
  paymentAmount?: number
  applications: BillPaymentApplicationInput[]
  onChange?: (applications: BillPaymentApplicationInput[]) => void
  editing?: boolean
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  paymentCurrencyCode?: string | null
  title?: string
}) {
  const draftAmounts = useMemo(
    () =>
      Object.fromEntries(
        applications.map((application) => [
          application.billId,
          application.appliedAmount > 0 ? String(application.appliedAmount) : '',
        ]),
      ),
    [applications],
  )

  const filteredBills = useMemo(() => {
    if (!selectedVendorId) return []
    return bills.filter((bill) => bill.vendorId === selectedVendorId && (bill.openAmount > 0 || applications.some((application) => application.billId === bill.id)))
  }, [applications, bills, selectedVendorId])

  const appliedRows = useMemo(() => {
    if (editing) return filteredBills
    return filteredBills.filter((bill) => {
      const amount = applications.find((application) => application.billId === bill.id)?.appliedAmount ?? 0
      return amount > 0
    })
  }, [applications, editing, filteredBills])

  function updateDraft(billId: string, nextRaw: string) {
    const nextDraft = {
      ...draftAmounts,
      [billId]: nextRaw,
    }
    if (!onChange) return

    const nextApplications = filteredBills
      .map((bill) => ({
        billId: bill.id,
        appliedAmount: roundMoney(Number(nextDraft[bill.id] ?? 0)),
      }))
      .filter((application) => Number.isFinite(application.appliedAmount) && application.appliedAmount > 0)

    onChange(nextApplications)
  }

  const totalApplied = roundMoney(sumBillPaymentApplications(applications))
  const normalizedPaymentAmount = roundMoney(paymentAmount ?? 0)
  const unappliedAmount = roundMoney(Math.max(normalizedPaymentAmount - totalApplied, 0))
  const overappliedAmount = roundMoney(Math.max(totalApplied - normalizedPaymentAmount, 0))
  const allocationEditingEnabled = editing && normalizedPaymentAmount > 0

  const displayRows = useMemo(
    () =>
      appliedRows.map((bill) => ({
        id: bill.id,
        label: bill.number,
        href: `/bills/${bill.id}`,
        status: bill.status,
        date: bill.date,
        totalAmount: bill.total,
        openAmount: bill.openAmount,
        allocatedAmount: applications.find((application) => application.billId === bill.id)?.appliedAmount ?? 0,
        currencyCode: bill.currencyCode ?? null,
      })),
    [appliedRows, applications],
  )

  let helperText: string | undefined
  if (!selectedVendorId) {
    helperText = 'Select a vendor above to load open bills for allocation.'
  } else if (editing && normalizedPaymentAmount <= 0) {
    helperText = 'Enter the bill payment amount above before allocating it across bills.'
  } else if (editing && overappliedAmount > 0) {
    helperText = `Applied amounts exceed the entered payment amount by ${fmtCurrency(overappliedAmount, paymentCurrencyCode ?? undefined, moneySettings)}.`
  } else {
    helperText = 'Allocate the payment total across one or more open vendor bills.'
  }

  return (
    <TransactionAllocationLinesSection
      title={title}
      rows={displayRows}
      editing={editing}
      moneySettings={moneySettings}
      helperText={helperText}
      summary={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--badge-background)', color: 'var(--accent-primary-strong)' }}>
            Applied {fmtCurrency(totalApplied, paymentCurrencyCode ?? undefined, moneySettings)}
          </span>
          {editing && normalizedPaymentAmount > 0 ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: overappliedAmount > 0 ? 'rgba(239,68,68,0.12)' : 'var(--badge-background)',
                color: overappliedAmount > 0 ? 'var(--danger)' : 'var(--text-secondary)',
              }}
            >
              {overappliedAmount > 0
                ? `Overapplied ${fmtCurrency(overappliedAmount, paymentCurrencyCode ?? undefined, moneySettings)}`
                : `Unapplied ${fmtCurrency(unappliedAmount, paymentCurrencyCode ?? undefined, moneySettings)}`}
            </span>
          ) : null}
        </div>
      }
      emptyMessage={
        !selectedVendorId
          ? 'Select a vendor above to load open bills for allocation.'
          : editing
            ? 'No open bills are available for this vendor.'
            : 'No bill applications are recorded for this payment.'
      }
      allocationEnabled={allocationEditingEnabled}
      allocationValueById={draftAmounts}
      onAllocationChange={updateDraft}
    />
  )
}
