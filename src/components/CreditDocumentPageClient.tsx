'use client'

import { useEffect, useMemo, useState } from 'react'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import RecordHeaderDetails, { type RecordHeaderSection } from '@/components/RecordHeaderDetails'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import CreditDocumentApplicationsSection from '@/components/CreditDocumentApplicationsSection'
import CreditDocumentLineItemsEditor, { type CreditDocumentLineDraft } from '@/components/CreditDocumentLineItemsEditor'
import type { BillCreditApplicationInput } from '@/lib/bill-credit-applications'
import type { CreditMemoApplicationInput } from '@/lib/credit-memo-applications'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'

type CounterpartyOption = {
  id: string
  reference: string
  name: string
  email?: string | null
  subsidiaryId?: string | null
  currencyId?: string | null
}

type SourceDocumentOption = {
  id: string
  number: string
  counterpartyId: string
  subsidiaryId?: string | null
  currencyId?: string | null
  total?: number | null
  status?: string
  date?: string
  openAmount?: number | null
  currencyCode?: string | null
  userId?: string | null
}

type SimpleOption = {
  value: string
  label: string
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function CreditDocumentPageClient({
  kind,
  mode,
  documentId,
  nextNumber,
  userId,
  userLabel,
  counterparties,
  sourceDocuments,
  subsidiaries,
  currencies,
  items,
  moneySettings,
  initialHeaderValues,
  initialLineItems,
}: {
  kind: 'credit-memo' | 'bill-credit'
  mode: 'create' | 'edit'
  documentId?: string
  nextNumber: string
  userId: string
  userLabel: string
  counterparties: CounterpartyOption[]
  sourceDocuments: SourceDocumentOption[]
  subsidiaries: SimpleOption[]
  currencies: SimpleOption[]
  items: Array<{ id: string; itemId: string | null; name: string }>
  moneySettings: Parameters<typeof fmtCurrency>[2]
  initialHeaderValues?: Partial<Record<string, string>>
  initialLineItems?: CreditDocumentLineDraft[]
}) {
  const isAr = kind === 'credit-memo'
  const titleLabel = isAr ? 'Credit Memo' : 'Bill Credit'
  const counterpartyLabel = isAr ? 'Customer' : 'Vendor'
  const sourceLabel = isAr ? 'Invoice' : 'Bill'
  const resourcePath = isAr ? '/api/credit-memos' : '/api/bill-credits'
  const detailBaseHref = isAr ? '/credit-memos' : '/bill-credits'
  const backLabel = isAr ? 'Back to Credit Memos' : 'Back to Bill Credits'

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    id: initialHeaderValues?.id ?? '',
    number: initialHeaderValues?.number ?? nextNumber,
    counterpartyId: initialHeaderValues?.counterpartyId ?? counterparties[0]?.id ?? '',
    sourceDocumentId: initialHeaderValues?.sourceDocumentId ?? '',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? '',
    currencyId: initialHeaderValues?.currencyId ?? '',
    status: initialHeaderValues?.status ?? 'draft',
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    reason: initialHeaderValues?.reason ?? '',
    notes: initialHeaderValues?.notes ?? '',
    createdAtDisplay: initialHeaderValues?.createdAtDisplay ?? '',
    updatedAtDisplay: initialHeaderValues?.updatedAtDisplay ?? '',
  })
  const [lineItems, setLineItems] = useState<CreditDocumentLineDraft[]>(
    initialLineItems ?? [
      {
        id: `draft-${Date.now()}`,
        itemId: '',
        description: '',
        quantity: '1',
        unitPrice: '0',
        notes: '',
      },
    ],
  )
  const [applications, setApplications] = useState<Array<CreditMemoApplicationInput | BillCreditApplicationInput>>(() => {
    const serialized = initialHeaderValues?.applications
    if (serialized) {
      try {
        return JSON.parse(serialized)
      } catch {
        return []
      }
    }
    return []
  })

  const selectedCounterparty = useMemo(
    () => counterparties.find((entry) => entry.id === headerValues.counterpartyId) ?? null,
    [counterparties, headerValues.counterpartyId],
  )

  const filteredSourceDocuments = useMemo(
    () =>
      sourceDocuments.filter((entry) => !headerValues.counterpartyId || entry.counterpartyId === headerValues.counterpartyId),
    [headerValues.counterpartyId, sourceDocuments],
  )

  const selectedSourceDocument = useMemo(
    () => filteredSourceDocuments.find((entry) => entry.id === headerValues.sourceDocumentId) ?? null,
    [filteredSourceDocuments, headerValues.sourceDocumentId],
  )

  const creditMemoApplicationDocuments = useMemo(
    () =>
      filteredSourceDocuments.map((document) => ({
        id: document.id,
        number: document.number,
        customerId: document.counterpartyId,
        customerName: selectedCounterparty?.name ?? '',
        status: document.status ?? '-',
        total: Number(document.total ?? 0),
        date: document.date ?? '',
        subsidiaryId: document.subsidiaryId ?? null,
        currencyId: document.currencyId ?? null,
        currencyCode: document.currencyCode ?? null,
        userId: document.userId ?? null,
        openAmount: Number(document.openAmount ?? document.total ?? 0),
      })),
    [filteredSourceDocuments, selectedCounterparty?.name],
  )

  const billCreditApplicationDocuments = useMemo(
    () =>
      filteredSourceDocuments.map((document) => ({
        id: document.id,
        number: document.number,
        vendorId: document.counterpartyId,
      vendorName: selectedCounterparty?.name ?? '',
      status: document.status ?? '-',
      total: Number(document.total ?? 0),
      date: document.date ?? '',
      subsidiaryId: document.subsidiaryId ?? null,
      currencyId: document.currencyId ?? null,
        currencyCode: document.currencyCode ?? null,
        userId: document.userId ?? null,
        openAmount: Number(document.openAmount ?? document.total ?? 0),
      })),
    [filteredSourceDocuments, selectedCounterparty?.name],
  )

  useEffect(() => {
    if (!selectedSourceDocument) return
    setHeaderValues((current) => ({
      ...current,
      counterpartyId: selectedSourceDocument.counterpartyId || current.counterpartyId,
      subsidiaryId: selectedSourceDocument.subsidiaryId || current.subsidiaryId,
      currencyId: selectedSourceDocument.currencyId || current.currencyId,
    }))
  }, [selectedSourceDocument])

  useEffect(() => {
    if (selectedSourceDocument || !selectedCounterparty) return
    setHeaderValues((current) => ({
      ...current,
      subsidiaryId: current.subsidiaryId || selectedCounterparty.subsidiaryId || '',
      currencyId: current.currencyId || selectedCounterparty.currencyId || '',
    }))
  }, [selectedCounterparty, selectedSourceDocument])

  const total = useMemo(
    () =>
      lineItems.reduce((sum, line) => {
        const quantity = Math.max(1, toNumber(line.quantity))
        const unitPrice = Math.max(0, toNumber(line.unitPrice))
        return sum + quantity * unitPrice
      }, 0),
    [lineItems],
  )

  const currencyCode =
    currencies.find((currency) => currency.value === headerValues.currencyId)?.label.split(' - ')[0] ?? undefined

  useEffect(() => {
    setApplications((current) => {
      const nextSourceId = headerValues.sourceDocumentId
      if (!nextSourceId) return []
      const stillHasCurrent = current.some((application) =>
        isAr ? 'invoiceId' in application && application.invoiceId === nextSourceId : 'billId' in application && application.billId === nextSourceId,
      )
      if (stillHasCurrent) return current
      return []
    })
  }, [headerValues.sourceDocumentId, isAr])

  const sections: RecordHeaderSection[] = [
    {
      title: 'Document Identity',
      description: `Core ${titleLabel.toLowerCase()} identifiers and source-document context.`,
      rows: 2,
      fields: [
        {
          key: 'number',
          label: `${titleLabel} Id`,
          value: headerValues.number,
          displayValue: headerValues.number || 'Auto-generated on save',
          fieldType: 'text',
          column: 1,
          order: 0,
        },
        {
          key: 'counterpartyId',
          label: counterpartyLabel,
          value: headerValues.counterpartyId,
          displayValue: selectedCounterparty ? `${selectedCounterparty.reference} - ${selectedCounterparty.name}` : '-',
          editable: true,
          type: 'select',
          options: counterparties.map((entry) => ({
            value: entry.id,
            label: `${entry.reference} - ${entry.name}`,
          })),
          fieldType: 'list',
          column: 2,
          order: 0,
        },
        {
          key: 'sourceDocumentId',
          label: sourceLabel,
          value: headerValues.sourceDocumentId,
          displayValue: selectedSourceDocument?.number ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...filteredSourceDocuments.map((entry) => ({ value: entry.id, label: entry.number }))],
          fieldType: 'list',
          column: 3,
          order: 0,
        },
        {
          key: 'reason',
          label: 'Reason',
          value: headerValues.reason,
          displayValue: headerValues.reason || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          column: 4,
          order: 0,
        },
        {
          key: 'notes',
          label: 'Notes',
          value: headerValues.notes,
          displayValue: headerValues.notes || '-',
          editable: true,
          type: 'text',
          fieldType: 'text',
          column: 1,
          order: 1,
        },
      ],
    },
    {
      title: 'Workflow & Timing',
      description: `Lifecycle status and key dates for this ${titleLabel.toLowerCase()}.`,
      rows: 1,
      fields: [
        {
          key: 'status',
          label: 'Status',
          value: headerValues.status,
          displayValue: headerValues.status || '-',
          editable: true,
          type: 'select',
          options: [
            { value: 'draft', label: 'draft' },
            { value: 'pending approval', label: 'pending approval' },
            { value: 'approved', label: 'approved' },
            { value: 'partially applied', label: 'partially applied' },
            { value: 'fully applied', label: 'fully applied' },
            { value: 'void', label: 'void' },
          ],
          fieldType: 'list',
          column: 1,
          order: 0,
        },
        {
          key: 'date',
          label: 'Date',
          value: headerValues.date,
          displayValue: headerValues.date ? fmtDocumentDate(new Date(headerValues.date), moneySettings) : '-',
          editable: true,
          type: 'date',
          fieldType: 'date',
          column: 2,
          order: 0,
        },
      ],
    },
    {
      title: 'Sourcing & Financials',
      description: `Organizational, currency, and monetary context for this ${titleLabel.toLowerCase()}.`,
      rows: 1,
      fields: [
        {
          key: 'subsidiaryId',
          label: 'Subsidiary',
          value: headerValues.subsidiaryId,
          displayValue: subsidiaries.find((entry) => entry.value === headerValues.subsidiaryId)?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...subsidiaries],
          fieldType: 'list',
          column: 1,
          order: 0,
        },
        {
          key: 'currencyId',
          label: 'Currency',
          value: headerValues.currencyId,
          displayValue: currencies.find((entry) => entry.value === headerValues.currencyId)?.label ?? '-',
          editable: true,
          type: 'select',
          options: [{ value: '', label: 'None' }, ...currencies],
          fieldType: 'list',
          column: 2,
          order: 0,
        },
        {
          key: 'total',
          label: 'Total',
          value: String(total),
          displayValue: fmtCurrency(total, currencyCode, moneySettings),
          fieldType: 'currency',
          column: 3,
          order: 0,
        },
      ],
    },
    {
      title: 'Record Keys',
      description: `Internal database and created-by identifiers for this ${titleLabel.toLowerCase()}.`,
      rows: 1,
      fields: [
        {
          key: 'id',
          label: 'DB Id',
          value: headerValues.id,
          displayValue: headerValues.id || 'Auto-generated on save',
          fieldType: 'text',
          column: 1,
          order: 0,
        },
        {
          key: 'userId',
          label: 'Created By',
          value: userId,
          displayValue: userLabel,
          fieldType: 'text',
          column: 2,
          order: 0,
        },
      ],
    },
    {
      title: 'System Dates',
      description: `System-managed timestamps for this ${titleLabel.toLowerCase()}.`,
      rows: 1,
      fields: [
        {
          key: 'createdAtDisplay',
          label: 'Created',
          value: headerValues.createdAtDisplay,
          displayValue: headerValues.createdAtDisplay || (mode === 'create' ? 'Set on save' : '-'),
          fieldType: 'date',
          column: 1,
          order: 0,
        },
        {
          key: 'updatedAtDisplay',
          label: 'Last Modified',
          value: headerValues.updatedAtDisplay,
          displayValue: headerValues.updatedAtDisplay || (mode === 'create' ? 'Set on save' : '-'),
          fieldType: 'date',
          column: 2,
          order: 0,
        },
      ],
    },
  ]

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const normalizedLines = lineItems
        .map((line) => {
          const quantity = Math.max(1, toNumber(line.quantity))
          const unitPrice = Math.max(0, toNumber(line.unitPrice))
          return {
            itemId: line.itemId || null,
            description: line.description,
            quantity,
            unitPrice,
            notes: line.notes || null,
          }
        })
        .filter((line) => line.itemId || line.description.trim())

      const payload = {
        [isAr ? 'customerId' : 'vendorId']: headerValues.counterpartyId || null,
        [isAr ? 'invoiceId' : 'billId']: headerValues.sourceDocumentId || null,
        userId,
        subsidiaryId: headerValues.subsidiaryId || null,
        currencyId: headerValues.currencyId || null,
        status: headerValues.status || 'draft',
        date: headerValues.date,
        reason: headerValues.reason || null,
        notes: headerValues.notes || null,
        total,
        lineItems: normalizedLines,
        applications,
      }

      const response = await fetch(
        mode === 'create' ? resourcePath : `${resourcePath}?id=${encodeURIComponent(documentId ?? '')}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error ?? `Failed to save ${titleLabel.toLowerCase()}`)
        return
      }

      const nextId = body?.id ?? documentId
      if (!nextId) {
        setError(`Saved ${titleLabel.toLowerCase()} but could not determine destination record`)
        return
      }
      window.location.assign(`${detailBaseHref}/${nextId}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Failed to save ${titleLabel.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref={mode === 'create' ? detailBaseHref : `${detailBaseHref}/${documentId}`}
      backLabel={backLabel}
      meta={mode === 'create' ? `New ${titleLabel}` : headerValues.number}
      title={mode === 'create' ? `New ${titleLabel}` : `${titleLabel} ${headerValues.number}`}
      actions={
        <RecordDetailActionBar
          mode={mode}
          detailHref={mode === 'create' ? detailBaseHref : `${detailBaseHref}/${documentId}`}
          onSave={handleSave}
          saving={saving}
          saveError={error}
        />
      }
    >
      <RecordHeaderDetails
        editing
        sections={sections}
        columns={4}
        containerTitle={`${titleLabel} Details`}
        containerDescription={`Core ${titleLabel.toLowerCase()} fields organized into one shared editable header container.`}
        onValuesChange={setHeaderValues}
      />
      <CreditDocumentLineItemsEditor
        title={`${titleLabel} Lines`}
        rows={lineItems}
        itemOptions={items}
        currencyCode={currencyCode}
        moneySettings={moneySettings}
        onChange={setLineItems}
      />
      {isAr ? (
        <CreditDocumentApplicationsSection
          kind="credit-memo"
          documents={creditMemoApplicationDocuments}
          selectedCounterpartyId={headerValues.counterpartyId}
          selectedSourceDocumentId={headerValues.sourceDocumentId}
          documentAmount={total}
          applications={applications as CreditMemoApplicationInput[]}
          onChange={(nextApplications) => setApplications(nextApplications)}
          editing
          moneySettings={moneySettings}
          currencyCode={currencyCode ?? null}
        />
      ) : (
        <CreditDocumentApplicationsSection
          kind="bill-credit"
          documents={billCreditApplicationDocuments}
          selectedCounterpartyId={headerValues.counterpartyId}
          selectedSourceDocumentId={headerValues.sourceDocumentId}
          documentAmount={total}
          applications={applications as BillCreditApplicationInput[]}
          onChange={(nextApplications) => setApplications(nextApplications)}
          editing
          moneySettings={moneySettings}
          currencyCode={currencyCode ?? null}
        />
      )}
    </RecordDetailPageShell>
  )
}
