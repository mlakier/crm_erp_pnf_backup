'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import CommunicationsSection, { type CommunicationRow } from '@/components/CommunicationsSection'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderSection } from '@/components/PurchaseOrderHeaderSections'
import SystemNotesSection, { type SystemNoteRow } from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { fmtCurrency } from '@/lib/format'
import { moneyEquals, sumMoney } from '@/lib/money'
import type { MoneySettings } from '@/lib/company-preferences-definitions'
import JournalDetailCustomizeMode from '@/components/JournalDetailCustomizeMode'
import {
  JOURNAL_DETAIL_FIELDS,
  type JournalDetailCustomizationConfig,
} from '@/lib/journal-detail-customization'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
} from '@/lib/transaction-detail-helpers'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import { journalPageConfig } from '@/lib/transaction-page-configs/journal'

type EntityOption = { id: string; subsidiaryId: string; name: string }
type AccountOption = { id: string; accountId: string; name: string }
type DepartmentOption = { id: string; departmentId: string; name: string }
type LocationOption = { id: string; locationId: string; name: string }
type ProjectOption = { id: string; name: string }
type CustomerOption = { id: string; customerId: string | null; name: string }
type VendorOption = { id: string; vendorNumber: string | null; name: string }
type ItemOption = { id: string; itemId: string | null; name: string }
type CurrencyOption = { id: string; currencyId: string; code?: string; name: string }
type PeriodOption = { id: string; name: string }
type EmployeeOption = { id: string; employeeId: string | null; firstName: string; lastName: string }
type SelectOption = { value: string; label: string }

type JournalLineDraft = {
  key: string
  displayOrder: number
  accountId: string
  description: string
  debit: string
  credit: string
  memo: string
  subsidiaryId: string
  departmentId: string
  locationId: string
  projectId: string
  customerId: string
  vendorId: string
  itemId: string
  employeeId: string
}

type JournalEntryDetailClientProps = {
  mode: 'new' | 'detail'
  editing: boolean
  detailHref: string
  customizeHref?: string
  customizing?: boolean
  customization?: JournalDetailCustomizationConfig
  entryId?: string
  initialNumber: string
  initialHeaderValues: Record<string, string>
  initialLineItems: JournalLineDraft[]
  entities: EntityOption[]
  accounts: AccountOption[]
  departments: DepartmentOption[]
  locations: LocationOption[]
  projects: ProjectOption[]
  customers: CustomerOption[]
  vendors: VendorOption[]
  items: ItemOption[]
  currencies: CurrencyOption[]
  accountingPeriods: PeriodOption[]
  employees: EmployeeOption[]
  statusOptions: SelectOption[]
  sourceTypeOptions: SelectOption[]
  moneySettings: MoneySettings
  systemNotes?: SystemNoteRow[]
}

export default function JournalEntryDetailClient({
  mode,
  editing,
  detailHref,
  customizeHref,
  customizing = false,
  customization,
  entryId,
  initialNumber,
  initialHeaderValues,
  initialLineItems,
  entities,
  accounts,
  departments,
  locations,
  projects,
  customers,
  vendors,
  items,
  currencies,
  accountingPeriods,
  employees,
  statusOptions,
  sourceTypeOptions,
  moneySettings,
  systemNotes = [],
}: JournalEntryDetailClientProps) {
  const router = useRouter()
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(initialHeaderValues)
  const [lineItems, setLineItems] = useState<JournalLineDraft[]>(initialLineItems)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const isNew = mode === 'new'
  const isIntercompany = headerValues.journalType === 'intercompany'
  const activeCustomization = customization

  const totalDebits = useMemo(() => sumMoney(lineItems.map((line) => line.debit)), [lineItems])
  const totalCredits = useMemo(() => sumMoney(lineItems.map((line) => line.credit)), [lineItems])
  const balance = useMemo(() => totalDebits - totalCredits, [totalCredits, totalDebits])
  const effectiveCurrencyCode = currencies.find((currency) => currency.id === headerValues.currencyId)?.code
  const visibleTotal = fmtCurrency(totalDebits, effectiveCurrencyCode, moneySettings)
  const affectedSubsidiaries = useMemo(
    () =>
      new Set(
        lineItems
          .map((line) => (isIntercompany ? line.subsidiaryId : '') || headerValues.subsidiaryId)
          .filter(Boolean),
      ).size,
    [headerValues.subsidiaryId, isIntercompany, lineItems],
  )
  const glImpactRows = useMemo(
    () =>
      lineItems.map((line) => ({
        key: line.key,
        lineNumber: line.displayOrder + 1,
        account: renderEntityLabel(accounts, line.accountId, 'accountId'),
        description: line.description || line.memo || '-',
        subsidiary: renderEntityLabel(entities, (isIntercompany ? line.subsidiaryId : '') || headerValues.subsidiaryId, 'subsidiaryId'),
        department: renderEntityLabel(departments, line.departmentId, 'departmentId'),
        location: renderEntityLabel(locations, line.locationId, 'locationId'),
        project: projects.find((project) => project.id === line.projectId)?.name ?? '-',
        customer: customers.find((customer) => customer.id === line.customerId)?.name ?? '-',
        vendor: vendors.find((vendor) => vendor.id === line.vendorId)?.name ?? '-',
        item: items.find((item) => item.id === line.itemId)?.name ?? '-',
        employee: employees.find((employee) => employee.id === line.employeeId)
          ? `${employees.find((employee) => employee.id === line.employeeId)?.firstName} ${employees.find((employee) => employee.id === line.employeeId)?.lastName}`
          : '-',
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
      })),
    [accounts, customers, departments, employees, entities, headerValues.subsidiaryId, isIntercompany, items, lineItems, locations, projects, vendors],
  )
  const visibleStatIds = useMemo(
    () =>
      [...(activeCustomization?.statCards ?? [])]
        .sort((left, right) => left.order - right.order)
        .filter((card) => card.visible)
        .map((card) => card.metric),
    [activeCustomization?.statCards],
  )
  const journalStatsRecord = useMemo(
    () => ({
      totalDebits,
      totalCredits,
      balance,
      lineCount: lineItems.length,
      lineSummary: isIntercompany ? `${lineItems.length} lines | ${affectedSubsidiaries || 0} subsidiaries` : `${lineItems.length} lines`,
      sourceId: headerValues.sourceId || null,
      sourceHref: headerValues.sourceId ? `/journals?${new URLSearchParams({ q: headerValues.sourceId }).toString()}` : null,
      statusLabel: statusOptions.find((option) => option.value === headerValues.status)?.label ?? headerValues.status ?? 'Draft',
      moneySettings,
    }),
    [affectedSubsidiaries, balance, headerValues.sourceId, headerValues.status, isIntercompany, lineItems.length, moneySettings, statusOptions, totalCredits, totalDebits],
  )
  const exportSections = useMemo(
    () => [
      {
        title: 'Journal Entry',
        fields: [
          { label: 'Journal Id', value: headerValues.number },
          { label: 'Date', value: headerValues.date, type: 'date' },
          { label: 'Description', value: headerValues.description || '-' },
          { label: 'Status', value: statusOptions.find((option) => option.value === headerValues.status)?.label ?? headerValues.status },
          { label: 'Subsidiary', value: renderEntityLabel(entities, headerValues.subsidiaryId, 'subsidiaryId') },
          { label: 'Currency', value: currencies.find((currency) => currency.id === headerValues.currencyId)?.code ?? '-' },
          { label: 'Accounting Period', value: accountingPeriods.find((period) => period.id === headerValues.accountingPeriodId)?.name ?? '-' },
          { label: 'Total Debits', value: fmtCurrency(totalDebits, effectiveCurrencyCode, moneySettings) },
          { label: 'Total Credits', value: fmtCurrency(totalCredits, effectiveCurrencyCode, moneySettings) },
          { label: 'Balance', value: fmtCurrency(balance, effectiveCurrencyCode, moneySettings) },
          { label: 'Source Type', value: (sourceTypeOptions.find((option) => option.value === headerValues.sourceType)?.label ?? headerValues.sourceType) || '-' },
          { label: 'Source Id', value: headerValues.sourceId || '-' },
          { label: 'Prepared By', value: employees.find((employee) => employee.id === headerValues.postedByEmployeeId) ? `${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.lastName}` : '-' },
          { label: 'Approved By', value: employees.find((employee) => employee.id === headerValues.approvedByEmployeeId) ? `${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.lastName}` : '-' },
        ],
      },
    ],
    [accountingPeriods, balance, currencies, effectiveCurrencyCode, employees, entities, headerValues.accountingPeriodId, headerValues.approvedByEmployeeId, headerValues.currencyId, headerValues.date, headerValues.description, headerValues.number, headerValues.postedByEmployeeId, headerValues.sourceId, headerValues.sourceType, headerValues.status, headerValues.subsidiaryId, moneySettings, sourceTypeOptions, statusOptions, totalCredits, totalDebits],
  )
  const relatedDocumentsCount = headerValues.sourceId ? 1 : 0
  const communicationRows = useMemo<CommunicationRow[]>(() => [], [])
  const composePayload =
    entryId && !customizing
      ? buildTransactionCommunicationComposePayload({
          recordId: entryId,
          number: headerValues.number || initialNumber,
          counterpartyName: 'Journal stakeholders',
          status: statusOptions.find((option) => option.value === headerValues.status)?.label ?? headerValues.status ?? 'Draft',
          total: visibleTotal,
          lineItems: lineItems.map((line, index) => ({
            line: index + 1,
            itemId: renderEntityLabel(accounts, line.accountId, 'accountId'),
            description: line.description || line.memo || '-',
            quantity: Number(line.debit || 0),
            receivedQuantity: 0,
            openQuantity: 0,
            billedQuantity: Number(line.credit || 0),
            unitPrice: 0,
            lineTotal: Number(line.debit || 0) - Number(line.credit || 0),
          })),
          sendEmailEndpoint: '/api/journals?action=send-email',
          recordIdFieldName: 'journalEntryId',
          documentLabel: 'Journal Entry',
        })
      : undefined

  const badge = (
    <div className="flex flex-wrap gap-2">
      <span
        className="inline-block rounded-full px-3 py-0.5 text-sm"
        style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
      >
        Journal Entry
      </span>
      <span
        className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
        style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
      >
        {headerValues.journalType === 'intercompany' ? 'Intercompany' : 'Standard'}
      </span>
      <span
        className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
        style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
      >
        {statusOptions.find((option) => option.value === headerValues.status)?.label ?? (headerValues.status || 'Draft')}
      </span>
    </div>
  )

  const fieldDefinitions = {
    number: { key: 'number', label: 'Journal Id', value: headerValues.number, editable: editing || isNew, type: 'text', fieldType: 'text', helpText: 'Unique journal identifier.' },
    date: { key: 'date', label: 'Date', value: headerValues.date, editable: editing || isNew, type: 'text', fieldType: 'date', helpText: 'Posting date for the journal entry.' },
    description: { key: 'description', label: 'Description', value: headerValues.description, editable: editing || isNew, type: 'text', fieldType: 'text', helpText: 'Header description for the journal entry.' },
    status: { key: 'status', label: 'Status', value: headerValues.status, editable: editing || isNew, type: 'select', options: statusOptions, fieldType: 'list', helpText: 'Current lifecycle stage of the journal.', sourceText: 'Journal status list' },
    subsidiaryId: { key: 'subsidiaryId', label: 'Subsidiary', value: headerValues.subsidiaryId, editable: editing || isNew, type: 'select', options: entities.map((entity) => ({ value: entity.id, label: `${entity.subsidiaryId} - ${entity.name}` })), fieldType: 'list', helpText: 'Default subsidiary context for the journal.', sourceText: 'Subsidiaries master data' },
    currencyId: { key: 'currencyId', label: 'Currency', value: headerValues.currencyId, editable: editing || isNew, type: 'select', options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code ?? currency.currencyId} - ${currency.name}` })), fieldType: 'list', helpText: 'Currency used for the journal header total display.', sourceText: 'Currencies master data' },
    accountingPeriodId: { key: 'accountingPeriodId', label: 'Accounting Period', value: headerValues.accountingPeriodId, editable: editing || isNew, type: 'select', options: accountingPeriods.map((period) => ({ value: period.id, label: period.name })), fieldType: 'list', helpText: 'Accounting period that owns the journal.', sourceText: 'Accounting periods' },
    journalType: { key: 'journalType', label: 'Journal Type', value: headerValues.journalType, editable: false, displayValue: headerValues.journalType === 'intercompany' ? 'Intercompany' : 'Standard', fieldType: 'text', helpText: 'Standard or intercompany journal classification.' },
    computedTotal: { key: 'computedTotal', label: 'Total', value: visibleTotal, displayValue: visibleTotal, editable: false, fieldType: 'currency', helpText: 'Balanced total based on journal debits.' },
    sourceType: { key: 'sourceType', label: 'Source Type', value: headerValues.sourceType, editable: editing || isNew, type: 'select', options: sourceTypeOptions, fieldType: 'list', helpText: 'Origin or purpose classification for the journal.', sourceText: 'Journal source type list' },
    sourceId: { key: 'sourceId', label: 'Source Id', value: headerValues.sourceId, editable: editing || isNew, type: 'text', fieldType: 'text', helpText: 'Identifier from the originating source record.' },
    postedByEmployeeId: { key: 'postedByEmployeeId', label: 'Prepared By', value: headerValues.postedByEmployeeId, editable: editing || isNew, type: 'select', options: employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}` })), fieldType: 'list', helpText: 'Employee that prepared the journal.', sourceText: 'Employees master data' },
    approvedByEmployeeId: { key: 'approvedByEmployeeId', label: 'Approved By', value: headerValues.approvedByEmployeeId, editable: editing || isNew, type: 'select', options: employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}` })), fieldType: 'list', helpText: 'Employee that approved the journal.', sourceText: 'Employees master data' },
    createdAt: { key: 'createdAt', label: 'Date Created', value: headerValues.createdAt, editable: false, fieldType: 'date', helpText: 'Timestamp when the journal was created.' },
    updatedAt: { key: 'updatedAt', label: 'Last Modified', value: headerValues.updatedAt, editable: false, fieldType: 'date', helpText: 'Timestamp of the most recent journal update.' },
  } as const

  const sectionDescriptions = {
    'Journal Entry': 'Core journal header information and posting context.',
    'Source And Approval': 'Reference source and approval ownership for the journal entry.',
  }

  const headerSections: PurchaseOrderHeaderSection[] = activeCustomization
    ? buildConfiguredTransactionSections({
        fields: JOURNAL_DETAIL_FIELDS,
        layout: activeCustomization,
        fieldDefinitions,
        sectionDescriptions,
      })
    : []

  const customizeFields = activeCustomization
    ? buildTransactionCustomizePreviewFields({
        fields: JOURNAL_DETAIL_FIELDS,
        fieldDefinitions,
        previewOverrides: {
          status: statusOptions.find((option) => option.value === headerValues.status)?.label ?? headerValues.status,
          subsidiaryId: entities.find((entity) => entity.id === headerValues.subsidiaryId)
            ? `${entities.find((entity) => entity.id === headerValues.subsidiaryId)?.subsidiaryId} - ${entities.find((entity) => entity.id === headerValues.subsidiaryId)?.name}`
            : '',
          currencyId: currencies.find((currency) => currency.id === headerValues.currencyId)
            ? `${currencies.find((currency) => currency.id === headerValues.currencyId)?.code ?? currencies.find((currency) => currency.id === headerValues.currencyId)?.currencyId} - ${currencies.find((currency) => currency.id === headerValues.currencyId)?.name}`
            : '',
          accountingPeriodId: accountingPeriods.find((period) => period.id === headerValues.accountingPeriodId)?.name ?? '',
          sourceType: sourceTypeOptions.find((option) => option.value === headerValues.sourceType)?.label ?? headerValues.sourceType,
          postedByEmployeeId: employees.find((employee) => employee.id === headerValues.postedByEmployeeId)
            ? `${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.employeeId ?? 'EMP'} - ${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.lastName}`
            : '',
          approvedByEmployeeId: employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)
            ? `${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.employeeId ?? 'EMP'} - ${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.lastName}`
            : '',
          computedTotal: visibleTotal,
        },
      })
    : []

  const title = isNew
    ? headerValues.journalType === 'intercompany'
      ? 'New Intercompany Journal'
      : 'New Journal Entry'
    : headerValues.description || headerValues.number

  function addLine() {
    setLineItems((current) => [
      ...current,
      {
        key: `${Date.now()}-${current.length}`,
        displayOrder: current.length,
        accountId: '',
        description: '',
        debit: '',
        credit: '',
        memo: '',
        subsidiaryId: isIntercompany ? headerValues.subsidiaryId || '' : '',
        departmentId: '',
        locationId: '',
        projectId: '',
        customerId: '',
        vendorId: '',
        itemId: '',
        employeeId: '',
      },
    ])
  }

  function updateLine(key: string, field: keyof JournalLineDraft, value: string) {
    setLineItems((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        if (field === 'debit') return { ...line, debit: value, credit: value ? '' : line.credit }
        if (field === 'credit') return { ...line, credit: value, debit: value ? '' : line.debit }
        return { ...line, [field]: value }
      }),
    )
  }

  function removeLine(key: string) {
    setLineItems((current) =>
      current
        .filter((line) => line.key !== key)
        .map((line, index) => ({
          ...line,
          displayOrder: index,
        })),
    )
  }

  async function handleDelete() {
    if (!entryId) return
    if (!window.confirm(`Delete ${headerValues.number || 'this journal entry'} permanently?`)) return

    setDeleteError('')
    const response = await fetch(`/api/journals?id=${encodeURIComponent(entryId)}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setDeleteError(body?.error ?? 'Unable to delete journal entry')
      return
    }

    router.push(isIntercompany ? '/intercompany-journals' : '/journals')
    router.refresh()
  }

  async function handleSave() {
    setSaveError('')
    if (lineItems.length > 0 && !moneyEquals(totalDebits, totalCredits)) {
      const error = 'Journal lines must balance before saving.'
      setSaveError(error)
      return { ok: false, error }
    }

    const filteredLines = lineItems
      .map((line) => ({
        accountId: line.accountId || null,
        description: line.description || null,
        debit: line.debit || '0',
        credit: line.credit || '0',
        memo: line.memo || null,
        subsidiaryId: isIntercompany ? line.subsidiaryId || null : null,
        departmentId: line.departmentId || null,
        locationId: line.locationId || null,
        projectId: line.projectId || null,
        customerId: line.customerId || null,
        vendorId: line.vendorId || null,
        itemId: line.itemId || null,
        employeeId: line.employeeId || null,
      }))
      .filter((line) => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0))

    setSaving(true)
    try {
      const payload = {
        number: headerValues.number,
        date: headerValues.date,
        description: headerValues.description || null,
        journalType: headerValues.journalType || 'standard',
        status: headerValues.status,
        subsidiaryId: headerValues.subsidiaryId || null,
        currencyId: headerValues.currencyId || null,
        accountingPeriodId: headerValues.accountingPeriodId || null,
        sourceType: headerValues.sourceType || null,
        sourceId: headerValues.sourceId || null,
        postedByEmployeeId: headerValues.postedByEmployeeId || null,
        approvedByEmployeeId: headerValues.approvedByEmployeeId || null,
        lineItems: filteredLines,
      }

      const response = await fetch(isNew ? '/api/journals' : `/api/journals?id=${encodeURIComponent(entryId ?? '')}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const error = body?.error ?? `Unable to ${isNew ? 'create' : 'update'} journal entry`
        setSaveError(error)
        return { ok: false, error }
      }

      const targetBasePath = body?.journalType === 'intercompany' ? '/intercompany-journals' : '/journals'
      router.push(isNew ? `${targetBasePath}/${body.id}` : detailHref)
      router.refresh()
      return { ok: true }
    } catch {
      const error = `Unable to ${isNew ? 'create' : 'update'} journal entry`
      setSaveError(error)
      return { ok: false, error }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref={isIntercompany ? '/intercompany-journals' : '/journals'}
      backLabel={isIntercompany ? '<- Back to Intercompany Journals' : '<- Back to Journal Entries'}
      meta={headerValues.number || initialNumber}
      title={title}
      badge={badge}
      widthClassName="w-full max-w-none"
      actions={
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {editing || isNew ? (
              <>
                <Link
                  href={isNew ? '/journals' : detailHref}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <MasterDataDetailCreateMenu
                  newHref={isIntercompany ? '/journals/intercompany/new' : '/journals/new'}
                  duplicateHref={entryId ? `${isIntercompany ? '/journals/intercompany/new' : '/journals/new'}?duplicateFrom=${entryId}` : undefined}
                />
                <MasterDataDetailExportMenu
                  title={title}
                  fileName={headerValues.number || initialNumber}
                  sections={exportSections}
                />
                {customizeHref ? (
                  <Link
                    href={customizeHref}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Customize
                  </Link>
                ) : null}
                <Link
                  href={`${detailHref}?edit=1`}
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                >
                  Delete
                </button>
              </>
            )}
          </div>
          {saveError ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{saveError}</p> : null}
          {deleteError ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{deleteError}</p> : null}
        </div>
      }
    >
      <div className="mb-8">
        <TransactionStatsRow
          record={journalStatsRecord}
          stats={journalPageConfig.stats}
          visibleStatIds={visibleStatIds}
        />
      </div>

      {customizing && activeCustomization ? (
        <JournalDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={activeCustomization}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
        />
      ) : (
        <PurchaseOrderHeaderSections
          purchaseOrderId={entryId}
          editing={editing || isNew}
          sections={headerSections}
          columns={activeCustomization?.formColumns ?? 4}
          formId="journal-entry-detail-form"
          submitMode="controlled"
          onSubmit={handleSave}
          onValuesChange={setHeaderValues}
        />
      )}

      {!customizing ? (
      <RecordDetailSection
        title="Journal Lines"
        count={lineItems.length}
        summary={`Debits ${totalDebits.toFixed(2)} | Credits ${totalCredits.toFixed(2)}`}
        actions={
          editing || isNew ? (
            <button
              type="button"
              onClick={addLine}
              className="rounded-md border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--accent-primary-strong)' }}
            >
              + Add Line
            </button>
          ) : null
        }
      >
        {lineItems.length === 0 ? (
          <RecordDetailEmptyState message="No journal lines yet." />
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Line</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>GL Account</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Debit</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Credit</RecordDetailHeaderCell>
                {isIntercompany ? <RecordDetailHeaderCell>Subsidiary</RecordDetailHeaderCell> : null}
                <RecordDetailHeaderCell>Department</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Location</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Project</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Customer</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Vendor</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Item</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Employee</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Memo</RecordDetailHeaderCell>
                {editing || isNew ? <RecordDetailHeaderCell /> : null}
              </tr>
            </thead>
            <tbody>
                {lineItems.map((line, index) => (
                  <tr key={line.key} style={index < lineItems.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                    <RecordDetailCell>{line.displayOrder + 1}</RecordDetailCell>
                    <EditableCell editing={editing || isNew}>
                    <select value={line.accountId} onChange={(event) => updateLine(line.key, 'accountId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">Select account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.accountId} - {account.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={line.description || '-'}>
                    <input value={line.description} onChange={(event) => updateLine(line.key, 'description', event.target.value)} className={inputClass} style={inputStyle} />
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={line.debit || '-'}>
                    <input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.key, 'debit', event.target.value)} className={inputClass} style={inputStyle} />
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={line.credit || '-'}>
                    <input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.key, 'credit', event.target.value)} className={inputClass} style={inputStyle} />
                  </EditableCell>
                  {isIntercompany ? (
                    <EditableCell editing={editing || isNew} value={renderEntityLabel(entities, line.subsidiaryId, 'subsidiaryId')}>
                      <select value={line.subsidiaryId} onChange={(event) => updateLine(line.key, 'subsidiaryId', event.target.value)} className={inputClass} style={inputStyle}>
                        <option value="">Use header / none</option>
                        {entities.map((entity) => (
                          <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>
                        ))}
                      </select>
                    </EditableCell>
                  ) : null}
                  <EditableCell editing={editing || isNew} value={renderEntityLabel(departments, line.departmentId, 'departmentId')}>
                    <select value={line.departmentId} onChange={(event) => updateLine(line.key, 'departmentId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{department.departmentId} - {department.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={renderEntityLabel(locations, line.locationId, 'locationId')}>
                    <select value={line.locationId} onChange={(event) => updateLine(line.key, 'locationId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>{location.locationId} - {location.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={projects.find((project) => project.id === line.projectId)?.name ?? '-'}>
                    <select value={line.projectId} onChange={(event) => updateLine(line.key, 'projectId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={customers.find((customer) => customer.id === line.customerId)?.name ?? '-'}>
                    <select value={line.customerId} onChange={(event) => updateLine(line.key, 'customerId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.customerId ?? 'CUST'} - {customer.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={vendors.find((vendor) => vendor.id === line.vendorId)?.name ?? '-'}>
                    <select value={line.vendorId} onChange={(event) => updateLine(line.key, 'vendorId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.vendorNumber ?? 'VEND'} - {vendor.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={items.find((item) => item.id === line.itemId)?.name ?? '-'}>
                    <select value={line.itemId} onChange={(event) => updateLine(line.key, 'itemId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.itemId ?? 'ITEM'} - {item.name}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={employees.find((employee) => employee.id === line.employeeId) ? `${employees.find((employee) => employee.id === line.employeeId)?.firstName} ${employees.find((employee) => employee.id === line.employeeId)?.lastName}` : '-'}>
                    <select value={line.employeeId} onChange={(event) => updateLine(line.key, 'employeeId', event.target.value)} className={inputClass} style={inputStyle}>
                      <option value="">None</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.employeeId ?? 'EMP'} - {employee.firstName} {employee.lastName}</option>
                      ))}
                    </select>
                  </EditableCell>
                  <EditableCell editing={editing || isNew} value={line.memo || '-'}>
                    <input value={line.memo} onChange={(event) => updateLine(line.key, 'memo', event.target.value)} className={inputClass} style={inputStyle} />
                  </EditableCell>
                  {editing || isNew ? (
                    <RecordDetailCell className="text-right">
                      <button type="button" onClick={() => removeLine(line.key)} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
                        Remove
                      </button>
                    </RecordDetailCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </RecordDetailSection>
      ) : null}

      {!customizing ? (
      <RecordDetailSection
        title="GL Impact"
        count={glImpactRows.length}
        summary={glImpactRows.length ? `${fmtCurrency(totalDebits, effectiveCurrencyCode, moneySettings)} debits | ${fmtCurrency(totalCredits, effectiveCurrencyCode, moneySettings)} credits` : undefined}
        collapsible
      >
        {glImpactRows.length === 0 ? (
          <RecordDetailEmptyState message="No journal lines yet, so there is no GL impact to preview." />
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Line</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Account</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Subsidiary</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Department</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Location</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Project</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Customer</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Vendor</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Item</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Employee</RecordDetailHeaderCell>
                <RecordDetailHeaderCell className="text-right">Debit</RecordDetailHeaderCell>
                <RecordDetailHeaderCell className="text-right">Credit</RecordDetailHeaderCell>
              </tr>
            </thead>
            <tbody>
              {glImpactRows.map((row, index) => (
                <tr key={row.key} style={index < glImpactRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                  <RecordDetailCell>{row.lineNumber}</RecordDetailCell>
                  <RecordDetailCell>{row.account}</RecordDetailCell>
                  <RecordDetailCell className="max-w-[260px] whitespace-pre-wrap break-words">{row.description}</RecordDetailCell>
                  <RecordDetailCell>{row.subsidiary}</RecordDetailCell>
                  <RecordDetailCell>{row.department}</RecordDetailCell>
                  <RecordDetailCell>{row.location}</RecordDetailCell>
                  <RecordDetailCell>{row.project}</RecordDetailCell>
                  <RecordDetailCell>{row.customer}</RecordDetailCell>
                  <RecordDetailCell>{row.vendor}</RecordDetailCell>
                  <RecordDetailCell>{row.item}</RecordDetailCell>
                  <RecordDetailCell>{row.employee}</RecordDetailCell>
                  <RecordDetailCell className="text-right">{row.debit ? fmtCurrency(row.debit, effectiveCurrencyCode, moneySettings) : '-'}</RecordDetailCell>
                  <RecordDetailCell className="text-right">{row.credit ? fmtCurrency(row.credit, effectiveCurrencyCode, moneySettings) : '-'}</RecordDetailCell>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </RecordDetailSection>
      ) : null}

      {!isNew && !customizing ? (
        <JournalRelatedDocumentsSection
          count={relatedDocumentsCount}
          sourceType={(sourceTypeOptions.find((option) => option.value === headerValues.sourceType)?.label ?? headerValues.sourceType) || '-'}
          sourceId={headerValues.sourceId}
          description={headerValues.description || '-'}
        />
      ) : null}

      {!isNew && !customizing ? (
        <CommunicationsSection rows={communicationRows} compose={composePayload} />
      ) : null}

      {!isNew && !customizing ? <SystemNotesSection notes={systemNotes} /> : null}
    </RecordDetailPageShell>
  )
}

function EditableCell({
  editing,
  value,
  children,
}: {
  editing: boolean
  value?: string
  children: ReactNode
}) {
  return (
    <RecordDetailCell className="min-w-[140px]">
      {editing ? children : value ?? '-'}
    </RecordDetailCell>
  )
}

function renderEntityLabel<T extends { id: string }>(
  values: T[],
  selectedId: string,
  codeKey: keyof T,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  const code = value[codeKey]
  const name = 'name' in value ? value.name : ''
  return `${String(code)}${name ? ` - ${String(name)}` : ''}`
}

const inputClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'
const inputStyle = { borderColor: 'var(--border-muted)' }

function JournalRelatedDocumentsSection({
  count,
  sourceType,
  sourceId,
  description,
}: {
  count: number
  sourceType: string
  sourceId: string
  description: string
}) {
  return (
    <RecordDetailSection title="Related Documents" count={count} summary={sourceId ? sourceType : undefined} collapsible>
      {sourceId ? (
        <table className="min-w-full">
          <thead>
            <tr>
              <RecordDetailHeaderCell>Source Type</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Source Id</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
            </tr>
          </thead>
          <tbody>
            <tr>
              <RecordDetailCell>{sourceType}</RecordDetailCell>
              <RecordDetailCell>{sourceId}</RecordDetailCell>
              <RecordDetailCell>{description}</RecordDetailCell>
            </tr>
          </tbody>
        </table>
      ) : (
        <RecordDetailEmptyState message="No related source document is linked to this journal yet." />
      )}
    </RecordDetailSection>
  )
}
