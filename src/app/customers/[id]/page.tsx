import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import CustomerRelatedDocs from '@/components/CustomerRelatedDocs'
import CustomerContactsSection from '@/components/CustomerContactsSection'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import { RecordDetailStatCard } from '@/components/RecordDetailPanels'
import { fmtCurrency, normalizePhone } from '@/lib/format'
import CustomerDetailCustomizeMode from '@/components/CustomerDetailCustomizeMode'
import { loadCustomerFormCustomization } from '@/lib/customer-form-customization-store'
import { CUSTOMER_FORM_FIELDS, type CustomerFormFieldKey } from '@/lib/customer-form-customization'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadListOptionsForSource } from '@/lib/list-source'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const fieldMetaById = buildFieldMetaById(CUSTOMER_FORM_FIELDS)

  const [customer, fieldOptions, inactiveOptions, formCustomization, formRequirements] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        currency: true,
        contacts: { orderBy: { createdAt: 'desc' } },
        opportunities: { orderBy: { createdAt: 'desc' } },
        quotes: { orderBy: { createdAt: 'desc' } },
        salesOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            fulfillments: { orderBy: { date: 'desc' } },
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            cashReceipts: { orderBy: { date: 'desc' } },
          },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, ['primarySubsidiaryId', 'primaryCurrencyId', 'industry']),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadCustomerFormCustomization(),
    loadFormRequirements(),
  ])

  if (!customer) notFound()

  const pipelineValue = customer.opportunities.reduce((sum, opportunity) => sum + (opportunity.amount ?? 0), 0)
  const detailHref = `/customers/${customer.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity fields for the customer record.',
    Contact: 'Contact channels and billing address.',
    Financial: 'Default industry, subsidiary, and currency settings.',
    Status: 'Availability and active-state controls.',
  }

  const fieldDefinitions: Record<CustomerFormFieldKey, InlineRecordSection['fields'][number]> = {
    customerId: {
      name: 'customerId',
      label: 'Customer ID',
      value: customer.customerId ?? '',
      helpText: 'System-generated customer identifier.',
    },
    name: {
      name: 'name',
      label: 'Name',
      value: customer.name,
      helpText: 'Primary customer or account name.',
    },
    email: {
      name: 'email',
      label: 'Email',
      value: customer.email ?? '',
      type: 'email',
      helpText: 'Primary customer email address.',
    },
    phone: {
      name: 'phone',
      label: 'Phone',
      value: normalizePhone(customer.phone) ?? '',
      helpText: 'Primary customer phone number.',
    },
    address: {
      name: 'address',
      label: 'Billing Address',
      value: customer.address ?? '',
      type: 'address',
      helpText: 'Main billing address for the customer.',
    },
    industry: {
      name: 'industry',
      label: 'Industry',
      value: customer.industry ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.industry ?? [])],
      helpText: 'Customer industry or segment classification.',
      sourceText: getFieldSourceText(fieldMetaById, 'industry'),
    },
    primarySubsidiaryId: {
      name: 'primarySubsidiaryId',
      label: 'Primary Subsidiary',
      value: customer.subsidiaryId ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.primarySubsidiaryId ?? [])],
      helpText: 'Default subsidiary context for this customer.',
      sourceText: getFieldSourceText(fieldMetaById, 'primarySubsidiaryId'),
    },
    primaryCurrencyId: {
      name: 'primaryCurrencyId',
      label: 'Primary Currency',
      value: customer.currencyId ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.primaryCurrencyId ?? [])],
      helpText: 'Default transaction currency for this customer.',
      sourceText: getFieldSourceText(fieldMetaById, 'primaryCurrencyId'),
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: customer.inactive ? 'true' : 'false',
      type: 'select',
      options: inactiveOptions,
      helpText: 'Marks the customer unavailable for new activity while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(CUSTOMER_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: CUSTOMER_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'customer',
    entityId: customer.id,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    fallbackCreatedByUserId: customer.userId,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'customer', entityId: customer.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/customers'}
      backLabel={isCustomizing ? '<- Back to Customer Detail' : '<- Back to Customers'}
      meta={customer.customerId ?? 'Pending'}
      title={customer.name}
      badge={
        customer.industry ? (
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            {customer.industry}
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
                form={`inline-record-form-${customer.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/customers/new" duplicateHref={`/customers/new?duplicateFrom=${customer.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={customer.name} fileName={`customer-${customer.customerId ?? customer.id}`} sections={detailSections} /> : null}
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
          {!isCustomizing ? <DeleteButton resource="customers" id={customer.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <CustomerDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.customerCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="customers"
            id={customer.id}
            title="Customer details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <RecordDetailStatCard label="Contacts" value={customer.contacts.length} />
          <RecordDetailStatCard label="Opportunities" value={customer.opportunities.length} />
          <RecordDetailStatCard label="Pipeline value" value={fmtCurrency(pipelineValue)} accent />
        </div>

        <CustomerContactsSection
          customerId={customer.id}
          userId={customer.userId}
          contacts={customer.contacts.map((contact) => ({
            id: contact.id,
            contactNumber: contact.contactNumber,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            position: contact.position,
            isPrimaryForCustomer: contact.isPrimaryForCustomer,
            receivesQuotesSalesOrders: contact.receivesQuotesSalesOrders,
            receivesInvoices: contact.receivesInvoices,
            receivesInvoiceCc: contact.receivesInvoiceCc,
          }))}
        />

        <CustomerRelatedDocs
          opportunities={customer.opportunities.map((opportunity) => ({
            id: opportunity.id,
            name: opportunity.name,
            stage: opportunity.stage,
            amount: opportunity.amount,
            closeDate: opportunity.closeDate ? opportunity.closeDate.toISOString() : null,
          }))}
          quotes={customer.quotes.map((quote) => ({
            id: quote.id,
            number: quote.number,
            status: quote.status,
            total: quote.total,
            validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
            createdAt: quote.createdAt.toISOString(),
          }))}
          salesOrders={customer.salesOrders.map((salesOrder) => ({
            id: salesOrder.id,
            number: salesOrder.number,
            status: salesOrder.status,
            total: salesOrder.total,
            createdAt: salesOrder.createdAt.toISOString(),
          }))}
          fulfillments={customer.salesOrders.flatMap((salesOrder) =>
            salesOrder.fulfillments.map((fulfillment) => ({
              id: fulfillment.id,
              number: fulfillment.number,
              status: fulfillment.status,
              date: fulfillment.date.toISOString(),
              notes: fulfillment.notes,
              salesOrderNumber: salesOrder.number,
            }))
          )}
          invoices={customer.invoices.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            total: invoice.total,
            dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
            paidDate: invoice.paidDate ? invoice.paidDate.toISOString() : null,
            createdAt: invoice.createdAt.toISOString(),
          }))}
          invoiceReceipts={customer.invoices.flatMap((invoice) =>
            invoice.cashReceipts.map((receipt) => ({
              id: receipt.id,
              number: receipt.number,
              amount: receipt.amount,
              date: receipt.date.toISOString(),
              method: receipt.method,
              reference: receipt.reference,
              invoiceNumber: invoice.number,
            }))
          )}
        />
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
