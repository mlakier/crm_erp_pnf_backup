'use client'

import { useState } from 'react'

type EntityOption = { id: string; subsidiaryId: string; name: string }
type CurrencyOption = { id: string; currencyId: string; code?: string; name: string }
type PeriodOption = { id: string; name: string }
type EmployeeOption = { id: string; employeeId: string | null; firstName: string; lastName: string }
type SelectOption = { value: string; label: string }

export default function JournalEntryCreateForm({
  entities,
  currencies,
  accountingPeriods,
  employees,
  statusOptions,
  onSuccess,
  onCancel,
}: {
  entities: EntityOption[]
  currencies: CurrencyOption[]
  accountingPeriods: PeriodOption[]
  employees: EmployeeOption[]
  statusOptions: SelectOption[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
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
  const [saving, setSaving] = useState(false)

  const inputStyle = { borderColor: 'var(--border-muted)' }
  const inputClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        date,
        description: description || null,
        total,
        status,
        subsidiaryId,
        currencyId,
        accountingPeriodId,
        sourceType,
        sourceId,
        postedByEmployeeId,
        approvedByEmployeeId,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onSuccess?.()
    } else {
      alert('Error creating journal entry')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Number</label><input type="text" value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} style={inputStyle} required placeholder="JE-000001" /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={inputStyle} required /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} style={inputStyle} rows={2} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total</label><input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} style={inputStyle}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Subsidiary</label><select value={subsidiaryId} onChange={(e) => setSubsidiaryId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.subsidiaryId} - {entity.name}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Currency</label><select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{currencies.map((currency) => <option key={currency.id} value={currency.id}>{currency.code ?? currency.currencyId} - {currency.name}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Accounting Period</label><select value={accountingPeriodId} onChange={(e) => setAccountingPeriodId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{accountingPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source Type</label><input type="text" value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Source Id</label><input type="text" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Posted By</label><select value={postedByEmployeeId} onChange={(e) => setPostedByEmployeeId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId ?? 'EMP'} - {employee.firstName} {employee.lastName}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Approved By</label><select value={approvedByEmployeeId} onChange={(e) => setApprovedByEmployeeId(e.target.value)} className={inputClass} style={inputStyle}><option value="">None</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId ?? 'EMP'} - {employee.firstName} {employee.lastName}</option>)}</select></div>
      <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button><button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving...' : 'Create Journal Entry'}</button></div>
    </form>
  )
}
