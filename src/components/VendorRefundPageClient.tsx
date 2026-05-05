'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'

type Option = { value: string; label: string }

type RefundSourceOption = {
  id: string
  vendorId: string
  vendorName: string
  paymentNumber: string
  billNumber: string | null
  availableAmount: number
}

const sectionDescriptions: Record<string, string> = {
  'Document Identity': 'Core vendor refund identifiers and source overpayment linkage.',
  'Refund Terms': 'Refund amount, bank account, payment method, and lifecycle status.',
  'System Dates': 'System-managed timestamps for this vendor refund.',
}

export default function VendorRefundPageClient({
  mode,
  refundId,
  vendors,
  refundSources,
  bankAccountOptions,
  methodOptions,
  statusOptions,
  initialHeaderValues,
}: {
  mode: 'create' | 'edit'
  refundId?: string
  vendors: Option[]
  refundSources: RefundSourceOption[]
  bankAccountOptions: Option[]
  methodOptions: Option[]
  statusOptions: Option[]
  initialHeaderValues?: Partial<Record<string, string>>
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    id: initialHeaderValues?.id ?? '',
    number: initialHeaderValues?.number ?? '',
    vendorId: initialHeaderValues?.vendorId ?? vendors[0]?.value ?? '',
    billPaymentId: initialHeaderValues?.billPaymentId ?? '',
    bankAccountId: initialHeaderValues?.bankAccountId ?? bankAccountOptions[0]?.value ?? '',
    amount: initialHeaderValues?.amount ?? '',
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    method: initialHeaderValues?.method ?? methodOptions[0]?.value ?? '',
    reference: initialHeaderValues?.reference ?? '',
    notes: initialHeaderValues?.notes ?? '',
    status: initialHeaderValues?.status ?? statusOptions[0]?.value ?? 'draft',
    createdAt: initialHeaderValues?.createdAt ?? '',
    createdAtDisplay: initialHeaderValues?.createdAtDisplay ?? '',
    updatedAt: initialHeaderValues?.updatedAt ?? '',
    updatedAtDisplay: initialHeaderValues?.updatedAtDisplay ?? '',
  })

  const selectedVendorId = headerValues.vendorId ?? ''
  const filteredSources = useMemo(
    () => refundSources.filter((source) => source.vendorId === selectedVendorId),
    [refundSources, selectedVendorId],
  )
  const sourceOptions = filteredSources.map((source) => ({
    value: source.id,
    label: `${source.paymentNumber}${source.billNumber ? ` - ${source.billNumber}` : ''} - ${source.vendorName} - Available ${source.availableAmount.toFixed(2)}`,
  }))
  const selectedSource = filteredSources.find((source) => source.id === (headerValues.billPaymentId ?? '')) ?? null
  const previousSourceIdRef = useRef(headerValues.billPaymentId ?? '')

  useEffect(() => {
    const previousSourceId = previousSourceIdRef.current
    const previousSource = filteredSources.find((source) => source.id === previousSourceId) ?? null
    const previousAutoAmount = previousSource ? previousSource.availableAmount.toFixed(2) : ''
    const nextAutoAmount = selectedSource ? selectedSource.availableAmount.toFixed(2) : ''

    previousSourceIdRef.current = headerValues.billPaymentId ?? ''
    if (!selectedSource) return

    setHeaderValues((current) => {
      if ((current.billPaymentId ?? '') !== selectedSource.id) return current

      const nextValues = { ...current }
      let changed = false

      if (!current.amount || current.amount === previousAutoAmount) {
        nextValues.amount = nextAutoAmount
        changed = true
      }

      if (!current.vendorId && selectedSource.vendorId) {
        nextValues.vendorId = selectedSource.vendorId
        changed = true
      }

      return changed ? nextValues : current
    })
  }, [filteredSources, headerValues.billPaymentId, selectedSource])

  const sections = [
    {
      title: 'Document Identity',
      description: sectionDescriptions['Document Identity'],
      rows: 1,
      fields: [
        {
          key: 'number',
          label: 'Vendor Refund Id',
          value: headerValues.number || '',
          displayValue: headerValues.number || 'Auto-generated on save',
          fieldType: 'text',
          helpText: 'Unique identifier for this vendor refund.',
        } satisfies RecordHeaderField,
        {
          key: 'vendorId',
          label: 'Vendor',
          value: headerValues.vendorId ?? '',
          displayValue: vendors.find((option) => option.value === (headerValues.vendorId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: vendors,
          fieldType: 'list',
          helpText: 'Vendor issuing the refund.',
        } satisfies RecordHeaderField,
        {
          key: 'billPaymentId',
          label: 'Refund Source',
          value: headerValues.billPaymentId ?? '',
          displayValue: sourceOptions.find((option) => option.value === (headerValues.billPaymentId ?? ''))?.label ?? 'Standalone vendor refund',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'Standalone vendor refund' }, ...sourceOptions],
          fieldType: 'list',
          helpText: 'Select an overpaid bill payment, or leave blank for a standalone refund.',
        } satisfies RecordHeaderField,
      ],
    },
    {
      title: 'Refund Terms',
      description: sectionDescriptions['Refund Terms'],
      rows: 2,
      fields: [
        {
          key: 'bankAccountId',
          label: 'Bank Account',
          value: headerValues.bankAccountId ?? '',
          displayValue: bankAccountOptions.find((option) => option.value === (headerValues.bankAccountId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: bankAccountOptions,
          fieldType: 'list',
          helpText: 'Cash or bank account receiving the refund disbursement.',
        } satisfies RecordHeaderField,
        {
          key: 'amount',
          label: 'Amount',
          value: headerValues.amount ?? '',
          displayValue: headerValues.amount || '-',
          editable: true,
          type: 'number',
          fieldType: 'currency',
          helpText: selectedSource
            ? `Available refundable balance on the selected source is ${selectedSource.availableAmount.toFixed(2)}.`
            : 'Refund amount.',
        } satisfies RecordHeaderField,
        {
          key: 'date',
          label: 'Refund Date',
          value: headerValues.date ?? '',
          displayValue: headerValues.date || '-',
          editable: true,
          type: 'date',
          fieldType: 'date',
          helpText: 'Date the refund was received.',
        } satisfies RecordHeaderField,
        {
          key: 'method',
          label: 'Method',
          value: headerValues.method ?? '',
          displayValue: methodOptions.find((option) => option.value === (headerValues.method ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: methodOptions,
          fieldType: 'list',
          helpText: 'Receipt method for the refund.',
        } satisfies RecordHeaderField,
        {
          key: 'status',
          label: 'Status',
          value: headerValues.status ?? '',
          displayValue: statusOptions.find((option) => option.value === (headerValues.status ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: statusOptions,
          fieldType: 'list',
          helpText: 'Processed refunds post to GL and increase cash.',
        } satisfies RecordHeaderField,
        {
          key: 'reference',
          label: 'Reference',
          value: headerValues.reference ?? '',
          displayValue: headerValues.reference || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          helpText: 'Reference or memo for this refund.',
        } satisfies RecordHeaderField,
        {
          key: 'notes',
          label: 'Notes',
          value: headerValues.notes ?? '',
          displayValue: headerValues.notes || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          helpText: 'Internal notes for this refund.',
        } satisfies RecordHeaderField,
      ],
    },
    {
      title: 'System Dates',
      description: sectionDescriptions['System Dates'],
      rows: 1,
      fields: [
        {
          key: 'createdAt',
          label: 'Created',
          value: headerValues.createdAt ?? '',
          displayValue: headerValues.createdAtDisplay || (mode === 'create' ? 'Set on save' : '-'),
          fieldType: 'date',
          helpText: 'Date/time the refund was created.',
        } satisfies RecordHeaderField,
        {
          key: 'updatedAt',
          label: 'Last Modified',
          value: headerValues.updatedAt ?? '',
          displayValue: headerValues.updatedAtDisplay || (mode === 'create' ? 'Set on save' : '-'),
          fieldType: 'date',
          helpText: 'Date/time the refund was last modified.',
        } satisfies RecordHeaderField,
      ],
    },
  ]

  async function handleSubmit(values: Record<string, string>) {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(mode === 'create' ? '/api/vendor-refunds' : `/api/vendor-refunds?id=${encodeURIComponent(refundId ?? '')}`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: values.vendorId,
          billPaymentId: values.billPaymentId || null,
          bankAccountId: values.bankAccountId || null,
          amount: values.amount,
          date: values.date,
          method: values.method,
          reference: values.reference || null,
          notes: values.notes || null,
          status: values.status,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!response.ok) {
        setError(body.error ?? `Error ${mode === 'create' ? 'creating' : 'updating'} vendor refund`)
        return { ok: false, error: body.error ?? `Error ${mode === 'create' ? 'creating' : 'updating'} vendor refund` }
      }

      router.push(`/vendor-refunds/${body.id ?? refundId}`)
      router.refresh()
      return { ok: true }
    } catch {
      const nextError = `Error ${mode === 'create' ? 'creating' : 'updating'} vendor refund`
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref={mode === 'create' ? '/vendor-refunds' : `/vendor-refunds/${refundId}`}
      backLabel={mode === 'create' ? '<- Back to Vendor Refunds' : '<- Back to Vendor Refund'}
      meta={mode === 'create' ? 'New' : (headerValues.number || refundId || 'Refund')}
      title={mode === 'create' ? 'New Vendor Refund' : `Vendor Refund ${headerValues.number || ''}`}
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode={mode === 'create' ? 'create' : 'edit'} cancelHref={mode === 'create' ? '/vendor-refunds' : `/vendor-refunds/${refundId}`} formId={`vendor-refund-form-${mode}`} />}
    >
      <RecordHeaderDetails
        editing
        sections={sections}
        columns={3}
        containerTitle="Vendor Refund Details"
        containerDescription="Vendor refund, overpayment source, and cash receipt details."
        showSubsections={false}
        formId={`vendor-refund-form-${mode}`}
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      {error ? <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      {saving ? <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Saving...</p> : null}
    </RecordDetailPageShell>
  )
}
