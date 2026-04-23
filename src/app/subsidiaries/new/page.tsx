import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import SubsidiaryCreateForm from '@/components/SubsidiaryCreateForm'
import { generateNextSubsidiaryCode } from '@/lib/subsidiary-code'
import { loadListOptionsForSource } from '@/lib/list-source'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadSubsidiaryFormCustomization } from '@/lib/subsidiary-form-customization-store'

export default async function NewSubsidiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [currencies, glAccounts, parentEntities, countryOptions, inactiveOptions, formCustomization, formRequirements, nextEntityCode, duplicateEntity] = await Promise.all([
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    prisma.chartOfAccounts.findMany({ where: { active: true }, orderBy: { accountId: 'asc' }, select: { id: true, accountId: true, name: true } }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'countries' }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadSubsidiaryFormCustomization(),
    loadFormRequirements(),
    generateNextSubsidiaryCode(),
    duplicateFrom
      ? prisma.subsidiary.findUnique({ where: { id: duplicateFrom } })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/subsidiaries" backLabel="<- Back to Subsidiaries" title="New Subsidiary" formId="create-subsidiary-form">
      <SubsidiaryCreateForm
        formId="create-subsidiary-form"
        showFooterActions={false}
        redirectBasePath="/subsidiaries"
        currencies={currencies}
        glAccounts={glAccounts}
        parentEntities={parentEntities}
        countryOptions={countryOptions}
        inactiveOptions={inactiveOptions}
        initialSubsidiaryId={nextEntityCode}
        initialLayoutConfig={formCustomization}
        initialRequirements={{ ...formRequirements.subsidiaryCreate }}
        sectionDescriptions={{
          Core: 'Primary identity and operating name for the subsidiary.',
          Registration: 'Legal registration, country, and statutory identifiers.',
          Hierarchy: 'Parent-child relationships used for organization and consolidation.',
          Currency: 'Default, functional, and reporting currency settings.',
          Consolidation: 'Consolidation ownership and group reporting configuration.',
          Accounting: 'Default account mappings used for close and intercompany activity.',
          Status: 'Availability and active-state controls.',
        }}
        initialValues={duplicateEntity ? {
          name: `Copy of ${duplicateEntity.name}`,
          legalName: duplicateEntity.legalName ? `Copy of ${duplicateEntity.legalName}` : '',
          entityType: duplicateEntity.entityType,
          country: duplicateEntity.country,
          taxId: duplicateEntity.taxId,
          registrationNumber: duplicateEntity.registrationNumber,
          address: duplicateEntity.address,
          defaultCurrencyId: duplicateEntity.defaultCurrencyId,
          functionalCurrencyId: duplicateEntity.functionalCurrencyId,
          reportingCurrencyId: duplicateEntity.reportingCurrencyId,
          parentSubsidiaryId: duplicateEntity.parentSubsidiaryId,
          consolidationMethod: duplicateEntity.consolidationMethod,
          ownershipPercent: duplicateEntity.ownershipPercent != null ? String(duplicateEntity.ownershipPercent) : '',
          retainedEarningsAccountId: duplicateEntity.retainedEarningsAccountId,
          ctaAccountId: duplicateEntity.ctaAccountId,
          intercompanyClearingAccountId: duplicateEntity.intercompanyClearingAccountId,
          dueToAccountId: duplicateEntity.dueToAccountId,
          dueFromAccountId: duplicateEntity.dueFromAccountId,
          inactive: !duplicateEntity.active,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
