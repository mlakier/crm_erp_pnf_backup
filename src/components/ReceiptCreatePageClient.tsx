'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import ReceiptLineItemsSection, { type ReceiptLineRow } from '@/components/ReceiptLineItemsSection'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import { applyRequirementsToEditableFields, useFormRequirementsState } from '@/lib/form-requirements-client'
import {
  RECEIPT_DETAIL_FIELDS,
  type ReceiptDetailCustomizationConfig,
  type ReceiptDetailFieldKey,
} from '@/lib/receipt-detail-customization'

type PurchaseOrderOption = {
  id: string
  number: string
  userId?: string | null
  subsidiaryId?: string | null
  subsidiaryLabel?: string | null
  currencyId?: string | null
  currencyLabel?: string | null
  lineOptions: Array<{
    id: string
    lineNumber: number
    itemId: string | null
    itemName: string | null
    description: string
    orderedQuantity: number
    alreadyReceivedQuantity: number
    openQuantity: number
    receivable: boolean
  }>
}

type Option = { value: string; label: string }

type ReceiptHeaderField = {
  key: ReceiptDetailFieldKey
  } & RecordHeaderField

const sectionDescriptions: Record<string, string> = {
  'Document Identity': 'Receipt numbering and source purchase-order context for this receipt.',
  'Receipt Terms': 'Core receipt quantity, date, status, and operational notes.',
  'Record Keys': 'Internal and linked transaction identifiers for this receipt.',
  'System Dates': 'System-managed timestamps for this receipt.',
}

function buildReceiptDraftRows(
  purchaseOrder: PurchaseOrderOption | null,
  initialLineItems: Array<{
    id: string
    purchaseOrderLineItemId: string | null
    receiptQuantity: number
    notes: string
  }>,
) {
  if (!purchaseOrder) return []
  const receivableOptions = purchaseOrder.lineOptions.filter((line) => line.receivable)
  return initialLineItems
    .map((line) => {
      const option = receivableOptions.find((candidate) => candidate.id === line.purchaseOrderLineItemId)
      if (!option) return null
      return {
        id: line.id,
        purchaseOrderLineItemId: option.id,
        lineNumber: option.lineNumber,
        itemId: option.itemId,
        itemName: option.itemName,
        description: option.description,
        orderedQuantity: option.orderedQuantity,
        alreadyReceivedQuantity: option.alreadyReceivedQuantity,
        openQuantity: option.openQuantity,
        receiptQuantity: Math.max(0, Math.min(line.receiptQuantity, option.openQuantity)),
        notes: line.notes,
      } satisfies ReceiptLineRow
    })
    .filter((line): line is NonNullable<typeof line> => line !== null)
}

function syncReceiptDraftRows(
  currentRows: ReceiptLineRow[],
  purchaseOrder: PurchaseOrderOption | null,
) {
  if (!purchaseOrder) return []
  const receivableOptions = purchaseOrder.lineOptions.filter((line) => line.receivable)
  return currentRows
    .map((row) => {
      const option = receivableOptions.find((candidate) => candidate.id === row.purchaseOrderLineItemId)
      if (!option) return null
      return {
        ...row,
        lineNumber: option.lineNumber,
        itemId: option.itemId,
        itemName: option.itemName,
        description: option.description,
        orderedQuantity: option.orderedQuantity,
        alreadyReceivedQuantity: option.alreadyReceivedQuantity,
        openQuantity: option.openQuantity,
        receiptQuantity: Math.max(0, Math.min(row.receiptQuantity, option.openQuantity)),
      }
    })
    .filter((line): line is NonNullable<typeof line> => line !== null)
}

export default function ReceiptCreatePageClient({
  purchaseOrders,
  statusOptions,
  customization,
  initialHeaderValues,
  initialLineItems = [],
}: {
  purchaseOrders: PurchaseOrderOption[]
  statusOptions: Option[]
  customization: ReceiptDetailCustomizationConfig
  initialHeaderValues?: Partial<Record<string, string>>
  initialLineItems?: Array<{
    id: string
    purchaseOrderLineItemId: string | null
    receiptQuantity: number
    notes: string
  }>
}) {
  const router = useRouter()
  const { req, isLocked } = useFormRequirementsState('receiptCreate')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    purchaseOrderId: initialHeaderValues?.purchaseOrderId ?? purchaseOrders[0]?.id ?? '',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? '',
    currencyId: initialHeaderValues?.currencyId ?? '',
    quantity: initialHeaderValues?.quantity ?? '0',
    date: initialHeaderValues?.date ?? new Date().toISOString().slice(0, 10),
    status: initialHeaderValues?.status ?? statusOptions[0]?.value ?? '',
    notes: initialHeaderValues?.notes ?? '',
  })

  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((purchaseOrder) => purchaseOrder.id === (headerValues.purchaseOrderId ?? '')) ?? null,
    [headerValues.purchaseOrderId, purchaseOrders],
  )
  const initialSelectedPurchaseOrderId = initialHeaderValues?.purchaseOrderId ?? purchaseOrders[0]?.id ?? ''
  const purchaseOrderIdRef = useRef(initialSelectedPurchaseOrderId)
  const [lineItems, setLineItems] = useState<ReceiptLineRow[]>(() =>
    buildReceiptDraftRows(
      purchaseOrders.find((purchaseOrder) => purchaseOrder.id === initialSelectedPurchaseOrderId) ?? null,
      initialLineItems,
    ),
  )
  const availableLineOptions = useMemo(
    () =>
      (selectedPurchaseOrder?.lineOptions ?? [])
        .filter((line) => line.receivable)
        .map((line) => ({
          id: line.id,
          lineNumber: line.lineNumber,
          itemId: line.itemId,
          itemName: line.itemName,
          description: line.description,
          orderedQuantity: line.orderedQuantity,
          alreadyProcessedQuantity: line.alreadyReceivedQuantity,
          openQuantity: line.openQuantity,
        })),
    [selectedPurchaseOrder],
  )
  const totalReceiptQuantity = useMemo(
    () => lineItems.reduce((sum, line) => sum + line.receiptQuantity, 0),
    [lineItems],
  )

  useEffect(() => {
    setHeaderValues((current) => ({
      ...current,
      quantity: String(totalReceiptQuantity),
    }))
  }, [totalReceiptQuantity])

  useEffect(() => {
    const selectedId = selectedPurchaseOrder?.id ?? ''
    if (selectedId !== purchaseOrderIdRef.current) {
      purchaseOrderIdRef.current = selectedId
      setLineItems([])
      setHeaderValues((current) => ({
        ...current,
        subsidiaryId: selectedPurchaseOrder?.subsidiaryId ?? '',
        currencyId: selectedPurchaseOrder?.currencyId ?? '',
      }))
      return
    }

    setHeaderValues((current) => ({
      ...current,
      subsidiaryId: selectedPurchaseOrder?.subsidiaryId ?? current.subsidiaryId ?? '',
      currencyId: selectedPurchaseOrder?.currencyId ?? current.currencyId ?? '',
    }))
    setLineItems((current) => syncReceiptDraftRows(current, selectedPurchaseOrder))
  }, [selectedPurchaseOrder])

  const purchaseOrderOptions = purchaseOrders.map((purchaseOrder) => ({
    value: purchaseOrder.id,
    label: purchaseOrder.number,
  }))

  const headerFieldDefinitions: Record<ReceiptDetailFieldKey, ReceiptHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Internal database identifier for this receipt.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and linked transaction identifiers for this receipt.',
    },
    number: {
      key: 'number',
      label: 'Receipt Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Display identifier for this receipt.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
    },
    purchaseOrderId: {
      key: 'purchaseOrderId',
      label: 'Purchase Order',
      value: headerValues.purchaseOrderId ?? '',
      displayValue: selectedPurchaseOrder?.number ?? '-',
      editable: true,
      type: 'select',
      options: purchaseOrderOptions,
      helpText: 'Purchase order that this receipt belongs to.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId ?? '',
      displayValue: selectedPurchaseOrder?.subsidiaryLabel ?? '-',
      editable: false,
      helpText: 'Subsidiary inherited from the linked purchase order posting context.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId ?? '',
      displayValue: selectedPurchaseOrder?.currencyLabel ?? '-',
      editable: false,
      helpText: 'Transaction currency inherited from the linked purchase order posting context.',
      fieldType: 'list',
      sourceText: 'Purchase order transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Receipt numbering and source purchase-order context for this receipt.',
    },
    quantity: {
      key: 'quantity',
      label: 'Quantity',
      value: headerValues.quantity ?? '',
      displayValue: headerValues.quantity || '0',
      editable: false,
      helpText: 'Derived from the receipt line quantities below.',
      fieldType: 'number',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    date: {
      key: 'date',
      label: 'Date',
      value: headerValues.date ?? '',
      displayValue: headerValues.date || '-',
      editable: true,
      type: 'date',
      helpText: 'Date the receipt was recorded.',
      fieldType: 'date',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status ?? '',
      displayValue: statusOptions.find((option) => option.value === (headerValues.status ?? ''))?.label ?? '-',
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Status of this receipt.',
      fieldType: 'list',
      sourceText: 'Receipt status list',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: headerValues.notes ?? '',
      displayValue: headerValues.notes || '-',
      editable: true,
      type: 'text',
      helpText: 'Free-form notes for this receipt.',
      fieldType: 'text',
      subsectionTitle: 'Receipt Terms',
      subsectionDescription: 'Core receipt quantity, date, status, and operational notes.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the receipt was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the receipt was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this receipt.',
    },
  }
  applyRequirementsToEditableFields(headerFieldDefinitions, req, isLocked)


  const headerSections = buildConfiguredTransactionSections({
    fields: RECEIPT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  async function handleSubmit(values: Record<string, string>) {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: values.purchaseOrderId,
          subsidiaryId: values.subsidiaryId || null,
          currencyId: values.currencyId || null,
          quantity: values.quantity,
          date: values.date,
          status: values.status,
          notes: values.notes || null,
          userId: selectedPurchaseOrder?.userId ?? null,
          lineItems,
        }),
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!response.ok || !body.id) {
        setError(body.error ?? 'Error creating receipt')
        return { ok: false, error: body.error ?? 'Error creating receipt' }
      }

      router.push(`/receipts/${body.id}`)
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
      backHref="/receipts"
      backLabel="<- Back to Receipts"
      meta="New"
      title="New Receipt"
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode="create" cancelHref="/receipts" formId="create-receipt-form" />}
    >
      <RecordHeaderDetails
        editing
        sections={headerSections}
        columns={customization.formColumns}
        containerTitle="Receipt Details"
        containerDescription="Core receipt fields organized into configurable sections."
        showSubsections={false}
        formId="create-receipt-form"
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <ReceiptLineItemsSection
        rows={lineItems}
        editing
        lineOptions={availableLineOptions}
        onChange={setLineItems}
        allowAddLines={Boolean(selectedPurchaseOrder)}
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

