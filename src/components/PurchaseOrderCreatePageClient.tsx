'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderSection } from '@/components/PurchaseOrderHeaderSections'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import { fmtCurrency, fmtPhone } from '@/lib/format'
import { calcLineTotal, sumMoney } from '@/lib/money'
import {
  PURCHASE_ORDER_DETAIL_FIELDS,
  PURCHASE_ORDER_LINE_COLUMNS,
  type PurchaseOrderDetailCustomizationConfig,
  type PurchaseOrderDetailFieldKey,
} from '@/lib/purchase-order-detail-customization'
import {
  buildConfiguredTransactionSections,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'

type VendorOption = {
  id: string
  vendorNumber: string | null
  name: string
  email: string | null
  phone: string | null
  taxId: string | null
  address: string | null
  inactive: boolean
  subsidiary: { id: string; subsidiaryId: string; name: string } | null
  currency: { id: string; currencyId: string; code?: string; name: string } | null
}

type SubsidiaryOption = {
  id: string
  subsidiaryId: string
  name: string
}

type ItemOption = {
  id: string
  itemId: string | null
  name: string
  listPrice: number | null
}

type DraftLinePayload = {
  itemId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  displayOrder: number
}

const PURCHASE_ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

const sectionDescriptions: Record<string, string> = {
  Vendor: 'Supplier master data linked to this purchase order.',
  'Purchase Order Details': 'Core purchase order fields and procurement lifecycle status.',
}

export default function PurchaseOrderCreatePageClient({
  nextNumber,
  userId,
  userLabel,
  vendors,
  subsidiaries,
  items,
  customization,
}: {
  nextNumber: string
  userId: string
  userLabel: string
  vendors: VendorOption[]
  subsidiaries: SubsidiaryOption[]
  items: ItemOption[]
  customization: PurchaseOrderDetailCustomizationConfig
}) {
  const router = useRouter()
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    number: nextNumber,
    vendorId: '',
    subsidiaryId: '',
    status: 'draft',
  })
  const [draftRows, setDraftRows] = useState<DraftLinePayload[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === (headerValues.vendorId ?? '')) ?? null,
    [headerValues.vendorId, vendors]
  )

  const computedTotal = useMemo(
    () => sumMoney(draftRows.map((row) => row.lineTotal)),
    [draftRows]
  )

  const vendorOptions = useMemo(
    () =>
      vendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`,
      })),
    [vendors]
  )

  function getVendorDefaultEntityId(vendorId: string | undefined) {
    if (!vendorId) return ''
    return vendors.find((vendor) => vendor.id === vendorId)?.subsidiary?.id ?? ''
  }

  const subsidiaryOptions = useMemo(
    () =>
      subsidiaries.map((subsidiary) => ({
        value: subsidiary.id,
        label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
      })),
    [subsidiaries]
  )

  const headerFieldDefinitions: Record<PurchaseOrderDetailFieldKey, PurchaseOrderHeaderSection['fields'][number]> = useMemo(
    () => ({
      vendorName: {
        key: 'vendorName',
        label: 'Vendor Name',
        value: selectedVendor?.name ?? '',
        displayValue: selectedVendor?.name ?? '-',
        helpText: 'Display name from the linked vendor record.',
        fieldType: 'text',
        sourceText: 'Vendors master data',
      },
      vendorNumber: {
        key: 'vendorNumber',
        label: 'Vendor #',
        value: selectedVendor?.vendorNumber ?? '',
        displayValue: selectedVendor?.vendorNumber ?? '-',
        helpText: 'Internal vendor identifier from the linked vendor record.',
        fieldType: 'text',
        sourceText: 'Vendors master data',
      },
      vendorEmail: {
        key: 'vendorEmail',
        label: 'Email',
        value: selectedVendor?.email ?? '',
        displayValue: selectedVendor?.email ?? '-',
        helpText: 'Primary vendor email address.',
        fieldType: 'email',
        sourceText: 'Vendors master data',
      },
      vendorPhone: {
        key: 'vendorPhone',
        label: 'Phone',
        value: selectedVendor?.phone ?? '',
        displayValue: selectedVendor?.phone ? fmtPhone(selectedVendor.phone) : '-',
        helpText: 'Primary vendor phone number.',
        fieldType: 'text',
        sourceText: 'Vendors master data',
      },
      vendorTaxId: {
        key: 'vendorTaxId',
        label: 'Tax ID',
        value: selectedVendor?.taxId ?? '',
        displayValue: selectedVendor?.taxId ?? '-',
        helpText: 'Vendor tax registration or identification number.',
        fieldType: 'text',
        sourceText: 'Vendors master data',
      },
      vendorAddress: {
        key: 'vendorAddress',
        label: 'Address',
        value: selectedVendor?.address ?? '',
        displayValue: selectedVendor?.address ?? '-',
        helpText: 'Mailing or remittance address from the linked vendor record.',
        fieldType: 'text',
        sourceText: 'Vendors master data',
      },
      vendorPrimarySubsidiary: {
        key: 'vendorPrimarySubsidiary',
        label: 'Primary Subsidiary',
        value: selectedVendor?.subsidiary ? `${selectedVendor.subsidiary.subsidiaryId} - ${selectedVendor.subsidiary.name}` : '',
        displayValue: selectedVendor?.subsidiary ? `${selectedVendor.subsidiary.subsidiaryId} - ${selectedVendor.subsidiary.name}` : '-',
        helpText: 'Default subsidiary context from the linked vendor record.',
        fieldType: 'list',
        sourceText: 'Vendors master data',
      },
      vendorPrimaryCurrency: {
        key: 'vendorPrimaryCurrency',
        label: 'Primary Currency',
        value: selectedVendor?.currency ? `${selectedVendor.currency.code ?? selectedVendor.currency.currencyId} - ${selectedVendor.currency.name}` : '',
        displayValue: selectedVendor?.currency ? `${selectedVendor.currency.code ?? selectedVendor.currency.currencyId} - ${selectedVendor.currency.name}` : '-',
        helpText: 'Default transaction currency from the linked vendor record.',
        fieldType: 'list',
        sourceText: 'Vendors master data',
      },
      vendorInactive: {
        key: 'vendorInactive',
        label: 'Inactive',
        value: selectedVendor?.inactive ? 'Yes' : 'No',
        displayValue: selectedVendor ? (selectedVendor.inactive ? 'Yes' : 'No') : '-',
        helpText: 'Indicates whether the linked vendor is inactive for new activity.',
        fieldType: 'checkbox',
        sourceText: 'Vendors master data',
      },
      number: {
        key: 'number',
        label: 'Purchase Order #',
        value: headerValues.number ?? nextNumber,
        editable: true,
        type: 'text',
        helpText: 'Unique purchase order number used across procurement workflows.',
        fieldType: 'text',
      },
      createdBy: {
        key: 'createdBy',
        label: 'Created By',
        value: userLabel,
        displayValue: userLabel || '-',
        helpText: 'User who will create the purchase order.',
        fieldType: 'text',
        sourceText: 'Users master data',
      },
      createdFrom: {
        key: 'createdFrom',
        label: 'Created From',
        value: '',
        displayValue: '-',
        helpText: 'Source transaction that created this purchase order.',
        fieldType: 'text',
        sourceText: 'Source transaction',
      },
      approvedBy: {
        key: 'approvedBy',
        label: 'Approved By',
        value: '',
        displayValue: '-',
        helpText: 'User who approved the purchase order based on the approval activity trail.',
        fieldType: 'text',
        sourceText: 'System Notes / activity history',
      },
      subsidiaryId: {
        key: 'subsidiaryId',
        label: 'Subsidiary',
        value: headerValues.subsidiaryId ?? '',
        editable: true,
        type: 'select',
        options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
        helpText: 'Subsidiary that owns the purchase order.',
        fieldType: 'list',
        sourceText: 'Subsidiaries master data',
      },
      vendorId: {
        key: 'vendorId',
        label: 'Vendor',
        value: headerValues.vendorId ?? '',
        editable: true,
        type: 'select',
        options: vendorOptions,
        helpText: 'Vendor record linked to this purchase order.',
        fieldType: 'list',
        sourceText: 'Vendors master data',
      },
      status: {
        key: 'status',
        label: 'Status',
        value: headerValues.status ?? 'draft',
        editable: true,
        type: 'select',
        options: PURCHASE_ORDER_STATUS_OPTIONS,
        helpText: 'Current lifecycle stage of the purchase order.',
        fieldType: 'list',
        sourceText: 'System purchase order statuses',
      },
      total: {
        key: 'total',
        label: 'Total',
        value: computedTotal.toString(),
        displayValue: fmtCurrency(computedTotal),
        helpText: 'Current document total based on all purchase order line amounts.',
        fieldType: 'currency',
      },
    }),
    [computedTotal, headerValues.subsidiaryId, headerValues.number, headerValues.status, headerValues.vendorId, nextNumber, selectedVendor, subsidiaryOptions, userLabel, vendorOptions]
  )

  const headerSections: PurchaseOrderHeaderSection[] = useMemo(
    () =>
      buildConfiguredTransactionSections({
        fields: PURCHASE_ORDER_DETAIL_FIELDS,
        layout: customization,
        fieldDefinitions: headerFieldDefinitions,
        sectionDescriptions,
      }),
    [customization, headerFieldDefinitions]
  )

  const orderedVisibleLineColumns = useMemo(
    () => getOrderedVisibleTransactionLineColumns(PURCHASE_ORDER_LINE_COLUMNS, customization),
    [customization]
  )

  async function handleCreate(values: Record<string, string>) {
    setSaving(true)
    setError('')

    const vendorId = values.vendorId?.trim()
    if (!vendorId) {
      setSaving(false)
      setError('Vendor is required')
      return { ok: false, error: 'Vendor is required' }
    }

    const filteredLines = draftRows
      .map((row, index) => ({
        ...row,
        quantity: Math.max(1, row.quantity || 1),
        unitPrice: Math.max(0, row.unitPrice || 0),
        lineTotal: calcLineTotal(row.quantity || 1, row.unitPrice || 0),
        displayOrder: index,
      }))
      .filter((row) => row.description.trim() || row.itemId)

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: values.number?.trim() || nextNumber,
          status: values.status?.trim() || 'draft',
          vendorId,
          subsidiaryId: values.subsidiaryId?.trim() || null,
          userId,
          total: sumMoney(filteredLines.map((row) => row.lineTotal)),
          lineItems: filteredLines,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        const nextError = body?.error || 'Unable to create purchase order'
        setError(nextError)
        return { ok: false, error: nextError }
      }

      router.push(`/purchase-orders/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = 'Unable to create purchase order'
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref="/purchase-orders"
      backLabel="<- Back to Purchase Orders"
      meta={headerValues.number ?? nextNumber}
      title={selectedVendor?.name ?? 'New Purchase Order'}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Purchase Order
          </span>
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
          >
            Draft
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={
        <>
          <button
            type="button"
            onClick={() => router.push('/purchase-orders')}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-purchase-order-form"
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        formId="new-purchase-order-form"
        submitMode="controlled"
        onSubmit={handleCreate}
        onValuesChange={(nextValues) => {
          setHeaderValues((previousValues) => {
            const vendorChanged = nextValues.vendorId !== previousValues.vendorId
            if (!vendorChanged) return nextValues

            const previousVendorDefaultEntityId = getVendorDefaultEntityId(previousValues.vendorId)
            const nextVendorDefaultEntityId = getVendorDefaultEntityId(nextValues.vendorId)
            const shouldApplyVendorDefault =
              !previousValues.subsidiaryId || previousValues.subsidiaryId === previousVendorDefaultEntityId

            return shouldApplyVendorDefault
              ? {
                  ...nextValues,
                  subsidiaryId: nextVendorDefaultEntityId,
                }
              : nextValues
          })
        }}
      />

      <PurchaseOrderLineItemsSection
        rows={[]}
        editing
        purchaseOrderId="draft-purchase-order"
        userId={userId}
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
        lineColumns={orderedVisibleLineColumns}
        draftMode
        onDraftRowsChange={setDraftRows}
      />

      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </RecordDetailPageShell>
  )
}
