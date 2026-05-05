import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataHeaderDetails from '@/components/MasterDataHeaderDetails'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import { buildMasterDataSystemInformationItems } from '@/components/RecordSystemInformationSection'
import CurrencyDetailCustomizeMode from '@/components/CurrencyDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadCurrencyFormCustomization } from '@/lib/currency-form-customization-store'
import { CURRENCY_FORM_FIELDS, type CurrencyFormFieldKey } from '@/lib/currency-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'

export default async function CurrencyDetailPage({
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
  const fieldMetaById = buildFieldMetaById(CURRENCY_FORM_FIELDS)

  const [currency, fieldOptions, currencyFormCustomization, formRequirements] = await Promise.all([
    prisma.currency.findUnique({
      where: { id },
      include: {
        localCurrencySubsidiaries: { orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } },
        customers: { orderBy: { name: 'asc' }, select: { id: true, name: true, customerId: true } },
        vendors: { orderBy: { name: 'asc' }, select: { id: true, name: true, vendorNumber: true } },
      },
    }),
    loadFieldOptionsMap(
      {
        ...fieldMetaById,
        isBase: {
          ...fieldMetaById.isBase,
          sourceType: 'system',
          sourceKey: 'boolean',
        },
      },
      ['isBase', 'inactive']
    ),
    loadCurrencyFormCustomization(),
    loadFormRequirements(),
  ])
  const baseOptions = fieldOptions.isBase ?? []
  const inactiveOptions = fieldOptions.inactive ?? []

  if (!currency) notFound()

  const detailHref = `/currencies/${currency.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity and presentation fields for the currency.',
    Settings: 'Rounding, status, and base-currency behavior.',
  }
  const fieldDefinitions: Record<CurrencyFormFieldKey, InlineRecordSection['fields'][number]> = {
    currencyId: { name: 'currencyId', label: 'Currency Id', value: currency.currencyId, helpText: 'System-generated currency master record identifier.' },
    code: { name: 'code', label: 'Code', value: currency.code, helpText: 'ISO currency code or operating currency code, such as USD, CAD, or AUD.' },
    name: { name: 'name', label: 'Name', value: currency.name, helpText: 'Display name for the currency.' },
    symbol: { name: 'symbol', label: 'Symbol', value: currency.symbol ?? '', helpText: 'Printed symbol used on forms and reports.' },
    decimals: { name: 'decimals', label: 'Decimal Places', value: String(currency.decimals), type: 'number', helpText: 'Number of decimal places used for this currency.' },
    isBase: { name: 'isBase', label: 'Base Currency', value: String(currency.isBase), type: 'select', options: baseOptions, helpText: 'Marks whether this is the primary company currency.', sourceText: 'System values' },
    inactive: { name: 'inactive', label: 'Inactive', value: String(!currency.active), type: 'select', options: inactiveOptions, helpText: 'Marks the currency unavailable for new records while preserving history.', sourceText: getFieldSourceText(fieldMetaById, 'inactive') },
  }
  const customizeFields = buildCustomizePreviewFields(CURRENCY_FORM_FIELDS, fieldDefinitions)
  const statPreviewCards: Array<{
    id: string
    label: string
    value: string | number
    cardTone?: TransactionVisualTone
    valueTone?: TransactionVisualTone
    supportsColorized: boolean
    supportsLink: boolean
  }> = [
    { id: 'subsidiaries', label: 'Subsidiaries', value: currency.localCurrencySubsidiaries.length, cardTone: 'accent', valueTone: 'accent', supportsColorized: true, supportsLink: false },
    { id: 'customers', label: 'Customers', value: currency.customers.length, cardTone: 'teal', valueTone: 'teal', supportsColorized: true, supportsLink: false },
    { id: 'vendors', label: 'Vendors', value: currency.vendors.length, cardTone: 'yellow', valueTone: 'yellow', supportsColorized: true, supportsLink: false },
  ]
  const statDefinitions: Array<TransactionStatDefinition<typeof currency>> = [
    { id: 'subsidiaries', label: 'Subsidiaries', getValue: () => currency.localCurrencySubsidiaries.length, getCardTone: () => 'accent', getValueTone: () => 'accent' },
    { id: 'customers', label: 'Customers', getValue: () => currency.customers.length, getCardTone: () => 'teal', getValueTone: () => 'teal' },
    { id: 'vendors', label: 'Vendors', getValue: () => currency.vendors.length, getCardTone: () => 'yellow', getValueTone: () => 'yellow' },
  ]
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: CURRENCY_FORM_FIELDS,
    layout: currencyFormCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'currency',
    entityId: currency.id,
    createdAt: currency.createdAt,
    updatedAt: currency.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'currency', entityId: currency.id })
  const relatedRecordsTabs = [
    {
      key: 'subsidiaries',
      label: 'Subsidiaries',
      count: currency.localCurrencySubsidiaries.length,
      emptyMessage: 'No subsidiaries use this as their local currency.',
      rows: currency.localCurrencySubsidiaries.map((subsidiary) => ({
        id: subsidiary.id,
        type: 'Subsidiary',
        reference: subsidiary.subsidiaryId,
        name: subsidiary.name,
        details: 'Local Currency',
        href: `/subsidiaries/${subsidiary.id}`,
      })),
    },
    {
      key: 'customers',
      label: 'Customers',
      count: currency.customers.length,
      emptyMessage: 'No customers use this as their primary currency.',
      rows: currency.customers.map((customer) => ({
        id: customer.id,
        type: 'Customer',
        reference: customer.customerId ?? 'Pending',
        name: customer.name,
        details: 'Primary Currency',
        href: `/customers/${customer.id}`,
      })),
    },
    {
      key: 'vendors',
      label: 'Vendors',
      count: currency.vendors.length,
      emptyMessage: 'No vendors use this as their primary currency.',
      rows: currency.vendors.map((vendor) => ({
        id: vendor.id,
        type: 'Vendor',
        reference: vendor.vendorNumber ?? 'Pending',
        name: vendor.name,
        details: 'Primary Currency',
        href: `/vendors/${vendor.id}`,
      })),
    },
  ]
  const communicationsToolbarTargetId = 'currency-communications-toolbar'
  const systemNotesToolbarTargetId = 'currency-system-notes-toolbar'

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/currencies'}
      backLabel={isCustomizing ? '<- Back to Currency Detail' : '<- Back to Currencies'}
      meta={currency.currencyId}
      title={currency.name}
      badge={
        currency.symbol ? (
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            {currency.symbol}
          </span>
        ) : null
      }
      actions={
        isCustomizing ? null : (
          <RecordDetailActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={`inline-record-form-${currency.id}`}
            newHref="/currencies/new"
            duplicateHref={`/currencies/new?duplicateFrom=${currency.id}`}
            exportTitle={currency.name}
            exportFileName={`currency-${currency.currencyId}`}
            exportSections={detailSections}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="currencies"
            deleteId={currency.id}
          />
        )
      }
    >
        {!isCustomizing ? (
          <div className="mb-8">
            <TransactionStatsRow
              record={currency}
              stats={statDefinitions}
              visibleStatCards={currencyFormCustomization.statCards as Array<{ id: string; metric: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg'; colorized?: boolean; linked?: boolean }> | undefined}
            />
          </div>
        ) : null}

        {isCustomizing ? (
          <CurrencyDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={currencyFormCustomization}
            initialRequirements={{ ...formRequirements.currencyCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
            statPreviewCards={statPreviewCards}
          />
        ) : (
          <MasterDataHeaderDetails
            resource="currencies"
            id={currency.id}
            title="Currency Details"
            sections={detailSections}
            editing={isEditing}
            columns={currencyFormCustomization.formColumns}
            systemInformationItems={buildMasterDataSystemInformationItems(systemInfo, currency.id)}
          />
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
