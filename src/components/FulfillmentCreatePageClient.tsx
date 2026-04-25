'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import FulfillmentLineItemsSection, {
  type FulfillmentLineOption,
  type FulfillmentLineRow,
} from '@/components/FulfillmentLineItemsSection'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  FULFILLMENT_DETAIL_FIELDS,
  FULFILLMENT_LINE_COLUMNS,
  type FulfillmentDetailCustomizationConfig,
  type FulfillmentDetailFieldKey,
} from '@/lib/fulfillment-detail-customization'
import { fulfillmentPageConfig } from '@/lib/transaction-page-configs/fulfillment'

type Option = { value: string; label: string }

type SalesOrderOption = {
  id: string
  number: string
  customer: {
    name: string
    customerId: string | null
    email: string | null
  }
  quoteNumber: string | null
  opportunityNumber: string | null
  subsidiaryId: string | null
  subsidiaryLabel: string
  currencyId: string | null
  currencyLabel: string
  lines: FulfillmentLineOption[]
}

type FulfillmentHeaderField = {
  key: FulfillmentDetailFieldKey
} & PurchaseOrderHeaderField

function draftRow(option: FulfillmentLineOption): FulfillmentLineRow {
  return {
    id: `draft-${option.id}`,
    salesOrderLineItemId: option.id,
    lineNumber: option.lineNumber,
    itemId: option.itemId,
    itemName: option.itemName,
    description: option.description,
    orderedQuantity: option.orderedQuantity,
    alreadyFulfilledQuantity: option.alreadyFulfilledQuantity,
    openQuantity: option.openQuantity,
    fulfillmentQuantity: 0,
    notes: '',
  }
}

export default function FulfillmentCreatePageClient({
  salesOrders,
  statusOptions,
  customization,
  initialSalesOrderId,
  initialHeaderValues,
  initialLineRows,
}: {
  salesOrders: SalesOrderOption[]
  statusOptions: Option[]
  customization: FulfillmentDetailCustomizationConfig
  initialSalesOrderId?: string | null
  initialHeaderValues?: Partial<Record<string, string>>
  initialLineRows?: FulfillmentLineRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    salesOrderId: initialSalesOrderId ?? salesOrders[0]?.id ?? '',
    status: initialHeaderValues?.status ?? statusOptions[0]?.value ?? 'pending',
    date: new Date().toISOString().slice(0, 10),
    notes: initialHeaderValues?.notes ?? '',
    subsidiaryId: initialHeaderValues?.subsidiaryId ?? salesOrders[0]?.subsidiaryId ?? '',
    currencyId: initialHeaderValues?.currencyId ?? salesOrders[0]?.currencyId ?? '',
    ...initialHeaderValues,
  })
  const [lineRows, setLineRows] = useState<FulfillmentLineRow[]>(
    initialLineRows ?? salesOrders[0]?.lines.map(draftRow) ?? [],
  )

  const selectedSalesOrder = useMemo(
    () => salesOrders.find((salesOrder) => salesOrder.id === (headerValues.salesOrderId ?? '')) ?? null,
    [headerValues.salesOrderId, salesOrders],
  )

  useEffect(() => {
    if (!selectedSalesOrder) return
    setHeaderValues((prev) => ({
      ...prev,
      subsidiaryId: selectedSalesOrder.subsidiaryId ?? '',
      currencyId: selectedSalesOrder.currencyId ?? '',
    }))
    setLineRows((prev) => {
      const isMatchingInitialSelection =
        initialSalesOrderId &&
        initialSalesOrderId === selectedSalesOrder.id &&
        prev.length > 0 &&
        prev.some((row) => row.salesOrderLineItemId)

      if (isMatchingInitialSelection) {
        return prev
      }

      return selectedSalesOrder.lines.map(draftRow)
    })
  }, [initialSalesOrderId, selectedSalesOrder])

  const salesOrderOptions = salesOrders.map((salesOrder) => ({
    value: salesOrder.id,
    label: `${salesOrder.number} - ${salesOrder.customer.name}`,
  }))
  const lineColumnIds = FULFILLMENT_LINE_COLUMNS.map((column) => column.id)

  const headerFieldDefinitions: Record<FulfillmentDetailFieldKey, FulfillmentHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: selectedSalesOrder?.customer.name ?? '',
      displayValue: selectedSalesOrder?.customer.name ?? '-',
      helpText: 'Display name from the linked sales order customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: selectedSalesOrder?.customer.customerId ?? '',
      displayValue: selectedSalesOrder?.customer.customerId ?? '-',
      helpText: 'Internal customer identifier from the linked sales order customer.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Internal database identifier for this fulfillment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    number: {
      key: 'number',
      label: 'Fulfillment Id',
      value: '',
      displayValue: 'Auto-generated on save',
      helpText: 'Unique identifier for this fulfillment.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    salesOrderId: {
      key: 'salesOrderId',
      label: 'Sales Order',
      value: headerValues.salesOrderId ?? '',
      displayValue: selectedSalesOrder?.number ?? '-',
      editable: true,
      type: 'select',
      options: salesOrderOptions,
      helpText: 'Sales order supplying the lines to fulfill.',
      fieldType: 'list',
      sourceText: 'Sales order transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    quoteId: {
      key: 'quoteId',
      label: 'Quote Id',
      value: selectedSalesOrder?.quoteNumber ?? '',
      displayValue: selectedSalesOrder?.quoteNumber ?? '-',
      helpText: 'Source quote linked through the sales order.',
      fieldType: 'text',
      sourceText: 'Quote transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity Id',
      value: selectedSalesOrder?.opportunityNumber ?? '',
      displayValue: selectedSalesOrder?.opportunityNumber ?? '-',
      helpText: 'Opportunity linked through the quote.',
      fieldType: 'text',
      sourceText: 'Opportunity transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and upstream transaction identifiers for this fulfillment.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId ?? '',
      displayValue: selectedSalesOrder?.subsidiaryLabel ?? '-',
      helpText: 'Subsidiary inherited from the linked sales order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId ?? '',
      displayValue: selectedSalesOrder?.currencyLabel ?? '-',
      helpText: 'Currency inherited from the linked sales order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status ?? '',
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the fulfillment.',
      fieldType: 'list',
      sourceText: 'Fulfillment status list',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    date: {
      key: 'date',
      label: 'Fulfillment Date',
      value: headerValues.date ?? '',
      editable: true,
      type: 'date',
      helpText: 'Date the fulfillment is recorded.',
      fieldType: 'date',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: headerValues.notes ?? '',
      editable: true,
      type: 'text',
      helpText: 'Warehouse or shipment notes for this fulfillment.',
      fieldType: 'text',
      subsectionTitle: 'Fulfillment Terms',
      subsectionDescription: 'Status, fulfillment date, and warehouse notes for this document.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the fulfillment record is created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this fulfillment.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: 'Set on save',
      helpText: 'Date/time the fulfillment record is last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this fulfillment.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: FULFILLMENT_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: fulfillmentPageConfig.sectionDescriptions,
  })

  async function handleSubmit(values: Record<string, string>) {
    setSaving(true)
    setError('')
    try {
      const activeLines = lineRows
        .filter((row) => row.salesOrderLineItemId && row.fulfillmentQuantity > 0)
        .map((row) => ({
          salesOrderLineItemId: row.salesOrderLineItemId,
          quantity: row.fulfillmentQuantity,
          notes: row.notes || null,
        }))

      if (!values.salesOrderId) {
        setError('Sales order is required.')
        return { ok: false, error: 'Sales order is required.' }
      }
      if (activeLines.length === 0) {
        setError('Enter at least one fulfillment quantity greater than zero.')
        return { ok: false, error: 'Enter at least one fulfillment quantity greater than zero.' }
      }

      const response = await fetch('/api/fulfillments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId: values.salesOrderId,
          status: values.status,
          date: values.date,
          notes: values.notes || null,
          subsidiaryId: values.subsidiaryId || null,
          currencyId: values.currencyId || null,
          lines: activeLines,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!response.ok || !body.id) {
        const message = body.error ?? 'Error creating fulfillment'
        setError(message)
        return { ok: false, error: message }
      }

      router.push(`/fulfillments/${body.id}`)
      return { ok: true }
    } catch {
      const message = 'Error creating fulfillment'
      setError(message)
      return { ok: false, error: message }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref="/fulfillments"
      backLabel="<- Back to Fulfillments"
      meta="New"
      title="New Fulfillment"
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode="create" cancelHref="/fulfillments" formId="create-fulfillment-form" />}
    >
      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        formId="create-fulfillment-form"
        submitMode="controlled"
        onSubmit={handleSubmit}
        onValuesChange={setHeaderValues}
      />
      <FulfillmentLineItemsSection
        rows={lineRows}
        editing
        lineOptions={selectedSalesOrder?.lines ?? []}
        onChange={setLineRows}
        visibleColumnIds={lineColumnIds}
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
