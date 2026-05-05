'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import {
  buildConfiguredTransactionSections,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import { applyRequirementsToEditableFields, useFormRequirementsState } from '@/lib/form-requirements-client'
import { calcLineTotal, sumMoney } from '@/lib/money'
import { fmtCurrency } from '@/lib/format'
import {
  BILL_DETAIL_FIELDS,
  BILL_LINE_COLUMNS,
  type BillDetailCustomizationConfig,
  type BillDetailFieldKey,
} from '@/lib/bill-detail-customization'

type VendorOption = {
  id: string
  name: string
  vendorNumber: string | null
  subsidiary: { id: string; subsidiaryId: string; name: string } | null
  currency: { id: string; currencyId: string; code: string | null; name: string } | null
}

type PurchaseOrderOption = {
  id: string
  number: string
  vendorId: string
}

type SubsidiaryOption = {
  id: string
  subsidiaryId: string
  name: string
}

type CurrencyOption = {
  id: string
  currencyId: string
  code: string | null
  name: string
}

type ItemOption = {
  id: string
  itemId: string | null
  name: string
  listPrice: number | null
}

type AccountOption = {
  id: string
  accountId: string
  accountNumber?: string | null
  name: string
}

type DraftLinePayload = {
  lineType: 'item' | 'expense'
  itemId: string | null
  expenseAccountId?: string | null
  description: string
  notes?: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  displayOrder: number
}

type BillHeaderField = {
  key: BillDetailFieldKey
} & RecordHeaderField

const BILL_STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'pending approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

export default function BillCreatePageClient({
  nextNumber,
  userId,
  vendors,
  purchaseOrders,
  subsidiaries,
  currencies,
  items,
  expenseAccounts,
  customization,
  initialHeaderValues,
  initialDraftRows,
}: {
  nextNumber: string
  userId: string
  vendors: VendorOption[]
  purchaseOrders: PurchaseOrderOption[]
  subsidiaries: SubsidiaryOption[]
  currencies: CurrencyOption[]
  items: ItemOption[]
  expenseAccounts: AccountOption[]
  customization: BillDetailCustomizationConfig
  initialHeaderValues?: Partial<Record<string, string>>
  initialDraftRows?: DraftLinePayload[]
}) {
  const router = useRouter()
  const { req, isLocked } = useFormRequirementsState('billCreate')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    number: initialHeaderValues?.number ?? nextNumber,
    vendorBillNumber: initialHeaderValues?.vendorBillNumber ?? '',
    vendorBillDate: initialHeaderValues?.vendorBillDate ?? '',
    vendorId: initialHeaderValues?.vendorId ?? '',
    purchaseOrderId: initialHeaderValues?.purchaseOrderId ?? '',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? '',
    currencyId: initialHeaderValues?.currencyId ?? '',
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    dueDate: initialHeaderValues?.dueDate ?? '',
    status: initialHeaderValues?.status ?? 'received',
    notes: initialHeaderValues?.notes ?? '',
  })
  const [draftRows, setDraftRows] = useState<DraftLinePayload[]>(initialDraftRows ?? [])

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === (headerValues.vendorId ?? '')) ?? null,
    [headerValues.vendorId, vendors],
  )

  const computedTotal = useMemo(() => sumMoney(draftRows.map((row) => row.lineTotal)), [draftRows])

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`,
  }))
  const purchaseOrderOptions = purchaseOrders
    .filter((purchaseOrder) => !headerValues.vendorId || purchaseOrder.vendorId === headerValues.vendorId)
    .map((purchaseOrder) => ({
      value: purchaseOrder.id,
      label: purchaseOrder.number,
    }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))

  const headerFieldDefinitions: Record<string, BillHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Internal database identifier for this bill.',
      fieldType: 'text',
      subsectionTitle: 'Bill Details',
      subsectionDescription: 'Core bill fields, linked records, and document totals.',
    },
    number: {
      key: 'number',
      label: 'Business Id',
      value: headerValues.number,
      displayValue: headerValues.number,
      helpText: 'Internal operational identifier for this bill.',
      fieldType: 'text',
      subsectionTitle: 'Bill Details',
      subsectionDescription: 'Core bill fields, linked records, and document totals.',
    },
    vendorBillNumber: {
      key: 'vendorBillNumber',
      label: 'Vendor Bill Number',
      value: headerValues.vendorBillNumber,
      displayValue: headerValues.vendorBillNumber || '-',
      editable: true,
      type: 'text',
      helpText: 'Vendor-provided invoice or bill reference number.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill identifiers and source-document context.',
    },
    vendorBillDate: {
      key: 'vendorBillDate',
      label: 'Vendor Bill Date',
      value: headerValues.vendorBillDate,
      displayValue: headerValues.vendorBillDate || '-',
      editable: true,
      type: 'date',
      helpText: 'Vendor-provided source-document date for this bill.',
      fieldType: 'date',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill identifiers and source-document context.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: headerValues.vendorId,
      displayValue: selectedVendor?.name ?? '-',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...vendorOptions],
      helpText: 'Vendor linked to this bill.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Bill Details',
      subsectionDescription: 'Core bill fields, linked records, and document totals.',
    },
    purchaseOrderId: {
      key: 'purchaseOrderId',
      label: 'Purchase Order',
      value: headerValues.purchaseOrderId,
      displayValue:
        purchaseOrders.find((purchaseOrder) => purchaseOrder.id === headerValues.purchaseOrderId)?.number ?? '-',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...purchaseOrderOptions],
      helpText: 'Source purchase order for this bill.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Core bill identifiers and source-document context.',
    },
    userId: {
      key: 'userId',
      label: 'Created By',
      value: userId,
      displayValue: userId || 'Current User',
      helpText: 'User creating this bill.',
      fieldType: 'list',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked-record identifiers for this bill.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId,
      displayValue:
        headerValues.subsidiaryId
          ? subsidiaryOptions.find((option) => option.value === headerValues.subsidiaryId)?.label ?? '-'
          : '-',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary owning this bill.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId,
      displayValue:
        headerValues.currencyId
          ? currencyOptions.find((option) => option.value === headerValues.currencyId)?.label ?? '-'
          : '-',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Currency for this bill.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(computedTotal),
      displayValue: fmtCurrency(computedTotal),
      helpText: 'Current bill total based on line items.',
      fieldType: 'currency',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    date: {
      key: 'date',
      label: 'Bill Date',
      value: headerValues.date,
      displayValue: headerValues.date || '-',
      editable: true,
      type: 'date',
      helpText: 'Date of the bill.',
      fieldType: 'date',
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Lifecycle status and scheduling dates for this bill.',
    },
    dueDate: {
      key: 'dueDate',
      label: 'Due Date',
      value: headerValues.dueDate,
      displayValue: headerValues.dueDate || '-',
      editable: true,
      type: 'date',
      helpText: 'Payment due date.',
      fieldType: 'date',
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Lifecycle status and scheduling dates for this bill.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status,
      displayValue: BILL_STATUS_OPTIONS.find((option) => option.value === headerValues.status)?.label ?? '-',
      editable: true,
      type: 'select',
      options: BILL_STATUS_OPTIONS,
      helpText: 'Status of this bill.',
      fieldType: 'list',
      sourceText: 'Bill status list',
      subsectionTitle: 'Workflow & Timing',
      subsectionDescription: 'Lifecycle status and scheduling dates for this bill.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: headerValues.notes,
      displayValue: headerValues.notes || '-',
      editable: true,
      type: 'text',
      helpText: 'Free-form notes for this bill.',
      fieldType: 'text',
      subsectionTitle: 'Sourcing & Financials',
      subsectionDescription: 'Organizational, currency, and financial context for this bill.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the bill was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the bill was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this bill.',
    },
  }
  applyRequirementsToEditableFields(headerFieldDefinitions, req, isLocked)


  const headerSections = buildConfiguredTransactionSections({
    fields: BILL_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: {
      'Document Identity': 'Core bill identifiers and source-document context.',
      'Workflow & Timing': 'Lifecycle status and scheduling dates for this bill.',
      'Sourcing & Financials': 'Organizational, currency, and financial context for this bill.',
      'Record Keys': 'Internal and linked-record identifiers for this bill.',
      'System Dates': 'System-managed timestamps for this bill.',
    },
  })
  const orderedVisibleLineColumns = getOrderedVisibleTransactionLineColumns(BILL_LINE_COLUMNS, customization)

  async function handleSubmit(values: Record<string, string>) {
    setSaving(true)
    setError('')
    try {
      const filteredLines = draftRows
        .map((row, index) => ({
          ...row,
          quantity: Math.max(1, row.quantity || 1),
          unitPrice: Math.max(0, row.unitPrice || 0),
          lineTotal: calcLineTotal(row.quantity || 1, row.unitPrice || 0),
          displayOrder: index,
        }))
        .filter((row) => row.description.trim() || row.itemId || row.expenseAccountId)

      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: values.vendorId || null,
          vendorBillNumber: values.vendorBillNumber || null,
          vendorBillDate: values.vendorBillDate || null,
          purchaseOrderId: values.purchaseOrderId || null,
          subsidiaryId: values.subsidiaryId || null,
          currencyId: values.currencyId || null,
          total: sumMoney(filteredLines.map((row) => row.lineTotal)),
          date: values.date,
          dueDate: values.dueDate || null,
          status: values.status,
          notes: values.notes || null,
          userId,
          lineItems: filteredLines,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!response.ok || !body.id) {
        const nextError = body.error ?? 'Unable to create bill'
        setError(nextError)
        return { ok: false, error: nextError }
      }

      router.push(`/bills/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = 'Unable to create bill'
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref="/bills"
      backLabel="<- Back to Bills"
      meta="New"
      title="New Bill"
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode="create" cancelHref="/bills" formId="create-bill-form" />}
    >
      <RecordHeaderDetails
        editing
        sections={headerSections}
        columns={customization.formColumns}
        containerTitle="Bill Details"
        containerDescription="Core bill fields, linked records, and document totals."
        showSubsections={false}
        formId="create-bill-form"
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={(nextValues) => {
          setHeaderValues((previousValues) => {
            const vendorChanged = nextValues.vendorId !== previousValues.vendorId
            if (!vendorChanged) return nextValues
            const vendor = vendors.find((entry) => entry.id === nextValues.vendorId)
            return {
              ...nextValues,
              subsidiaryId: nextValues.subsidiaryId || vendor?.subsidiary?.id || '',
              currencyId: nextValues.currencyId || vendor?.currency?.id || '',
            }
          })
        }}
      />

      <TransactionLineItemsSection
        rows={[]}
        editing
        purchaseOrderId="draft-bill"
        userId={userId || 'draft-user'}
        itemOptions={items.map((item) => ({
          id: item.id,
          itemId: item.itemId ?? 'Pending',
          name: item.name,
          unitPrice: item.listPrice ?? 0,
          itemDrivenValues: {
            description: item.name,
            unitPrice: String(item.listPrice ?? 0),
          },
        }))}
        accountOptions={expenseAccounts}
        lineColumns={orderedVisibleLineColumns}
        sectionTitle="Bill Line Items"
        draftMode
        initialDraftRows={initialDraftRows}
        onDraftRowsChange={setDraftRows}
        lineItemApiBasePath="/api/bill-line-items"
        parentIdFieldName="billId"
        tableId="bill-new-line-items"
        lineSettings={customization.lineSettings}
        lineColumnCustomization={customization.lineColumns}
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

