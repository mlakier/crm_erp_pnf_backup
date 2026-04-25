import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import ChartOfAccountsDetailCustomizeMode from '@/components/ChartOfAccountsDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
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
    loadFieldOptionsMap(fieldMetaById, ['accountType', 'normalBalance', 'financialStatementCategory']),
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
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link
                href={detailHref}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${account.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/chart-of-accounts/new" duplicateHref={`/chart-of-accounts/new?duplicateFrom=${account.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={account.name} fileName={`gl-account-${account.accountId}`} sections={detailSections} /> : null}
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
          {!isCustomizing ? <DeleteButton resource="chart-of-accounts" id={account.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <ChartOfAccountsDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={chartFormCustomization}
            initialRequirements={{ ...formRequirements.chartOfAccountCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="chart-of-accounts"
            id={account.id}
            title="Account details"
            sections={detailSections}
            editing={isEditing}
            columns={chartFormCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <RecordDetailSection title="Subsidiaries in Scope" count={subsidiaries.length}>
          {subsidiaries.length === 0 ? (
            <RecordDetailEmptyState message="No subsidiaries assigned." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Subsidiary Id</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {subsidiaries.map((subsidiary, index) => (
                  <tr key={subsidiary.id} style={index < subsidiaries.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <RecordDetailCell>{subsidiary.subsidiaryId}</RecordDetailCell>
                    <RecordDetailCell>{subsidiary.name}</RecordDetailCell>
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
