import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, fmtPhone, normalizePhone } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import ContactDetailCustomizeMode from '@/components/ContactDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailField,
  RecordDetailHeaderCell,
  RecordDetailSection,
  RecordDetailStatCard,
} from '@/components/RecordDetailPanels'
import { loadContactFormCustomization } from '@/lib/contact-form-customization-store'
import { CONTACT_FORM_FIELDS, type ContactFormFieldKey } from '@/lib/contact-form-customization'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

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

  const [contact, fieldOptions, formCustomization, formRequirements] = await Promise.all([
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
  ])

  if (!contact) notFound()

  const detailHref = `/contacts/${contact.id}`
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
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${contact.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/contacts/new" duplicateHref={`/contacts/new?duplicateFrom=${contact.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={`${contact.firstName} ${contact.lastName}`} fileName={`contact-${contact.contactNumber ?? contact.id}`} sections={detailSections} /> : null}
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
          {!isCustomizing ? <DeleteButton resource="contacts" id={contact.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <ContactDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.contactCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="contacts"
            id={contact.id}
            title="Contact details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <RecordDetailStatCard label="Account Type" value={contact.customer ? 'Customer' : 'Vendor'} />
          <RecordDetailStatCard label="Account" value={contact.customer?.name ?? contact.vendor?.name ?? '-'} />
          <RecordDetailStatCard label="Owner" value={contact.user.name ?? contact.user.email} />
          <RecordDetailStatCard
            label={contact.customer ? 'Open opportunities' : 'Purchase orders'}
            value={contact.customer ? contact.customer.opportunities.length : contact.vendor?.purchaseOrders.length ?? 0}
            accent
          />
        </div>

        {contact.customer ? (
          <>
            <RecordDetailSection title="Linked customer" count={1}>
              <div className="mb-4 flex items-center justify-between px-6 pt-6">
                <Link href={`/customers/${contact.customer.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                  {'View customer ->'}
                </Link>
              </div>
              <div className="px-6 pb-6">
                <p className="text-lg font-semibold text-white">{contact.customer.name}</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <RecordDetailField label="Industry">{contact.customer.industry ?? '-'}</RecordDetailField>
                  <RecordDetailField label="Customer email">{contact.customer.email ?? '-'}</RecordDetailField>
                  <RecordDetailField label="Customer phone">{fmtPhone(contact.customer.phone)}</RecordDetailField>
                  <RecordDetailField label="Address">{contact.customer.address ?? '-'}</RecordDetailField>
                </dl>
              </div>
            </RecordDetailSection>

            <RecordDetailSection title="Recent customer opportunities" count={contact.customer.opportunities.length}>
              {contact.customer.opportunities.length === 0 ? (
                <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No opportunities for this customer yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                        <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                        <RecordDetailHeaderCell>Stage</RecordDetailHeaderCell>
                        <RecordDetailHeaderCell>Amount</RecordDetailHeaderCell>
                        <RecordDetailHeaderCell>Close Date</RecordDetailHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {contact.customer.opportunities.map((opportunity, index) => (
                        <tr key={opportunity.id} style={index < contact.customer!.opportunities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                          <RecordDetailCell>
                            <Link href={`/opportunities/${opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                              {opportunity.name}
                            </Link>
                          </RecordDetailCell>
                          <RecordDetailCell>{opportunity.stage}</RecordDetailCell>
                          <RecordDetailCell>{fmtCurrency(opportunity.amount, undefined, moneySettings)}</RecordDetailCell>
                          <RecordDetailCell>{opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate, moneySettings) : '-'}</RecordDetailCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </RecordDetailSection>
          </>
        ) : contact.vendor ? (
          <>
            <RecordDetailSection title="Linked vendor" count={1}>
              <div className="mb-4 flex items-center justify-between px-6 pt-6">
                <Link href={`/vendors/${contact.vendor.id}`} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                  {'View vendor ->'}
                </Link>
              </div>
              <div className="px-6 pb-6">
                <p className="text-lg font-semibold text-white">{contact.vendor.name}</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <RecordDetailField label="Vendor email">{contact.vendor.email ?? '-'}</RecordDetailField>
                  <RecordDetailField label="Vendor phone">{fmtPhone(contact.vendor.phone)}</RecordDetailField>
                  <RecordDetailField label="Tax ID">{contact.vendor.taxId ?? '-'}</RecordDetailField>
                  <RecordDetailField label="Address">{contact.vendor.address ?? '-'}</RecordDetailField>
                </dl>
              </div>
            </RecordDetailSection>

            <RecordDetailSection title="Recent vendor purchase orders" count={contact.vendor.purchaseOrders.length}>
              {contact.vendor.purchaseOrders.length === 0 ? (
                <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No purchase orders for this vendor yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                        <RecordDetailHeaderCell>Number</RecordDetailHeaderCell>
                        <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
                        <RecordDetailHeaderCell>Total</RecordDetailHeaderCell>
                        <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {contact.vendor.purchaseOrders.map((purchaseOrder, index) => (
                        <tr key={purchaseOrder.id} style={index < contact.vendor!.purchaseOrders.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                          <RecordDetailCell>
                            <Link href={`/purchase-orders/${purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                              {purchaseOrder.number}
                            </Link>
                          </RecordDetailCell>
                          <RecordDetailCell>{purchaseOrder.status}</RecordDetailCell>
                          <RecordDetailCell>{fmtCurrency(purchaseOrder.total, undefined, moneySettings)}</RecordDetailCell>
                          <RecordDetailCell>{fmtDocumentDate(purchaseOrder.createdAt, moneySettings)}</RecordDetailCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </RecordDetailSection>
          </>
        ) : null}
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
