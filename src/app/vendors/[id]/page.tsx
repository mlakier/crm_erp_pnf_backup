import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, normalizePhone, toNumericValue } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import VendorDetailCustomizeMode from '@/components/VendorDetailCustomizeMode'
import VendorContactsSection from '@/components/VendorContactsSection'
import VendorRelatedDocuments from '@/components/VendorRelatedDocuments'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import { RecordDetailStatCard } from '@/components/RecordDetailPanels'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadVendorFormCustomization } from '@/lib/vendor-form-customization-store'
import { VENDOR_FORM_FIELDS, type VendorFormFieldKey } from '@/lib/vendor-form-customization'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadListOptionsForSource } from '@/lib/list-source'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { moneySettings } = await loadCompanyDisplaySettings()
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const fieldMetaById = buildFieldMetaById(VENDOR_FORM_FIELDS)

  const [vendor, defaultUser, fieldOptions, inactiveOptions, formCustomization, formRequirements] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        currency: true,
        contacts: { orderBy: { createdAt: 'desc' } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            receipts: { orderBy: { date: 'desc' } },
            requisition: true,
          },
        },
        requisitions: { orderBy: { createdAt: 'desc' } },
        bills: {
          orderBy: { createdAt: 'desc' },
          include: {
            billPayments: { orderBy: { date: 'desc' } },
          },
        },
      },
    }),
    prisma.user.findFirst({ where: { email: 'admin@example.com' }, select: { id: true } }),
    loadFieldOptionsMap(fieldMetaById, ['primarySubsidiaryId', 'primaryCurrencyId']),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadVendorFormCustomization(),
    loadFormRequirements(),
  ])

  if (!vendor) notFound()

  const totalSpend = vendor.purchaseOrders.reduce((sum, purchaseOrder) => sum + toNumericValue(purchaseOrder.total), 0)
  const openInvoices = vendor.bills.filter((bill) => bill.status !== 'paid' && bill.status !== 'void')
  const detailHref = `/vendors/${vendor.id}`
  const relatedPurchaseOrders = vendor.purchaseOrders.map((purchaseOrder) => ({
    id: purchaseOrder.id,
    number: purchaseOrder.number,
    status: purchaseOrder.status,
    total: toNumericValue(purchaseOrder.total, 0),
    createdAt: purchaseOrder.createdAt.toISOString(),
  }))
  const relatedRequisitionMap = new Map<string, {
    id: string
    number: string
    status: string
    total: number
    priority: string | null
    title: string | null
    createdAt: string
  }>()
  for (const requisition of vendor.requisitions) {
    relatedRequisitionMap.set(requisition.id, {
      id: requisition.id,
      number: requisition.number,
      status: requisition.status,
      total: toNumericValue(requisition.total, 0),
      priority: requisition.priority,
      title: requisition.title,
      createdAt: requisition.createdAt.toISOString(),
    })
  }
  for (const purchaseOrder of vendor.purchaseOrders) {
    if (!purchaseOrder.requisition) continue
    relatedRequisitionMap.set(purchaseOrder.requisition.id, {
      id: purchaseOrder.requisition.id,
      number: purchaseOrder.requisition.number,
      status: purchaseOrder.requisition.status,
      total: toNumericValue(purchaseOrder.requisition.total, 0),
      priority: purchaseOrder.requisition.priority,
      title: purchaseOrder.requisition.title,
      createdAt: purchaseOrder.requisition.createdAt.toISOString(),
    })
  }
  const relatedRequisitions = Array.from(relatedRequisitionMap.values()).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  const relatedBills = vendor.bills.map((bill) => ({
    id: bill.id,
    number: bill.number,
    status: bill.status,
    total: toNumericValue(bill.total, 0),
    date: bill.date.toISOString(),
    dueDate: bill.dueDate?.toISOString() ?? null,
  }))
  const relatedReceipts = vendor.purchaseOrders.flatMap((purchaseOrder) =>
    purchaseOrder.receipts.map((receipt) => ({
      id: receipt.id,
      number: receipt.id,
      date: receipt.date.toISOString(),
      status: receipt.status,
      quantity: receipt.quantity,
      notes: receipt.notes,
      purchaseOrderNumber: purchaseOrder.number,
    }))
  )
  const relatedBillPayments = vendor.bills.flatMap((bill) =>
    bill.billPayments.map((payment) => ({
      id: payment.id,
      number: payment.number,
      amount: toNumericValue(payment.amount, 0),
      date: payment.date.toISOString(),
      method: payment.method,
      reference: payment.reference,
      status: payment.status,
      billNumber: bill.number,
    }))
  )

  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity fields for the vendor record.',
    Contact: 'Contact channels and mailing address.',
    Financial: 'Default tax, subsidiary, and currency settings.',
    Status: 'Availability and active-state controls.',
  }

  const fieldDefinitions: Record<VendorFormFieldKey, InlineRecordSection['fields'][number]> = {
    vendorNumber: {
      name: 'vendorNumber',
      label: 'Vendor ID',
      value: vendor.vendorNumber ?? '',
      helpText: 'System-generated vendor identifier.',
    },
    name: {
      name: 'name',
      label: 'Name',
      value: vendor.name,
      helpText: 'Primary vendor or supplier name.',
    },
    email: {
      name: 'email',
      label: 'Email',
      value: vendor.email ?? '',
      type: 'email',
      helpText: 'Primary vendor email address.',
    },
    phone: {
      name: 'phone',
      label: 'Phone',
      value: normalizePhone(vendor.phone) ?? '',
      helpText: 'Primary vendor phone number.',
    },
    address: {
      name: 'address',
      label: 'Address',
      value: vendor.address ?? '',
      type: 'address',
      helpText: 'Mailing or remittance address for the vendor.',
    },
    taxId: {
      name: 'taxId',
      label: 'Tax ID',
      value: vendor.taxId ?? '',
      helpText: 'Tax identifier for the vendor.',
    },
    primarySubsidiaryId: {
      name: 'primarySubsidiaryId',
      label: 'Primary Subsidiary',
      value: vendor.subsidiaryId ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.primarySubsidiaryId ?? [])],
      helpText: 'Default subsidiary context for this vendor.',
      sourceText: getFieldSourceText(fieldMetaById, 'primarySubsidiaryId'),
    },
    primaryCurrencyId: {
      name: 'primaryCurrencyId',
      label: 'Primary Currency',
      value: vendor.currencyId ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.primaryCurrencyId ?? [])],
      helpText: 'Default transaction currency for this vendor.',
      sourceText: getFieldSourceText(fieldMetaById, 'primaryCurrencyId'),
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: String(vendor.inactive),
      type: 'select',
      options: inactiveOptions,
      helpText: 'Marks the vendor unavailable for new activity while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(VENDOR_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: VENDOR_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'vendor',
    entityId: vendor.id,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'vendor', entityId: vendor.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/vendors'}
      backLabel={isCustomizing ? '<- Back to Vendor Detail' : '<- Back to Vendors'}
      meta={vendor.vendorNumber ?? 'Pending'}
      title={vendor.name}
      badge={
        vendor.taxId ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tax ID: {vendor.taxId}</p>
        ) : null
      }
      actions={
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${vendor.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/vendors/new" duplicateHref={`/vendors/new?duplicateFrom=${vendor.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={vendor.name} fileName={`vendor-${vendor.vendorNumber ?? vendor.id}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? (
            <Link href={`${detailHref}?customize=1`} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
              Customize
            </Link>
          ) : null}
          {!isEditing && !isCustomizing ? (
            <Link
              href={`${detailHref}?edit=1`}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Edit
            </Link>
          ) : null}
          {!isCustomizing ? <DeleteButton resource="vendors" id={vendor.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <VendorDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.vendorCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="vendors"
            id={vendor.id}
            title="Vendor details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RecordDetailStatCard label="Contacts" value={vendor.contacts.length} />
          <RecordDetailStatCard label="Purchase orders" value={vendor.purchaseOrders.length} />
          <RecordDetailStatCard label="Total spend" value={fmtCurrency(totalSpend, undefined, moneySettings)} accent="teal" />
          <RecordDetailStatCard label="Open AP invoices" value={openInvoices.length} accent={openInvoices.length > 0 ? 'yellow' : undefined} />
        </div>

        <VendorContactsSection
          vendorId={vendor.id}
          userId={defaultUser?.id ?? null}
          contacts={vendor.contacts.map((contact) => ({
            id: contact.id,
            contactNumber: contact.contactNumber,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            position: contact.position,
          }))}
        />

        <VendorRelatedDocuments purchaseRequisitions={relatedRequisitions} purchaseOrders={relatedPurchaseOrders} receipts={relatedReceipts} bills={relatedBills} billPayments={relatedBillPayments} />
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
