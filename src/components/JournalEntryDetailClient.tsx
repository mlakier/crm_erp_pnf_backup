'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import CommunicationsSection, { type CommunicationRow } from '@/components/CommunicationsSection'
import RecordBottomTabsSection from '@/components/RecordBottomTabsSection'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'
import RecordGlImpactSection from '@/components/RecordGlImpactSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import RecordHeaderDetails, { type RecordHeaderSection } from '@/components/RecordHeaderDetails'
import SharedSearchableSelect, { type SearchableSelectOption as SharedSearchableSelectOption } from '@/components/SearchableSelect'
import SystemNotesSection, { type SystemNoteRow } from '@/components/SystemNotesSection'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { fmtCurrency, fmtDocumentDate, parseMoneyInput } from '@/lib/format'
import { applyRequirementsToEditableFields, useFormRequirementsState } from '@/lib/form-requirements-client'
import { moneyEquals, sumMoney } from '@/lib/money'
import type { MoneySettings } from '@/lib/company-preferences-definitions'
import JournalDetailCustomizeMode from '@/components/JournalDetailCustomizeMode'
import {
  JOURNAL_GL_IMPACT_COLUMNS,
  JOURNAL_LINE_COLUMNS,
  JOURNAL_DETAIL_FIELDS,
  type JournalDetailCustomizationConfig,
  type JournalGlImpactColumnCustomization,
  type JournalGlImpactColumnKey,
  type JournalLineColumnKey,
  type JournalLineColumnCustomization,
  type JournalLineDisplayMode,
  type JournalLineDropdownSortMode,
} from '@/lib/journal-detail-customization'
import { deriveManualJournalActivityType } from '@/lib/accounting-activity-types'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import { journalPageConfig } from '@/lib/transaction-page-configs/journal'
import { findAccountingPeriodIdForDate } from '@/lib/accounting-periods'
import type { DocumentRelationshipSummary } from '@/lib/document-relationships'

type EntityOption = { id: string; subsidiaryId: string; name: string }
type AccountOption = { id: string; accountId: string; accountNumber: string; name: string }
type DepartmentOption = { id: string; departmentId: string; departmentNumber: string | null; name: string }
type LocationOption = { id: string; locationId: string; code: string; name: string }
type ProjectOption = { id: string; name: string; description: string | null }
type CustomerOption = { id: string; customerId: string | null; name: string }
type VendorOption = { id: string; vendorNumber: string | null; name: string }
type ItemOption = { id: string; itemId: string | null; sku: string | null; name: string }
type CurrencyOption = { id: string; currencyId: string; code?: string; name: string }
type PeriodOption = {
  id: string
  name: string
  startDate: string
  endDate: string
  subsidiaryId?: string | null
  closed?: boolean
  status?: string | null
}
type EmployeeOption = { id: string; employeeId: string | null; eid: string | null; firstName: string; lastName: string }
type JournalReferenceOption = { id: string; number: string; description: string | null; journalType: string; status: string }
type OpenItemOption = {
  id: string
  openItemNumber: string
  sourceNumber: string | null
  openItemType: string
  counterpartyType: string | null
  counterpartyId: string | null
  sourceTransactionType: string | null
  sourceTransactionId: string | null
  originalTransactionAmount: string
  status: string
}
type SelectOption = { value: string; label: string }

type JournalLineDraft = {
  key: string
  displayOrder: number
  accountId: string
  activityTypeCode: string
  description: string
  debit: string
  credit: string
  localDebit?: string
  localCredit?: string
  functionalDebit?: string
  functionalCredit?: string
  groupDebit?: string
  groupCredit?: string
  memo: string
  subsidiaryId: string
  departmentId: string
  locationId: string
  projectId: string
  customerId: string
  vendorId: string
  itemId: string
  employeeId: string
  settlesOpenItemId: string
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
  journalEntries: JournalReferenceOption[]
  openItems: OpenItemOption[]
  statusOptions: SelectOption[]
  sourceTypeOptions: SelectOption[]
  activityTypeOptions: SelectOption[]
  linkedDocuments?: DocumentRelationshipSummary[]
  createdByUserLabel?: string
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
  journalEntries,
  openItems,
  statusOptions,
  sourceTypeOptions,
  activityTypeOptions,
  linkedDocuments = [],
  createdByUserLabel = '-',
  moneySettings,
  systemNotes = [],
}: JournalEntryDetailClientProps) {
  const router = useRouter()
  const { req, isLocked } = useFormRequirementsState('journalCreate')
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
  const persistedTotal = Number(headerValues.total || 0)
  const computedTotalDisplay = fmtCurrency(totalDebits, effectiveCurrencyCode, moneySettings)
  const persistedTotalDisplay = fmtCurrency(persistedTotal, effectiveCurrencyCode, moneySettings)
  const detailTotalDisplay = editing || isNew ? computedTotalDisplay : persistedTotalDisplay
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
        account: renderAccountLabel(accounts, line.accountId),
        description: line.description || line.memo || '-',
        subsidiary: renderEntityLabel(entities, (isIntercompany ? line.subsidiaryId : '') || headerValues.subsidiaryId, 'subsidiaryId'),
        department: renderDepartmentLabel(departments, line.departmentId),
        location: renderLocationLabel(locations, line.locationId),
        project: renderProjectLabel(projects, line.projectId),
        customer: renderCustomerLabel(customers, line.customerId),
        vendor: renderVendorLabel(vendors, line.vendorId),
        item: renderItemLabel(items, line.itemId),
        employee: renderEmployeeLabel(employees, line.employeeId),
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        localDebit: Number(line.localDebit || 0),
        localCredit: Number(line.localCredit || 0),
        functionalDebit: Number(line.functionalDebit || 0),
        functionalCredit: Number(line.functionalCredit || 0),
        groupDebit: Number(line.groupDebit || 0),
        groupCredit: Number(line.groupCredit || 0),
      })),
    [accounts, customers, departments, employees, entities, headerValues.subsidiaryId, isIntercompany, items, lineItems, locations, projects, vendors],
  )
  const lineColumnDefinitions = useMemo(
    () => JOURNAL_LINE_COLUMNS.filter((column) => isIntercompany || column.id !== 'subsidiaryId'),
    [isIntercompany],
  )
  const visibleLineColumns = useMemo(
    () =>
      activeCustomization?.lineColumns
        ? getOrderedVisibleTransactionLineColumns(lineColumnDefinitions, activeCustomization)
        : lineColumnDefinitions.map((column) => ({ id: column.id, label: column.label })),
    [activeCustomization, lineColumnDefinitions],
  )
  const glImpactColumnDefinitions = useMemo(
    () => JOURNAL_GL_IMPACT_COLUMNS.filter((column) => isIntercompany || column.id !== 'subsidiaryId'),
    [isIntercompany],
  )
  const visibleGlImpactColumns = useMemo(
    () =>
      activeCustomization?.glImpactColumns
        ? getOrderedVisibleTransactionLineColumns(glImpactColumnDefinitions, { lineColumns: activeCustomization.glImpactColumns })
        : glImpactColumnDefinitions.map((column) => ({ id: column.id, label: column.label })),
    [activeCustomization?.glImpactColumns, glImpactColumnDefinitions],
  )
  const lineFontSize = activeCustomization?.lineSettings?.fontSize === 'sm' ? 'sm' : 'xs'
  const lineInputClass = useMemo(
    () =>
      `w-full rounded-md border bg-transparent px-2.5 py-1.5 ${lineFontSize === 'sm' ? 'text-sm' : 'text-xs'} text-white`,
    [lineFontSize],
  )
  const lineReadOnlyTextClass = lineFontSize === 'sm' ? 'text-sm leading-5' : 'text-xs leading-5'
  const glImpactFontSize = activeCustomization?.glImpactSettings?.fontSize === 'sm' ? 'sm' : 'xs'
  const glImpactTextClass = glImpactFontSize === 'sm' ? 'text-sm leading-5' : 'text-xs leading-5'
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
          { label: 'Open Item Relevant', value: headerValues.isOpenItemRelevant === 'true' ? 'Yes' : 'No' },
          { label: 'Subsidiary', value: renderEntityLabel(entities, headerValues.subsidiaryId, 'subsidiaryId') },
          { label: 'Currency', value: currencies.find((currency) => currency.id === headerValues.currencyId)?.code ?? '-' },
          { label: 'Accounting Period', value: accountingPeriods.find((period) => period.id === headerValues.accountingPeriodId)?.name ?? '-' },
          { label: 'Total', value: persistedTotalDisplay },
          { label: 'Total Debits', value: fmtCurrency(totalDebits, effectiveCurrencyCode, moneySettings) },
          { label: 'Total Credits', value: fmtCurrency(totalCredits, effectiveCurrencyCode, moneySettings) },
          { label: 'Balance', value: fmtCurrency(balance, effectiveCurrencyCode, moneySettings) },
          { label: 'Source Type', value: (sourceTypeOptions.find((option) => option.value === headerValues.sourceType)?.label ?? headerValues.sourceType) || '-' },
          { label: 'Source Id', value: headerValues.sourceId || '-' },
          { label: 'Reverses Journal', value: (journalEntries.find((journal) => journal.id === headerValues.reversesJournalEntryId)?.number ?? headerValues.reversesJournalEntryId) || '-' },
          { label: 'Reversal Reason', value: headerValues.reversalReasonCode || '-' },
          { label: 'Created By', value: createdByUserLabel },
          { label: 'Prepared By', value: employees.find((employee) => employee.id === headerValues.postedByEmployeeId) ? `${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.lastName}` : '-' },
          { label: 'Approved By', value: employees.find((employee) => employee.id === headerValues.approvedByEmployeeId) ? `${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.lastName}` : '-' },
        ],
      },
    ],
    [accountingPeriods, balance, createdByUserLabel, currencies, effectiveCurrencyCode, employees, entities, headerValues.accountingPeriodId, headerValues.approvedByEmployeeId, headerValues.currencyId, headerValues.date, headerValues.description, headerValues.isOpenItemRelevant, headerValues.number, headerValues.postedByEmployeeId, headerValues.reversalReasonCode, headerValues.reversesJournalEntryId, headerValues.sourceId, headerValues.sourceType, headerValues.status, headerValues.subsidiaryId, journalEntries, moneySettings, persistedTotalDisplay, sourceTypeOptions, statusOptions, totalCredits, totalDebits],
  )
  const relatedDocumentsCount = (headerValues.sourceId ? 1 : 0) + linkedDocuments.length
  const communicationRows = useMemo<CommunicationRow[]>(() => [], [])
  const composePayload =
    entryId && !customizing
      ? buildTransactionCommunicationComposePayload({
          recordId: entryId,
          number: headerValues.number || initialNumber,
          counterpartyName: 'Journal stakeholders',
          status: statusOptions.find((option) => option.value === headerValues.status)?.label ?? headerValues.status ?? 'Draft',
          total: persistedTotalDisplay,
          lineItems: lineItems.map((line, index) => ({
            line: index + 1,
            itemId: renderAccountLabel(accounts, line.accountId),
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
    date: { key: 'date', label: 'Date', value: headerValues.date, editable: editing || isNew, type: 'date', fieldType: 'date', helpText: 'Posting date for the journal entry.' },
    description: { key: 'description', label: 'Description', value: headerValues.description, editable: editing || isNew, type: 'text', fieldType: 'text', helpText: 'Header description for the journal entry.' },
    status: { key: 'status', label: 'Status', value: headerValues.status, editable: editing || isNew, type: 'select', options: statusOptions, fieldType: 'list', helpText: 'Current lifecycle stage of the journal.', sourceText: 'Journal status list' },
    isOpenItemRelevant: { key: 'isOpenItemRelevant', label: 'Open Item Relevant', value: headerValues.isOpenItemRelevant, editable: editing || isNew, type: 'checkbox', fieldType: 'checkbox', helpText: 'Determines whether this posted journal should participate in open item management.' },
    subsidiaryId: { key: 'subsidiaryId', label: 'Subsidiary', value: headerValues.subsidiaryId, editable: editing || isNew, type: 'select', options: entities.map((entity) => ({ value: entity.id, label: `${entity.subsidiaryId} - ${entity.name}` })), fieldType: 'list', helpText: 'Default subsidiary context for the journal.', sourceText: 'Subsidiaries master data' },
    currencyId: { key: 'currencyId', label: 'Currency', value: headerValues.currencyId, editable: editing || isNew, type: 'select', options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code ?? currency.currencyId} - ${currency.name}` })), fieldType: 'list', helpText: 'Currency used for the journal header total display.', sourceText: 'Currencies master data' },
    accountingPeriodId: { key: 'accountingPeriodId', label: 'Accounting Period', value: headerValues.accountingPeriodId, editable: editing || isNew, disabled: true, type: 'select', options: accountingPeriods.map((period) => ({ value: period.id, label: period.name })), fieldType: 'list', helpText: 'Auto-derived from the posting date and matching accounting period.', sourceText: 'Accounting periods' },
    journalType: { key: 'journalType', label: 'Journal Type', value: headerValues.journalType, editable: false, displayValue: headerValues.journalType === 'intercompany' ? 'Intercompany' : 'Standard', fieldType: 'text', helpText: 'Standard or intercompany journal classification.' },
    total: { key: 'total', label: 'Total', value: headerValues.total, displayValue: detailTotalDisplay, editable: false, fieldType: 'currency', helpText: 'Persisted journal total stored on the journal header.' },
    sourceType: { key: 'sourceType', label: 'Source Type', value: headerValues.sourceType, editable: editing || isNew, type: 'select', options: sourceTypeOptions, fieldType: 'list', helpText: 'Origin or purpose classification for the journal.', sourceText: 'Journal source type list' },
    sourceId: { key: 'sourceId', label: 'Source Id', value: headerValues.sourceId, editable: editing || isNew, type: 'text', fieldType: 'text', helpText: 'Identifier from the originating source record.' },
    reversesJournalEntryId: { key: 'reversesJournalEntryId', label: 'Reverses Journal', value: headerValues.reversesJournalEntryId, editable: editing || isNew, type: 'select', options: journalEntries.filter((journal) => journal.id !== entryId).map((journal) => ({ value: journal.id, label: `${journal.number}${journal.description ? ` - ${journal.description}` : ''}` })), fieldType: 'list', helpText: 'Original journal entry that this journal is intended to reverse.', sourceText: 'Journal entries' },
    reversalReasonCode: { key: 'reversalReasonCode', label: 'Reversal Reason', value: headerValues.reversalReasonCode, editable: editing || isNew, type: 'text', fieldType: 'text', helpText: 'Reason or explanation for the reversal relationship.' },
    userId: { key: 'userId', label: 'Created By', value: headerValues.userId, displayValue: createdByUserLabel, editable: false, fieldType: 'list', helpText: 'User account that created the journal entry.', sourceText: 'Users' },
    postedByEmployeeId: { key: 'postedByEmployeeId', label: 'Prepared By', value: headerValues.postedByEmployeeId, editable: editing || isNew, type: 'select', options: employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}` })), fieldType: 'list', helpText: 'Employee that prepared the journal.', sourceText: 'Employees master data' },
    approvedByEmployeeId: { key: 'approvedByEmployeeId', label: 'Approved By', value: headerValues.approvedByEmployeeId, editable: editing || isNew, type: 'select', options: employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}` })), fieldType: 'list', helpText: 'Employee that approved the journal.', sourceText: 'Employees master data' },
    createdAt: { key: 'createdAt', label: 'Date Created', value: headerValues.createdAt, editable: false, fieldType: 'date', helpText: 'Timestamp when the journal was created.' },
    updatedAt: { key: 'updatedAt', label: 'Last Modified', value: headerValues.updatedAt, editable: false, fieldType: 'date', helpText: 'Timestamp of the most recent journal update.' },
  } as const

  applyRequirementsToEditableFields(fieldDefinitions, req, isLocked)

  const sectionDescriptions = {
    'Journal Entry': 'Core journal header information and posting context.',
    'Source And Approval': 'Reference source and approval ownership for the journal entry.',
  }

  const headerSections: RecordHeaderSection[] = activeCustomization
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
          isOpenItemRelevant: headerValues.isOpenItemRelevant === 'true' ? 'Yes' : 'No',
          subsidiaryId: entities.find((entity) => entity.id === headerValues.subsidiaryId)
            ? `${entities.find((entity) => entity.id === headerValues.subsidiaryId)?.subsidiaryId} - ${entities.find((entity) => entity.id === headerValues.subsidiaryId)?.name}`
            : '',
          currencyId: currencies.find((currency) => currency.id === headerValues.currencyId)
            ? `${currencies.find((currency) => currency.id === headerValues.currencyId)?.code ?? currencies.find((currency) => currency.id === headerValues.currencyId)?.currencyId} - ${currencies.find((currency) => currency.id === headerValues.currencyId)?.name}`
            : '',
          accountingPeriodId: accountingPeriods.find((period) => period.id === headerValues.accountingPeriodId)?.name ?? '',
          sourceType: sourceTypeOptions.find((option) => option.value === headerValues.sourceType)?.label ?? headerValues.sourceType,
          reversesJournalEntryId: journalEntries.find((journal) => journal.id === headerValues.reversesJournalEntryId)
            ? `${journalEntries.find((journal) => journal.id === headerValues.reversesJournalEntryId)?.number}${journalEntries.find((journal) => journal.id === headerValues.reversesJournalEntryId)?.description ? ` - ${journalEntries.find((journal) => journal.id === headerValues.reversesJournalEntryId)?.description}` : ''}`
            : '',
          reversalReasonCode: headerValues.reversalReasonCode,
          postedByEmployeeId: employees.find((employee) => employee.id === headerValues.postedByEmployeeId)
            ? `${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.employeeId ?? 'EMP'} - ${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.postedByEmployeeId)?.lastName}`
            : '',
          approvedByEmployeeId: employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)
            ? `${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.employeeId ?? 'EMP'} - ${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.firstName} ${employees.find((employee) => employee.id === headerValues.approvedByEmployeeId)?.lastName}`
            : '',
          total: detailTotalDisplay,
        },
      })
    : []

  const title = isNew
    ? headerValues.journalType === 'intercompany'
      ? 'New Intercompany Journal'
      : 'New Journal Entry'
    : headerValues.description || headerValues.number

  function addLine() {
    const defaultActivityType = deriveManualJournalActivityType({
      journalType: headerValues.journalType,
      sourceType: headerValues.sourceType,
    })
    setLineItems((current) => [
      ...current,
      {
        key: `${Date.now()}-${current.length}`,
        displayOrder: current.length,
        accountId: '',
        activityTypeCode: defaultActivityType,
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
        settlesOpenItemId: '',
      },
    ])
  }

  function updateLine(key: string, field: keyof JournalLineDraft, value: string) {
    setLineItems((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        if (field === 'debit') return { ...line, debit: value, credit: value ? '' : line.credit }
        if (field === 'credit') return { ...line, credit: value, debit: value ? '' : line.debit }
        if (field === 'customerId') return { ...line, customerId: value, settlesOpenItemId: '' }
        if (field === 'vendorId') return { ...line, vendorId: value, settlesOpenItemId: '' }
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
        activityTypeCode:
          line.activityTypeCode
          || deriveManualJournalActivityType({
            journalType: headerValues.journalType,
            sourceType: headerValues.sourceType,
          }),
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
        settlesOpenItemId: line.settlesOpenItemId || null,
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
        isOpenItemRelevant: headerValues.isOpenItemRelevant === 'true',
        subsidiaryId: headerValues.subsidiaryId || null,
        currencyId: headerValues.currencyId || null,
        accountingPeriodId: headerValues.accountingPeriodId || null,
        sourceType: headerValues.sourceType || null,
        sourceId: headerValues.sourceId || null,
        reversesJournalEntryId: headerValues.reversesJournalEntryId || null,
        reversalReasonCode: headerValues.reversalReasonCode || null,
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
      backHref={customizing ? detailHref : isIntercompany ? '/intercompany-journals' : '/journals'}
      backLabel={
        customizing
          ? isIntercompany
            ? '<- Back to Intercompany Journal Detail'
            : '<- Back to Journal Detail'
          : isIntercompany
            ? '<- Back to Intercompany Journals'
            : '<- Back to Journal Entries'
      }
      meta={headerValues.number || initialNumber}
      title={title}
      badge={badge}
      widthClassName="w-full max-w-none"
      actions={
        customizing ? null : (
        <RecordDetailActionBar
          mode={editing || isNew ? (isNew ? 'create' : 'edit') : 'detail'}
          detailHref={detailHref}
          newHref={!isNew ? (isIntercompany ? '/journals/intercompany/new' : '/journals/new') : undefined}
          duplicateHref={!isNew && entryId ? `${isIntercompany ? '/journals/intercompany/new' : '/journals/new'}?duplicateFrom=${entryId}` : undefined}
          exportTitle={!isNew ? title : undefined}
          exportFileName={!isNew ? (headerValues.number || initialNumber) : undefined}
          exportSections={!isNew ? exportSections : undefined}
          customizeHref={!isNew ? customizeHref : undefined}
          editHref={!editing && !isNew ? `${detailHref}?edit=1` : undefined}
          onSave={editing || isNew ? handleSave : undefined}
          saving={saving}
          saveError={saveError || deleteError}
          onDelete={!isNew ? handleDelete : undefined}
          showDeleteInEdit={!isNew}
        />
        )
      }
    >
      <div className="mb-8">
        <TransactionStatsRow
          record={journalStatsRecord}
          stats={journalPageConfig.stats}
          visibleStatCards={activeCustomization?.statCards}
        />
      </div>

      {customizing && activeCustomization ? (
        <JournalDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={activeCustomization}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
          lineColumnDefinitions={lineColumnDefinitions}
          glImpactColumnDefinitions={glImpactColumnDefinitions}
        />
      ) : (
        <RecordHeaderDetails
          purchaseOrderId={entryId}
          editing={editing || isNew}
          sections={headerSections}
          columns={activeCustomization?.formColumns ?? 4}
          containerTitle={isIntercompany ? 'Intercompany Journal Details' : 'Journal Details'}
          containerDescription={
            isIntercompany
              ? 'Core intercompany journal fields organized into configurable sections.'
              : 'Core journal fields organized into configurable sections.'
          }
          showSubsections={false}
          formId="journal-entry-detail-form"
          submitMode="controlled"
          onSubmit={handleSave}
          onValuesChange={(nextValues) => {
            if (!(editing || isNew)) {
              setHeaderValues(nextValues)
              return
            }

            setHeaderValues({
              ...nextValues,
              accountingPeriodId: findAccountingPeriodIdForDate(
                accountingPeriods,
                nextValues.date,
                nextValues.subsidiaryId,
              ),
            })
          }}
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
          <table className={`min-w-full ${lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}`}>
            <thead>
              <tr>
                {visibleLineColumns.map((column) => (
                  <RecordDetailHeaderCell
                    key={column.id}
                    className={
                      column.id === 'debit' || column.id === 'credit'
                      || column.id === 'localDebit' || column.id === 'localCredit'
                      || column.id === 'functionalDebit' || column.id === 'functionalCredit'
                      || column.id === 'groupDebit' || column.id === 'groupCredit'
                        ? 'text-right'
                        : undefined
                    }
                  >
                    {column.label}
                  </RecordDetailHeaderCell>
                ))}
                {editing || isNew ? <RecordDetailHeaderCell /> : null}
              </tr>
            </thead>
            <tbody>
                {lineItems.map((line, index) => (
                  <tr key={line.key} style={index < lineItems.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                    {visibleLineColumns.map((column) => {
                      switch (column.id as JournalLineColumnKey) {
                        case 'line':
                          return <RecordDetailCell key={column.id}>{line.displayOrder + 1}</RecordDetailCell>
                        case 'accountId':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={editing || isNew}
                              value={renderAccountValue(accounts, line.accountId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))}
                              title={renderAccountLabel(accounts, line.accountId)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}
                            >
                              <AccountLookupInput
                                selectedAccountId={line.accountId}
                                accountOptions={accounts}
                                displayMode={getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')}
                                dropdownDisplay={getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])}
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(accountId) => updateLine(line.key, 'accountId', accountId)}
                              />
                            </EditableCell>
                          )
                        case 'description':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={line.description || '-'} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <input value={line.description} onChange={(event) => updateLine(line.key, 'description', event.target.value)} className={lineInputClass} style={inputStyle} />
                            </EditableCell>
                          )
                        case 'activityTypeCode':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={editing || isNew}
                              value={activityTypeOptions.find((option) => option.value === line.activityTypeCode)?.label ?? line.activityTypeCode ?? '-'}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}
                            >
                              <SearchableSelectInput
                                selectedValue={line.activityTypeCode}
                                options={activityTypeOptions.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                  searchText: `${option.label} ${option.value}`,
                                }))}
                                placeholder="Select activity type"
                                searchPlaceholder="Search activity type"
                                dropdownSort="label"
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'activityTypeCode', value)}
                              />
                            </EditableCell>
                          )
                        case 'debit':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={formatLineAmount(line.debit, moneySettings)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}>
                              <AmountInput
                                value={line.debit}
                                moneySettings={moneySettings}
                                onChange={(value) => updateLine(line.key, 'debit', value)}
                                className={`${lineInputClass} text-right`}
                                style={inputStyle}
                              />
                            </EditableCell>
                          )
                        case 'credit':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={formatLineAmount(line.credit, moneySettings)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}>
                              <AmountInput
                                value={line.credit}
                                moneySettings={moneySettings}
                                onChange={(value) => updateLine(line.key, 'credit', value)}
                                className={`${lineInputClass} text-right`}
                                style={inputStyle}
                              />
                            </EditableCell>
                          )
                        case 'localDebit':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={false}
                              value={formatLineAmount(line.localDebit, moneySettings)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}
                            >
                              {null}
                            </EditableCell>
                          )
                        case 'localCredit':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={false}
                              value={formatLineAmount(line.localCredit, moneySettings)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}
                            >
                              {null}
                            </EditableCell>
                          )
                        case 'functionalDebit':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={false}
                              value={formatLineAmount(line.functionalDebit, moneySettings)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}
                            >
                              {null}
                            </EditableCell>
                          )
                        case 'functionalCredit':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={false}
                              value={formatLineAmount(line.functionalCredit, moneySettings)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}
                            >
                              {null}
                            </EditableCell>
                          )
                        case 'groupDebit':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={false}
                              value={formatLineAmount(line.groupDebit, moneySettings)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}
                            >
                              {null}
                            </EditableCell>
                          )
                        case 'groupCredit':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={false}
                              value={formatLineAmount(line.groupCredit, moneySettings)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id], 'text-right')}
                            >
                              {null}
                            </EditableCell>
                          )
                        case 'subsidiaryId':
                          return isIntercompany ? (
                            <EditableCell
                              key={column.id}
                              editing={editing || isNew}
                              value={renderSubsidiaryValue(entities, line.subsidiaryId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))}
                              title={renderEntityLabel(entities, line.subsidiaryId, 'subsidiaryId')}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}
                            >
                              <SearchableSelectInput
                                selectedValue={line.subsidiaryId}
                                options={entities.map((entity) => ({
                                  value: entity.id,
                                  label: `${entity.subsidiaryId} - ${entity.name}`,
                                  displayLabel: renderSubsidiaryValue(entities, entity.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderSubsidiaryValue(entities, entity.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${entity.subsidiaryId} ${entity.name}`,
                                  sortIdText: entity.subsidiaryId,
                                  sortLabelText: entity.name,
                                }))}
                                placeholder="Use header / none"
                                searchPlaceholder="Search subsidiary"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'subsidiaryId', value)}
                              />
                            </EditableCell>
                          ) : null
                        case 'departmentId':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={editing || isNew}
                              value={renderDepartmentValue(departments, line.departmentId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))}
                              title={renderDepartmentLabel(departments, line.departmentId)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}
                            >
                              <SearchableSelectInput
                                selectedValue={line.departmentId}
                                options={departments.map((department) => ({
                                  value: department.id,
                                  label: `${department.departmentNumber ?? department.departmentId} - ${department.name}`,
                                  displayLabel: renderDepartmentValue(departments, department.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderDepartmentValue(departments, department.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${department.departmentNumber ?? department.departmentId ?? ''} ${department.name}`,
                                  sortIdText: department.departmentNumber ?? department.departmentId ?? '',
                                  sortLabelText: department.name,
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search department"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'departmentId', value)}
                              />
                            </EditableCell>
                          )
                        case 'locationId':
                          return (
                            <EditableCell
                              key={column.id}
                              editing={editing || isNew}
                              value={renderLocationValue(locations, line.locationId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))}
                              title={renderLocationLabel(locations, line.locationId)}
                              textClassName={lineReadOnlyTextClass}
                              className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}
                            >
                              <SearchableSelectInput
                                selectedValue={line.locationId}
                                options={locations.map((location) => ({
                                  value: location.id,
                                  label: `${location.code} - ${location.name}`,
                                  displayLabel: renderLocationValue(locations, location.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderLocationValue(locations, location.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${location.code} ${location.name}`,
                                  sortIdText: location.code,
                                  sortLabelText: location.name,
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search location"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'locationId', value)}
                              />
                            </EditableCell>
                          )
                        case 'projectId':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={renderProjectValue(projects, line.projectId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))} title={renderProjectLabel(projects, line.projectId)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <SearchableSelectInput
                                selectedValue={line.projectId}
                                options={projects.map((project) => ({
                                  value: project.id,
                                  label: renderProjectLabel(projects, project.id),
                                  displayLabel: renderProjectValue(projects, project.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderProjectValue(projects, project.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: renderProjectLabel(projects, project.id),
                                  sortIdText: project.name,
                                  sortLabelText: project.description?.trim() ? `${project.name} ${project.description}` : project.name,
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search project"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'projectId', value)}
                              />
                            </EditableCell>
                          )
                        case 'customerId':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={renderCustomerValue(customers, line.customerId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))} title={renderCustomerLabel(customers, line.customerId)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <SearchableSelectInput
                                selectedValue={line.customerId}
                                options={customers.map((customer) => ({
                                  value: customer.id,
                                  label: `${customer.customerId ?? 'CUST'} - ${customer.name}`,
                                  displayLabel: renderCustomerValue(customers, customer.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderCustomerValue(customers, customer.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${customer.customerId ?? 'CUST'} ${customer.name}`,
                                  sortIdText: customer.customerId ?? 'CUST',
                                  sortLabelText: customer.name,
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search customer"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'customerId', value)}
                              />
                            </EditableCell>
                          )
                        case 'vendorId':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={renderVendorValue(vendors, line.vendorId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))} title={renderVendorLabel(vendors, line.vendorId)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <SearchableSelectInput
                                selectedValue={line.vendorId}
                                options={vendors.map((vendor) => ({
                                  value: vendor.id,
                                  label: `${vendor.vendorNumber ?? 'VEND'} - ${vendor.name}`,
                                  displayLabel: renderVendorValue(vendors, vendor.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderVendorValue(vendors, vendor.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${vendor.vendorNumber ?? 'VEND'} ${vendor.name}`,
                                  sortIdText: vendor.vendorNumber ?? 'VEND',
                                  sortLabelText: vendor.name,
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search vendor"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'vendorId', value)}
                              />
                            </EditableCell>
                          )
                        case 'itemId':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={renderItemValue(items, line.itemId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))} title={renderItemLabel(items, line.itemId)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <SearchableSelectInput
                                selectedValue={line.itemId}
                                options={items.map((item) => ({
                                  value: item.id,
                                  label: `${item.sku ?? item.itemId ?? 'ITEM'} - ${item.name}`,
                                  displayLabel: renderItemValue(items, item.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderItemValue(items, item.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${item.sku ?? item.itemId ?? 'ITEM'} ${item.name}`,
                                  sortIdText: item.sku ?? item.itemId ?? 'ITEM',
                                  sortLabelText: item.name,
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search item"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'itemId', value)}
                              />
                            </EditableCell>
                          )
                        case 'employeeId':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={renderEmployeeValue(employees, line.employeeId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'))} title={renderEmployeeLabel(employees, line.employeeId)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <SearchableSelectInput
                                selectedValue={line.employeeId}
                                options={employees.map((employee) => ({
                                  value: employee.id,
                                  label: `${employee.eid ?? employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}`,
                                  displayLabel: renderEmployeeValue(employees, employee.id, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit')),
                                  menuLabel: renderEmployeeValue(employees, employee.id, getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id])),
                                  searchText: `${employee.eid ?? employee.employeeId ?? 'EMP'} ${employee.firstName} ${employee.lastName}`,
                                  sortIdText: employee.eid ?? employee.employeeId ?? 'EMP',
                                  sortLabelText: `${employee.firstName} ${employee.lastName}`.trim(),
                                }))}
                                placeholder="None"
                                searchPlaceholder="Search employee"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'employeeId', value)}
                              />
                            </EditableCell>
                          )
                        case 'settlesOpenItemId': {
                          const settlementOptions = openItems
                            .filter((openItem) => {
                              if (!line.customerId && !line.vendorId) return false
                              const targetType = line.customerId ? 'customer' : 'vendor'
                              const targetId = line.customerId || line.vendorId
                              return openItem.counterpartyType === targetType && openItem.counterpartyId === targetId
                            })
                            .map((openItem) => ({
                              value: openItem.id,
                              label: renderOpenItemLabel(openItem, 'idAndLabel', moneySettings),
                              displayLabel: renderOpenItemLabel(
                                openItem,
                                getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'edit'),
                                moneySettings,
                              ),
                              menuLabel: renderOpenItemLabel(
                                openItem,
                                getLineColumnDropdownDisplayMode(activeCustomization?.lineColumns?.[column.id]),
                                moneySettings,
                              ),
                              searchText: `${openItem.openItemNumber} ${openItem.sourceNumber ?? ''} ${openItem.counterpartyId ?? ''} ${openItem.sourceTransactionId ?? ''} ${openItem.openItemType}`,
                              sortIdText: openItem.openItemNumber,
                              sortLabelText: `${openItem.sourceNumber ?? ''} ${openItem.sourceTransactionId ?? ''}`,
                            }))
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={renderOpenItemValue(openItems, line.settlesOpenItemId, getLineColumnDisplayMode(activeCustomization?.lineColumns?.[column.id], 'view'), moneySettings)} title={renderOpenItemLabelById(openItems, line.settlesOpenItemId, moneySettings)} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <SearchableSelectInput
                                selectedValue={line.settlesOpenItemId}
                                options={settlementOptions}
                                placeholder={line.customerId || line.vendorId ? 'None' : 'Pick customer or vendor first'}
                                searchPlaceholder="Search open item"
                                dropdownSort={getLineColumnDropdownSortMode(activeCustomization?.lineColumns?.[column.id])}
                                textClassName={lineFontSize === 'sm' ? 'text-sm' : 'text-xs'}
                                onSelect={(value) => updateLine(line.key, 'settlesOpenItemId', value)}
                              />
                            </EditableCell>
                          )
                        }
                        case 'memo':
                          return (
                            <EditableCell key={column.id} editing={editing || isNew} value={line.memo || '-'} textClassName={lineReadOnlyTextClass} className={getJournalLineColumnClass(column.id, activeCustomization?.lineColumns?.[column.id])}>
                              <input value={line.memo} onChange={(event) => updateLine(line.key, 'memo', event.target.value)} className={lineInputClass} style={inputStyle} />
                            </EditableCell>
                          )
                        default:
                          return null
                      }
                    })}
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
        <RecordGlImpactSection
          count={glImpactRows.length}
          summary={
            glImpactRows.length
              ? `${fmtCurrency(totalDebits, effectiveCurrencyCode, moneySettings)} debits | ${fmtCurrency(totalCredits, effectiveCurrencyCode, moneySettings)} credits`
              : undefined
          }
          emptyMessage="No journal lines yet, so there is no GL impact to preview."
          rows={lineItems}
          columns={visibleGlImpactColumns}
          fontSize={glImpactFontSize}
          getRowKey={(row) => row.key}
          getHeaderClassName={(columnId) =>
            columnId === 'debit' || columnId === 'credit'
              || columnId === 'localDebit' || columnId === 'localCredit'
              || columnId === 'functionalDebit' || columnId === 'functionalCredit'
              || columnId === 'groupDebit' || columnId === 'groupCredit'
              ? 'text-right'
              : undefined
          }
          getCellClassName={(columnId) => {
            const widthClass =
              columnId === 'description'
                ? 'max-w-[260px] whitespace-pre-wrap break-words'
                : getGlImpactColumnClass(
                    columnId as JournalGlImpactColumnKey,
                    activeCustomization?.glImpactColumns?.[columnId as JournalGlImpactColumnKey],
                  )
            const alignment = columnId === 'debit' || columnId === 'credit' ? 'text-right' : ''
            const translatedAlignment =
              columnId === 'localDebit' || columnId === 'localCredit'
              || columnId === 'functionalDebit' || columnId === 'functionalCredit'
              || columnId === 'groupDebit' || columnId === 'groupCredit'
                ? 'text-right'
                : ''
            return [widthClass, alignment, translatedAlignment, glImpactTextClass].filter(Boolean).join(' ')
          }}
          renderCell={(line, columnId) => {
            switch (columnId as JournalGlImpactColumnKey) {
              case 'line':
                return line.displayOrder + 1
              case 'accountId':
                return renderAccountValue(
                  accounts,
                  line.accountId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'description':
                return line.description || line.memo || '-'
              case 'subsidiaryId':
                return renderSubsidiaryValue(
                  entities,
                  (isIntercompany ? line.subsidiaryId : '') || headerValues.subsidiaryId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'departmentId':
                return renderDepartmentValue(
                  departments,
                  line.departmentId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'locationId':
                return renderLocationValue(
                  locations,
                  line.locationId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'projectId':
                return renderProjectValue(
                  projects,
                  line.projectId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'customerId':
                return renderCustomerValue(
                  customers,
                  line.customerId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'vendorId':
                return renderVendorValue(
                  vendors,
                  line.vendorId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'itemId':
                return renderItemValue(
                  items,
                  line.itemId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'employeeId':
                return renderEmployeeValue(
                  employees,
                  line.employeeId,
                  getGlImpactColumnDisplayMode(activeCustomization?.glImpactColumns?.[columnId]),
                )
              case 'debit':
                return formatLineAmount(line.debit, moneySettings)
              case 'credit':
                return formatLineAmount(line.credit, moneySettings)
              case 'localDebit':
                return formatLineAmount(line.localDebit, moneySettings)
              case 'localCredit':
                return formatLineAmount(line.localCredit, moneySettings)
              case 'functionalDebit':
                return formatLineAmount(line.functionalDebit, moneySettings)
              case 'functionalCredit':
                return formatLineAmount(line.functionalCredit, moneySettings)
              case 'groupDebit':
                return formatLineAmount(line.groupDebit, moneySettings)
              case 'groupCredit':
                return formatLineAmount(line.groupCredit, moneySettings)
              default:
                return '-'
            }
          }}
        />
      ) : null}

      {!isNew && !customizing ? (
        <RecordBottomTabsSection
          defaultActiveKey="related-documents"
          tabs={[
            {
              key: 'related-documents',
              label: 'Related Documents',
              count: relatedDocumentsCount,
              content: (
                <JournalRelatedDocumentsSection
                  embedded
                  count={relatedDocumentsCount}
                  sourceType={(sourceTypeOptions.find((option) => option.value === headerValues.sourceType)?.label ?? headerValues.sourceType) || '-'}
                  sourceId={headerValues.sourceId}
                  description={headerValues.description || '-'}
                  linkedDocuments={linkedDocuments}
                  moneySettings={moneySettings}
                />
              ),
            },
            {
              key: 'communications',
              label: 'Communications',
              count: communicationRows.length,
              content: <CommunicationsSection embedded showDisplayControl={false} rows={communicationRows} compose={composePayload} />,
            },
            {
              key: 'system-notes',
              label: 'System Notes',
              count: systemNotes.length,
              content: <SystemNotesSection embedded showDisplayControl={false} notes={systemNotes} />,
            },
          ]}
        />
      ) : null}
    </RecordDetailPageShell>
  )
}

function EditableCell({
  editing,
  value,
  title,
  className,
  textClassName,
  children,
}: {
  editing: boolean
  value?: string
  title?: string
  className?: string
  textClassName?: string
  children: ReactNode
}) {
  return (
    <RecordDetailCell className={className ?? 'min-w-[110px] max-w-[140px]'}>
      {editing ? children : <span className={`block truncate whitespace-nowrap ${textClassName ?? 'text-xs leading-5'}`} title={title ?? value ?? '-'}>{value ?? '-'}</span>}
    </RecordDetailCell>
  )
}

function getLineColumnDisplayMode(
  columnConfig: JournalLineColumnCustomization | undefined,
  mode: 'edit' | 'view',
): JournalLineDisplayMode {
  if (mode === 'edit') return columnConfig?.editDisplay ?? 'label'
  return columnConfig?.viewDisplay ?? 'label'
}

function getLineColumnDropdownDisplayMode(
  columnConfig: JournalLineColumnCustomization | undefined,
): JournalLineDisplayMode {
  return columnConfig?.dropdownDisplay ?? 'label'
}

function getLineColumnDropdownSortMode(
  columnConfig: JournalLineColumnCustomization | undefined,
): JournalLineDropdownSortMode {
  return columnConfig?.dropdownSort ?? 'id'
}

function getJournalLineColumnClass(
  columnId: JournalLineColumnKey,
  columnConfig?: JournalLineColumnCustomization,
  extraClassName?: string,
) {
  const widthMode = columnConfig?.widthMode ?? 'normal'
  const widthClassByMode = {
    auto: 'min-w-max',
    compact: 'min-w-[100px] max-w-[140px]',
    normal: 'min-w-[120px] max-w-[180px]',
    wide: 'min-w-[180px] max-w-[260px]',
  } as const

  const baseClass =
    columnId === 'line'
      ? 'min-w-[48px]'
      : columnId === 'debit' || columnId === 'credit'
        || columnId === 'localDebit' || columnId === 'localCredit'
        || columnId === 'functionalDebit' || columnId === 'functionalCredit'
        || columnId === 'groupDebit' || columnId === 'groupCredit'
        ? 'min-w-[110px]'
        : widthClassByMode[widthMode]

  return [baseClass, extraClassName].filter(Boolean).join(' ')
}

function getGlImpactColumnDisplayMode(
  columnConfig: JournalGlImpactColumnCustomization | undefined,
): JournalLineDisplayMode {
  return columnConfig?.viewDisplay ?? 'label'
}

function getGlImpactColumnClass(
  columnId: JournalGlImpactColumnKey,
  columnConfig?: JournalGlImpactColumnCustomization,
  extraClassName?: string,
) {
  const widthMode = columnConfig?.widthMode ?? 'normal'
  const widthClassByMode = {
    auto: 'min-w-max',
    compact: 'min-w-[100px] max-w-[140px]',
    normal: 'min-w-[120px] max-w-[180px]',
    wide: 'min-w-[180px] max-w-[260px]',
  } as const

  const baseClass =
    columnId === 'line'
      ? 'min-w-[48px]'
      : columnId === 'debit' || columnId === 'credit'
        || columnId === 'localDebit' || columnId === 'localCredit'
        || columnId === 'functionalDebit' || columnId === 'functionalCredit'
        || columnId === 'groupDebit' || columnId === 'groupCredit'
        ? 'min-w-[110px]'
        : widthClassByMode[widthMode]

  return [baseClass, extraClassName].filter(Boolean).join(' ')
}

function renderCodeAndName(
  code: string | null | undefined,
  label: string | null | undefined,
  mode: JournalLineDisplayMode,
) {
  const safeCode = code?.trim()
  const safeLabel = label?.trim()
  if (!safeCode && !safeLabel) return '-'
  if (mode === 'id') return safeCode ?? safeLabel ?? '-'
  if (mode === 'label') return safeLabel ?? safeCode ?? '-'
  return safeCode && safeLabel ? `${safeCode} - ${safeLabel}` : safeCode ?? safeLabel ?? '-'
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

function renderSubsidiaryValue(
  values: EntityOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.subsidiaryId, value.name, mode)
}

function renderAccountLabel(
  values: AccountOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.accountNumber} - ${value.name}`
}

function renderAccountValue(
  values: AccountOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.accountNumber, value.name, mode)
}

function formatLineAmount(value: string | undefined, moneySettings: MoneySettings) {
  if (!value?.trim()) return '-'
  const amount = Number(value)
  if (Number.isNaN(amount)) return '-'
  return (
    fmtCurrency(amount, undefined, {
      ...moneySettings,
      showCurrencyOn: 'documentHeadersOnly',
    }) || '-'
  )
}

function AmountInput({
  value,
  moneySettings,
  onChange,
  className,
  style,
}: {
  value: string
  moneySettings: MoneySettings
  onChange: (value: string) => void
  className: string
  style: CSSProperties
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? draft : formatEditableAmount(value, moneySettings)}
      onFocus={() => {
        setFocused(true)
        setDraft(value)
      }}
      onChange={(event) => {
        const nextDraft = normalizeAmountDraft(event.target.value)
        setDraft(nextDraft)
        onChange(nextDraft)
      }}
      onBlur={() => {
        const parsed = parseMoneyInput(draft, moneySettings.decimalPlaces)
        const normalized = parsed == null ? '' : String(parsed)
        onChange(normalized)
        setDraft(normalized)
        setFocused(false)
      }}
      className={className}
      style={style}
    />
  )
}

function normalizeAmountDraft(value: string) {
  return value.replace(/,/g, '').replace(/[^\d.-]/g, '')
}

function formatEditableAmount(value: string | undefined, moneySettings: MoneySettings) {
  if (!value?.trim()) return ''
  return formatLineAmount(value, {
    ...moneySettings,
    zeroFormat: 'zero',
  })
}

function renderDepartmentLabel(
  values: DepartmentOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.departmentNumber ?? value.departmentId} - ${value.name}`
}

function renderDepartmentValue(
  values: DepartmentOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.departmentNumber ?? value.departmentId, value.name, mode)
}

function renderLocationLabel(
  values: LocationOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.code} - ${value.name}`
}

function renderLocationValue(
  values: LocationOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.code, value.name, mode)
}

function renderItemLabel(
  values: ItemOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.sku ?? value.itemId ?? 'ITEM'} - ${value.name}`
}

function renderItemValue(
  values: ItemOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.sku ?? value.itemId ?? 'ITEM', value.name, mode)
}

function renderCustomerLabel(
  values: CustomerOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.customerId ?? 'CUST'} - ${value.name}`
}

function renderCustomerValue(
  values: CustomerOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.customerId ?? 'CUST', value.name, mode)
}

function renderVendorLabel(
  values: VendorOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.vendorNumber ?? 'VEND'} - ${value.name}`
}

function renderVendorValue(
  values: VendorOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.vendorNumber ?? 'VEND', value.name, mode)
}

function renderProjectLabel(
  values: ProjectOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return value.description?.trim() ? `${value.name} - ${value.description}` : value.name
}

function renderProjectValue(
  values: ProjectOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  const detailLabel = value.description?.trim() ? `${value.name} - ${value.description}` : value.name
  if (mode === 'id') return value.name
  if (mode === 'label') return value.name
  return detailLabel
}

function renderEmployeeLabel(
  values: EmployeeOption[],
  selectedId: string,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return `${value.eid ?? value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`
}

function renderEmployeeValue(
  values: EmployeeOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderCodeAndName(value.eid ?? value.employeeId ?? 'EMP', `${value.firstName} ${value.lastName}`.trim(), mode)
}

function renderOpenItemLabel(
  openItem: OpenItemOption,
  mode: JournalLineDisplayMode,
  moneySettings: MoneySettings,
) {
  const idText = openItem.openItemNumber
  const labelText = `${openItem.sourceNumber ?? openItem.sourceTransactionId ?? openItem.openItemType} (${fmtCurrency(openItem.originalTransactionAmount, undefined, moneySettings)})`
  return renderCodeAndName(idText, labelText, mode)
}

function renderOpenItemLabelById(
  values: OpenItemOption[],
  selectedId: string,
  moneySettings: MoneySettings,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return ''
  return renderOpenItemLabel(value, 'idAndLabel', moneySettings)
}

function renderOpenItemValue(
  values: OpenItemOption[],
  selectedId: string,
  mode: JournalLineDisplayMode,
  moneySettings: MoneySettings,
) {
  const value = values.find((entry) => entry.id === selectedId)
  if (!value) return '-'
  return renderOpenItemLabel(value, mode, moneySettings)
}

const inputStyle = { borderColor: 'var(--border-muted)' }

function AccountLookupInput({
  selectedAccountId,
  accountOptions,
  displayMode,
  dropdownDisplay,
  dropdownSort,
  textClassName,
  onSelect,
}: {
  selectedAccountId: string
  accountOptions: AccountOption[]
  displayMode: JournalLineDisplayMode
  dropdownDisplay: JournalLineDisplayMode
  dropdownSort: JournalLineDropdownSortMode
  textClassName: string
  onSelect: (accountId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{ bottom: number; left: number; minWidth: number; maxWidth: number } | null>(null)
  const selectedAccount = accountOptions.find((account) => account.id === selectedAccountId) ?? null
  const selectedLabel = selectedAccount ? `${selectedAccount.accountNumber} - ${selectedAccount.name}` : ''
  const selectedDisplayLabel = selectedAccount ? renderCodeAndName(selectedAccount.accountNumber, selectedAccount.name, displayMode) : ''

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
        setQuery(selectedLabel)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [selectedLabel])

  useEffect(() => {
    if (!open || !inputRef.current) return

    function updatePosition() {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const maxWidth = window.innerWidth - 32
      setDropdownStyle({
        bottom: Math.max(window.innerHeight - rect.top + 4, 8),
        left: Math.max(16, rect.left),
        minWidth: rect.width + 120,
        maxWidth,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [accountOptions, open, query])

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const sortedAccounts = [...accountOptions].sort((left, right) =>
      (dropdownSort === 'label' ? left.name : `${left.accountNumber} ${left.name}`).localeCompare(
        dropdownSort === 'label' ? right.name : `${right.accountNumber} ${right.name}`,
        undefined,
        {
          sensitivity: 'base',
          numeric: true,
        },
      ),
    )
    if (!normalizedQuery) return sortedAccounts
    return sortedAccounts
      .filter((account) => `${account.accountNumber} ${account.accountId} ${account.name}`.toLowerCase().includes(normalizedQuery))
  }, [accountOptions, dropdownSort, query])

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : selectedDisplayLabel}
          onFocus={() => {
            setOpen(true)
            setQuery(selectedLabel)
          }}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setOpen(true)
            if (selectedAccountId && nextQuery !== selectedLabel) {
              onSelect('')
            }
          }}
          placeholder="Select or search GL account"
          title={selectedLabel || 'Select or search GL account'}
          className={`w-full rounded-md border bg-transparent px-2.5 py-1.5 pr-8 text-white ${textClassName}`}
          style={{
            ...inputStyle,
            backgroundColor: 'var(--card-elevated)',
            colorScheme: 'dark',
            WebkitTextFillColor: 'white',
          }}
        />
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            const nextOpen = !open
              setOpen(nextOpen)
              if (nextOpen) {
                setQuery(selectedLabel)
              inputRef.current?.focus()
            }
          }}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-md"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Toggle GL account options"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        </button>
      </div>
      {open && filteredAccounts.length > 0 && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[220] max-h-60 overflow-y-auto rounded-md border shadow-2xl"
              style={{
                bottom: dropdownStyle.bottom,
                left: dropdownStyle.left,
                minWidth: dropdownStyle.minWidth,
                width: 'max-content',
                maxWidth: dropdownStyle.maxWidth,
                borderColor: 'var(--border-muted)',
                backgroundColor: 'var(--card-elevated)',
              }}
            >
              {filteredAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(account.id)
                    setQuery(`${account.accountNumber} - ${account.name}`)
                    setOpen(false)
                  }}
                  className={`block w-full whitespace-nowrap px-2.5 py-1.5 text-left hover:bg-white/5 ${textClassName}`}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {renderCodeAndName(account.accountNumber, account.name, dropdownDisplay)}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

type SearchableSelectOption = SharedSearchableSelectOption

function SearchableSelectInput({
  selectedValue,
  options,
  placeholder,
  searchPlaceholder,
  dropdownSort,
  textClassName,
  onSelect,
}: {
  selectedValue: string
  options: SearchableSelectOption[]
  placeholder: string
  searchPlaceholder: string
  dropdownSort: JournalLineDropdownSortMode
  textClassName: string
  onSelect: (value: string) => void
}) {
  return (
    <SharedSearchableSelect
      selectedValue={selectedValue}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      sortMode={dropdownSort}
      textClassName={textClassName}
      onSelect={onSelect}
    />
  )
}

function JournalRelatedDocumentsSection({
  embedded = false,
  count,
  sourceType,
  sourceId,
  description,
  linkedDocuments = [],
  moneySettings,
}: {
  embedded?: boolean
  count: number
  sourceType: string
  sourceId: string
  description: string
  linkedDocuments?: DocumentRelationshipSummary[]
  moneySettings: MoneySettings
}) {
  const hasRows = Boolean(sourceId) || linkedDocuments.length > 0

  const content = hasRows ? (
    <table className="min-w-full">
      <thead>
        <tr>
          <RecordDetailHeaderCell>Relationship</RecordDetailHeaderCell>
          <RecordDetailHeaderCell>Type</RecordDetailHeaderCell>
          <RecordDetailHeaderCell>Txn Id</RecordDetailHeaderCell>
          <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
          <RecordDetailHeaderCell>Amount</RecordDetailHeaderCell>
          <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
          <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
        </tr>
      </thead>
      <tbody>
        {sourceId ? (
          <tr>
            <RecordDetailCell>Source</RecordDetailCell>
            <RecordDetailCell>{sourceType}</RecordDetailCell>
            <RecordDetailCell>{sourceId}</RecordDetailCell>
            <RecordDetailCell>-</RecordDetailCell>
            <RecordDetailCell>-</RecordDetailCell>
            <RecordDetailCell>-</RecordDetailCell>
            <RecordDetailCell>{description}</RecordDetailCell>
          </tr>
        ) : null}
        {linkedDocuments.map((document) => (
          <tr key={document.id}>
            <RecordDetailCell>{document.relationshipLabel}</RecordDetailCell>
            <RecordDetailCell>{document.relatedRecordLabel}</RecordDetailCell>
            <RecordDetailCell>
              {document.href ? (
                <Link
                  href={document.href}
                  className="hover:underline"
                  style={{ color: 'var(--accent-primary-strong)' }}
                >
                  {document.relatedNumber}
                </Link>
              ) : (
                document.relatedNumber
              )}
            </RecordDetailCell>
            <RecordDetailCell>{document.relatedStatus ?? '-'}</RecordDetailCell>
            <RecordDetailCell>
              {document.relatedAmount != null ? fmtCurrency(document.relatedAmount, undefined, moneySettings) : '-'}
            </RecordDetailCell>
            <RecordDetailCell>{document.relatedDate ? fmtDocumentDate(document.relatedDate, moneySettings) : '-'}</RecordDetailCell>
            <RecordDetailCell>{document.relatedDescription ?? '-'}</RecordDetailCell>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <RecordDetailEmptyState message="No related source document is linked to this journal yet." />
  )

  if (embedded) {
    return content
  }

  return (
    <RecordDetailSection title="Related Documents" count={count} summary={sourceId ? sourceType : undefined} collapsible>
      {content}
    </RecordDetailSection>
  )
}
