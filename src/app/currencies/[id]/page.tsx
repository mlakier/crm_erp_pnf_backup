import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import CurrencyDetailCustomizeMode from '@/components/CurrencyDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
  RecordDetailStatCard,
} from '@/components/RecordDetailPanels'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadCurrencyFormCustomization } from '@/lib/currency-form-customization-store'
import { CURRENCY_FORM_FIELDS, type CurrencyFormFieldKey } from '@/lib/currency-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

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
        defaultCurrencySubsidiaries: { orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } },
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
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${currency.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/currencies/new" duplicateHref={`/currencies/new?duplicateFrom=${currency.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={currency.name} fileName={`currency-${currency.currencyId}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? (
            <Link
              href={`${detailHref}?customize=1`}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
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
          {!isCustomizing ? <DeleteButton resource="currencies" id={currency.id} /> : null}
        </>
      }
    >
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <RecordDetailStatCard label="Subsidiaries" value={currency.defaultCurrencySubsidiaries.length} />
          <RecordDetailStatCard label="Customers" value={currency.customers.length} />
          <RecordDetailStatCard label="Vendors" value={currency.vendors.length} />
        </div>

        {isCustomizing ? (
          <CurrencyDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={currencyFormCustomization}
            initialRequirements={{ ...formRequirements.currencyCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="currencies"
            id={currency.id}
            title="Currency details"
            sections={detailSections}
            editing={isEditing}
            columns={currencyFormCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <RecordDetailSection title="Subsidiaries (Default Currency)" count={currency.defaultCurrencySubsidiaries.length}>
          {currency.defaultCurrencySubsidiaries.length === 0 ? (
            <RecordDetailEmptyState message="No subsidiaries use this as default currency" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Code</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {currency.defaultCurrencySubsidiaries.map((subsidiary) => (
                  <tr key={subsidiary.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/subsidiaries/${subsidiary.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {subsidiary.subsidiaryId}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{subsidiary.name}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>

        <RecordDetailSection title="Customers" count={currency.customers.length}>
          {currency.customers.length === 0 ? (
            <RecordDetailEmptyState message="No customers with this primary currency" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Customer #</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {currency.customers.map((customer) => (
                  <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/customers/${customer.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {customer.customerId ?? 'Pending'}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{customer.name}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>

        <RecordDetailSection title="Vendors" count={currency.vendors.length}>
          {currency.vendors.length === 0 ? (
            <RecordDetailEmptyState message="No vendors with this primary currency" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Vendor Id</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {currency.vendors.map((vendor) => (
                  <tr key={vendor.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/vendors/${vendor.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {vendor.vendorNumber ?? 'Pending'}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{vendor.name}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
