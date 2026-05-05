import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, normalizePhone, toNumericValue } from '@/lib/format'
import type { InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataHeaderDetails from '@/components/MasterDataHeaderDetails'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import { buildMasterDataSystemInformationItems } from '@/components/RecordSystemInformationSection'
import VendorDetailCustomizeMode from '@/components/VendorDetailCustomizeMode'
import VendorRelatedDocuments from '@/components/VendorRelatedDocuments'
import VendorContactsSection from '@/components/VendorContactsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadVendorFormCustomization } from '@/lib/vendor-form-customization-store'
import { VENDOR_FORM_FIELDS, type VendorFormFieldKey } from '@/lib/vendor-form-customization'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadListOptionsForSource } from '@/lib/list-source'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'

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

  const [vendor, defaultUser, fieldOptions, inactiveOptions, formCustomization, formRequirements, currencies] = await Promise.all([
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
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true },
    }),
  ])

  if (!vendor) notFound()

  const totalSpend = vendor.purchaseOrders.reduce((sum, purchaseOrder) => sum + toNumericValue(purchaseOrder.total), 0)
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]))
  const openInvoices = vendor.bills.filter((bill) => bill.status !== 'paid' && bill.status !== 'void')
  const detailHref = `/vendors/${vendor.id}`
  const relatedPurchaseOrders = vendor.purchaseOrders.map((purchaseOrder) => ({
    id: purchaseOrder.id,
    number: purchaseOrder.number,
    status: purchaseOrder.status,
    total: toNumericValue(purchaseOrder.total, 0),
    currencyCode: currencyCodeById.get(purchaseOrder.currencyId ?? '') ?? null,
    createdAt: purchaseOrder.createdAt.toISOString(),
  }))
  const relatedRequisitionMap = new Map<string, {
    id: string
    number: string
    status: string
    total: number
    currencyCode?: string | null
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
      currencyCode: currencyCodeById.get(requisition.currencyId ?? '') ?? null,
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
      currencyCode: currencyCodeById.get(purchaseOrder.requisition.currencyId ?? '') ?? null,
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
    currencyCode: currencyCodeById.get(bill.currencyId ?? '') ?? null,
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
      currencyCode: currencyCodeById.get(bill.currencyId ?? '') ?? null,
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
  const statPreviewCards: Array<{
    id: string
    label: string
    value: string | number
    accent?: true | 'teal' | 'yellow'
    cardTone?: TransactionVisualTone
    valueTone?: TransactionVisualTone
    supportsColorized: boolean
    supportsLink: boolean
  }> = [
    { id: 'contacts', label: 'Contacts', value: vendor.contacts.length, cardTone: 'accent', valueTone: 'accent', supportsColorized: true, supportsLink: false },
    { id: 'purchaseOrders', label: 'Purchase Orders', value: vendor.purchaseOrders.length, cardTone: 'teal', valueTone: 'teal', supportsColorized: true, supportsLink: false },
    { id: 'totalSpend', label: 'Total Spend', value: fmtCurrency(totalSpend, undefined, moneySettings), cardTone: 'green', valueTone: 'green', supportsColorized: true, supportsLink: false },
    { id: 'openInvoices', label: 'Open AP Invoices', value: openInvoices.length, accent: openInvoices.length > 0 ? 'yellow' : undefined, cardTone: openInvoices.length > 0 ? 'yellow' : 'default', valueTone: openInvoices.length > 0 ? 'yellow' : 'default', supportsColorized: true, supportsLink: false },
  ]
  const statDefinitions: Array<TransactionStatDefinition<typeof vendor>> = [
    { id: 'contacts', label: 'Contacts', getValue: () => vendor.contacts.length, getCardTone: () => 'accent', getValueTone: () => 'accent' },
    { id: 'purchaseOrders', label: 'Purchase Orders', getValue: () => vendor.purchaseOrders.length, getCardTone: () => 'teal', getValueTone: () => 'teal' },
    { id: 'totalSpend', label: 'Total Spend', getValue: () => fmtCurrency(totalSpend, undefined, moneySettings), getCardTone: () => 'green', getValueTone: () => 'green' },
    { id: 'openInvoices', label: 'Open AP Invoices', getValue: () => openInvoices.length, accent: openInvoices.length > 0 ? 'yellow' : undefined, getCardTone: () => (openInvoices.length > 0 ? 'yellow' : 'default'), getValueTone: () => (openInvoices.length > 0 ? 'yellow' : 'default') },
  ]
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
  const relatedRecordsTabs = [
    {
      key: 'contacts',
      label: 'Contacts',
      count: vendor.contacts.length,
      emptyMessage: 'No contacts are linked to this vendor yet.',
      rows: vendor.contacts.map((contact) => ({
        id: contact.id,
        type: 'Contact',
        reference: contact.contactNumber ?? contact.id,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        details:
          [
            contact.position,
            contact.email,
            normalizePhone(contact.phone) ?? null,
            contact.receivesQuotesSalesOrders ? 'Receives Quote/SO' : null,
            contact.receivesInvoices ? 'Receives Invoices' : null,
            contact.receivesInvoiceCc ? 'Invoice CC' : null,
          ]
            .filter(Boolean)
            .join(' | ') || '-',
        href: `/contacts/${contact.id}`,
      })),
    },
    {
      key: 'core-links',
      label: 'Core Links',
      count: (vendor.subsidiary ? 1 : 0) + (vendor.currency ? 1 : 0),
      emptyMessage: 'No core linked records are available for this vendor.',
      rows: [
        vendor.subsidiary
          ? {
              id: `subsidiary-${vendor.subsidiary.id}`,
              type: 'Primary Subsidiary',
              reference: vendor.subsidiary.subsidiaryId,
              name: vendor.subsidiary.name,
              details: vendor.subsidiary.country ?? vendor.subsidiary.entityType ?? '-',
              href: `/subsidiaries/${vendor.subsidiary.id}`,
            }
          : null,
        vendor.currency
          ? {
              id: `currency-${vendor.currency.id}`,
              type: 'Primary Currency',
              reference: vendor.currency.currencyId ?? vendor.currency.code ?? vendor.currency.id,
              name: vendor.currency.name,
              details: vendor.currency.symbol ?? vendor.currency.code ?? '-',
              href: `/currencies/${vendor.currency.id}`,
            }
          : null,
      ].filter((row): row is { id: string; type: string; reference: string; name: string; details: string; href: string } => Boolean(row)),
    },
  ]
  const relatedDocumentsCount =
    relatedRequisitions.length +
    relatedPurchaseOrders.length +
    relatedReceipts.length +
    relatedBills.length +
    relatedBillPayments.length
  const communicationsToolbarTargetId = 'vendor-communications-toolbar'
  const systemNotesToolbarTargetId = 'vendor-system-notes-toolbar'

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
        isCustomizing ? null : (
          <RecordDetailActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={`inline-record-form-${vendor.id}`}
            newHref="/vendors/new"
            duplicateHref={`/vendors/new?duplicateFrom=${vendor.id}`}
            exportTitle={vendor.name}
            exportFileName={`vendor-${vendor.vendorNumber ?? vendor.id}`}
            exportSections={detailSections}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="vendors"
            deleteId={vendor.id}
          />
        )
      }
    >
        {isCustomizing ? (
          <VendorDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.vendorCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
            statPreviewCards={statPreviewCards}
          />
        ) : (
          <>
          <div className="mb-8">
            <TransactionStatsRow
              record={vendor}
              stats={statDefinitions}
              visibleStatCards={formCustomization.statCards as Array<{ id: string; metric: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg'; colorized?: boolean; linked?: boolean }> | undefined}
            />
          </div>
          <MasterDataHeaderDetails
            resource="vendors"
            id={vendor.id}
            title="Vendor Details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            systemInformationItems={buildMasterDataSystemInformationItems(systemInfo, vendor.id)}
          />
          </>
        )}

        {!isCustomizing ? (
          <>
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
                receivesQuotesSalesOrders: contact.receivesQuotesSalesOrders,
                receivesInvoices: contact.receivesInvoices,
                receivesInvoiceCc: contact.receivesInvoiceCc,
              }))}
            />
            <RecordBottomTabsSection
              defaultActiveKey="related-records"
              tabs={[
                {
                  key: 'related-records',
                  label: 'Related Records',
                  count: relatedRecordsTabs.reduce((sum, tab) => sum + tab.count, 0),
                  content: <RelatedRecordsSection embedded tabs={relatedRecordsTabs} showDisplayControl={false} />,
                },
                {
                  key: 'related-documents',
                  label: 'Related Documents',
                  count: relatedDocumentsCount,
                  content: (
                    <VendorRelatedDocuments
                      embedded
                      showDisplayControl={false}
                      defaultCurrencyCode={vendor.currency?.code ?? vendor.currency?.currencyId ?? null}
                      purchaseRequisitions={relatedRequisitions}
                      purchaseOrders={relatedPurchaseOrders}
                      receipts={relatedReceipts}
                      bills={relatedBills}
                      billPayments={relatedBillPayments}
                    />
                  ),
                },
                {
                  key: 'communications',
                  label: 'Communications',
                  count: 0,
                  toolbarTargetId: communicationsToolbarTargetId,
                  toolbarPlacement: 'tab-bar',
                  content: (
                    <CommunicationsSection
                      embedded
                      toolbarTargetId={communicationsToolbarTargetId}
                      rows={[]}
                      showDisplayControl={false}
                    />
                  ),
                },
                {
                  key: 'system-notes',
                  label: 'System Notes',
                  count: systemNotes.length,
                  toolbarTargetId: systemNotesToolbarTargetId,
                  toolbarPlacement: 'tab-bar',
                  content: (
                    <SystemNotesSection
                      embedded
                      toolbarTargetId={systemNotesToolbarTargetId}
                      notes={systemNotes}
                      showDisplayControl={false}
                    />
                  ),
                },
              ]}
            />
          </>
        ) : null}
    </RecordDetailPageShell>
  )
}
