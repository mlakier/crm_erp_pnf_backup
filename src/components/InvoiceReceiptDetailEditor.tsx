'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import InvoiceReceiptApplicationsSection from '@/components/InvoiceReceiptApplicationsSection'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  INVOICE_RECEIPT_DETAIL_FIELDS,
  type InvoiceReceiptDetailCustomizationConfig,
  type InvoiceReceiptDetailFieldKey,
} from '@/lib/invoice-receipt-detail-customization'
import {
  roundMoney,
  sumInvoiceReceiptApplications,
  type InvoiceApplicationCandidate,
  type InvoiceReceiptApplicationInput,
} from '@/lib/invoice-receipt-applications'
import { parseMoneyValue } from '@/lib/money'

type Option = { value: string; label: string }
const OVERPAYMENT_OPTIONS: Option[] = [
  { value: '', label: 'Require Full Application' },
  { value: 'apply_to_future_invoices', label: 'Leave On Account' },
  { value: 'refund_pending', label: 'Refund Customer' },
]

type InvoiceReceiptHeaderField = {
  key: InvoiceReceiptDetailFieldKey
} & RecordHeaderField

const sectionDescriptions: Record<string, string> = {
  Customer: 'Customer context derived from the selected invoice.',
  'Invoice Receipt Details': 'Core receipt fields, invoice link, and system-managed values.',
}

export default function InvoiceReceiptDetailEditor({
  receiptId,
  detailHref,
  customization,
  invoices,
  statusOptions,
  methodOptions,
  bankAccountOptions,
  initialHeaderValues,
  initialApplications,
  moneySettings,
}: {
  receiptId: string
  detailHref: string
  customization: InvoiceReceiptDetailCustomizationConfig
  invoices: InvoiceApplicationCandidate[]
  statusOptions: Option[]
  methodOptions: Option[]
  bankAccountOptions: Option[]
  initialHeaderValues: Record<string, string>
  initialApplications: InvoiceReceiptApplicationInput[]
  moneySettings?: Parameters<typeof InvoiceReceiptApplicationsSection>[0]['moneySettings']
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<InvoiceReceiptApplicationInput[]>(initialApplications)
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(initialHeaderValues)
  const persistedStatus = (initialHeaderValues.status ?? '').toLowerCase()
  const postingLocked = persistedStatus === 'posted'

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === (headerValues.invoiceId ?? '')) ?? null,
    [headerValues.invoiceId, invoices],
  )
  const selectedCustomerId = selectedInvoice?.customerId ?? ''
  const receiptAmount = useMemo(
    () => roundMoney(parseMoneyValue(headerValues.amount, 0)),
    [headerValues.amount],
  )
  const appliedTotal = useMemo(
    () => roundMoney(sumInvoiceReceiptApplications(applications)),
    [applications],
  )
  const selectedStatus = (headerValues.status ?? '').toLowerCase()
  const requiresFullApplication = selectedStatus === 'posted'
  const overpaymentHandling = headerValues.overpaymentHandling ?? ''
  const allocationError = useMemo(() => {
    if (receiptAmount <= 0) return 'Receipt amount must be greater than zero.'
    if (appliedTotal > receiptAmount + 0.005) return 'Applied invoice amounts cannot exceed the entered receipt amount.'
    if (requiresFullApplication && roundMoney(receiptAmount - appliedTotal) > 0.005 && !overpaymentHandling) {
      return 'Choose how to handle the overpayment before posting this receipt.'
    }
    return ''
  }, [appliedTotal, receiptAmount, requiresFullApplication, overpaymentHandling])

  useEffect(() => {
    if (!selectedCustomerId) {
      setApplications([])
      return
    }
    setApplications((current) =>
      current.filter((application) =>
        invoices.some((invoice) => invoice.id === application.invoiceId && invoice.customerId === selectedCustomerId),
      ),
    )
  }, [invoices, selectedCustomerId])

  const invoiceOptions = useMemo(
    () => invoices.map((invoice) => ({
      value: invoice.id,
      label: `${invoice.number} - ${invoice.customerName}`,
    })),
    [invoices],
  )

  const headerFieldDefinitions: Record<string, InvoiceReceiptHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: selectedInvoice?.customerName ?? '',
      displayValue: selectedInvoice?.customerName ?? '-',
      helpText: 'Display name from the selected invoice customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: '',
      displayValue: selectedInvoice?.customerName ?? '-',
      helpText: 'Customer context is derived from the selected invoice and its applications.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: initialHeaderValues.id ?? '',
      displayValue: initialHeaderValues.id ?? '-',
      helpText: 'Internal database identifier for this invoice receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    number: {
      key: 'number',
      label: 'Invoice Receipt Id',
      value: initialHeaderValues.number ?? '',
      displayValue: initialHeaderValues.number ?? '-',
      helpText: 'Unique identifier for this invoice receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    invoiceId: {
      key: 'invoiceId',
      label: 'Anchor Invoice',
      value: headerValues.invoiceId ?? '',
      displayValue: applications.length > 1 ? `${applications.length} applied invoices` : selectedInvoice?.number ?? '-',
      editable: !postingLocked,
      type: 'select',
      options: invoiceOptions,
      helpText: postingLocked
        ? 'Invoice applications are locked after this receipt has posted to GL.'
        : 'Select an invoice to establish customer context for the receipt applications below.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
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
        ? 'Bank account is locked after this receipt has posted to GL.'
        : 'Cash or bank GL account that receives this receipt.',
      fieldType: 'list',
      sourceText: 'Chart of accounts',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
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
        ? 'Status is locked after this receipt has posted to GL.'
        : 'Draft receipts can remain unapplied; posted receipts must be fully applied before they post to GL.',
      fieldType: 'list',
      sourceText: 'Invoice receipt status list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    overpaymentHandling: {
      key: 'overpaymentHandling',
      label: 'Overpayment Handling',
      value: headerValues.overpaymentHandling ?? '',
      displayValue: OVERPAYMENT_OPTIONS.find((option) => option.value === (headerValues.overpaymentHandling ?? ''))?.label ?? 'Require Full Application',
      editable: !postingLocked,
      type: 'select',
      options: OVERPAYMENT_OPTIONS,
      helpText: postingLocked
        ? 'Overpayment handling is locked after this receipt has posted to GL.'
        : 'Choose whether any posted overpayment stays on account or should be refunded.',
      fieldType: 'list',
      sourceText: 'Invoice receipt overpayment policy',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: headerValues.amount ?? '',
      displayValue: headerValues.amount || '-',
      editable: !postingLocked,
      type: 'number',
      helpText: postingLocked
        ? 'Receipt amount is locked after this receipt has posted to GL.'
        : 'Enter the total receipt amount, then allocate it across open invoices below.',
      fieldType: 'currency',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    date: {
      key: 'date',
      label: 'Receipt Date',
      value: headerValues.date ?? '',
      displayValue: headerValues.date || '-',
      editable: !postingLocked,
      type: 'date',
      helpText: postingLocked
        ? 'Receipt date is locked after this receipt has posted to GL.'
        : 'Date the receipt was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
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
        ? 'Payment method is locked after this receipt has posted to GL.'
        : 'Method used to receive payment.',
      fieldType: 'list',
      sourceText: 'Payment method list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    reference: {
      key: 'reference',
      label: 'Reference',
      value: headerValues.reference ?? '',
      displayValue: headerValues.reference || '-',
      editable: !postingLocked,
      type: 'text',
      helpText: postingLocked
        ? 'Reference is locked after this receipt has posted to GL.'
        : 'Reference number or memo for the receipt.',
      fieldType: 'text',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: initialHeaderValues.createdAt ?? '',
      displayValue: initialHeaderValues.createdAtDisplay ?? initialHeaderValues.createdAt ?? '-',
      helpText: 'Date/time the invoice receipt record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: initialHeaderValues.updatedAt ?? '',
      displayValue: initialHeaderValues.updatedAtDisplay ?? initialHeaderValues.updatedAt ?? '-',
      helpText: 'Date/time the invoice receipt record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: INVOICE_RECEIPT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  async function handleSubmit(values: Record<string, string>) {
    if (allocationError) {
      return { ok: false, error: allocationError }
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/invoice-receipts?id=${encodeURIComponent(receiptId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: values.invoiceId,
          bankAccountId: values.bankAccountId || null,
          status: values.status,
          overpaymentHandling: values.overpaymentHandling || null,
          amount: values.amount,
          date: values.date,
          method: values.method,
          reference: values.reference || null,
          applications,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? 'Error updating receipt')
        return { ok: false, error: body.error ?? 'Error updating receipt' }
      }

      router.push(detailHref)
      router.refresh()
      return { ok: true }
    } catch {
      const nextError = 'Error updating receipt'
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
        containerTitle="Invoice Receipt Details"
        containerDescription="Core invoice receipt fields organized into configurable sections."
        showSubsections={false}
        formId={`inline-record-form-${receiptId}`}
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <InvoiceReceiptApplicationsSection
        invoices={invoices}
        selectedCustomerId={selectedCustomerId}
        receiptAmount={receiptAmount}
        applications={applications}
        onChange={postingLocked ? undefined : setApplications}
        editing={!postingLocked}
        requiresFullApplication={requiresFullApplication}
        overpaymentHandling={overpaymentHandling}
        moneySettings={moneySettings}
      />
      {postingLocked ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Receipt terms and applications are locked because this receipt has already posted to GL.
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
