import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataHeaderDetails from '@/components/MasterDataHeaderDetails'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import { buildMasterDataSystemInformationItems } from '@/components/RecordSystemInformationSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import CustomerRelatedDocumentsSection from '@/components/CustomerRelatedDocumentsSection'
import CustomerContactsSection from '@/components/CustomerContactsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import { fmtCurrency, normalizePhone, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import CustomerDetailCustomizeMode from '@/components/CustomerDetailCustomizeMode'
import { loadCustomerFormCustomization } from '@/lib/customer-form-customization-store'
import {
  CUSTOMER_FORM_FIELDS,
  type CustomerFormFieldKey,
} from '@/lib/customer-form-customization'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadListOptionsForSource } from '@/lib/list-source'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'

export default async function CustomerDetailPage({
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
  const fieldMetaById = buildFieldMetaById(CUSTOMER_FORM_FIELDS)

  const [customer, fieldOptions, inactiveOptions, formCustomization, formRequirements, currencies] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
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
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, currencyId: true, code: true },
    }),
  ])

  if (!customer) notFound()

  const pipelineValue = customer.opportunities.reduce((sum, opportunity) => sum + toNumericValue(opportunity.amount), 0)
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]))
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
    { id: 'contacts', label: 'Contacts', value: customer.contacts.length, cardTone: 'accent', valueTone: 'accent', supportsColorized: true, supportsLink: false },
    { id: 'opportunities', label: 'Opportunities', value: customer.opportunities.length, accent: 'teal', cardTone: 'teal', valueTone: 'teal', supportsColorized: true, supportsLink: false },
    { id: 'pipelineValue', label: 'Pipeline Value', value: fmtCurrency(pipelineValue, undefined, moneySettings), cardTone: 'green', valueTone: 'green', supportsColorized: true, supportsLink: false },
    { id: 'status', label: 'Status', value: customer.inactive ? 'Inactive' : 'Active', cardTone: customer.inactive ? 'red' : 'green', valueTone: customer.inactive ? 'red' : 'green', supportsColorized: true, supportsLink: false },
  ]
  const statDefinitions: Array<TransactionStatDefinition<typeof customer>> = [
    { id: 'contacts', label: 'Contacts', getValue: () => customer.contacts.length, getCardTone: () => 'accent', getValueTone: () => 'accent' },
    { id: 'opportunities', label: 'Opportunities', getValue: () => customer.opportunities.length, accent: 'teal', getCardTone: () => 'teal', getValueTone: () => 'teal' },
    { id: 'pipelineValue', label: 'Pipeline Value', getValue: () => fmtCurrency(pipelineValue, undefined, moneySettings), getCardTone: () => 'green', getValueTone: () => 'green' },
    { id: 'status', label: 'Status', getValue: () => (customer.inactive ? 'Inactive' : 'Active'), getCardTone: () => (customer.inactive ? 'red' : 'green'), getValueTone: () => (customer.inactive ? 'red' : 'green') },
  ]
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
  const relatedRecordsTabs = [
    {
      key: 'contacts',
      label: 'Contacts',
      count: customer.contacts.length,
      emptyMessage: 'No contacts are linked to this customer yet.',
      rows: customer.contacts.map((contact) => ({
        id: contact.id,
        type: contact.isPrimaryForCustomer ? 'Primary Contact' : 'Contact',
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
      count:
        (customer.user ? 1 : 0) +
        (customer.subsidiary ? 1 : 0) +
        (customer.currency ? 1 : 0),
      emptyMessage: 'No core linked records are available for this customer.',
      rows: [
        customer.user
          ? {
              id: `owner-${customer.user.id}`,
              type: 'Owner',
              reference: customer.user.userId ?? customer.user.id,
              name: customer.user.name ?? customer.user.email ?? '-',
              details: customer.user.email ?? '-',
              href: `/users/${customer.user.id}`,
            }
          : null,
        customer.subsidiary
          ? {
              id: `subsidiary-${customer.subsidiary.id}`,
              type: 'Primary Subsidiary',
              reference: customer.subsidiary.subsidiaryId,
              name: customer.subsidiary.name,
              details: customer.subsidiary.country ?? customer.subsidiary.entityType ?? '-',
              href: `/subsidiaries/${customer.subsidiary.id}`,
            }
          : null,
        customer.currency
          ? {
              id: `currency-${customer.currency.id}`,
              type: 'Primary Currency',
              reference: customer.currency.currencyId ?? customer.currency.code ?? customer.currency.id,
              name: customer.currency.name,
              details: customer.currency.symbol ?? customer.currency.code ?? '-',
              href: `/currencies/${customer.currency.id}`,
            }
          : null,
      ].filter((row): row is { id: string; type: string; reference: string; name: string; details: string; href: string } => Boolean(row)),
    },
  ]
  const relatedDocumentsCount =
    customer.opportunities.length +
    customer.quotes.length +
    customer.salesOrders.length +
    customer.salesOrders.reduce((sum, salesOrder) => sum + salesOrder.fulfillments.length, 0) +
    customer.invoices.length +
    customer.invoices.reduce((sum, invoice) => sum + invoice.cashReceipts.length, 0)
  const communicationsToolbarTargetId = 'customer-communications-toolbar'
  const systemNotesToolbarTargetId = 'customer-system-notes-toolbar'

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
        isCustomizing ? null : (
          <RecordDetailActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={`inline-record-form-${customer.id}`}
            newHref="/customers/new"
            duplicateHref={`/customers/new?duplicateFrom=${customer.id}`}
            exportTitle={customer.name}
            exportFileName={`customer-${customer.customerId ?? customer.id}`}
            exportSections={detailSections}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="customers"
            deleteId={customer.id}
          />
        )
      }
    >
        {!isCustomizing ? (
          <div className="mb-8">
            <TransactionStatsRow
              record={customer}
              stats={statDefinitions}
              visibleStatCards={formCustomization.statCards as Array<{ id: string; metric: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg'; colorized?: boolean; linked?: boolean }> | undefined}
            />
          </div>
        ) : null}

        {isCustomizing ? (
          <CustomerDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.customerCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
            statPreviewCards={statPreviewCards}
          />
        ) : (
          <MasterDataHeaderDetails
            resource="customers"
            id={customer.id}
            title="Customer Details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            systemInformationItems={buildMasterDataSystemInformationItems(systemInfo, customer.id)}
          />
        )}

        {!isCustomizing ? (
          <>
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
                    <CustomerRelatedDocumentsSection
                      embedded
                      showDisplayControl={false}
                      defaultCurrencyCode={customer.currency?.code ?? customer.currency?.currencyId ?? null}
                      opportunities={customer.opportunities.map((opportunity) => ({
                        id: opportunity.id,
                        number: opportunity.opportunityNumber ?? opportunity.name,
                        name: opportunity.name,
                        status: opportunity.stage,
                        total: toNumericValue(opportunity.amount, 0),
                        currencyCode: currencyCodeById.get(opportunity.currencyId ?? '') ?? null,
                        closeDate: opportunity.closeDate ? opportunity.closeDate.toISOString() : null,
                      }))}
                      quotes={customer.quotes.map((quote) => ({
                        id: quote.id,
                        number: quote.number,
                        status: quote.status,
                        total: toNumericValue(quote.total, 0),
                        currencyCode: currencyCodeById.get(quote.currencyId ?? '') ?? null,
                        validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
                        createdAt: quote.createdAt.toISOString(),
                      }))}
                      salesOrders={customer.salesOrders.map((salesOrder) => ({
                        id: salesOrder.id,
                        number: salesOrder.number,
                        status: salesOrder.status,
                        total: toNumericValue(salesOrder.total, 0),
                        currencyCode: currencyCodeById.get(salesOrder.currencyId ?? '') ?? null,
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
                        })),
                      )}
                      invoices={customer.invoices.map((invoice) => ({
                        id: invoice.id,
                        number: invoice.number,
                        status: invoice.status,
                        total: toNumericValue(invoice.total, 0),
                        currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                        dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
                        paidDate: invoice.paidDate ? invoice.paidDate.toISOString() : null,
                      }))}
                      invoiceReceipts={customer.invoices.flatMap((invoice) =>
                        invoice.cashReceipts.map((receipt) => ({
                          id: receipt.id,
                          number: receipt.number,
                          amount: toNumericValue(receipt.amount, 0),
                          currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                          date: receipt.date.toISOString(),
                          method: receipt.method,
                          reference: receipt.reference,
                          invoiceNumber: invoice.number,
                        })),
                      )}
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
