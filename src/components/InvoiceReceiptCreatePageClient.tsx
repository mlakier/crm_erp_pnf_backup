'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, {
  type RecordHeaderField,
} from '@/components/RecordHeaderDetails'
import InvoiceReceiptApplicationsSection from '@/components/InvoiceReceiptApplicationsSection'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import { applyRequirementsToEditableFields, useFormRequirementsState } from '@/lib/form-requirements-client'
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

type InvoiceOption = {
  id: string
  number: string
  customerId: string
  customerNumber: string | null
  customerName: string
  status: string
  total: number
  date: string
  subsidiaryId: string | null
  currencyId: string | null
  subsidiaryLabel?: string | null
  currencyLabel?: string | null
  userId: string | null
  openAmount: number
}

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

export default function InvoiceReceiptCreatePageClient({
  invoices,
  methodOptions,
  statusOptions,
  bankAccountOptions,
  customization,
  initialHeaderValues,
  initialApplications = [],
}: {
  invoices: InvoiceOption[]
  methodOptions: Option[]
  statusOptions: Option[]
  bankAccountOptions: Option[]
  customization: InvoiceReceiptDetailCustomizationConfig
  initialHeaderValues?: Partial<Record<string, string>>
  initialApplications?: InvoiceReceiptApplicationInput[]
}) {
  const router = useRouter()
  const { req, isLocked } = useFormRequirementsState('invoiceReceiptCreate')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState<InvoiceReceiptApplicationInput[]>(initialApplications)
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    invoiceId: initialHeaderValues?.invoiceId ?? invoices[0]?.id ?? '',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? invoices[0]?.subsidiaryId ?? '',
    currencyId: initialHeaderValues?.currencyId ?? invoices[0]?.currencyId ?? '',
    bankAccountId: initialHeaderValues?.bankAccountId ?? bankAccountOptions[0]?.value ?? '',
    status: initialHeaderValues?.status ?? statusOptions.find((option) => option.value === 'draft')?.value ?? statusOptions[0]?.value ?? 'draft',
    overpaymentHandling: initialHeaderValues?.overpaymentHandling ?? '',
    amount: initialHeaderValues?.amount ?? (initialApplications.length > 0 ? String(roundMoney(sumInvoiceReceiptApplications(initialApplications))) : ''),
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    method: initialHeaderValues?.method ?? methodOptions[0]?.value ?? '',
    reference: initialHeaderValues?.reference ?? '',
  })

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
      current.filter((application) => invoices.some((invoice) => invoice.id === application.invoiceId && invoice.customerId === selectedCustomerId)),
    )
  }, [invoices, selectedCustomerId])

  useEffect(() => {
    setHeaderValues((current) => ({
      ...current,
      subsidiaryId: selectedInvoice?.subsidiaryId ?? '',
      currencyId: selectedInvoice?.currencyId ?? '',
    }))
  }, [selectedInvoice?.subsidiaryId, selectedInvoice?.currencyId])

  const invoiceOptions = invoices.map((invoice) => ({
    value: invoice.id,
    label: `${invoice.number} - ${invoice.customerName}`,
  }))

  const headerFieldDefinitions: Record<string, InvoiceReceiptHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: selectedInvoice?.customerName ?? '',
      displayValue: selectedInvoice?.customerName ?? '-',
      helpText: 'Display name from the linked invoice customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: selectedInvoice?.customerNumber ?? '',
      displayValue: selectedInvoice?.customerNumber ?? '-',
      helpText: 'Internal customer identifier from the linked invoice customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Internal database identifier for this invoice receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    number: {
      key: 'number',
      label: 'Invoice Receipt Id',
      value: '',
      displayValue: 'Auto-generated on save',
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
      editable: true,
      type: 'select',
      options: invoiceOptions,
      helpText: 'Select an invoice to establish customer context for the receipt applications below.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId ?? '',
      displayValue: selectedInvoice?.subsidiaryLabel ?? selectedInvoice?.subsidiaryId ?? '-',
      editable: false,
      helpText: 'Subsidiary inherited from the linked invoice posting context.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId ?? '',
      displayValue: selectedInvoice?.currencyLabel ?? selectedInvoice?.currencyId ?? '-',
      editable: false,
      helpText: 'Transaction currency inherited from the linked invoice posting context.',
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
      editable: true,
      type: 'select',
      options: bankAccountOptions,
      helpText: 'Cash or bank GL account that receives this receipt.',
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
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Draft receipts can remain unapplied; posted receipts must be fully applied before they post to GL.',
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
      editable: true,
      type: 'select',
      options: OVERPAYMENT_OPTIONS,
      helpText: 'When a posted receipt exceeds current invoice applications, either leave the balance on account or mark it for refund.',
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
      editable: true,
      type: 'number',
      helpText: 'Cash receipt amount applied to the invoice.',
      fieldType: 'currency',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    date: {
      key: 'date',
      label: 'Receipt Date',
      value: headerValues.date ?? '',
      displayValue: headerValues.date || '-',
      editable: true,
      type: 'date',
      helpText: 'Date the receipt was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    method: {
      key: 'method',
      label: 'Method',
      value: headerValues.method ?? '',
      displayValue: methodOptions.find((option) => option.value === (headerValues.method ?? ''))?.label ?? '-',
      editable: true,
      type: 'select',
      options: methodOptions,
      helpText: 'Method used to receive payment.',
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
      editable: true,
      type: 'text',
      helpText: 'Reference number or memo for the receipt.',
      fieldType: 'text',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Status, monetary amount, receipt date, and payment method.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the invoice receipt record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the invoice receipt record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
  }
  applyRequirementsToEditableFields(headerFieldDefinitions, req, isLocked)


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
      const response = await fetch('/api/invoice-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: values.invoiceId,
          subsidiaryId: values.subsidiaryId || null,
          currencyId: values.currencyId || null,
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

      const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!response.ok || !body.id) {
        setError(body.error ?? 'Error creating receipt')
        return { ok: false, error: body.error ?? 'Error creating receipt' }
      }

      router.push(`/invoice-receipts/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = 'Error creating receipt'
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref="/invoice-receipts"
      backLabel="<- Back to Invoice Receipts"
      meta="New"
      title="New Invoice Receipt"
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode="create" cancelHref="/invoice-receipts" formId="create-invoice-receipt-form" />}
    >
      <RecordHeaderDetails
        editing
        sections={headerSections}
        columns={customization.formColumns}
        containerTitle="Invoice Receipt Details"
        containerDescription="Core invoice receipt fields organized into configurable sections."
        showSubsections={false}
        formId="create-invoice-receipt-form"
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <div className="mt-6">
        <InvoiceReceiptApplicationsSection
          invoices={invoices as InvoiceApplicationCandidate[]}
          selectedCustomerId={selectedCustomerId}
          receiptAmount={receiptAmount}
          applications={applications}
          onChange={setApplications}
          editing
          requiresFullApplication={requiresFullApplication}
          overpaymentHandling={overpaymentHandling}
        />
      </div>
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

