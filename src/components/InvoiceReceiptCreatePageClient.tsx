'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import PurchaseOrderHeaderSections, {
  type PurchaseOrderHeaderField,
} from '@/components/PurchaseOrderHeaderSections'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  INVOICE_RECEIPT_DETAIL_FIELDS,
  type InvoiceReceiptDetailCustomizationConfig,
  type InvoiceReceiptDetailFieldKey,
} from '@/lib/invoice-receipt-detail-customization'

type InvoiceOption = {
  id: string
  number: string
  customer: {
    id: string
    customerId: string | null
    name: string
  }
}

type Option = { value: string; label: string }

type InvoiceReceiptHeaderField = {
  key: InvoiceReceiptDetailFieldKey
} & PurchaseOrderHeaderField

const sectionDescriptions: Record<string, string> = {
  Customer: 'Customer context derived from the selected invoice.',
  'Invoice Receipt Details': 'Core receipt fields, invoice link, and system-managed values.',
}

export default function InvoiceReceiptCreatePageClient({
  invoices,
  methodOptions,
  customization,
  initialHeaderValues,
}: {
  invoices: InvoiceOption[]
  methodOptions: Option[]
  customization: InvoiceReceiptDetailCustomizationConfig
  initialHeaderValues?: Partial<Record<string, string>>
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    invoiceId: initialHeaderValues?.invoiceId ?? invoices[0]?.id ?? '',
    amount: initialHeaderValues?.amount ?? '',
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    method: initialHeaderValues?.method ?? methodOptions[0]?.value ?? '',
    reference: initialHeaderValues?.reference ?? '',
  })

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === (headerValues.invoiceId ?? '')) ?? null,
    [headerValues.invoiceId, invoices],
  )

  const invoiceOptions = invoices.map((invoice) => ({
    value: invoice.id,
    label: `${invoice.number} - ${invoice.customer.name}`,
  }))

  const headerFieldDefinitions: Record<InvoiceReceiptDetailFieldKey, InvoiceReceiptHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: selectedInvoice?.customer.name ?? '',
      displayValue: selectedInvoice?.customer.name ?? '-',
      helpText: 'Display name from the linked invoice customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: selectedInvoice?.customer.customerId ?? '',
      displayValue: selectedInvoice?.customer.customerId ?? '-',
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
      label: 'Invoice',
      value: headerValues.invoiceId ?? '',
      displayValue: selectedInvoice?.number ?? '-',
      editable: true,
      type: 'select',
      options: invoiceOptions,
      helpText: 'Invoice that this receipt is applied to.',
      fieldType: 'list',
      sourceText: 'Invoice transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
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
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
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
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
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
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
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
      subsectionDescription: 'Monetary amount, receipt date, and payment method.',
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

  const headerSections = buildConfiguredTransactionSections({
    fields: INVOICE_RECEIPT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  async function handleSubmit(values: Record<string, string>) {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/invoice-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: values.invoiceId,
          amount: values.amount,
          date: values.date,
          method: values.method,
          reference: values.reference || null,
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
      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        formId="create-invoice-receipt-form"
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
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
