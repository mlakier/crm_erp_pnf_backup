import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import AccountingPeriodDetailCustomizeMode from '@/components/AccountingPeriodDetailCustomizeMode'
import MasterDataActionBar from '@/components/MasterDataActionBar'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
  RecordDetailStatCard,
} from '@/components/RecordDetailPanels'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadAccountingPeriodFormCustomization } from '@/lib/accounting-period-form-customization-store'
import { ACCOUNTING_PERIOD_FORM_FIELDS, type AccountingPeriodFormFieldKey } from '@/lib/accounting-period-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

export default async function AccountingPeriodDetailPage({
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
  const fieldMetaById = buildFieldMetaById(ACCOUNTING_PERIOD_FORM_FIELDS)

  const [period, fieldOptions, customization, formRequirements] = await Promise.all([
    prisma.accountingPeriod.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        journalEntries: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, number: true, date: true, status: true, description: true, total: true },
        },
        _count: { select: { journalEntries: true } },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, ['subsidiaryId', 'status']),
    loadAccountingPeriodFormCustomization(),
    loadFormRequirements(),
  ])

  if (!period) notFound()

  const detailHref = `/accounting-periods/${period.id}`
  const statusOptions = (fieldOptions.status ?? []).map((option) => ({
    value: option.value.toLowerCase(),
    label: option.label,
  }))
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary period identity, dates, and scope.',
    Controls: 'Period-close and subledger control settings.',
  }

  const fieldDefinitions: Record<AccountingPeriodFormFieldKey, InlineRecordSection['fields'][number]> = {
    name: { name: 'name', label: 'Name', value: period.name, helpText: 'Display name for the accounting period.' },
    startDate: { name: 'startDate', label: 'Start Date', value: new Date(period.startDate).toISOString().slice(0, 10), type: 'date', helpText: 'First date included in the accounting period.' },
    endDate: { name: 'endDate', label: 'End Date', value: new Date(period.endDate).toISOString().slice(0, 10), type: 'date', helpText: 'Last date included in the accounting period.' },
    subsidiaryId: {
      name: 'subsidiaryId',
      label: 'Subsidiary',
      value: period.subsidiaryId ?? '',
      type: 'select',
      options: fieldOptions.subsidiaryId ?? [],
      helpText: 'Optional subsidiary scope for the accounting period.',
      sourceText: getFieldSourceText(fieldMetaById, 'subsidiaryId'),
    },
    status: {
      name: 'status',
      label: 'Status',
      value: period.status,
      type: 'select',
      options: statusOptions,
      helpText: 'Operational status of the period.',
      sourceText: getFieldSourceText(fieldMetaById, 'status'),
    },
    closed: { name: 'closed', label: 'Closed', value: String(period.closed), type: 'checkbox', helpText: 'Marks the period closed for posting.' },
    arLocked: { name: 'arLocked', label: 'AR Locked', value: String(period.arLocked), type: 'checkbox', helpText: 'Prevents new AR activity in the period.' },
    apLocked: { name: 'apLocked', label: 'AP Locked', value: String(period.apLocked), type: 'checkbox', helpText: 'Prevents new AP activity in the period.' },
    inventoryLocked: { name: 'inventoryLocked', label: 'Inventory Locked', value: String(period.inventoryLocked), type: 'checkbox', helpText: 'Prevents inventory postings in the period.' },
  }

  const customizeFields = buildCustomizePreviewFields(ACCOUNTING_PERIOD_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: ACCOUNTING_PERIOD_FORM_FIELDS,
    layout: customization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'accounting-period',
    entityId: period.id,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'accounting-period', entityId: period.id })
  const activeLocks = [period.arLocked, period.apLocked, period.inventoryLocked].filter(Boolean).length
  const statusLabel = statusOptions.find((option) => option.value === period.status)?.label ?? period.status

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/accounting-periods'}
      backLabel={isCustomizing ? '<- Back to Accounting Period Detail' : '<- Back to Accounting Periods'}
      meta={period.subsidiary ? period.subsidiary.subsidiaryId : 'Global'}
      title={period.name}
      badge={
        <span
          className="inline-block rounded-full px-3 py-0.5 text-sm"
          style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
        >
          {statusLabel}
        </span>
      }
      actions={
        !isCustomizing ? (
          <MasterDataActionBar
            mode={isEditing ? 'edit' : 'detail'}
            detailHref={detailHref}
            formId={`inline-record-form-${period.id}`}
            newHref="/accounting-periods/new"
            duplicateHref={`/accounting-periods/new?duplicateFrom=${period.id}`}
            customizeHref={`${detailHref}?customize=1`}
            editHref={`${detailHref}?edit=1`}
            deleteResource="accounting-periods"
            deleteId={period.id}
            deleteLabel={period.name}
            exportTitle={period.name}
            exportFileName={`accounting-period-${period.name}`}
            exportSections={detailSections}
          />
        ) : null
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <RecordDetailStatCard label="Journal Entries" value={period._count.journalEntries} />
        <RecordDetailStatCard label="Closed" value={yesNo(period.closed)} />
        <RecordDetailStatCard label="Locked Areas" value={activeLocks} />
      </div>

      {isCustomizing ? (
        <AccountingPeriodDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={customization}
          initialRequirements={{ ...formRequirements.accountingPeriodCreate }}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
        />
      ) : (
        <InlineRecordDetails
          resource="accounting-periods"
          id={period.id}
          title="Accounting period details"
          sections={detailSections}
          editing={isEditing}
          columns={customization.formColumns}
          showInternalActions={false}
        />
      )}

      {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

      <RecordDetailSection title="Journals" count={period.journalEntries.length}>
        {period.journalEntries.length === 0 ? (
          <RecordDetailEmptyState message="No journals in this accounting period" />
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Journal</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Total</RecordDetailHeaderCell>
              </tr>
            </thead>
            <tbody>
              {period.journalEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <RecordDetailCell>
                    <Link href={`/journals/${entry.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {entry.number}
                    </Link>
                  </RecordDetailCell>
                  <RecordDetailCell>{new Date(entry.date).toLocaleDateString()}</RecordDetailCell>
                  <RecordDetailCell>{entry.status}</RecordDetailCell>
                  <RecordDetailCell>{entry.description || '-'}</RecordDetailCell>
                  <RecordDetailCell>{Number(entry.total).toFixed(2)}</RecordDetailCell>
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
