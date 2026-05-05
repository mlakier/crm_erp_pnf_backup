import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataHeaderDetails from '@/components/MasterDataHeaderDetails'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import { buildMasterDataSystemInformationItems } from '@/components/RecordSystemInformationSection'
import SubsidiaryDetailCustomizeMode from '@/components/SubsidiaryDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadSubsidiaryFormCustomization } from '@/lib/subsidiary-form-customization-store'
import { SUBSIDIARY_FORM_FIELDS, type SubsidiaryFormFieldKey } from '@/lib/subsidiary-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'

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
        localCurrency: true,
        functionalCurrency: true,
        groupCurrency: true,
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
      'localCurrencyId',
      'functionalCurrencyId',
      'groupCurrencyId',
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
  const formId = `inline-record-form-${Subsidiary.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity and operating name for the subsidiary.',
    Registration: 'Legal registration, country, and statutory identifiers.',
    Hierarchy: 'Parent-child relationships used for organization and consolidation.',
    Currency: 'Local, functional, and group currency settings.',
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
    localCurrencyId: {
      name: 'localCurrencyId',
      label: 'Local Currency',
      value: Subsidiary.localCurrencyId ?? '',
      type: 'select',
      placeholder: 'Select currency',
      options: fieldOptions.localCurrencyId ?? [],
      helpText: 'Local statutory currency used for the subsidiary’s primary books.',
      sourceText: getFieldSourceText(fieldMetaById, 'localCurrencyId'),
    },
    functionalCurrencyId: {
      name: 'functionalCurrencyId',
      label: 'Functional Currency',
      value: Subsidiary.functionalCurrencyId ?? '',
      type: 'select',
      placeholder: 'Select currency',
      options: fieldOptions.functionalCurrencyId ?? [],
      helpText: 'Currency of the primary economic environment. This may match the country’s local currency, but it can differ when the subsidiary mainly prices, funds, and operates in another currency.',
      sourceText: getFieldSourceText(fieldMetaById, 'functionalCurrencyId'),
    },
    groupCurrencyId: {
      name: 'groupCurrencyId',
      label: 'Group Currency',
      value: Subsidiary.groupCurrencyId ?? '',
      type: 'select',
      placeholder: 'Select currency',
      options: fieldOptions.groupCurrencyId ?? [],
      helpText: 'Currency used for consolidated group reporting and translation.',
      sourceText: getFieldSourceText(fieldMetaById, 'groupCurrencyId'),
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
  const statPreviewCards: Array<{
    id: string
    label: string
    value: string | number
    cardTone?: TransactionVisualTone
    valueTone?: TransactionVisualTone
    supportsColorized: boolean
    supportsLink: boolean
  }> = [
    { id: 'childSubsidiaries', label: 'Child Subsidiaries', value: Subsidiary.childSubsidiaries.length, cardTone: 'accent', valueTone: 'accent', supportsColorized: true, supportsLink: false },
    { id: 'employees', label: 'Employees', value: Subsidiary.employees.length, cardTone: 'teal', valueTone: 'teal', supportsColorized: true, supportsLink: false },
    { id: 'customers', label: 'Customers', value: Subsidiary.customers.length, cardTone: 'yellow', valueTone: 'yellow', supportsColorized: true, supportsLink: false },
    { id: 'vendors', label: 'Vendors', value: Subsidiary.vendors.length, cardTone: 'green', valueTone: 'green', supportsColorized: true, supportsLink: false },
  ]
  const statDefinitions: Array<TransactionStatDefinition<typeof Subsidiary>> = [
    { id: 'childSubsidiaries', label: 'Child Subsidiaries', getValue: () => Subsidiary.childSubsidiaries.length, getCardTone: () => 'accent', getValueTone: () => 'accent' },
    { id: 'employees', label: 'Employees', getValue: () => Subsidiary.employees.length, getCardTone: () => 'teal', getValueTone: () => 'teal' },
    { id: 'customers', label: 'Customers', getValue: () => Subsidiary.customers.length, getCardTone: () => 'yellow', getValueTone: () => 'yellow' },
    { id: 'vendors', label: 'Vendors', getValue: () => Subsidiary.vendors.length, getCardTone: () => 'green', getValueTone: () => 'green' },
  ]
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
  const relatedRecordsTabs = [
    {
      key: 'child-subsidiaries',
      label: 'Child Subsidiaries',
      count: Subsidiary.childSubsidiaries.length,
      emptyMessage: 'No child subsidiaries are linked to this subsidiary yet.',
      rows: Subsidiary.childSubsidiaries.map((child) => ({
        id: child.id,
        type: 'Subsidiary',
        reference: child.subsidiaryId,
        name: child.name,
        details: '-',
        href: `/subsidiaries/${child.id}`,
      })),
    },
    {
      key: 'employees',
      label: 'Employees',
      count: Subsidiary.employees.length,
      emptyMessage: 'No employees are linked to this subsidiary yet.',
      rows: Subsidiary.employees.map((employee) => ({
        id: employee.id,
        type: 'Employee',
        reference: employee.email ?? employee.id,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        details: [employee.title, employee.email].filter(Boolean).join(' | ') || '-',
        href: `/employees/${employee.id}`,
      })),
    },
    {
      key: 'customers',
      label: 'Customers',
      count: Subsidiary.customers.length,
      emptyMessage: 'No customers are linked to this subsidiary yet.',
      rows: Subsidiary.customers.map((customer) => ({
        id: customer.id,
        type: 'Customer',
        reference: customer.customerId ?? 'Pending',
        name: customer.name,
        details: '-',
        href: `/customers/${customer.id}`,
      })),
    },
    {
      key: 'vendors',
      label: 'Vendors',
      count: Subsidiary.vendors.length,
      emptyMessage: 'No vendors are linked to this subsidiary yet.',
      rows: Subsidiary.vendors.map((vendor) => ({
        id: vendor.id,
        type: 'Vendor',
        reference: vendor.vendorNumber ?? 'Pending',
        name: vendor.name,
        details: '-',
        href: `/vendors/${vendor.id}`,
      })),
    },
  ]
  const communicationsToolbarTargetId = 'subsidiary-communications-toolbar'
  const systemNotesToolbarTargetId = 'subsidiary-system-notes-toolbar'

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
        isCustomizing ? null : (
          <RecordDetailActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={formId}
            newHref="/subsidiaries/new"
            duplicateHref={`/subsidiaries/new?duplicateFrom=${Subsidiary.id}`}
            exportTitle={Subsidiary.name}
            exportFileName={`subsidiary-${Subsidiary.subsidiaryId}`}
            exportSections={detailSections}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="subsidiaries"
            deleteId={Subsidiary.id}
          />
        )
      }
    >
        {!isCustomizing ? (
          <div className="mb-8">
            <TransactionStatsRow
              record={Subsidiary}
              stats={statDefinitions}
              visibleStatCards={formCustomization.statCards as Array<{ id: string; metric: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg'; colorized?: boolean; linked?: boolean }> | undefined}
            />
          </div>
        ) : null}

        {isCustomizing ? (
          <SubsidiaryDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.subsidiaryCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
            statPreviewCards={statPreviewCards}
          />
        ) : (
          <MasterDataHeaderDetails
            resource="entities"
            id={Subsidiary.id}
            title="Subsidiary Details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            formId={formId}
            systemInformationItems={buildMasterDataSystemInformationItems(systemInfo, Subsidiary.id)}
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
