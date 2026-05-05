'use client'

import { useMemo } from 'react'

import TransactionAllocationLinesSection from '@/components/TransactionAllocationLinesSection'
import {
  roundMoney as roundBillMoney,
  sumBillCreditApplications,
  type BillCreditApplicationCandidate,
  type BillCreditApplicationInput,
} from '@/lib/bill-credit-applications'
import {
  roundMoney as roundCreditMoney,
  sumCreditMemoApplications,
  type CreditMemoApplicationCandidate,
  type CreditMemoApplicationInput,
} from '@/lib/credit-memo-applications'
import { fmtCurrency } from '@/lib/format'

type CreditDocumentApplicationsSectionProps =
  | {
      kind: 'credit-memo'
      documents: CreditMemoApplicationCandidate[]
      selectedCounterpartyId: string
      selectedSourceDocumentId: string
      documentAmount?: number
      applications: CreditMemoApplicationInput[]
      onChange?: (applications: CreditMemoApplicationInput[]) => void
      editing?: boolean
      moneySettings?: Parameters<typeof fmtCurrency>[2]
      currencyCode?: string | null
    }
  | {
      kind: 'bill-credit'
      documents: BillCreditApplicationCandidate[]
      selectedCounterpartyId: string
      selectedSourceDocumentId: string
      documentAmount?: number
      applications: BillCreditApplicationInput[]
      onChange?: (applications: BillCreditApplicationInput[]) => void
      editing?: boolean
      moneySettings?: Parameters<typeof fmtCurrency>[2]
      currencyCode?: string | null
    }

export default function CreditDocumentApplicationsSection(props: CreditDocumentApplicationsSectionProps) {
  const editing = props.editing ?? false
  const normalizedAmount = props.kind === 'credit-memo'
    ? roundCreditMoney(props.documentAmount ?? 0)
    : roundBillMoney(props.documentAmount ?? 0)

  const documents = useMemo(() => {
    if (props.kind === 'credit-memo') {
      const activeIds = new Set(props.applications.map((application) => application.invoiceId))
      const rows = props.documents.filter((document) => {
        const matchesCounterparty = document.customerId === props.selectedCounterpartyId
        const matchesSource = !props.selectedSourceDocumentId || document.id === props.selectedSourceDocumentId
        return matchesCounterparty && matchesSource && (document.openAmount > 0 || activeIds.has(document.id))
      })
      return editing ? rows : rows.filter((row) => activeIds.has(row.id))
    }

    const activeIds = new Set(props.applications.map((application) => application.billId))
    const rows = props.documents.filter((document) => {
      const matchesCounterparty = document.vendorId === props.selectedCounterpartyId
      const matchesSource = !props.selectedSourceDocumentId || document.id === props.selectedSourceDocumentId
      return matchesCounterparty && matchesSource && (document.openAmount > 0 || activeIds.has(document.id))
    })
    return editing ? rows : rows.filter((row) => activeIds.has(row.id))
  }, [editing, props])

  const draftAmounts = useMemo(() => {
    if (props.kind === 'credit-memo') {
      return Object.fromEntries(
        props.applications.map((application) => [
          application.invoiceId,
          application.appliedAmount > 0 ? String(application.appliedAmount) : '',
        ]),
      )
    }

    return Object.fromEntries(
      props.applications.map((application) => [
        application.billId,
        application.appliedAmount > 0 ? String(application.appliedAmount) : '',
      ]),
    )
  }, [props])

  const totalApplied = props.kind === 'credit-memo'
    ? roundCreditMoney(sumCreditMemoApplications(props.applications))
    : roundBillMoney(sumBillCreditApplications(props.applications))
  const unappliedAmount = Math.max(normalizedAmount - totalApplied, 0)
  const overappliedAmount = Math.max(totalApplied - normalizedAmount, 0)

  function updateDraft(rowId: string, nextRaw: string) {
    if (!props.onChange) return

    if (props.kind === 'credit-memo') {
      const nextApplications = documents
        .map((document) => ({
          invoiceId: document.id,
          appliedAmount:
            document.id === rowId
              ? roundCreditMoney(Number(nextRaw || 0))
              : roundCreditMoney(Number(draftAmounts[document.id] || 0)),
        }))
        .filter((application) => application.appliedAmount > 0)
      props.onChange(nextApplications)
      return
    }

    const nextApplications = documents
      .map((document) => ({
        billId: document.id,
        appliedAmount:
          document.id === rowId
            ? roundBillMoney(Number(nextRaw || 0))
            : roundBillMoney(Number(draftAmounts[document.id] || 0)),
      }))
      .filter((application) => application.appliedAmount > 0)
    props.onChange(nextApplications)
  }

  const rows = documents.map((document) => ({
    id: document.id,
    label: document.number,
    href: props.kind === 'credit-memo' ? `/invoices/${document.id}` : `/bills/${document.id}`,
    status: document.status,
    date: document.date,
    totalAmount: document.total,
    openAmount: document.openAmount,
    allocatedAmount:
      props.kind === 'credit-memo'
        ? props.applications.find((application) => application.invoiceId === document.id)?.appliedAmount ?? 0
        : props.applications.find((application) => application.billId === document.id)?.appliedAmount ?? 0,
    currencyCode: document.currencyCode ?? null,
  }))

  const sourceLabel = props.kind === 'credit-memo' ? 'Invoice' : 'Bill'
  const title = props.kind === 'credit-memo' ? 'Credit Applications' : 'Bill Credit Applications'

  return (
    <TransactionAllocationLinesSection
      title={title}
      rows={rows}
      editing={editing}
      moneySettings={props.moneySettings}
      helperText={
        !props.selectedCounterpartyId
          ? `Select a ${props.kind === 'credit-memo' ? 'customer' : 'vendor'} above to load open ${sourceLabel.toLowerCase()}s.`
          : `Allocate this ${props.kind === 'credit-memo' ? 'credit memo' : 'bill credit'} across one or more open ${sourceLabel.toLowerCase()}s.`
      }
      summary={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: 'var(--badge-background)', color: 'var(--accent-primary-strong)' }}
          >
            Applied {fmtCurrency(totalApplied, props.currencyCode ?? undefined, props.moneySettings)}
          </span>
          {editing && normalizedAmount > 0 ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: overappliedAmount > 0 ? 'rgba(239,68,68,0.12)' : 'var(--badge-background)',
                color: overappliedAmount > 0 ? 'var(--danger)' : 'var(--text-secondary)',
              }}
            >
              {overappliedAmount > 0
                ? `Overapplied ${fmtCurrency(overappliedAmount, props.currencyCode ?? undefined, props.moneySettings)}`
                : `Unapplied ${fmtCurrency(unappliedAmount, props.currencyCode ?? undefined, props.moneySettings)}`}
            </span>
          ) : null}
        </div>
      }
      emptyMessage={
        !props.selectedCounterpartyId
          ? `Select a ${props.kind === 'credit-memo' ? 'customer' : 'vendor'} above to load open ${sourceLabel.toLowerCase()}s.`
          : `No ${sourceLabel.toLowerCase()} applications are recorded for this ${props.kind === 'credit-memo' ? 'credit memo' : 'bill credit'}.`
      }
      allocationEnabled={editing && normalizedAmount > 0}
      allocationValueById={draftAmounts}
      onAllocationChange={updateDraft}
      sourceLabel={sourceLabel}
      totalAmountLabel={`${sourceLabel} Total`}
      openAmountLabel="Open Amount"
      allocationAmountLabel="Applied Amount"
    />
  )
}
