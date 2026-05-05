'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import BillPaymentApplicationsSection from '@/components/BillPaymentApplicationsSection'
import { fmtCurrency } from '@/lib/format'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import { applyRequirementsToEditableFields, useFormRequirementsState } from '@/lib/form-requirements-client'
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

export default function BillPaymentCreatePageClient({
  vendors,
  bills,
  methodOptions,
  statusOptions,
  bankAccountOptions,
  customization,
  initialHeaderValues,
  initialApplications = [],
}: {
  vendors: Option[]
  bills: BillApplicationCandidate[]
  methodOptions: Option[]
  statusOptions: Option[]
  bankAccountOptions: Option[]
  customization: BillPaymentDetailCustomizationConfig
  initialHeaderValues?: Partial<Record<string, string>>
  initialApplications?: BillPaymentApplicationInput[]
}) {
  const router = useRouter()
  const { req, isLocked } = useFormRequirementsState('billPaymentCreate')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<BillPaymentApplicationInput[]>(initialApplications)
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    vendorId: initialHeaderValues?.vendorId ?? vendors[0]?.value ?? '',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? '',
    currencyId: initialHeaderValues?.currencyId ?? '',
    bankAccountId: initialHeaderValues?.bankAccountId ?? bankAccountOptions[0]?.value ?? '',
    amount: initialHeaderValues?.amount ?? (initialApplications.length > 0 ? String(roundMoney(sumBillPaymentApplications(initialApplications))) : ''),
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    method: initialHeaderValues?.method ?? methodOptions[0]?.value ?? '',
    reference: initialHeaderValues?.reference ?? '',
    status: initialHeaderValues?.status ?? statusOptions[0]?.value ?? '',
    notes: initialHeaderValues?.notes ?? '',
  })

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.value === (headerValues.vendorId ?? '')) ?? null,
    [headerValues.vendorId, vendors],
  )
  const selectedPostingBill = useMemo(
    () => bills.find((bill) => bill.id === (applications[0]?.billId ?? '')) ?? null,
    [applications, bills],
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
      current.filter((application) => bills.some((bill) => bill.id === application.billId && bill.vendorId === (headerValues.vendorId ?? ''))),
    )
  }, [bills, headerValues.vendorId])

  useEffect(() => {
    setHeaderValues((current) => ({
      ...current,
      subsidiaryId: selectedPostingBill?.subsidiaryId ?? '',
      currencyId: selectedPostingBill?.currencyId ?? '',
    }))
  }, [selectedPostingBill?.subsidiaryId, selectedPostingBill?.currencyId])

  const headerFieldDefinitions: Record<string, BillPaymentHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Internal database identifier for this bill payment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this bill payment.',
    },
    number: {
      key: 'number',
      label: 'Bill Payment Id',
      value: '',
      displayValue: 'Auto-generated on save',
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
      editable: true,
      type: 'select',
      options: vendors,
      helpText: 'Vendor this payment is being applied against.',
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
      helpText: 'Primary linked bill derived from the applied bill rows below.',
      fieldType: 'list',
      sourceText: 'Bill transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId ?? '',
      displayValue: selectedPostingBill?.subsidiaryLabel ?? selectedPostingBill?.subsidiaryId ?? '-',
      editable: false,
      helpText: 'Subsidiary derived from the applied bill posting context.',
      fieldType: 'list',
      sourceText: 'Bill transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill payment identifiers and source-bill context.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId ?? '',
      displayValue: selectedPostingBill?.currencyLabel ?? selectedPostingBill?.currencyCode ?? selectedPostingBill?.currencyId ?? '-',
      editable: false,
      helpText: 'Transaction currency derived from the applied bill posting context.',
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
      editable: true,
      type: 'select',
      options: bankAccountOptions,
      helpText: 'Cash or bank GL account used for this payment.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: headerValues.amount ?? '',
      displayValue: headerValues.amount || '-',
      editable: true,
      type: 'number',
      helpText: 'Enter the total payment amount, then allocate it across open bills below.',
      fieldType: 'currency',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: headerValues.date ?? '',
      displayValue: headerValues.date || '-',
      editable: true,
      type: 'date',
      helpText: 'Date the bill payment was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    method: {
      key: 'method',
      label: 'Method',
      value: headerValues.method ?? '',
      displayValue: methodOptions.find((option) => option.value === (headerValues.method ?? ''))?.label ?? '-',
      editable: true,
      type: 'select',
      options: methodOptions,
      helpText: 'Payment method used for this bill payment.',
      fieldType: 'list',
      sourceText: 'Payment method list',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
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
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status ?? '',
      displayValue: statusOptions.find((option) => option.value === (headerValues.status ?? ''))?.label ?? '-',
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Status of this bill payment.',
      fieldType: 'list',
      sourceText: 'Bill payment status list',
      subsectionTitle: 'Payment Terms',
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
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
      subsectionDescription: 'Monetary amount, date, payment method, and status.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the bill payment was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill payment.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the bill payment was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill payment.',
    },
  }
  applyRequirementsToEditableFields(headerFieldDefinitions, req, isLocked)


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
      const response = await fetch('/api/bill-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: values.vendorId,
          subsidiaryId: values.subsidiaryId || null,
          currencyId: values.currencyId || null,
          bankAccountId: values.bankAccountId || null,
          amount: values.amount,
          date: values.date,
          method: values.method,
          status: values.status,
          reference: values.reference || null,
          notes: values.notes || null,
          applications,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!response.ok || !body.id) {
        setError(body.error ?? 'Error creating bill payment')
        return { ok: false, error: body.error ?? 'Error creating bill payment' }
      }

      router.push(`/bill-payments/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = 'Error creating bill payment'
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref="/bill-payments"
      backLabel="<- Back to Bill Payments"
      meta="New"
      title="New Bill Payment"
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode="create" cancelHref="/bill-payments" formId="create-bill-payment-form" />}
    >
      <RecordHeaderDetails
        editing
        sections={headerSections}
        columns={customization.formColumns}
        containerTitle="Bill Payment Details"
        containerDescription="Core bill payment fields organized into configurable sections."
        showSubsections={false}
        formId="create-bill-payment-form"
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <div className="mt-6">
        <BillPaymentApplicationsSection
          bills={bills}
          selectedVendorId={headerValues.vendorId ?? ''}
          paymentAmount={paymentAmount}
          applications={applications}
          onChange={setApplications}
          editing
        />
      </div>
      {allocationError ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>
          {allocationError}
        </p>
      ) : null}
      {!allocationError && paymentAmount > appliedTotal ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Unapplied amount: {fmtCurrency(roundMoney(paymentAmount - appliedTotal))}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      {saving ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Saving...
        </p>
      ) : null}
    </RecordDetailPageShell>
  )
}

