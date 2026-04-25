'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PurchaseOrderHeaderSections, {
  type PurchaseOrderHeaderField,
  type PurchaseOrderHeaderSection,
} from '@/components/PurchaseOrderHeaderSections'
import TransactionCreatePageShell from '@/components/TransactionCreatePageShell'
import { RecordDetailEmptyState, RecordDetailSection } from '@/components/RecordDetailPanels'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  PURCHASE_REQUISITION_DETAIL_FIELDS,
  type PurchaseRequisitionDetailCustomizationConfig,
  type PurchaseRequisitionDetailFieldKey,
} from '@/lib/purchase-requisitions-detail-customization'
import { purchaseRequisitionPageConfig } from '@/lib/transaction-page-configs/purchase-requisition'
import { fmtCurrency, fmtPhone } from '@/lib/format'

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
  currency: { id: string; currencyId: string; code: string; name: string } | null
}

type DepartmentOption = {
  id: string
  departmentId: string
  name: string
}

type SubsidiaryOption = {
  id: string
  subsidiaryId: string
  name: string
}

type CurrencyOption = {
  id: string
  currencyId: string
  code: string
  name: string
}

const REQUISITION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function PurchaseRequisitionCreatePageClient({
  nextNumber,
  userId,
  userLabel,
  vendors,
  departments,
  subsidiaries,
  currencies,
  customization,
}: {
  nextNumber: string
  userId: string
  userLabel: string
  vendors: VendorOption[]
  departments: DepartmentOption[]
  subsidiaries: SubsidiaryOption[]
  currencies: CurrencyOption[]
  customization: PurchaseRequisitionDetailCustomizationConfig
}) {
  const router = useRouter()
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    number: nextNumber,
    status: 'draft',
    priority: 'medium',
    title: '',
    description: '',
    neededByDate: '',
    notes: '',
    vendorId: '',
    departmentId: '',
    subsidiaryId: '',
    currencyId: '',
  })
  const [error, setError] = useState('')

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === (headerValues.vendorId ?? '')) ?? null,
    [headerValues.vendorId, vendors]
  )

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`,
  }))
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: `${department.departmentId} - ${department.name}`,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))

  const headerFieldDefinitions: Record<
    PurchaseRequisitionDetailFieldKey,
    PurchaseOrderHeaderField & { key: PurchaseRequisitionDetailFieldKey }
  > = {
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
      value: selectedVendor?.subsidiary
        ? `${selectedVendor.subsidiary.subsidiaryId} - ${selectedVendor.subsidiary.name}`
        : '',
      displayValue: selectedVendor?.subsidiary
        ? `${selectedVendor.subsidiary.subsidiaryId} - ${selectedVendor.subsidiary.name}`
        : '-',
      helpText: 'Default subsidiary context from the linked vendor record.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    vendorPrimaryCurrency: {
      key: 'vendorPrimaryCurrency',
      label: 'Primary Currency',
      value: selectedVendor?.currency
        ? `${selectedVendor.currency.code ?? selectedVendor.currency.currencyId} - ${selectedVendor.currency.name}`
        : '',
      displayValue: selectedVendor?.currency
        ? `${selectedVendor.currency.code ?? selectedVendor.currency.currencyId} - ${selectedVendor.currency.name}`
        : '-',
      helpText: 'Default transaction currency from the linked vendor record.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    vendorInactive: {
      key: 'vendorInactive',
      label: 'Inactive',
      value: selectedVendor ? (selectedVendor.inactive ? 'Yes' : 'No') : '',
      displayValue: selectedVendor ? (selectedVendor.inactive ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked vendor is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Vendors master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: '-',
      helpText: 'Internal database identifier for the requisition record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    number: {
      key: 'number',
      label: 'Purchase Requisition Id',
      value: headerValues.number ?? nextNumber,
      editable: true,
      type: 'text',
      helpText: 'Unique purchase requisition number used across procurement workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: userLabel,
      displayValue: userLabel || '-',
      helpText: 'Internal user identifier for the requisition creator.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    departmentRecordId: {
      key: 'departmentRecordId',
      label: 'Department Id',
      value: '',
      displayValue: '-',
      helpText: 'Internal department identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Departments master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    vendorRecordId: {
      key: 'vendorRecordId',
      label: 'Vendor Id',
      value: selectedVendor?.vendorNumber ?? '',
      displayValue: selectedVendor?.vendorNumber ?? '-',
      helpText: 'Internal vendor identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    subsidiaryRecordId: {
      key: 'subsidiaryRecordId',
      label: 'Subsidiary Id',
      value: '',
      displayValue: '-',
      helpText: 'Internal subsidiary identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    currencyRecordId: {
      key: 'currencyRecordId',
      label: 'Currency Id',
      value: '',
      displayValue: '-',
      helpText: 'Internal currency identifier linked to this requisition.',
      fieldType: 'text',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this requisition.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: userLabel,
      displayValue: userLabel || '-',
      helpText: 'User who will create the purchase requisition.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: '',
      displayValue: '-',
      helpText: 'Source transaction that created this requisition.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    approvedBy: {
      key: 'approvedBy',
      label: 'Approved By',
      value: '',
      displayValue: '-',
      helpText: 'User who approved the requisition based on the approval activity trail.',
      fieldType: 'text',
      sourceText: 'System Notes / activity history',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Document numbering, source context, and ownership for this requisition.',
    },
    title: {
      key: 'title',
      label: 'Title',
      value: headerValues.title ?? '',
      editable: true,
      type: 'text',
      helpText: 'Brief internal title for the requisition.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    description: {
      key: 'description',
      label: 'Description',
      value: headerValues.description ?? '',
      editable: true,
      type: 'text',
      helpText: 'Header description for the requisition.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status ?? 'draft',
      editable: true,
      type: 'select',
      options: REQUISITION_STATUS_OPTIONS,
      helpText: 'Current workflow state of the requisition.',
      fieldType: 'list',
      sourceText: 'System purchase requisition statuses',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    priority: {
      key: 'priority',
      label: 'Priority',
      value: headerValues.priority ?? 'medium',
      editable: true,
      type: 'select',
      options: PRIORITY_OPTIONS,
      helpText: 'Urgency level for the requested spend.',
      fieldType: 'list',
      sourceText: 'System purchase requisition priorities',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    neededByDate: {
      key: 'neededByDate',
      label: 'Needed By',
      value: headerValues.neededByDate ?? '',
      displayValue: headerValues.neededByDate || '-',
      editable: true,
      type: 'text',
      helpText: 'Date the requested goods or services are needed.',
      fieldType: 'date',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    departmentId: {
      key: 'departmentId',
      label: 'Department',
      value: headerValues.departmentId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...departmentOptions],
      helpText: 'Department requesting or funding the spend.',
      fieldType: 'list',
      sourceText: 'Departments master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: headerValues.vendorId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...vendorOptions],
      helpText: 'Preferred vendor linked to this requisition.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary that owns the requisition.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Transaction currency for the requisition.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: '0',
      displayValue: fmtCurrency(0),
      helpText: 'Current document total based on all requisition line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: headerValues.notes ?? '',
      editable: true,
      type: 'text',
      helpText: 'Internal notes or comments for the requisition.',
      fieldType: 'text',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Procurement controls, routing context, and monetary settings for the requisition.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: '-',
      helpText: 'Date/time the requisition record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this requisition record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: '-',
      helpText: 'Date/time the requisition record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this requisition record.',
    },
  }

  const headerSections: PurchaseOrderHeaderSection[] = buildConfiguredTransactionSections({
    fields: PURCHASE_REQUISITION_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: purchaseRequisitionPageConfig.sectionDescriptions,
  })

  async function handleCreate(values: Record<string, string>) {
    setError('')

    try {
      const response = await fetch('/api/purchase-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: values.number?.trim() || nextNumber,
          status: values.status?.trim() || 'draft',
          title: values.title?.trim() || null,
          description: values.description?.trim() || null,
          priority: values.priority?.trim() || 'medium',
          neededByDate: values.neededByDate?.trim() || null,
          notes: values.notes?.trim() || null,
          vendorId: values.vendorId?.trim() || null,
          departmentId: values.departmentId?.trim() || null,
          subsidiaryId: values.subsidiaryId?.trim() || null,
          currencyId: values.currencyId?.trim() || null,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        const nextError = body?.error || 'Unable to create purchase requisition'
        setError(nextError)
        return { ok: false, error: nextError }
      }

      router.push(`/purchase-requisitions/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = 'Unable to create purchase requisition'
      setError(nextError)
      return { ok: false, error: nextError }
    }
  }

  return (
    <TransactionCreatePageShell
      backHref="/purchase-requisitions"
      backLabel="<- Back to Purchase Requisitions"
      title="New Purchase Requisition"
      description="Capture the requisition header first, then add line items after save."
      formId="new-purchase-requisition-form"
    >
      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        formId="new-purchase-requisition-form"
        submitMode="controlled"
        onSubmit={handleCreate}
        onValuesChange={(nextValues) => {
          setHeaderValues((previousValues) => {
            const vendorChanged = nextValues.vendorId !== previousValues.vendorId
            if (!vendorChanged) return nextValues

            const nextVendor = vendors.find((vendor) => vendor.id === nextValues.vendorId)
            if (!nextVendor) return nextValues

            return {
              ...nextValues,
              subsidiaryId: nextValues.subsidiaryId || nextVendor.subsidiary?.id || '',
              currencyId: nextValues.currencyId || nextVendor.currency?.id || '',
            }
          })
        }}
      />

      <div className="mt-6">
        <RecordDetailSection title="Purchase Requisition Line Items" count={0}>
          <RecordDetailEmptyState message="Add line items after the requisition is saved." />
        </RecordDetailSection>
      </div>

      {error ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </TransactionCreatePageShell>
  )
}
