'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import BillPaymentApplicationsSection from '@/components/BillPaymentApplicationsSection'
import { fmtCurrency } from '@/lib/format'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  BILL_PAYMENT_DETAIL_FIELDS,
  type BillPaymentDetailCustomizationConfig,
  type BillPaymentDetailFieldKey,
} from '@/lib/bill-payment-detail-customization'
import {
  sumBillPaymentApplications,
  roundMoney,
  type BillApplicationCandidate,
  type BillPaymentApplicationInput,
} from '@/lib/bill-payment-applications'
import { parseMoneyValue } from '@/lib/money'

type Option = { value: string; label: string }

type BillPaymentHeaderField = {
  key: BillPaymentDetailFieldKey
} & RecordHeaderField

const sectionDescriptions: Record<string, string> = {
  'Document Identity': 'Core bill payment identifiers and source-bill context.',
  'Payment Terms': 'Amount, timing, method, status, and payment notes.',
  'Record Keys': 'Internal and linked transaction identifiers for this bill payment.',
  'System Dates': 'System-managed timestamps for this bill payment.',
}

export default function BillPaymentDetailEditor({
  paymentId,
  detailHref,
  customization,
  vendors,
  bills,
  statusOptions,
  methodOptions,
  bankAccountOptions,
  initialHeaderValues,
  initialApplications,
  moneySettings,
}: {
  paymentId: string
  detailHref: string
  customization: BillPaymentDetailCustomizationConfig
  vendors: Option[]
  bills: BillApplicationCandidate[]
  statusOptions: Option[]
  methodOptions: Option[]
  bankAccountOptions: Option[]
  initialHeaderValues: Record<string, string>
  initialApplications: BillPaymentApplicationInput[]
  moneySettings?: Parameters<typeof BillPaymentApplicationsSection>[0]['moneySettings']
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<BillPaymentApplicationInput[]>(initialApplications)
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(initialHeaderValues)

  const persistedStatus = (initialHeaderValues.status ?? '').toLowerCase()
  const postingLocked = persistedStatus === 'processed' || persistedStatus === 'cleared'

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.value === (headerValues.vendorId ?? '')) ?? null,
    [headerValues.vendorId, vendors],
  )

  const paymentAmount = useMemo(
    () => roundMoney(parseMoneyValue(headerValues.amount, 0)),
    [headerValues.amount],
  )

  const appliedTotal = useMemo(
    () => roundMoney(sumBillPaymentApplications(applications)),
    [applications],
  )

  const allocationError = useMemo(() => {
    if (paymentAmount <= 0) return 'Payment amount must be greater than zero.'
    if (appliedTotal > paymentAmount + 0.005) {
      return 'Applied bill amounts cannot exceed the entered payment amount.'
    }
    return ''
  }, [appliedTotal, paymentAmount])

  useEffect(() => {
    setApplications((current) =>
      current.filter((application) =>
        bills.some((bill) => bill.id === application.billId && bill.vendorId === (headerValues.vendorId ?? '')),
      ),
    )
  }, [bills, headerValues.vendorId])

  const headerFieldDefinitions: Record<string, BillPaymentHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: initialHeaderValues.id ?? '',
      displayValue: initialHeaderValues.id ?? '-',
      helpText: 'Internal database identifier for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this bill payment.',
    },
    number: {
      key: 'number',
      label: 'Bill Payment Id',
      value: initialHeaderValues.number ?? '',
      displayValue: initialHeaderValues.number ?? '-',
      helpText: 'Identifier for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: headerValues.vendorId ?? '',
      displayValue: selectedVendor?.label ?? '-',
      editable: !postingLocked,
      type: 'select',
      options: vendors,
      helpText: postingLocked
        ? 'Vendor is locked after the payment has posted to GL.'
        : 'Vendor this payment is being applied against.',
      fieldType: 'list',
      sourceText: 'Vendor record',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
    },
    billId: {
      key: 'billId',
      label: 'Bill',
      value: applications[0]?.billId ?? '',
      displayValue: applications.length > 0 ? `${applications.length} applied bill${applications.length === 1 ? '' : 's'}` : '-',
      editable: false,
      helpText: 'Bill linkage is derived from the bill applications below.',
      fieldType: 'list',
      sourceText: 'Bill transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
    },
    bankAccountId: {
      key: 'bankAccountId',
      label: 'Bank Account',
      value: headerValues.bankAccountId ?? '',
      displayValue: bankAccountOptions.find((option) => option.value === (headerValues.bankAccountId ?? ''))?.label ?? '-',
      editable: !postingLocked,
      type: 'select',
      options: bankAccountOptions,
      helpText: postingLocked
        ? 'Bank account is locked after the payment has posted to GL.'
        : 'Cash or bank GL account used for this payment.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: headerValues.amount ?? '',
      displayValue: headerValues.amount || '-',
      editable: !postingLocked,
      type: 'number',
      helpText: postingLocked
        ? 'Payment amount is locked after the payment has posted to GL.'
        : 'Enter the total payment amount, then allocate it across open bills below.',
      fieldType: 'currency',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: headerValues.date ?? '',
      displayValue: headerValues.date || '-',
      editable: !postingLocked,
      type: 'date',
      helpText: postingLocked
        ? 'Posting date is locked after the payment has posted to GL.'
        : 'Date the bill payment was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    method: {
      key: 'method',
      label: 'Method',
      value: headerValues.method ?? '',
      displayValue: methodOptions.find((option) => option.value === (headerValues.method ?? ''))?.label ?? '-',
      editable: !postingLocked,
      type: 'select',
      options: methodOptions,
      helpText: postingLocked
        ? 'Payment method is locked after the payment has posted to GL.'
        : 'Payment method used for this bill payment.',
      fieldType: 'list',
      sourceText: 'Payment method list',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    reference: {
      key: 'reference',
      label: 'Reference',
      value: headerValues.reference ?? '',
      displayValue: headerValues.reference || '-',
      editable: true,
      type: 'text',
      helpText: 'Reference number or memo for this payment.',
      fieldType: 'text',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status ?? '',
      displayValue: statusOptions.find((option) => option.value === (headerValues.status ?? ''))?.label ?? '-',
      editable: !postingLocked,
      type: 'select',
      options: statusOptions,
      helpText: postingLocked
        ? 'Status is locked after the payment has posted to GL.'
        : 'Status of this bill payment.',
      fieldType: 'list',
      sourceText: 'Bill payment status list',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: headerValues.notes ?? '',
      displayValue: headerValues.notes || '-',
      editable: true,
      type: 'text',
      helpText: 'Free-form notes for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Amount, timing, method, status, and payment notes.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: initialHeaderValues.createdAt ?? '',
      displayValue: initialHeaderValues.createdAtDisplay ?? initialHeaderValues.createdAt ?? '-',
      helpText: 'Date/time the bill payment record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill payment.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: initialHeaderValues.updatedAt ?? '',
      displayValue: initialHeaderValues.updatedAtDisplay ?? initialHeaderValues.updatedAt ?? '-',
      helpText: 'Date/time the bill payment record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill payment.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: BILL_PAYMENT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  async function handleSubmit(values: Record<string, string>) {
    if (allocationError) {
      setError(allocationError)
      return { ok: false, error: allocationError }
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/bill-payments?id=${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: values.vendorId || null,
          bankAccountId: values.bankAccountId || null,
          amount: values.amount,
          date: values.date,
          method: values.method || null,
          status: values.status,
          reference: values.reference || null,
          notes: values.notes || null,
          applications,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? 'Error updating bill payment')
        return { ok: false, error: body.error ?? 'Error updating bill payment' }
      }

      router.push(detailHref)
      router.refresh()
      return { ok: true }
    } catch {
      const nextError = 'Error updating bill payment'
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <RecordHeaderDetails
        editing
        sections={headerSections}
        columns={customization.formColumns}
        containerTitle="Bill Payment Details"
        containerDescription="Core bill payment fields organized into configurable sections."
        showSubsections={false}
        formId={`inline-record-form-${paymentId}`}
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <BillPaymentApplicationsSection
        bills={bills}
        selectedVendorId={headerValues.vendorId ?? ''}
        paymentAmount={paymentAmount}
        applications={applications}
        onChange={postingLocked ? undefined : setApplications}
        editing={!postingLocked}
        moneySettings={moneySettings}
      />
      {allocationError && !postingLocked ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {allocationError}
        </p>
      ) : null}
      {!allocationError && !postingLocked && paymentAmount > appliedTotal ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Unapplied amount: {fmtCurrency(roundMoney(paymentAmount - appliedTotal))}
        </p>
      ) : null}
      {postingLocked ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Vendor, payment terms, and applications are locked because this payment has already posted to GL.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      {saving ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Saving...
        </p>
      ) : null}
    </div>
  )
}
