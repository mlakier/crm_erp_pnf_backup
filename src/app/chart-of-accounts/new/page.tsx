import { prisma } from '@/lib/prisma'
import RecordCreateDetailPageClient from '@/components/RecordCreateDetailPageClient'
import { generateNextChartOfAccountId } from '@/lib/chart-of-account-id'
import { loadChartOfAccountsFormCustomization } from '@/lib/chart-of-accounts-form-customization-store'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { CHART_OF_ACCOUNTS_FORM_FIELDS, type ChartOfAccountsFormFieldKey } from '@/lib/chart-of-accounts-form-customization'
import { buildConfiguredInlineSections, buildCreateInlineFieldDefinitions } from '@/lib/detail-page-helpers'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'

const CHART_SECTION_DESCRIPTIONS: Record<string, string> = {
  Core: 'Primary identity, numbering, and account classification fields.',
  Reporting: 'Statement groupings and reporting attributes.',
  Structure: 'Subsidiary scope and rollup relationships.',
  Controls: 'Posting and control flags for account behavior.',
}

export default async function NewChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const fieldMetaById = buildFieldMetaById(CHART_OF_ACCOUNTS_FORM_FIELDS)
  const [formCustomization, formRequirements, nextAccountId, fieldOptions, duplicateAccount] = await Promise.all([
    loadChartOfAccountsFormCustomization(),
    loadFormRequirements(),
    generateNextChartOfAccountId(),
    loadFieldOptionsMap(fieldMetaById, [
      'accountType',
      'normalBalance',
      'financialStatementCategory',
      'accountRole',
      'rollforwardCategory',
      'subsidiaryIds',
      'parentAccountId',
      'closeToAccountId',
    ]),
    duplicateFrom
      ? prisma.chartOfAccounts.findUnique({
          where: { id: duplicateFrom },
          include: { subsidiaryAssignments: { select: { subsidiaryId: true } } },
        })
      : Promise.resolve(null),
  ])

  const initialValues: Partial<Record<ChartOfAccountsFormFieldKey, unknown>> = duplicateAccount
    ? {
        accountId: nextAccountId,
        accountNumber: '',
        name: `Copy of ${duplicateAccount.name}`,
        description: duplicateAccount.description,
        accountType: duplicateAccount.accountType,
        inventory: duplicateAccount.inventory,
        revalueOpenBalance: duplicateAccount.revalueOpenBalance,
        eliminateIntercoTransactions: duplicateAccount.eliminateIntercoTransactions,
        summary: duplicateAccount.summary,
        normalBalance: duplicateAccount.normalBalance,
        financialStatementSection: duplicateAccount.financialStatementSection,
        financialStatementGroup: duplicateAccount.financialStatementGroup,
        financialStatementCategory: duplicateAccount.financialStatementCategory,
        accountRole: duplicateAccount.accountRole,
        rollforwardCategory: duplicateAccount.rollforwardCategory,
        isPosting: duplicateAccount.isPosting,
        isControlAccount: duplicateAccount.isControlAccount,
        allowsManualPosting: duplicateAccount.allowsManualPosting,
        requiresSubledgerType: duplicateAccount.requiresSubledgerType,
        cashFlowCategory: duplicateAccount.cashFlowCategory,
        parentAccountId: duplicateAccount.parentAccountId,
        closeToAccountId: duplicateAccount.closeToAccountId,
        subsidiaryIds: duplicateAccount.parentSubsidiaryId
          ? [duplicateAccount.parentSubsidiaryId]
          : duplicateAccount.subsidiaryAssignments.map((assignment) => assignment.subsidiaryId),
        includeChildren: duplicateAccount.includeChildren,
      }
    : {
        accountId: nextAccountId,
        includeChildren: false,
        allowsManualPosting: true,
      }

  const fieldDefinitions = buildCreateInlineFieldDefinitions<ChartOfAccountsFormFieldKey, (typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]>({
    fields: CHART_OF_ACCOUNTS_FORM_FIELDS,
    initialValues,
    fieldOptions,
    requirements: formRequirements.chartOfAccountCreate,
    readOnlyFields: ['accountId'],
    generatedFieldLabels: ['accountId'],
    multipleFields: ['subsidiaryIds'],
  })

  const sections = buildConfiguredInlineSections({
    fields: CHART_OF_ACCOUNTS_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions: CHART_SECTION_DESCRIPTIONS,
  })

  return (
    <RecordCreateDetailPageClient
      resource="chart-of-accounts"
      backHref="/chart-of-accounts"
      backLabel="<- Back to Chart of Accounts"
      title="New Chart of Accounts"
      detailsTitle="Chart of accounts details"
      formId="create-chart-of-accounts-inline-form"
      sections={sections}
      formColumns={formCustomization.formColumns}
      createEndpoint="/api/chart-of-accounts"
      successRedirectBasePath="/chart-of-accounts"
      extraPayload={{ scopeMode: 'selected' }}
    />
  )
}
