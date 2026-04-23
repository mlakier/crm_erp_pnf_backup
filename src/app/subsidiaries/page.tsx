import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { resolveCompanyPageLogo } from '@/lib/company-page-logo'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import SubsidiaryHierarchyModal from '@/components/SubsidiaryHierarchyModal'
import { SUBSIDIARY_FORM_FIELDS } from '@/lib/subsidiary-form-customization'
import { loadSubsidiaryFormCustomization } from '@/lib/subsidiary-form-customization-store'
import { subsidiaryListDefinition } from '@/lib/master-data-list-definitions'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

type SubsidiaryHierarchyEntity = {
  id: string
  subsidiaryId: string
  name: string
  country: string | null
  entityType: string | null
  taxId: string | null
  parentSubsidiaryId: string | null
}

export default async function SubsidiariesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT

  const where = query
    ? { OR: [{ subsidiaryId: { contains: query, mode: 'insensitive' as const } }, { name: { contains: query, mode: 'insensitive' as const } }] }
    : {}

  const total = await prisma.subsidiary.count({ where })
  const pagination = getPagination(total, params.page)
  const fieldMetaById = buildFieldMetaById(SUBSIDIARY_FORM_FIELDS)

  const [entities, currencies, glAccounts, allEntities, companySettings, cabinetFiles, fieldOptions, formCustomization] = await Promise.all([
    prisma.subsidiary.findMany({
      where,
      include: { defaultCurrency: true, functionalCurrency: true, reportingCurrency: true, parentSubsidiary: true },
      orderBy:
        sort === 'id'
          ? [{ subsidiaryId: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
    prisma.chartOfAccounts.findMany({ where: { active: true }, orderBy: { accountId: 'asc' }, select: { id: true, accountId: true, name: true } }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true, country: true, entityType: true, taxId: true, parentSubsidiaryId: true },
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadFieldOptionsMap(fieldMetaById, ['country', 'inactive']),
    loadSubsidiaryFormCustomization(),
  ])
  const countryOptions = fieldOptions.country ?? []
  const inactiveOptions = fieldOptions.inactive ?? []
  const hierarchyEntities: SubsidiaryHierarchyEntity[] = allEntities

  const companyLogoPages = resolveCompanyPageLogo(companySettings, cabinetFiles)

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Subsidiaries"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/subsidiaries/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Subsidiary
          </Link>
        }
      />

      <SubsidiaryHierarchyModal
        entities={hierarchyEntities}
        logoUrl={companyLogoPages?.url}
        title={companySettings.companyName ? `${companySettings.companyName} Group of Companies` : 'Group of Companies'}
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={subsidiaryListDefinition.searchPlaceholder}
        tableId={subsidiaryListDefinition.tableId}
        exportFileName={subsidiaryListDefinition.exportFileName}
        columns={subsidiaryListDefinition.columns}
        sort={sort}
        sortOptions={subsidiaryListDefinition.sortOptions}
        compactExport={subsidiaryListDefinition.compactExport}
        tableContainerId="subsidiaries-list-scroll"
      >
        <table className="min-w-[1600px] w-full" id={subsidiaryListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="subsidiary-id" className="sticky top-0 left-0 z-20 w-36 min-w-36 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Subsidiary Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name" className="sticky top-0 z-20 w-64 min-w-64 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ left: '9rem', color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="country">Country</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="address">Address</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="tax-id">Tax ID</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="parent-subsidiary">Parent Subsidiary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="legal-name">Legal Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="type">Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="default-currency">Primary Currency</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="functional-currency">Functional Currency</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="reporting-currency">Reporting Currency</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="consolidation-method">Consolidation Method</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="ownership-percent">Ownership %</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {entities.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={subsidiaryListDefinition.columns.length}>No subsidiaries found</MasterDataEmptyStateRow>
            ) : (
              entities.map((Subsidiary, index) => (
                <tr key={Subsidiary.id} style={getMasterDataRowStyle(index, entities.length)}>
                  <MasterDataBodyCell columnId="subsidiary-id" className="sticky left-0 z-10 w-36 min-w-36 px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--card)' }}>
                    <Link href={`/subsidiaries/${Subsidiary.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {Subsidiary.subsidiaryId}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="name" className="sticky z-10 w-64 min-w-64 max-w-64 overflow-hidden text-ellipsis px-4 py-2 text-sm" style={{ left: '9rem', backgroundColor: 'var(--card)' }}>{Subsidiary.name}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="country">{Subsidiary.country ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="address">{Subsidiary.address ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="tax-id">{Subsidiary.taxId ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="parent-subsidiary">{Subsidiary.parentSubsidiary ? `${Subsidiary.parentSubsidiary.subsidiaryId} - ${Subsidiary.parentSubsidiary.name}` : '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="legal-name">{Subsidiary.legalName ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="type">{Subsidiary.entityType ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="default-currency">{Subsidiary.defaultCurrency?.code ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="functional-currency">{Subsidiary.functionalCurrency?.code ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="reporting-currency">{Subsidiary.reportingCurrency?.code ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="consolidation-method">{Subsidiary.consolidationMethod ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="ownership-percent">{Subsidiary.ownershipPercent?.toString() ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="inactive">{Subsidiary.active ? 'No' : 'Yes'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="created">{formatMasterDataDate(Subsidiary.createdAt)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(Subsidiary.updatedAt)}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <div className="flex items-center gap-2">
                      <EditButton
                        resource="subsidiaries"
                        id={Subsidiary.id}
                        fields={[
                          ...(formCustomization.fields.subsidiaryId.visible ? [{ name: 'subsidiaryId', label: 'Subsidiary ID', value: Subsidiary.subsidiaryId }] : []),
                          ...(formCustomization.fields.name.visible ? [{ name: 'name', label: 'Name', value: Subsidiary.name }] : []),
                          ...(formCustomization.fields.legalName.visible ? [{ name: 'legalName', label: 'Legal Name', value: Subsidiary.legalName ?? '' }] : []),
                          ...(formCustomization.fields.entityType.visible ? [{ name: 'entityType', label: 'Type', value: Subsidiary.entityType ?? '' }] : []),
                          ...(formCustomization.fields.country.visible ? [{
                              name: 'country',
                              label: 'Country',
                              value: Subsidiary.country ?? '',
                              type: 'select' as const,
                              placeholder: 'Select country',
                              options: countryOptions,
                            }] : []),
                          ...(formCustomization.fields.address.visible ? [{ name: 'address', label: 'Address', value: Subsidiary.address ?? '', type: 'address' as const }] : []),
                          ...(formCustomization.fields.taxId.visible ? [{ name: 'taxId', label: 'Tax ID', value: Subsidiary.taxId ?? '' }] : []),
                          ...(formCustomization.fields.registrationNumber.visible ? [{ name: 'registrationNumber', label: 'Registration Number', value: Subsidiary.registrationNumber ?? '' }] : []),
                          ...(formCustomization.fields.parentSubsidiaryId.visible ? [{
                              name: 'parentSubsidiaryId',
                              label: 'Parent Subsidiary',
                              value: Subsidiary.parentSubsidiaryId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select parent subsidiary',
                              options: allEntities.filter((candidate) => candidate.id !== Subsidiary.id).map((candidate) => ({ value: candidate.id, label: `${candidate.subsidiaryId} - ${candidate.name}` })),
                            }] : []),
                          ...(formCustomization.fields.defaultCurrencyId.visible ? [{
                              name: 'defaultCurrencyId',
                              label: 'Primary Currency',
                              value: Subsidiary.defaultCurrencyId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select currency',
                              options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` })),
                            }] : []),
                          ...(formCustomization.fields.functionalCurrencyId.visible ? [{
                              name: 'functionalCurrencyId',
                              label: 'Functional Currency',
                              value: Subsidiary.functionalCurrencyId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select currency',
                              options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` })),
                            }] : []),
                          ...(formCustomization.fields.reportingCurrencyId.visible ? [{
                              name: 'reportingCurrencyId',
                              label: 'Reporting Currency',
                              value: Subsidiary.reportingCurrencyId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select currency',
                              options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` })),
                            }] : []),
                          ...(formCustomization.fields.consolidationMethod.visible ? [{ name: 'consolidationMethod', label: 'Consolidation Method', value: Subsidiary.consolidationMethod ?? '' }] : []),
                          ...(formCustomization.fields.ownershipPercent.visible ? [{ name: 'ownershipPercent', label: 'Ownership Percent', value: Subsidiary.ownershipPercent?.toString() ?? '', type: 'number' as const }] : []),
                          ...(formCustomization.fields.retainedEarningsAccountId.visible ? [{
                              name: 'retainedEarningsAccountId',
                              label: 'Retained Earnings Account',
                              value: Subsidiary.retainedEarningsAccountId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select account',
                              options: glAccounts.map((account) => ({ value: account.id, label: `${account.accountId} - ${account.name}` })),
                            }] : []),
                          ...(formCustomization.fields.ctaAccountId.visible ? [{
                              name: 'ctaAccountId',
                              label: 'CTA Account',
                              value: Subsidiary.ctaAccountId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select account',
                              options: glAccounts.map((account) => ({ value: account.id, label: `${account.accountId} - ${account.name}` })),
                            }] : []),
                          ...(formCustomization.fields.intercompanyClearingAccountId.visible ? [{
                              name: 'intercompanyClearingAccountId',
                              label: 'Intercompany Clearing Account',
                              value: Subsidiary.intercompanyClearingAccountId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select account',
                              options: glAccounts.map((account) => ({ value: account.id, label: `${account.accountId} - ${account.name}` })),
                            }] : []),
                          ...(formCustomization.fields.dueToAccountId.visible ? [{
                              name: 'dueToAccountId',
                              label: 'Due To Account',
                              value: Subsidiary.dueToAccountId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select account',
                              options: glAccounts.map((account) => ({ value: account.id, label: `${account.accountId} - ${account.name}` })),
                            }] : []),
                          ...(formCustomization.fields.dueFromAccountId.visible ? [{
                              name: 'dueFromAccountId',
                              label: 'Due From Account',
                              value: Subsidiary.dueFromAccountId ?? '',
                              type: 'select' as const,
                              placeholder: 'Select account',
                              options: glAccounts.map((account) => ({ value: account.id, label: `${account.accountId} - ${account.name}` })),
                            }] : []),
                          ...(formCustomization.fields.inactive.visible ? [{
                              name: 'inactive',
                              label: 'Inactive',
                              value: String(!Subsidiary.active),
                              type: 'select' as const,
                              options: inactiveOptions,
                            }] : []),
                        ]}
                      />
                      <DeleteButton resource="subsidiaries" id={Subsidiary.id} />
                    </div>
                  </MasterDataBodyCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </MasterDataListSection>
    </div>
  )
}
