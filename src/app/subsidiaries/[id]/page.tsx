import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import SubsidiaryDetailCustomizeMode from '@/components/SubsidiaryDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadSubsidiaryFormCustomization } from '@/lib/subsidiary-form-customization-store'
import { SUBSIDIARY_FORM_FIELDS, type SubsidiaryFormFieldKey } from '@/lib/subsidiary-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

export default async function SubsidiaryDetailPage({
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

  const fieldMetaById = buildFieldMetaById(SUBSIDIARY_FORM_FIELDS)

  const [Subsidiary, fieldOptions, formCustomization, formRequirements] = await Promise.all([
    prisma.subsidiary.findUnique({
      where: { id },
      include: {
        defaultCurrency: true,
        functionalCurrency: true,
        reportingCurrency: true,
        parentSubsidiary: true,
        childSubsidiaries: { orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } },
        employees: { orderBy: { lastName: 'asc' }, select: { id: true, firstName: true, lastName: true, title: true, email: true } },
        customers: { orderBy: { name: 'asc' }, select: { id: true, name: true, customerId: true } },
        vendors: { orderBy: { name: 'asc' }, select: { id: true, name: true, vendorNumber: true } },
        retainedEarningsAccount: { select: { id: true, accountId: true, name: true } },
        ctaAccount: { select: { id: true, accountId: true, name: true } },
        intercompanyClearingAccount: { select: { id: true, accountId: true, name: true } },
        dueToAccount: { select: { id: true, accountId: true, name: true } },
        dueFromAccount: { select: { id: true, accountId: true, name: true } },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, [
      'country',
      'defaultCurrencyId',
      'functionalCurrencyId',
      'reportingCurrencyId',
      'parentSubsidiaryId',
      'retainedEarningsAccountId',
      'ctaAccountId',
      'intercompanyClearingAccountId',
      'dueToAccountId',
      'dueFromAccountId',
      'inactive',
    ]),
    loadSubsidiaryFormCustomization(),
    loadFormRequirements(),
  ])

  if (!Subsidiary) notFound()

  const detailHref = `/subsidiaries/${Subsidiary.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity and operating name for the subsidiary.',
    Registration: 'Legal registration, country, and statutory identifiers.',
    Hierarchy: 'Parent-child relationships used for organization and consolidation.',
    Currency: 'Default, functional, and reporting currency settings.',
    Consolidation: 'Consolidation ownership and group reporting configuration.',
    Accounting: 'Default account mappings used for close and intercompany activity.',
    Status: 'Availability and active-state controls.',
  }

  const fieldDefinitions: Record<SubsidiaryFormFieldKey, InlineRecordSection['fields'][number]> = {
    subsidiaryId: { name: 'subsidiaryId', label: 'Subsidiary ID', value: Subsidiary.subsidiaryId, helpText: 'System-generated legal Subsidiary code.' },
    name: { name: 'name', label: 'Name', value: Subsidiary.name, helpText: 'Operating name of the subsidiary.' },
    legalName: { name: 'legalName', label: 'Legal Name', value: Subsidiary.legalName ?? '', helpText: 'Registered legal Subsidiary name.' },
    entityType: { name: 'entityType', label: 'Type', value: Subsidiary.entityType ?? '', helpText: 'Subsidiary classification such as corporation, LLC, or branch.' },
    country: {
      name: 'country',
      label: 'Country',
      value: Subsidiary.country ?? '',
      type: 'select',
      placeholder: 'Select country',
      options: fieldOptions.country ?? [],
      helpText: 'Country of registration or primary operation.',
      sourceText: getFieldSourceText(fieldMetaById, 'country'),
    },
    address: { name: 'address', label: 'Address', value: Subsidiary.address ?? '', type: 'address', helpText: 'Mailing or registered office address.' },
    taxId: { name: 'taxId', label: 'Tax ID', value: Subsidiary.taxId ?? '', helpText: 'Primary tax registration or identification number.' },
    registrationNumber: { name: 'registrationNumber', label: 'Registration Number', value: Subsidiary.registrationNumber ?? '', helpText: 'Corporate registration number where applicable.' },
    parentSubsidiaryId: {
      name: 'parentSubsidiaryId',
      label: 'Parent Subsidiary',
      value: Subsidiary.parentSubsidiaryId ?? '',
      type: 'select',
      placeholder: 'Select parent subsidiary',
      options: fieldOptions.parentSubsidiaryId ?? [],
      helpText: 'Parent Subsidiary used for hierarchy and consolidation.',
      sourceText: getFieldSourceText(fieldMetaById, 'parentSubsidiaryId'),
    },
    defaultCurrencyId: {
      name: 'defaultCurrencyId',
      label: 'Primary Currency',
      value: Subsidiary.defaultCurrencyId ?? '',
      type: 'select',
      placeholder: 'Select currency',
      options: fieldOptions.defaultCurrencyId ?? [],
      helpText: 'Default transaction currency for the subsidiary.',
      sourceText: getFieldSourceText(fieldMetaById, 'defaultCurrencyId'),
    },
    functionalCurrencyId: {
      name: 'functionalCurrencyId',
      label: 'Functional Currency',
      value: Subsidiary.functionalCurrencyId ?? '',
      type: 'select',
      placeholder: 'Select currency',
      options: fieldOptions.functionalCurrencyId ?? [],
      helpText: 'Currency of the primary economic environment.',
      sourceText: getFieldSourceText(fieldMetaById, 'functionalCurrencyId'),
    },
    reportingCurrencyId: {
      name: 'reportingCurrencyId',
      label: 'Reporting Currency',
      value: Subsidiary.reportingCurrencyId ?? '',
      type: 'select',
      placeholder: 'Select currency',
      options: fieldOptions.reportingCurrencyId ?? [],
      helpText: 'Currency used for group or reporting presentation.',
      sourceText: getFieldSourceText(fieldMetaById, 'reportingCurrencyId'),
    },
    consolidationMethod: { name: 'consolidationMethod', label: 'Consolidation Method', value: Subsidiary.consolidationMethod ?? '', helpText: 'How the Subsidiary is consolidated into group reporting.' },
    ownershipPercent: { name: 'ownershipPercent', label: 'Ownership Percent', value: Subsidiary.ownershipPercent?.toString() ?? '', type: 'number', helpText: 'Ownership percentage held in the subsidiary.' },
    retainedEarningsAccountId: {
      name: 'retainedEarningsAccountId',
      label: 'Retained Earnings Account',
      value: Subsidiary.retainedEarningsAccountId ?? '',
      type: 'select',
      placeholder: 'Select account',
      options: fieldOptions.retainedEarningsAccountId ?? [],
      helpText: 'Default retained earnings account for close activity.',
      sourceText: getFieldSourceText(fieldMetaById, 'retainedEarningsAccountId'),
    },
    ctaAccountId: {
      name: 'ctaAccountId',
      label: 'CTA Account',
      value: Subsidiary.ctaAccountId ?? '',
      type: 'select',
      placeholder: 'Select account',
      options: fieldOptions.ctaAccountId ?? [],
      helpText: 'Cumulative translation adjustment account.',
      sourceText: getFieldSourceText(fieldMetaById, 'ctaAccountId'),
    },
    intercompanyClearingAccountId: {
      name: 'intercompanyClearingAccountId',
      label: 'Intercompany Clearing Account',
      value: Subsidiary.intercompanyClearingAccountId ?? '',
      type: 'select',
      placeholder: 'Select account',
      options: fieldOptions.intercompanyClearingAccountId ?? [],
      helpText: 'Clearing account for intercompany activity.',
      sourceText: getFieldSourceText(fieldMetaById, 'intercompanyClearingAccountId'),
    },
    dueToAccountId: {
      name: 'dueToAccountId',
      label: 'Due To Account',
      value: Subsidiary.dueToAccountId ?? '',
      type: 'select',
      placeholder: 'Select account',
      options: fieldOptions.dueToAccountId ?? [],
      helpText: 'Default due-to intercompany account.',
      sourceText: getFieldSourceText(fieldMetaById, 'dueToAccountId'),
    },
    dueFromAccountId: {
      name: 'dueFromAccountId',
      label: 'Due From Account',
      value: Subsidiary.dueFromAccountId ?? '',
      type: 'select',
      placeholder: 'Select account',
      options: fieldOptions.dueFromAccountId ?? [],
      helpText: 'Default due-from intercompany account.',
      sourceText: getFieldSourceText(fieldMetaById, 'dueFromAccountId'),
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: String(!Subsidiary.active),
      type: 'select',
      options: fieldOptions.inactive ?? [],
      helpText: 'Marks the subsidiary unavailable for new activity while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(SUBSIDIARY_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: SUBSIDIARY_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'Subsidiary',
    entityId: Subsidiary.id,
    createdAt: Subsidiary.createdAt,
    updatedAt: Subsidiary.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'Subsidiary', entityId: Subsidiary.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/subsidiaries'}
      backLabel={isCustomizing ? '<- Back to Subsidiary Detail' : '<- Back to Subsidiaries'}
      meta={Subsidiary.subsidiaryId}
      title={Subsidiary.name}
      badge={
        Subsidiary.entityType ? (
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            {Subsidiary.entityType}
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
                form={`inline-record-form-${Subsidiary.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/subsidiaries/new" duplicateHref={`/subsidiaries/new?duplicateFrom=${Subsidiary.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={Subsidiary.name} fileName={`subsidiary-${Subsidiary.subsidiaryId}`} sections={detailSections} /> : null}
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
          {!isCustomizing ? <DeleteButton resource="subsidiaries" id={Subsidiary.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <SubsidiaryDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.subsidiaryCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="entities"
            id={Subsidiary.id}
            title="Subsidiary details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <RecordDetailSection title="Child Subsidiaries" count={Subsidiary.childSubsidiaries.length}>
          {Subsidiary.childSubsidiaries.length === 0 ? (
            <RecordDetailEmptyState message="No child subsidiaries" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Subsidiary ID</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {Subsidiary.childSubsidiaries.map((child) => (
                  <tr key={child.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/subsidiaries/${child.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {child.subsidiaryId}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{child.name}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>

        <RecordDetailSection title="Employees" count={Subsidiary.employees.length}>
          {Subsidiary.employees.length === 0 ? (
            <RecordDetailEmptyState message="No employees in this subsidiary" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Title</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Email</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {Subsidiary.employees.map((employee) => (
                  <tr key={employee.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/employees/${employee.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {employee.firstName} {employee.lastName}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{employee.title ?? '-'}</RecordDetailCell>
                    <RecordDetailCell>{employee.email ?? '-'}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>

        <RecordDetailSection title="Customers" count={Subsidiary.customers.length}>
          {Subsidiary.customers.length === 0 ? (
            <RecordDetailEmptyState message="No customers in this subsidiary" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Customer #</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {Subsidiary.customers.map((customer) => (
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

        <RecordDetailSection title="Vendors" count={Subsidiary.vendors.length}>
          {Subsidiary.vendors.length === 0 ? (
            <RecordDetailEmptyState message="No vendors in this subsidiary" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Vendor ID</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {Subsidiary.vendors.map((vendor) => (
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
