import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, fmtPhone, normalizePhone } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import type { InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataHeaderDetails from '@/components/MasterDataHeaderDetails'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import { buildMasterDataSystemInformationItems } from '@/components/RecordSystemInformationSection'
import ContactDetailCustomizeMode from '@/components/ContactDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
} from '@/components/TransactionRelatedDocumentsTabs'
import { loadContactFormCustomization } from '@/lib/contact-form-customization-store'
import { CONTACT_FORM_FIELDS, type ContactFormFieldKey } from '@/lib/contact-form-customization'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'

export default async function ContactDetailPage({
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
  const fieldMetaById = buildFieldMetaById(CONTACT_FORM_FIELDS)

  const [contact, fieldOptions, formCustomization, formRequirements, currencies] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            opportunities: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        vendor: {
          include: {
            purchaseOrders: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        user: true,
      },
    }),
    loadFieldOptionsMap(fieldMetaById, ['customerId', 'vendorId', 'inactive']),
    loadContactFormCustomization(),
    loadFormRequirements(),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
  ])

  if (!contact) notFound()

  const detailHref = `/contacts/${contact.id}`
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]))
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity fields for the contact record.',
    Contact: 'Communication channels and mailing information.',
    Relationship: 'Customer or vendor ownership and job-context fields.',
    Status: 'Availability and active-state controls.',
  }

  const fieldDefinitions: Record<ContactFormFieldKey, InlineRecordSection['fields'][number]> = {
    contactNumber: {
      name: 'contactNumber',
      label: 'Contact ID',
      value: contact.contactNumber ?? '',
      helpText: 'System-generated contact identifier.',
    },
    firstName: {
      name: 'firstName',
      label: 'First Name',
      value: contact.firstName,
      helpText: 'Contact given name.',
    },
    lastName: {
      name: 'lastName',
      label: 'Last Name',
      value: contact.lastName,
      helpText: 'Contact family name.',
    },
    email: {
      name: 'email',
      label: 'Email',
      value: contact.email ?? '',
      type: 'email',
      helpText: 'Primary contact email address.',
    },
    phone: {
      name: 'phone',
      label: 'Phone',
      value: normalizePhone(contact.phone) ?? '',
      helpText: 'Primary contact phone number.',
    },
    address: {
      name: 'address',
      label: 'Address',
      value: contact.address ?? '',
      type: 'address',
      helpText: 'Mailing or business address for the contact.',
    },
    position: {
      name: 'position',
      label: 'Position',
      value: contact.position ?? '',
      helpText: 'Job title or role for the contact.',
    },
    customerId: {
      name: 'customerId',
      label: 'Customer',
      value: contact.customerId ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.customerId ?? [])],
      helpText: 'Customer account this contact belongs to, when customer-linked.',
      sourceText: getFieldSourceText(fieldMetaById, 'customerId'),
    },
    vendorId: {
      name: 'vendorId',
      label: 'Vendor',
      value: contact.vendorId ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.vendorId ?? [])],
      helpText: 'Vendor account this contact belongs to, when vendor-linked.',
      sourceText: getFieldSourceText(fieldMetaById, 'vendorId'),
    },
    isPrimaryForCustomer: {
      name: 'isPrimaryForCustomer',
      label: 'Primary',
      value: contact.isPrimaryForCustomer ? 'true' : 'false',
      type: 'checkbox',
      helpText: 'Marks the primary contact for the linked customer.',
      sourceText: getFieldSourceText(fieldMetaById, 'isPrimaryForCustomer'),
    },
    receivesQuotesSalesOrders: {
      name: 'receivesQuotesSalesOrders',
      label: 'Send Quote / SO',
      value: contact.receivesQuotesSalesOrders ? 'true' : 'false',
      type: 'checkbox',
      helpText: 'Whether this contact receives quotes and sales orders.',
      sourceText: getFieldSourceText(fieldMetaById, 'receivesQuotesSalesOrders'),
    },
    receivesInvoices: {
      name: 'receivesInvoices',
      label: 'Send Invoice',
      value: contact.receivesInvoices ? 'true' : 'false',
      type: 'checkbox',
      helpText: 'Whether this contact receives invoices.',
      sourceText: getFieldSourceText(fieldMetaById, 'receivesInvoices'),
    },
    receivesInvoiceCc: {
      name: 'receivesInvoiceCc',
      label: 'CC Invoice',
      value: contact.receivesInvoiceCc ? 'true' : 'false',
      type: 'checkbox',
      helpText: 'Whether this contact receives invoice CC copies.',
      sourceText: getFieldSourceText(fieldMetaById, 'receivesInvoiceCc'),
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: contact.active ? 'false' : 'true',
      type: 'select',
      options: fieldOptions.inactive ?? [],
      helpText: 'Marks the contact unavailable for new activity while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(CONTACT_FORM_FIELDS, fieldDefinitions)
  const accountType = contact.customer ? 'Customer' : 'Vendor'
  const accountName = contact.customer?.name ?? contact.vendor?.name ?? '-'
  const ownerName = contact.user.name ?? contact.user.email
  const activityCount = contact.customer ? contact.customer.opportunities.length : contact.vendor?.purchaseOrders.length ?? 0
  const statPreviewCards: Array<{
    id: string
    label: string
    value: string | number
    href?: string | null
    accent?: true | 'teal' | 'yellow'
    cardTone?: TransactionVisualTone
    valueTone?: TransactionVisualTone
    supportsColorized: boolean
    supportsLink: boolean
  }> = [
    { id: 'accountType', label: 'Account Type', value: accountType, cardTone: contact.customer ? 'accent' : 'yellow', valueTone: contact.customer ? 'accent' : 'yellow', supportsColorized: true, supportsLink: false },
    { id: 'account', label: 'Account', value: accountName, href: contact.customer ? `/customers/${contact.customer.id}` : contact.vendor ? `/vendors/${contact.vendor.id}` : null, cardTone: 'teal', valueTone: 'teal', supportsColorized: true, supportsLink: true },
    { id: 'owner', label: 'Owner', value: ownerName, cardTone: 'accent', valueTone: 'accent', supportsColorized: true, supportsLink: false },
    { id: 'activityCount', label: contact.customer ? 'Open Opportunities' : 'Purchase Orders', value: activityCount, accent: true, cardTone: 'green', valueTone: 'green', supportsColorized: true, supportsLink: false },
  ]
  const statDefinitions: Array<TransactionStatDefinition<typeof contact>> = [
    { id: 'accountType', label: 'Account Type', getValue: () => accountType, getCardTone: () => (contact.customer ? 'accent' : 'yellow'), getValueTone: () => (contact.customer ? 'accent' : 'yellow') },
    { id: 'account', label: 'Account', getValue: () => accountName, getHref: () => (contact.customer ? `/customers/${contact.customer.id}` : contact.vendor ? `/vendors/${contact.vendor.id}` : null), accent: 'teal', getCardTone: () => 'teal', getValueTone: () => 'teal' },
    { id: 'owner', label: 'Owner', getValue: () => ownerName, getCardTone: () => 'accent', getValueTone: () => 'accent' },
    { id: 'activityCount', label: contact.customer ? 'Open Opportunities' : 'Purchase Orders', getValue: () => activityCount, accent: true, getCardTone: () => 'green', getValueTone: () => 'green' },
  ]
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: CONTACT_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'contact',
    entityId: contact.id,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    fallbackCreatedByUserId: contact.userId,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'contact', entityId: contact.id })
  const relatedRecordsTabs = [
    ...(contact.customer
      ? [
          {
            key: 'customer',
            label: 'Customer',
            count: 1,
            emptyMessage: 'No customer is linked to this contact.',
            rows: [
              {
                id: contact.customer.id,
                type: 'Customer',
                reference: contact.customer.customerId ?? 'Pending',
                name: contact.customer.name,
                details: [contact.customer.email ?? '-', fmtPhone(contact.customer.phone), contact.customer.address ?? '-']
                  .filter(Boolean)
                  .join(' | '),
                href: `/customers/${contact.customer.id}`,
              },
            ],
          },
        ]
      : []),
    ...(contact.vendor
      ? [
          {
            key: 'vendor',
            label: 'Vendor',
            count: 1,
            emptyMessage: 'No vendor is linked to this contact.',
            rows: [
              {
                id: contact.vendor.id,
                type: 'Vendor',
                reference: contact.vendor.vendorNumber ?? 'Pending',
                name: contact.vendor.name,
                details: [contact.vendor.email ?? '-', fmtPhone(contact.vendor.phone), contact.vendor.address ?? '-']
                  .filter(Boolean)
                  .join(' | '),
                href: `/vendors/${contact.vendor.id}`,
              },
            ],
          },
        ]
      : []),
  ]
  const relatedDocumentsTabs = [
    ...(contact.customer
      ? [
          {
            key: 'opportunities',
            label: 'Opportunities',
            count: contact.customer.opportunities.length,
            tone: 'downstream' as const,
            emptyMessage: 'No opportunities are linked to this contact yet.',
            headers: ['Txn ID', 'Name', 'Status', 'Amount', 'Close Date'],
            rows: contact.customer.opportunities.map((opportunity) => ({
              id: opportunity.id,
              cells: [
                <Link key="link" href={`/opportunities/${opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                  {opportunity.opportunityNumber ?? 'Pending'}
                </Link>,
                opportunity.name,
                <RelatedDocumentsStatusBadge key="status" status={opportunity.stage} />,
                fmtCurrency(opportunity.amount, currencyCodeById.get(opportunity.currencyId ?? '') ?? undefined, moneySettings),
                opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate, moneySettings) : '-',
              ],
              filterValues: [
                opportunity.opportunityNumber ?? 'Pending',
                opportunity.name,
                opportunity.stage,
                fmtCurrency(opportunity.amount, currencyCodeById.get(opportunity.currencyId ?? '') ?? undefined, moneySettings),
                opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate, moneySettings) : '-',
              ],
            })),
          },
        ]
      : []),
    ...(contact.vendor
      ? [
          {
            key: 'purchase-orders',
            label: 'Purchase Orders',
            count: contact.vendor.purchaseOrders.length,
            tone: 'downstream' as const,
            emptyMessage: 'No purchase orders are linked to this contact yet.',
            headers: ['Txn ID', 'Status', 'Total', 'Created'],
            rows: contact.vendor.purchaseOrders.map((purchaseOrder) => ({
              id: purchaseOrder.id,
              cells: [
                <Link key="link" href={`/purchase-orders/${purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                  {purchaseOrder.number}
                </Link>,
                <RelatedDocumentsStatusBadge key="status" status={purchaseOrder.status} />,
                fmtCurrency(purchaseOrder.total, currencyCodeById.get(purchaseOrder.currencyId ?? '') ?? undefined, moneySettings),
                fmtDocumentDate(purchaseOrder.createdAt, moneySettings),
              ],
              filterValues: [
                purchaseOrder.number,
                purchaseOrder.status,
                fmtCurrency(purchaseOrder.total, currencyCodeById.get(purchaseOrder.currencyId ?? '') ?? undefined, moneySettings),
                fmtDocumentDate(purchaseOrder.createdAt, moneySettings),
              ],
            })),
          },
        ]
      : []),
  ]
  const communicationsToolbarTargetId = 'contact-communications-toolbar'
  const systemNotesToolbarTargetId = 'contact-system-notes-toolbar'

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/contacts'}
      backLabel={isCustomizing ? '<- Back to Contact Detail' : '<- Back to Contacts'}
      meta={contact.contactNumber ?? 'Pending'}
      title={`${contact.firstName} ${contact.lastName}`}
      badge={
        contact.position ? (
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            {contact.position}
          </span>
        ) : null
      }
      actions={
        isCustomizing ? null : (
          <RecordDetailActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={`inline-record-form-${contact.id}`}
            newHref="/contacts/new"
            duplicateHref={`/contacts/new?duplicateFrom=${contact.id}`}
            exportTitle={`${contact.firstName} ${contact.lastName}`}
            exportFileName={`contact-${contact.contactNumber ?? contact.id}`}
            exportSections={detailSections}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="contacts"
            deleteId={contact.id}
          />
        )
      }
    >
        {isCustomizing ? (
          <ContactDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.contactCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
            statPreviewCards={statPreviewCards}
          />
        ) : (
          <>
          <div className="mb-8">
            <TransactionStatsRow
              record={contact}
              stats={statDefinitions}
              visibleStatCards={formCustomization.statCards as Array<{ id: string; metric: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg'; colorized?: boolean; linked?: boolean }> | undefined}
            />
          </div>
          <MasterDataHeaderDetails
            resource="contacts"
            id={contact.id}
            title="Contact Details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            systemInformationItems={buildMasterDataSystemInformationItems(systemInfo, contact.id)}
          />
          </>
        )}

        {!isCustomizing ? (
          <RecordBottomTabsSection
            defaultActiveKey="related-records"
            tabs={[
              {
                key: 'related-records',
                label: 'Related Records',
                count: relatedRecordsTabs.reduce((sum, tab) => sum + tab.count, 0),
                content: <RelatedRecordsSection embedded tabs={relatedRecordsTabs} showDisplayControl={false} />,
              },
              ...(relatedDocumentsTabs.length
                ? [
                    {
                      key: 'related-documents',
                      label: 'Related Documents',
                      count: relatedDocumentsTabs.reduce((sum, tab) => sum + tab.count, 0),
                      content: (
                        <TransactionRelatedDocumentsTabs
                          embedded
                          tabs={relatedDocumentsTabs}
                          showDisplayControl={false}
                        />
                      ),
                    },
                  ]
                : []),
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
        ) : null}
    </RecordDetailPageShell>
  )
}
