import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataHeaderDetails from '@/components/MasterDataHeaderDetails'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import { buildMasterDataSystemInformationItems } from '@/components/RecordSystemInformationSection'
import ChartOfAccountsDetailCustomizeMode from '@/components/ChartOfAccountsDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import CommunicationsSection from '@/components/CommunicationsSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import type { TransactionStatDefinition, TransactionVisualTone } from '@/lib/transaction-page-config'
import { loadChartOfAccountsFormCustomization } from '@/lib/chart-of-accounts-form-customization-store'
import {
  CHART_OF_ACCOUNTS_FORM_FIELDS,
  type ChartOfAccountsFormFieldKey,
} from '@/lib/chart-of-accounts-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

async function getDescendantSubsidiaryIds(parentId: string): Promise<Set<string>> {
  const descendants = new Set<string>([parentId])
  const queue = [parentId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const children = await prisma.subsidiary.findMany({
      where: { parentSubsidiaryId: current },
      select: { id: true },
    })

    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id)
        queue.push(child.id)
      }
    }
  }

  return descendants
}

async function getDescendantSubsidiaryIdsForParents(parentIds: string[]): Promise<Set<string>> {
  const descendants = new Set<string>()

  for (const parentId of parentIds) {
    const childIds = await getDescendantSubsidiaryIds(parentId)
    for (const childId of childIds) descendants.add(childId)
  }

  return descendants
}

export default async function ChartOfAccountDetailPage({
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
  const fieldMetaById = buildFieldMetaById(CHART_OF_ACCOUNTS_FORM_FIELDS)

  const [account, fieldOptions, chartFormCustomization, formRequirements] = await Promise.all([
    prisma.chartOfAccounts.findUnique({
      where: { id },
      include: {
        parentSubsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        parentAccount: { select: { id: true, accountId: true, name: true } },
        closeToAccount: { select: { id: true, accountId: true, name: true } },
        subsidiaryAssignments: {
          include: { subsidiary: { select: { id: true, subsidiaryId: true, name: true } } },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, ['accountType', 'normalBalance', 'financialStatementCategory', 'accountRole', 'rollforwardCategory']),
    loadChartOfAccountsFormCustomization(),
    loadFormRequirements(),
  ])

  if (!account) notFound()

  const selectedSubsidiaryIds = account.parentSubsidiaryId
    ? [account.parentSubsidiaryId]
    : account.subsidiaryAssignments.map((entry) => entry.subsidiaryId)
  const scopedSubsidiaryIds = account.includeChildren
    ? Array.from(await getDescendantSubsidiaryIdsForParents(selectedSubsidiaryIds))
    : selectedSubsidiaryIds

  const [subsidiaries, allSubsidiaries] = await Promise.all([
    prisma.subsidiary.findMany({
      where: { id: { in: scopedSubsidiaryIds } },
      select: { id: true, subsidiaryId: true, name: true },
      orderBy: { subsidiaryId: 'asc' },
    }),
    prisma.subsidiary.findMany({
      select: { id: true, subsidiaryId: true, name: true },
      orderBy: { subsidiaryId: 'asc' },
    }),
  ])
  const childAccountCount = await prisma.chartOfAccounts.count({
    where: { parentAccountId: account.id },
  })

  const accountOptions = await prisma.chartOfAccounts.findMany({
    where: { NOT: { id } },
    orderBy: { accountId: 'asc' },
    select: { id: true, accountId: true, accountNumber: true, name: true },
  })

  const detailHref = `/chart-of-accounts/${account.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Identity and primary classification for the GL account.',
    Reporting: 'Statement mapping and reporting defaults used for financial presentation.',
    Structure: 'Rollup and relationship fields that shape how the account behaves in hierarchies and close logic.',
    Controls: 'Posting, control, inventory, and elimination behavior for operational accounting.',
  }

  const fieldDefinitions: Record<ChartOfAccountsFormFieldKey, InlineRecordSection['fields'][number]> = {
    accountId: { name: 'accountId', label: 'Account Id', value: account.accountId, helpText: 'System-generated GL identifier used throughout the platform.' },
    accountNumber: { name: 'accountNumber', label: 'Account Number', value: account.accountNumber, helpText: 'Business-facing account number such as 1000 or 760.' },
    name: { name: 'name', label: 'Name', value: account.name, helpText: 'Reporting name for the account.' },
    description: { name: 'description', label: 'Description', value: account.description ?? '', helpText: 'Longer explanation of the account purpose or usage guidance.' },
    accountType: {
      name: 'accountType',
      label: 'Account Type',
      value: account.accountType,
      type: 'select',
      options: fieldOptions.accountType ?? [],
      helpText: 'Broad accounting classification for the account.',
      sourceText: getFieldSourceText(fieldMetaById, 'accountType'),
    },
    normalBalance: {
      name: 'normalBalance',
      label: 'Normal Balance',
      value: account.normalBalance ?? '',
      type: 'select',
      options: fieldOptions.normalBalance ?? [],
      helpText: 'Default debit or credit orientation for the account.',
      sourceText: getFieldSourceText(fieldMetaById, 'normalBalance'),
    },
    financialStatementSection: {
      name: 'financialStatementSection',
      label: 'FS Section',
      value: account.financialStatementSection ?? '',
      helpText: 'Financial statement section used for rollups and presentation.',
    },
    financialStatementGroup: {
      name: 'financialStatementGroup',
      label: 'FS Group',
      value: account.financialStatementGroup ?? '',
      helpText: 'More granular reporting group under the statement section.',
    },
    financialStatementCategory: {
      name: 'financialStatementCategory',
      label: 'FS Category',
      value: account.financialStatementCategory ?? '',
      type: 'select',
      options: fieldOptions.financialStatementCategory ?? [],
      helpText: 'Detailed reporting category such as Cash, AR, Inventory, AP, or FX.',
      sourceText: getFieldSourceText(fieldMetaById, 'financialStatementCategory'),
    },
    accountRole: {
      name: 'accountRole',
      label: 'Account Role',
      value: account.accountRole ?? '',
      type: 'select',
      options: fieldOptions.accountRole ?? [],
      helpText: 'Operational role used for shared dropdown filters, defaults, and system account selection.',
      sourceText: getFieldSourceText(fieldMetaById, 'accountRole'),
    },
    rollforwardCategory: {
      name: 'rollforwardCategory',
      label: 'Rollforward Category',
      value: account.rollforwardCategory ?? '',
      type: 'select',
      options: fieldOptions.rollforwardCategory ?? [],
      helpText: 'Controlled rollforward grouping used for downstream balance movement reporting.',
      sourceText: getFieldSourceText(fieldMetaById, 'rollforwardCategory'),
    },
    subsidiaryIds: {
      name: 'subsidiaryIds',
      label: 'Subsidiaries',
      value: selectedSubsidiaryIds.join(','),
      type: 'select',
      multiple: true,
      placeholder: 'Select subsidiaries',
      options: allSubsidiaries.map((subsidiary) => ({ value: subsidiary.id, label: `${subsidiary.subsidiaryId} - ${subsidiary.name}` })),
      helpText: 'Subsidiaries where this GL account is available.',
      sourceText: getFieldSourceText(fieldMetaById, 'subsidiaryIds'),
    },
    includeChildren: {
      name: 'includeChildren',
      label: 'Include Children',
      value: String(account.includeChildren),
      type: 'checkbox',
      placeholder: 'Include Children',
      helpText: 'If enabled, child subsidiaries under selected subsidiaries also inherit account availability.',
    },
    parentAccountId: {
      name: 'parentAccountId',
      label: 'Parent Account',
      value: account.parentAccountId ?? '',
      type: 'select',
      placeholder: 'Select parent account',
      options: accountOptions.map((option) => ({ value: option.id, label: `${option.accountId} - ${option.accountNumber} - ${option.name}` })),
      helpText: 'Rollup parent for hierarchical reporting.',
      sourceText: getFieldSourceText(fieldMetaById, 'parentAccountId'),
    },
    closeToAccountId: {
      name: 'closeToAccountId',
      label: 'Close To Account',
      value: account.closeToAccountId ?? '',
      type: 'select',
      placeholder: 'Select close-to account',
      options: accountOptions.map((option) => ({ value: option.id, label: `${option.accountId} - ${option.accountNumber} - ${option.name}` })),
      helpText: 'Target account used when closing temporary balances.',
      sourceText: getFieldSourceText(fieldMetaById, 'closeToAccountId'),
    },
    isPosting: { name: 'isPosting', label: 'Posting Account', value: String(account.isPosting), type: 'checkbox', helpText: 'Controls whether journals can post directly to this account.' },
    isControlAccount: { name: 'isControlAccount', label: 'Control Account', value: String(account.isControlAccount), type: 'checkbox', helpText: 'Marks accounts managed primarily by subledgers or protected processes.' },
    allowsManualPosting: { name: 'allowsManualPosting', label: 'Allow Manual Posting', value: String(account.allowsManualPosting), type: 'checkbox', helpText: 'Determines whether users can manually post journals to this account.' },
    requiresSubledgerType: { name: 'requiresSubledgerType', label: 'Requires Subledger Type', value: account.requiresSubledgerType ?? '', helpText: 'Optional validation hint for the related subledger dimension.' },
    cashFlowCategory: { name: 'cashFlowCategory', label: 'Cash Flow Category', value: account.cashFlowCategory ?? '', helpText: 'Classification used for operating, investing, or financing cash flow reporting.' },
    inventory: { name: 'inventory', label: 'Inventory', value: String(account.inventory), type: 'checkbox', helpText: 'Flags the account as inventory-related for downstream logic and reporting.' },
    revalueOpenBalance: { name: 'revalueOpenBalance', label: 'Revalue Open Balance', value: String(account.revalueOpenBalance), type: 'checkbox', helpText: 'Controls whether open balances are revalued for FX processes.' },
    eliminateIntercoTransactions: { name: 'eliminateIntercoTransactions', label: 'Eliminate Interco Transactions', value: String(account.eliminateIntercoTransactions), type: 'checkbox', helpText: 'Marks the account for intercompany elimination handling.' },
    summary: { name: 'summary', label: 'Summary', value: String(account.summary), type: 'checkbox', helpText: 'Indicates a header or summary account rather than a direct posting account.' },
  }

  const customizeFields = buildCustomizePreviewFields(CHART_OF_ACCOUNTS_FORM_FIELDS, fieldDefinitions)
  const postingStatus = account.isPosting ? 'Posting' : 'Non-Posting'
  const summaryStatus = account.summary ? 'Summary' : 'Detail'
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
    { id: 'subsidiaries', label: 'Subsidiaries', value: subsidiaries.length, cardTone: 'accent', valueTone: 'accent', supportsColorized: true, supportsLink: false },
    { id: 'childAccounts', label: 'Child Accounts', value: childAccountCount, accent: 'teal', cardTone: 'teal', valueTone: 'teal', supportsColorized: true, supportsLink: false },
    { id: 'posting', label: 'Posting', value: postingStatus, accent: 'yellow', cardTone: account.isPosting ? 'yellow' : 'default', valueTone: account.isPosting ? 'yellow' : 'default', supportsColorized: true, supportsLink: false },
    { id: 'summary', label: 'Summary', value: summaryStatus, cardTone: account.summary ? 'green' : 'default', valueTone: account.summary ? 'green' : 'default', supportsColorized: true, supportsLink: false },
  ]
  const statDefinitions: Array<TransactionStatDefinition<typeof account>> = [
    { id: 'subsidiaries', label: 'Subsidiaries', getValue: () => subsidiaries.length, getCardTone: () => 'accent', getValueTone: () => 'accent' },
    { id: 'childAccounts', label: 'Child Accounts', getValue: () => childAccountCount, accent: 'teal', getCardTone: () => 'teal', getValueTone: () => 'teal' },
    { id: 'posting', label: 'Posting', getValue: () => postingStatus, accent: 'yellow', getCardTone: () => (account.isPosting ? 'yellow' : 'default'), getValueTone: () => (account.isPosting ? 'yellow' : 'default') },
    { id: 'summary', label: 'Summary', getValue: () => summaryStatus, getCardTone: () => (account.summary ? 'green' : 'default'), getValueTone: () => (account.summary ? 'green' : 'default') },
  ]
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: CHART_OF_ACCOUNTS_FORM_FIELDS,
    layout: chartFormCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'chart-of-account',
    entityId: account.id,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'chart-of-account', entityId: account.id })
  const relatedRecordsTabs = [
    {
      key: 'subsidiaries',
      label: 'Subsidiaries',
      count: subsidiaries.length,
      emptyMessage: 'No subsidiaries are in scope for this account.',
      rows: subsidiaries.map((subsidiary) => ({
        id: subsidiary.id,
        type: 'Subsidiary',
        reference: subsidiary.subsidiaryId,
        name: subsidiary.name,
        details: 'Account Scope',
        href: `/subsidiaries/${subsidiary.id}`,
      })),
    },
    {
      key: 'account-links',
      label: 'Account Links',
      count: [account.parentAccount, account.closeToAccount, account.parentSubsidiary].filter(Boolean).length,
      emptyMessage: 'No linked account records are set for this account.',
      rows: [
        ...(account.parentAccount
          ? [{
              id: account.parentAccount.id,
              type: 'GL Account',
              reference: account.parentAccount.accountId,
              name: account.parentAccount.name,
              details: 'Parent Account',
              href: `/chart-of-accounts/${account.parentAccount.id}`,
            }]
          : []),
        ...(account.closeToAccount
          ? [{
              id: account.closeToAccount.id,
              type: 'GL Account',
              reference: account.closeToAccount.accountId,
              name: account.closeToAccount.name,
              details: 'Close To Account',
              href: `/chart-of-accounts/${account.closeToAccount.id}`,
            }]
          : []),
        ...(account.parentSubsidiary
          ? [{
              id: account.parentSubsidiary.id,
              type: 'Subsidiary',
              reference: account.parentSubsidiary.subsidiaryId,
              name: account.parentSubsidiary.name,
              details: 'Parent Subsidiary',
              href: `/subsidiaries/${account.parentSubsidiary.id}`,
            }]
          : []),
      ],
    },
  ]
  const communicationsToolbarTargetId = 'chart-of-accounts-communications-toolbar'
  const systemNotesToolbarTargetId = 'chart-of-accounts-system-notes-toolbar'

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/chart-of-accounts'}
      backLabel={isCustomizing ? '<- Back to Chart of Accounts Detail' : '<- Back to Chart of Accounts'}
      meta={account.accountId}
      title={account.name}
      badge={
        <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
          {account.accountType}
        </span>
      }
      actions={
        isCustomizing ? null : (
          <RecordDetailActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={`inline-record-form-${account.id}`}
            newHref="/chart-of-accounts/new"
            duplicateHref={`/chart-of-accounts/new?duplicateFrom=${account.id}`}
            exportTitle={account.name}
            exportFileName={`gl-account-${account.accountId}`}
            exportSections={detailSections}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="chart-of-accounts"
            deleteId={account.id}
          />
        )
      }
    >
        {!isCustomizing ? (
          <div className="mb-8">
            <TransactionStatsRow
              record={account}
              stats={statDefinitions}
              visibleStatCards={chartFormCustomization.statCards as Array<{ id: string; metric: string; visible: boolean; order: number; size?: 'sm' | 'md' | 'lg'; colorized?: boolean; linked?: boolean }> | undefined}
            />
          </div>
        ) : null}

        {isCustomizing ? (
          <ChartOfAccountsDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={chartFormCustomization}
            initialRequirements={{ ...formRequirements.chartOfAccountCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
            statPreviewCards={statPreviewCards}
          />
        ) : (
          <MasterDataHeaderDetails
            resource="chart-of-accounts"
            id={account.id}
            title="Chart Of Accounts Details"
            sections={detailSections}
            editing={isEditing}
            columns={chartFormCustomization.formColumns}
            systemInformationItems={buildMasterDataSystemInformationItems(systemInfo, account.id)}
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
