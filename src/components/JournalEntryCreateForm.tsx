'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { moneyEquals, sumMoney } from '@/lib/money'

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
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} style={inputStyle}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Header Subsidiary</label><select value={subsidiaryId} onChange={(e) => setSubsidiaryId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Currency</label><select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code ?? currency.currencyId} - {currency.name}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Accounting Period</label><select value={accountingPeriodId} onChange={(e) => setAccountingPeriodId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{accountingPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source Type</label><select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{sourceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source Id</label><input type="text" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Prepared By</label><select value={postedByEmployeeId} onChange={(e) => setPostedByEmployeeId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId ?? 'EMP'} - {employee.firstName} {employee.lastName}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Approved By</label><select value={approvedByEmployeeId} onChange={(e) => setApprovedByEmployeeId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId ?? 'EMP'} - {employee.firstName} {employee.lastName}</option>)}</select></div>

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
                        <select value={line.accountId} onChange={(e) => updateLine(line.key, 'accountId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>Select account</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {account.accountId} - {account.name}
                            </option>
                          ))}
                        </select>
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
                        <select value={line.subsidiaryId} onChange={(e) => updateLine(line.key, 'subsidiaryId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>Use header / none</option>
                          {entities.map((entity) => (
                            <option key={entity.id} value={entity.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {entity.subsidiaryId} - {entity.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.departmentId} onChange={(e) => updateLine(line.key, 'departmentId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {departments.map((department) => (
                            <option key={department.id} value={department.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {department.departmentId} - {department.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.locationId} onChange={(e) => updateLine(line.key, 'locationId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {location.locationId} - {location.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.projectId} onChange={(e) => updateLine(line.key, 'projectId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.customerId} onChange={(e) => updateLine(line.key, 'customerId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {customer.customerId ?? 'CUST'} - {customer.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.vendorId} onChange={(e) => updateLine(line.key, 'vendorId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {vendor.vendorNumber ?? 'VEND'} - {vendor.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.itemId} onChange={(e) => updateLine(line.key, 'itemId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {item.itemId ?? 'ITEM'} - {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.employeeId} onChange={(e) => updateLine(line.key, 'employeeId', e.target.value)} className="w-full min-w-[180px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                          <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>None</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                              {employee.employeeId ?? 'EMP'} - {employee.firstName} {employee.lastName}
                            </option>
                          ))}
                        </select>
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
