'use client'

import { useMemo } from 'react'
import { fmtCurrency } from '@/lib/format'
import TransactionAllocationLinesSection from '@/components/TransactionAllocationLinesSection'
import {
  roundMoney,
  sumInvoiceReceiptApplications,
  type InvoiceApplicationCandidate,
  type InvoiceReceiptApplicationInput,
} from '@/lib/invoice-receipt-applications'

export default function InvoiceReceiptApplicationsSection({
  invoices,
  selectedCustomerId,
  receiptAmount,
  applications,
  onChange,
  editing = false,
  requiresFullApplication = false,
  overpaymentHandling = '',
  moneySettings,
  receiptCurrencyCode,
  title = 'Receipt Applications',
}: {
  invoices: InvoiceApplicationCandidate[]
  selectedCustomerId: string
  receiptAmount?: number
  applications: InvoiceReceiptApplicationInput[]
  onChange?: (applications: InvoiceReceiptApplicationInput[]) => void
  editing?: boolean
  requiresFullApplication?: boolean
  overpaymentHandling?: string
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  receiptCurrencyCode?: string | null
  title?: string
}) {
  const draftAmounts = useMemo(
    () =>
      Object.fromEntries(
        applications.map((application) => [
          application.invoiceId,
          application.appliedAmount > 0 ? String(application.appliedAmount) : '',
        ]),
      ),
    [applications],
  )

  const filteredInvoices = useMemo(() => {
    if (!selectedCustomerId) return []
    return invoices.filter((invoice) => invoice.customerId === selectedCustomerId && (invoice.openAmount > 0 || applications.some((application) => application.invoiceId === invoice.id)))
  }, [applications, invoices, selectedCustomerId])

  const appliedRows = useMemo(() => {
    if (editing) return filteredInvoices
    return filteredInvoices.filter((invoice) => {
      const amount = applications.find((application) => application.invoiceId === invoice.id)?.appliedAmount ?? 0
      return amount > 0
    })
  }, [applications, editing, filteredInvoices])

  function updateDraft(invoiceId: string, nextRaw: string) {
    const nextDraft = {
      ...draftAmounts,
      [invoiceId]: nextRaw,
    }
    if (!onChange) return

    const nextApplications = filteredInvoices
      .map((invoice) => ({
        invoiceId: invoice.id,
        appliedAmount: roundMoney(Number(nextDraft[invoice.id] ?? 0)),
      }))
      .filter((application) => Number.isFinite(application.appliedAmount) && application.appliedAmount > 0)

    onChange(nextApplications)
  }

  const totalApplied = roundMoney(sumInvoiceReceiptApplications(applications))
  const normalizedReceiptAmount = roundMoney(receiptAmount ?? 0)
  const unappliedAmount = roundMoney(Math.max(normalizedReceiptAmount - totalApplied, 0))
  const overappliedAmount = roundMoney(Math.max(totalApplied - normalizedReceiptAmount, 0))
  const allocationEditingEnabled = editing && normalizedReceiptAmount > 0

  const displayRows = useMemo(
    () =>
      appliedRows.map((invoice) => ({
        id: invoice.id,
        label: invoice.number,
        href: `/invoices/${invoice.id}`,
        status: invoice.status,
        date: invoice.date,
        totalAmount: invoice.total,
        openAmount: invoice.openAmount,
        allocatedAmount: applications.find((application) => application.invoiceId === invoice.id)?.appliedAmount ?? 0,
        currencyCode: invoice.currencyCode ?? null,
      })),
    [appliedRows, applications],
  )

  let helperText: string | undefined
  if (!selectedCustomerId) {
    helperText = 'Select an invoice above to establish customer context and load open invoices for allocation.'
  } else if (editing && normalizedReceiptAmount <= 0) {
    helperText = 'Enter the receipt amount above before allocating it across invoices.'
  } else if (editing && overappliedAmount > 0) {
    helperText = `Applied amounts exceed the entered receipt amount by ${fmtCurrency(overappliedAmount, receiptCurrencyCode ?? undefined, moneySettings)}.`
  } else if (editing && requiresFullApplication && unappliedAmount > 0) {
    helperText =
      overpaymentHandling === 'apply_to_future_invoices'
        ? `This overpayment will remain on the customer account as unapplied cash: ${fmtCurrency(unappliedAmount, receiptCurrencyCode ?? undefined, moneySettings)}.`
        : overpaymentHandling === 'refund_pending'
          ? `This overpayment is marked for refund: ${fmtCurrency(unappliedAmount, receiptCurrencyCode ?? undefined, moneySettings)}.`
          : `This receipt has an overpayment of ${fmtCurrency(unappliedAmount, receiptCurrencyCode ?? undefined, moneySettings)}. Choose how to handle it above before posting.`
  } else {
    helperText = 'Allocate the receipt total across one or more open customer invoices.'
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
            Applied {fmtCurrency(totalApplied, receiptCurrencyCode ?? undefined, moneySettings)}
          </span>
          {editing && normalizedReceiptAmount > 0 ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: overappliedAmount > 0 ? 'rgba(239,68,68,0.12)' : 'var(--badge-background)',
                color: overappliedAmount > 0 ? 'var(--danger)' : 'var(--text-secondary)',
              }}
            >
              {overappliedAmount > 0
                ? `Overapplied ${fmtCurrency(overappliedAmount, receiptCurrencyCode ?? undefined, moneySettings)}`
                : `Unapplied ${fmtCurrency(unappliedAmount, receiptCurrencyCode ?? undefined, moneySettings)}`}
            </span>
          ) : null}
        </div>
      }
      emptyMessage={
        !selectedCustomerId
          ? 'Select an invoice above to establish customer context and load open invoices for allocation.'
          : editing
            ? 'No open invoices are available for this customer.'
            : 'No invoice applications are recorded for this receipt.'
      }
      allocationEnabled={allocationEditingEnabled}
      allocationValueById={draftAmounts}
      onAllocationChange={updateDraft}
      sourceLabel="Invoice"
      totalAmountLabel="Invoice Total"
      openAmountLabel="Open Amount"
      allocationAmountLabel="Applied Amount"
    />
  )
}
