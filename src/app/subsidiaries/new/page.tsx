import { prisma } from '@/lib/prisma'
import RecordCreateDetailPageClient from '@/components/RecordCreateDetailPageClient'
import { generateNextSubsidiaryCode } from '@/lib/subsidiary-code'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadSubsidiaryFormCustomization } from '@/lib/subsidiary-form-customization-store'
import { SUBSIDIARY_FORM_FIELDS, type SubsidiaryFormFieldKey } from '@/lib/subsidiary-form-customization'
import { buildConfiguredInlineSections, buildCreateInlineFieldDefinitions } from '@/lib/detail-page-helpers'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'

const SUBSIDIARY_SECTION_DESCRIPTIONS: Record<string, string> = {
  Core: 'Primary identity and operating name for the subsidiary.',
  Registration: 'Legal registration, country, and statutory identifiers.',
  Hierarchy: 'Parent-child relationships used for organization and consolidation.',
  Currency: 'Local, functional, and group currency settings.',
  Consolidation: 'Consolidation ownership and group reporting configuration.',
  Accounting: 'Default account mappings used for close and intercompany activity.',
  Status: 'Availability and active-state controls.',
}

export default async function NewSubsidiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const fieldMetaById = buildFieldMetaById(SUBSIDIARY_FORM_FIELDS)
  const [formCustomization, formRequirements, nextEntityCode, fieldOptions, duplicateEntity] = await Promise.all([
    loadSubsidiaryFormCustomization(),
    loadFormRequirements(),
    generateNextSubsidiaryCode(),
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
    duplicateFrom
      ? prisma.subsidiary.findUnique({ where: { id: duplicateFrom } })
      : Promise.resolve(null),
  ])

  const initialValues: Partial<Record<SubsidiaryFormFieldKey, unknown>> = duplicateEntity
    ? {
        subsidiaryId: nextEntityCode,
        name: `Copy of ${duplicateEntity.name}`,
        legalName: duplicateEntity.legalName ? `Copy of ${duplicateEntity.legalName}` : '',
        entityType: duplicateEntity.entityType,
        country: duplicateEntity.country,
        taxId: duplicateEntity.taxId,
        registrationNumber: duplicateEntity.registrationNumber,
        address: duplicateEntity.address,
        localCurrencyId: duplicateEntity.localCurrencyId,
        functionalCurrencyId: duplicateEntity.functionalCurrencyId,
        groupCurrencyId: duplicateEntity.groupCurrencyId,
        parentSubsidiaryId: duplicateEntity.parentSubsidiaryId,
        consolidationMethod: duplicateEntity.consolidationMethod,
        ownershipPercent: duplicateEntity.ownershipPercent != null ? String(duplicateEntity.ownershipPercent) : '',
        retainedEarningsAccountId: duplicateEntity.retainedEarningsAccountId,
        ctaAccountId: duplicateEntity.ctaAccountId,
        intercompanyClearingAccountId: duplicateEntity.intercompanyClearingAccountId,
        dueToAccountId: duplicateEntity.dueToAccountId,
        dueFromAccountId: duplicateEntity.dueFromAccountId,
        inactive: !duplicateEntity.active,
      }
    : {
        subsidiaryId: nextEntityCode,
        inactive: false,
      }

  const fieldDefinitions = buildCreateInlineFieldDefinitions<SubsidiaryFormFieldKey, (typeof SUBSIDIARY_FORM_FIELDS)[number]>({
    fields: SUBSIDIARY_FORM_FIELDS,
    initialValues,
    fieldOptions,
    requirements: formRequirements.subsidiaryCreate,
    readOnlyFields: ['subsidiaryId'],
    generatedFieldLabels: ['subsidiaryId'],
  })

  const sections = buildConfiguredInlineSections({
    fields: SUBSIDIARY_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions: SUBSIDIARY_SECTION_DESCRIPTIONS,
  })

  return (
    <RecordCreateDetailPageClient
      resource="subsidiaries"
      backHref="/subsidiaries"
      backLabel="<- Back to Subsidiaries"
      title="New Subsidiary"
      detailsTitle="Subsidiary details"
      formId="create-subsidiary-inline-form"
      sections={sections}
      formColumns={formCustomization.formColumns}
      createEndpoint="/api/subsidiaries"
      successRedirectBasePath="/subsidiaries"
    />
  )
}
