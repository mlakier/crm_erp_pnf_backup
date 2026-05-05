'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import SearchableSelect from '@/components/SearchableSelect'

type Option = { value: string; label: string }
type ClearingLineDraft = {
  key: string
  lineRole: string
  fromOpenItemId: string
  toOpenItemId: string
  transactionAmount: string
  memo: string
}

const sectionDescriptions: Record<string, string> = {
  'Document Identity': 'Core clearing document type and lifecycle state.',
  'Clearing Context': 'Business date, posting date, accounting period, and base amount.',
  'Source and Counterparty': 'Optional source and counterparty references for manual clearing traceability.',
  'Notes and System Dates': 'Memo and system-managed timestamps.',
}

export default function ClearingDocumentPageClient({
  mode,
  clearingDocumentId,
  subsidiaryOptions,
  currencyOptions,
  accountingPeriodOptions,
  openItemOptions,
  statusOptions,
  initialHeaderValues,
  initialLines,
}: {
  mode: 'create' | 'edit'
  clearingDocumentId?: string
  subsidiaryOptions: Option[]
  currencyOptions: Option[]
  accountingPeriodOptions: Option[]
  openItemOptions: Option[]
  statusOptions: Option[]
  initialHeaderValues?: Partial<Record<string, string>>
  initialLines?: ClearingLineDraft[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    id: initialHeaderValues?.id ?? '',
    clearingNumber: initialHeaderValues?.clearingNumber ?? '',
    clearingType: initialHeaderValues?.clearingType ?? 'manual-clearing',
    status: initialHeaderValues?.status ?? 'draft',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? '',
    transactionCurrencyId: initialHeaderValues?.transactionCurrencyId ?? '',
    localCurrencyId: initialHeaderValues?.localCurrencyId ?? '',
    functionalCurrencyId: initialHeaderValues?.functionalCurrencyId ?? '',
    groupCurrencyId: initialHeaderValues?.groupCurrencyId ?? '',
    clearingDate: initialHeaderValues?.clearingDate ?? new Date().toISOString().slice(0, 10),
    postingDate: initialHeaderValues?.postingDate ?? '',
    accountingPeriodId: initialHeaderValues?.accountingPeriodId ?? '',
    transactionAmount: initialHeaderValues?.transactionAmount ?? '0.00',
    localAmount: initialHeaderValues?.localAmount ?? '0.00',
    functionalAmount: initialHeaderValues?.functionalAmount ?? '0.00',
    groupAmount: initialHeaderValues?.groupAmount ?? '0.00',
    sourceTransactionType: initialHeaderValues?.sourceTransactionType ?? '',
    sourceTransactionId: initialHeaderValues?.sourceTransactionId ?? '',
    counterpartyType: initialHeaderValues?.counterpartyType ?? '',
    counterpartyId: initialHeaderValues?.counterpartyId ?? '',
    memo: initialHeaderValues?.memo ?? '',
    createdAt: initialHeaderValues?.createdAt ?? '',
    createdAtDisplay: initialHeaderValues?.createdAtDisplay ?? '',
    updatedAt: initialHeaderValues?.updatedAt ?? '',
    updatedAtDisplay: initialHeaderValues?.updatedAtDisplay ?? '',
  })
  const [lines, setLines] = useState<ClearingLineDraft[]>(
    initialLines && initialLines.length > 0
      ? initialLines
      : [
          {
            key: 'line-1',
            lineRole: 'manual-settlement',
            fromOpenItemId: '',
            toOpenItemId: '',
            transactionAmount: '',
            memo: '',
          },
      ],
  )

  const sections = [
    {
      title: 'Document Identity',
      description: sectionDescriptions['Document Identity'],
      rows: 1,
      fields: [
        {
          key: 'clearingNumber',
          label: 'Business Id',
          value: headerValues.clearingNumber ?? '',
          displayValue: headerValues.clearingNumber || 'Auto-generated on save',
          fieldType: 'text',
          helpText: 'Internal operational identifier for this manual clearing document.',
        } satisfies RecordHeaderField,
        {
          key: 'clearingType',
          label: 'Clearing Type',
          value: headerValues.clearingType ?? '',
          displayValue:
            [
              { value: 'manual-clearing', label: 'Manual Clearing' },
              { value: 'manual-reclass', label: 'Manual Reclass' },
              { value: 'manual-adjustment', label: 'Manual Adjustment' },
            ].find((option) => option.value === (headerValues.clearingType ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [
            { value: 'manual-clearing', label: 'Manual Clearing' },
            { value: 'manual-reclass', label: 'Manual Reclass' },
            { value: 'manual-adjustment', label: 'Manual Adjustment' },
          ],
          fieldType: 'list',
          helpText: 'Business pattern for the manual clearing transaction.',
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
          helpText: 'Manual lifecycle state. Draft, Pending Approval, and Approved are supported in this first pass.',
        } satisfies RecordHeaderField,
      ],
    },
    {
      title: 'Clearing Context',
      description: sectionDescriptions['Clearing Context'],
      rows: 3,
      fields: [
        {
          key: 'subsidiaryId',
          label: 'Subsidiary',
          value: headerValues.subsidiaryId ?? '',
          displayValue: subsidiaryOptions.find((option) => option.value === (headerValues.subsidiaryId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
          fieldType: 'list',
          helpText: 'Subsidiary/legal-entity context for this manual clearing transaction.',
        } satisfies RecordHeaderField,
        {
          key: 'clearingDate',
          label: 'Clearing Date',
          value: headerValues.clearingDate ?? '',
          displayValue: headerValues.clearingDate || '-',
          editable: true,
          type: 'date',
          fieldType: 'date',
          helpText: 'Business date for this manual clearing document.',
        } satisfies RecordHeaderField,
        {
          key: 'postingDate',
          label: 'Posting Date',
          value: headerValues.postingDate ?? '',
          displayValue: headerValues.postingDate || '-',
          editable: true,
          type: 'date',
          fieldType: 'date',
          helpText: 'Optional posting date reserved for later posting workflow.',
        } satisfies RecordHeaderField,
        {
          key: 'accountingPeriodId',
          label: 'Accounting Period',
          value: headerValues.accountingPeriodId ?? '',
          displayValue: accountingPeriodOptions.find((option) => option.value === (headerValues.accountingPeriodId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...accountingPeriodOptions],
          fieldType: 'list',
          helpText: 'Optional accounting period for this manual clearing document.',
        } satisfies RecordHeaderField,
        {
          key: 'transactionAmount',
          label: 'Transaction Amount',
          value: headerValues.transactionAmount ?? '',
          displayValue: headerValues.transactionAmount || '-',
          editable: true,
          type: 'number',
          fieldType: 'currency',
          helpText: 'Amount in transaction currency.',
        } satisfies RecordHeaderField,
        {
          key: 'transactionCurrencyId',
          label: 'Transaction Currency',
          value: headerValues.transactionCurrencyId ?? '',
          displayValue: currencyOptions.find((option) => option.value === (headerValues.transactionCurrencyId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...currencyOptions],
          fieldType: 'list',
          helpText: 'Currency the clearing transaction is entered or settled in.',
        } satisfies RecordHeaderField,
        {
          key: 'localAmount',
          label: 'Local Amount',
          value: headerValues.localAmount ?? '',
          displayValue: headerValues.localAmount || '-',
          editable: true,
          type: 'number',
          fieldType: 'currency',
          helpText: 'Amount in statutory/local currency.',
        } satisfies RecordHeaderField,
        {
          key: 'localCurrencyId',
          label: 'Local Currency',
          value: headerValues.localCurrencyId ?? '',
          displayValue: currencyOptions.find((option) => option.value === (headerValues.localCurrencyId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...currencyOptions],
          fieldType: 'list',
          helpText: 'Statutory or company-code currency.',
        } satisfies RecordHeaderField,
        {
          key: 'functionalAmount',
          label: 'Functional Amount',
          value: headerValues.functionalAmount ?? '',
          displayValue: headerValues.functionalAmount || '-',
          editable: true,
          type: 'number',
          fieldType: 'currency',
          helpText: 'Amount in functional currency.',
        } satisfies RecordHeaderField,
        {
          key: 'functionalCurrencyId',
          label: 'Functional Currency',
          value: headerValues.functionalCurrencyId ?? '',
          displayValue: currencyOptions.find((option) => option.value === (headerValues.functionalCurrencyId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...currencyOptions],
          fieldType: 'list',
          helpText: 'Primary economic-environment currency of the entity.',
        } satisfies RecordHeaderField,
        {
          key: 'groupAmount',
          label: 'Group Amount',
          value: headerValues.groupAmount ?? '',
          displayValue: headerValues.groupAmount || '-',
          editable: true,
          type: 'number',
          fieldType: 'currency',
          helpText: 'Amount in group/reporting currency.',
        } satisfies RecordHeaderField,
        {
          key: 'groupCurrencyId',
          label: 'Group Currency',
          value: headerValues.groupCurrencyId ?? '',
          displayValue: currencyOptions.find((option) => option.value === (headerValues.groupCurrencyId ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...currencyOptions],
          fieldType: 'list',
          helpText: 'Consolidated group/reporting currency.',
        } satisfies RecordHeaderField,
      ],
    },
    {
      title: 'Source and Counterparty',
      description: sectionDescriptions['Source and Counterparty'],
      rows: 2,
      fields: [
        {
          key: 'sourceTransactionType',
          label: 'Source Transaction Type',
          value: headerValues.sourceTransactionType ?? '',
          displayValue:
            [
              { value: '', label: 'None' },
              { value: 'invoice-receipt', label: 'Invoice Receipt' },
              { value: 'bill-payment', label: 'Bill Payment' },
              { value: 'customer-refund', label: 'Customer Refund' },
              { value: 'journal-entry', label: 'Journal Entry' },
            ].find((option) => option.value === (headerValues.sourceTransactionType ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [
            { value: '', label: 'None' },
            { value: 'invoice-receipt', label: 'Invoice Receipt' },
            { value: 'bill-payment', label: 'Bill Payment' },
            { value: 'customer-refund', label: 'Customer Refund' },
            { value: 'journal-entry', label: 'Journal Entry' },
          ],
          fieldType: 'list',
          helpText: 'Optional source transaction family linked to this manual clearing document.',
        } satisfies RecordHeaderField,
        {
          key: 'sourceTransactionId',
          label: 'Source Transaction DB Id',
          value: headerValues.sourceTransactionId ?? '',
          displayValue: headerValues.sourceTransactionId || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          helpText: 'Optional source transaction database identifier for traceability.',
        } satisfies RecordHeaderField,
        {
          key: 'counterpartyType',
          label: 'Counterparty Type',
          value: headerValues.counterpartyType ?? '',
          displayValue:
            [
              { value: '', label: 'None' },
              { value: 'customer', label: 'Customer' },
              { value: 'vendor', label: 'Vendor' },
              { value: 'employee', label: 'Employee' },
            ].find((option) => option.value === (headerValues.counterpartyType ?? ''))?.label ?? '-',
          editable: true,
          type: 'select',
          options: [
            { value: '', label: 'None' },
            { value: 'customer', label: 'Customer' },
            { value: 'vendor', label: 'Vendor' },
            { value: 'employee', label: 'Employee' },
          ],
          fieldType: 'list',
          helpText: 'Optional counterparty family for manual clearing context.',
        } satisfies RecordHeaderField,
        {
          key: 'counterpartyId',
          label: 'Counterparty DB Id',
          value: headerValues.counterpartyId ?? '',
          displayValue: headerValues.counterpartyId || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          helpText: 'Optional counterparty database identifier for traceability.',
        } satisfies RecordHeaderField,
      ],
    },
    {
      title: 'Notes and System Dates',
      description: sectionDescriptions['Notes and System Dates'],
      rows: 2,
      fields: [
        {
          key: 'memo',
          label: 'Memo',
          value: headerValues.memo ?? '',
          displayValue: headerValues.memo || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          helpText: 'Internal memo for this manual clearing document.',
        } satisfies RecordHeaderField,
        {
          key: 'createdAt',
          label: 'Created',
          value: headerValues.createdAt ?? '',
          displayValue: headerValues.createdAtDisplay || (mode === 'create' ? 'Set on save' : '-'),
          fieldType: 'date',
          helpText: 'Date/time the clearing document was created.',
        } satisfies RecordHeaderField,
        {
          key: 'updatedAt',
          label: 'Last Modified',
          value: headerValues.updatedAt ?? '',
          displayValue: headerValues.updatedAtDisplay || (mode === 'create' ? 'Set on save' : '-'),
          fieldType: 'date',
          helpText: 'Date/time the clearing document was last modified.',
        } satisfies RecordHeaderField,
      ],
    },
  ]

  async function handleSubmit(values: Record<string, string>) {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        mode === 'create'
          ? '/api/clearing-documents'
          : `/api/clearing-documents?id=${encodeURIComponent(clearingDocumentId ?? '')}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...values,
            lines,
          }),
        },
      )

      const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!response.ok || !body.id) {
        const nextError = body.error ?? `Error ${mode === 'create' ? 'creating' : 'saving'} clearing document`
        setError(nextError)
        return { ok: false, error: nextError }
      }

      router.push(`/clearing-documents/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = `Error ${mode === 'create' ? 'creating' : 'saving'} clearing document`
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  const detailHref = clearingDocumentId ? `/clearing-documents/${clearingDocumentId}` : '/clearing-documents'
  const lineTotal = lines.reduce((sum, line) => sum + (Number(line.transactionAmount || 0) || 0), 0)

  function updateLine(lineKey: string, field: keyof ClearingLineDraft, nextValue: string) {
    setLines((current) =>
      current.map((line) => (line.key === lineKey ? { ...line, [field]: nextValue } : line)),
    )
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: `line-${Date.now()}-${current.length + 1}`,
        lineRole: 'manual-settlement',
        fromOpenItemId: '',
        toOpenItemId: '',
        transactionAmount: '',
        memo: '',
      },
    ])
  }

  function removeLine(lineKey: string) {
    setLines((current) =>
      current.length > 1
        ? current.filter((line) => line.key !== lineKey)
        : [
            {
              key: 'line-1',
              lineRole: 'manual-settlement',
              fromOpenItemId: '',
              toOpenItemId: '',
              transactionAmount: '',
              memo: '',
            },
          ],
    )
  }

  return (
    <RecordDetailPageShell
      backHref="/clearing-documents"
      backLabel="<- Back to Clearing Documents"
      meta={mode === 'create' ? 'New' : headerValues.clearingNumber || ''}
      title={mode === 'create' ? 'New Clearing Document' : `Edit Clearing Document ${headerValues.clearingNumber || ''}`}
      widthClassName="w-full max-w-none"
      actions={
        <TransactionActionStack
          mode={mode === 'create' ? 'create' : 'edit'}
          cancelHref={detailHref}
          formId={mode === 'create' ? 'create-clearing-document-form' : `edit-clearing-document-form-${clearingDocumentId}`}
        />
      }
    >
      <RecordHeaderDetails
        editing
        sections={sections}
        columns={2}
        containerTitle="Clearing Document Details"
        containerDescription="Core manual clearing document fields organized into shared configurable sections."
        showSubsections={false}
        formId={mode === 'create' ? 'create-clearing-document-form' : `edit-clearing-document-form-${clearingDocumentId}`}
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <div className="mt-6 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card)' }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-muted)' }}>
          <div>
            <h2 className="text-base font-semibold text-white">Clearing Lines</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Draft normalized manual clearing lines against open items. Approved documents can be posted from the detail page into open-item settlement.
            </p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Add Line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Role</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>From Open Item</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>To Open Item</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Memo</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.key} style={index < lines.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                  <td className="px-3 py-2">
                    <SearchableSelect
                      selectedValue={line.lineRole}
                      options={[
                        { value: 'manual-settlement', label: 'Manual Settlement' },
                        { value: 'manual-reclass', label: 'Manual Reclass' },
                        { value: 'manual-adjustment', label: 'Manual Adjustment' },
                      ]}
                      placeholder="Select role"
                      searchPlaceholder="Search role"
                      sortMode="label"
                      textClassName="text-sm"
                      dropdownWidthMode="trigger"
                      onSelect={(value) => updateLine(line.key, 'lineRole', value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <SearchableSelect
                      selectedValue={line.fromOpenItemId}
                      options={openItemOptions}
                      placeholder="None"
                      searchPlaceholder="Search from open item"
                      sortMode="label"
                      textClassName="text-sm"
                      dropdownWidthMode="trigger"
                      onSelect={(value) => updateLine(line.key, 'fromOpenItemId', value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <SearchableSelect
                      selectedValue={line.toOpenItemId}
                      options={openItemOptions}
                      placeholder="None"
                      searchPlaceholder="Search to open item"
                      sortMode="label"
                      textClassName="text-sm"
                      dropdownWidthMode="trigger"
                      onSelect={(value) => updateLine(line.key, 'toOpenItemId', value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.transactionAmount}
                      onChange={(event) => updateLine(line.key, 'transactionAmount', event.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-right text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={line.memo}
                      onChange={(event) => updateLine(line.key, 'memo', event.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-md border px-2 py-1 text-xs font-medium"
                      style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
          Draft line total: {lineTotal.toFixed(2)}
        </div>
      </div>
      <div className="mt-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
        Manual draft clearing is live. Save in draft here, then use the detail page to post or reverse the settlement lifecycle.
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
