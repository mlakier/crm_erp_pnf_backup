'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SearchableSelect from '@/components/SearchableSelect'
import { formatGlAccountLabel } from '@/lib/gl-account-label'
import { moneyEquals, sumMoney } from '@/lib/money'

type EntityOption = { id: string; subsidiaryId: string; name: string }
type AccountOption = { id: string; accountId: string; accountNumber: string; name: string }
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
type SearchOption = { value: string; label: string; searchText?: string; sortIdText?: string; sortLabelText?: string }
type JournalLineDraft = {
  key: string
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

export default function JournalEntryCreateForm({
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
  onSuccess,
  onCancel,
  redirectTo,
  cancelHref,
}: {
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
  onSuccess?: () => void
  onCancel?: () => void
  redirectTo?: string
  cancelHref?: string
}) {
  const router = useRouter()
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [total, setTotal] = useState('')
  const [status, setStatus] = useState(statusOptions[0]?.value ?? '')
  const [subsidiaryId, setSubsidiaryId] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [accountingPeriodId, setAccountingPeriodId] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [postedByEmployeeId, setPostedByEmployeeId] = useState('')
  const [approvedByEmployeeId, setApprovedByEmployeeId] = useState('')
  const [lineItems, setLineItems] = useState<JournalLineDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputStyle = { borderColor: 'var(--border-muted)' }
  const inputClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'
  const totalDebits = useMemo(() => sumMoney(lineItems.map((line) => line.debit)), [lineItems])
  const totalCredits = useMemo(() => sumMoney(lineItems.map((line) => line.credit)), [lineItems])
  const derivedTotal = useMemo(() => sumMoney(lineItems.map((line) => line.debit)), [lineItems])
  const toSearchOptions = (options: SelectOption[]): SearchOption[] =>
    options.map((option) => ({
      value: option.value,
      label: option.label,
      searchText: `${option.value} ${option.label}`,
      sortIdText: option.value,
      sortLabelText: option.label,
    }))
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: formatGlAccountLabel(account),
        searchText: `${account.accountNumber} ${account.accountId} ${account.name}`,
        sortIdText: account.accountNumber,
        sortLabelText: account.name,
      })),
    [accounts],
  )
  const entityOptions = useMemo(
    () =>
      entities.map((entity) => ({
        value: entity.id,
        label: `${entity.subsidiaryId} - ${entity.name}`,
        searchText: `${entity.subsidiaryId} ${entity.name}`,
        sortIdText: entity.subsidiaryId,
        sortLabelText: entity.name,
      })),
    [entities],
  )
  const departmentOptions = useMemo(
    () =>
      departments.map((department) => ({
        value: department.id,
        label: `${department.departmentId} - ${department.name}`,
        searchText: `${department.departmentId} ${department.name}`,
        sortIdText: department.departmentId,
        sortLabelText: department.name,
      })),
    [departments],
  )
  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: `${location.locationId} - ${location.name}`,
        searchText: `${location.locationId} ${location.name}`,
        sortIdText: location.locationId,
        sortLabelText: location.name,
      })),
    [locations],
  )
  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
        searchText: project.name,
        sortLabelText: project.name,
      })),
    [projects],
  )
  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: `${customer.customerId ?? 'CUST'} - ${customer.name}`,
        searchText: `${customer.customerId ?? 'CUST'} ${customer.name}`,
        sortIdText: customer.customerId ?? 'CUST',
        sortLabelText: customer.name,
      })),
    [customers],
  )
  const vendorOptions = useMemo(
    () =>
      vendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.vendorNumber ?? 'VEND'} - ${vendor.name}`,
        searchText: `${vendor.vendorNumber ?? 'VEND'} ${vendor.name}`,
        sortIdText: vendor.vendorNumber ?? 'VEND',
        sortLabelText: vendor.name,
      })),
    [vendors],
  )
  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: `${item.itemId ?? 'ITEM'} - ${item.name}`,
        searchText: `${item.itemId ?? 'ITEM'} ${item.name}`,
        sortIdText: item.itemId ?? 'ITEM',
        sortLabelText: item.name,
      })),
    [items],
  )
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}`,
        searchText: `${employee.employeeId ?? 'EMP'} ${employee.firstName} ${employee.lastName}`,
        sortIdText: employee.employeeId ?? 'EMP',
        sortLabelText: `${employee.firstName} ${employee.lastName}`,
      })),
    [employees],
  )

  const addLine = () => {
    setLineItems((current) => [
      ...current,
      {
        key: `${Date.now()}-${current.length}`,
        accountId: '',
        description: '',
        debit: '',
        credit: '',
        memo: '',
        subsidiaryId: subsidiaryId || '',
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

  const removeLine = (key: string) => {
    setLineItems((current) => current.filter((line) => line.key !== key))
  }

  const updateLine = (key: string, field: keyof JournalLineDraft, value: string) => {
    setLineItems((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        if (field === 'debit') return { ...line, debit: value, credit: value ? '' : line.credit }
        if (field === 'credit') return { ...line, credit: value, debit: value ? '' : line.debit }
        return { ...line, [field]: value }
      }),
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (lineItems.length > 0 && !moneyEquals(totalDebits, totalCredits)) {
      setError('Journal lines must balance before saving.')
      return
    }

    setSaving(true)
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        date,
        description: description || null,
        total: lineItems.length > 0 ? derivedTotal : total,
        status,
        subsidiaryId,
        currencyId,
        accountingPeriodId,
        sourceType,
        sourceId,
        postedByEmployeeId,
        approvedByEmployeeId,
        lineItems: lineItems.map((line) => ({
          accountId: line.accountId,
          description: line.description || null,
          debit: line.debit || '0',
          credit: line.credit || '0',
          memo: line.memo || null,
          subsidiaryId: line.subsidiaryId || null,
          departmentId: line.departmentId || null,
          locationId: line.locationId || null,
          projectId: line.projectId || null,
          customerId: line.customerId || null,
          vendorId: line.vendorId || null,
          itemId: line.itemId || null,
          employeeId: line.employeeId || null,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      if (onSuccess) {
        onSuccess()
      } else if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
      }
    } else {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Error creating journal entry')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Number</label><input type="text" value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} style={inputStyle} required placeholder="JE-000001" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={inputStyle} required /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} style={inputStyle} rows={2} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total</label><input type="number" step="0.01" value={lineItems.length > 0 ? derivedTotal.toFixed(2) : total} onChange={(e) => setTotal(e.target.value)} className={inputClass} style={inputStyle} disabled={lineItems.length > 0} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label><SearchableSelect selectedValue={status} onSelect={setStatus} options={toSearchOptions(statusOptions)} placeholder="Select status" searchPlaceholder="Search status" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Header Subsidiary</label><SearchableSelect selectedValue={subsidiaryId} onSelect={setSubsidiaryId} options={entityOptions} placeholder="None" searchPlaceholder="Search subsidiary" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Currency</label><SearchableSelect selectedValue={currencyId} onSelect={setCurrencyId} options={currencies.map((currency) => ({ value: currency.id, label: `${currency.code ?? currency.currencyId} - ${currency.name}`, searchText: `${currency.code ?? currency.currencyId} ${currency.name}`, sortIdText: currency.code ?? currency.currencyId, sortLabelText: currency.name }))} placeholder="None" searchPlaceholder="Search currency" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Accounting Period</label><SearchableSelect selectedValue={accountingPeriodId} onSelect={setAccountingPeriodId} options={accountingPeriods.map((period) => ({ value: period.id, label: period.name, searchText: period.name, sortLabelText: period.name }))} placeholder="None" searchPlaceholder="Search accounting period" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source Type</label><SearchableSelect selectedValue={sourceType} onSelect={setSourceType} options={toSearchOptions(sourceTypeOptions)} placeholder="None" searchPlaceholder="Search source type" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source Id</label><input type="text" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Prepared By</label><SearchableSelect selectedValue={postedByEmployeeId} onSelect={setPostedByEmployeeId} options={employeeOptions} placeholder="None" searchPlaceholder="Search employee" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Approved By</label><SearchableSelect selectedValue={approvedByEmployeeId} onSelect={setApprovedByEmployeeId} options={employeeOptions} placeholder="None" searchPlaceholder="Search employee" /></div>

      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card)' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Journal Lines</h3>
          <button type="button" onClick={addLine} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--accent-primary-strong)' }}>
            + Add Line
          </button>
        </div>
        {lineItems.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No journal lines yet. Add lines to assign subsidiaries at the line level.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>GL Account</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Description</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide w-28" style={{ color: 'var(--text-muted)' }}>Debit</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide w-28" style={{ color: 'var(--text-muted)' }}>Credit</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Subsidiary</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Department</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Location</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Project</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customer</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Vendor</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Item</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Employee</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Memo</th>
                    <th className="px-2 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line) => (
                    <tr key={line.key} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.accountId} onSelect={(value) => updateLine(line.key, 'accountId', value)} options={accountOptions} placeholder="Select account" searchPlaceholder="Search account" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={line.description} onChange={(e) => updateLine(line.key, 'description', e.target.value)} className="w-full min-w-[140px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(line.key, 'debit', e.target.value)} className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(line.key, 'credit', e.target.value)} className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.subsidiaryId} onSelect={(value) => updateLine(line.key, 'subsidiaryId', value)} options={entityOptions} placeholder="Use header / none" searchPlaceholder="Search subsidiary" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.departmentId} onSelect={(value) => updateLine(line.key, 'departmentId', value)} options={departmentOptions} placeholder="None" searchPlaceholder="Search department" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.locationId} onSelect={(value) => updateLine(line.key, 'locationId', value)} options={locationOptions} placeholder="None" searchPlaceholder="Search location" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.projectId} onSelect={(value) => updateLine(line.key, 'projectId', value)} options={projectOptions} placeholder="None" searchPlaceholder="Search project" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.customerId} onSelect={(value) => updateLine(line.key, 'customerId', value)} options={customerOptions} placeholder="None" searchPlaceholder="Search customer" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.vendorId} onSelect={(value) => updateLine(line.key, 'vendorId', value)} options={vendorOptions} placeholder="None" searchPlaceholder="Search vendor" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.itemId} onSelect={(value) => updateLine(line.key, 'itemId', value)} options={itemOptions} placeholder="None" searchPlaceholder="Search item" />
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect selectedValue={line.employeeId} onSelect={(value) => updateLine(line.key, 'employeeId', value)} options={employeeOptions} placeholder="None" searchPlaceholder="Search employee" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={line.memo} onChange={(e) => updateLine(line.key, 'memo', e.target.value)} className="w-full min-w-[120px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button type="button" onClick={() => removeLine(line.key)} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <div style={{ color: 'var(--text-secondary)' }}>Debits: <span className="font-medium text-white">{totalDebits.toFixed(2)}</span></div>
              <div style={{ color: 'var(--text-secondary)' }}>Credits: <span className="font-medium text-white">{totalCredits.toFixed(2)}</span></div>
              <div style={{ color: moneyEquals(totalDebits, totalCredits) ? 'var(--text-secondary)' : 'var(--danger)' }}>
                Balance: <span className="font-medium text-white">{(totalDebits - totalCredits).toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      <div className="flex justify-end gap-3 pt-2">
        {cancelHref ? (
          <Link href={cancelHref} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
            Cancel
          </Link>
        ) : (
          <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Journal Entry'}</button>
      </div>
    </form>
  )
}
