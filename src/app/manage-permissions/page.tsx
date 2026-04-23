'use client'

import { Fragment, useEffect, useState } from 'react'

/* ── Every navigable list page in the app ── */
const ALL_PAGES = [
  // Master Data
  { key: 'users', label: 'Users', group: 'Master Data' },
  { key: 'roles', label: 'Roles', group: 'Master Data' },
  { key: 'contacts', label: 'Contacts', group: 'Master Data' },
  { key: 'customers', label: 'Customers', group: 'Master Data' },
  { key: 'vendors', label: 'Vendors', group: 'Master Data' },
  { key: 'items', label: 'Items', group: 'Master Data' },
  { key: 'employees', label: 'Employees', group: 'Master Data' },
  { key: 'departments', label: 'Departments', group: 'Master Data' },
  { key: 'subsidiaries', label: 'Subsidiaries', group: 'Master Data' },
  { key: 'currencies', label: 'Currencies', group: 'Master Data' },
  { key: 'chart-of-accounts', label: 'Chart of Accounts', group: 'Master Data' },
  // OTC
  { key: 'leads', label: 'Leads', group: 'OTC', statusKey: 'LEAD-STATUS' },
  { key: 'opportunities', label: 'Opportunities', group: 'OTC', statusKey: 'OPP-STAGE' },
  { key: 'quotes', label: 'Quotes', group: 'OTC', statusKey: 'QUOTE-STATUS' },
  { key: 'sales-orders', label: 'Sales Orders', group: 'OTC', statusKey: 'SO-STATUS' },
  { key: 'fulfillments', label: 'Fulfillments', group: 'OTC' },
  { key: 'invoices', label: 'Invoices', group: 'OTC', statusKey: 'INV-STATUS' },
  { key: 'invoice-receipts', label: 'Invoice Receipts', group: 'OTC' },
  // PTP
  { key: 'purchase-requisitions', label: 'Purchase Requisitions', group: 'PTP', statusKey: 'REQ-STATUS' },
  { key: 'purchase-orders', label: 'Purchase Orders', group: 'PTP', statusKey: 'PO-STATUS' },
  { key: 'receipts', label: 'Receipts', group: 'PTP', statusKey: 'RECEIPT-STATUS' },
  { key: 'bills', label: 'Bills', group: 'PTP', statusKey: 'BILL-STATUS' },
  { key: 'bill-payments', label: 'Bill Payments', group: 'PTP' },
  // RTR
  { key: 'journals', label: 'Journals', group: 'RTR' },
]

const PROCESS_GROUPS = ['OTC', 'PTP', 'RTR']

type Role = { id: string; roleId: string; name: string; description?: string }
type PermRow = {
  page: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  blockedStates: string[]
}
type ListConfigResponse = {
  rowsByKey?: Record<string, Array<{ value: string }>>
}
type PermissionResponseRow = {
  page: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  blockedStates?: string | null
}
type AiPermission = {
  page: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  blockedStates?: string[]
}
type AiPermissionResponse = {
  permissions?: AiPermission[]
  error?: string
}

/* ── STATUS PILL colours ── */
const STATUS_COLORS: Record<string, { color: string; border: string }> = {
  draft: { color: '#94a3b8', border: '#475569' },
  pending: { color: '#f59e0b', border: '#d97706' },
  'pending approval': { color: '#f59e0b', border: '#d97706' },
  approved: { color: '#22c55e', border: '#16a34a' },
  ordered: { color: '#3b82f6', border: '#2563eb' },
  cancelled: { color: '#ef4444', border: '#dc2626' },
  closed: { color: '#6b7280', border: '#4b5563' },
  shipped: { color: '#8b5cf6', border: '#7c3aed' },
  delivered: { color: '#22c55e', border: '#16a34a' },
  open: { color: '#3b82f6', border: '#2563eb' },
  received: { color: '#22c55e', border: '#16a34a' },
  partial: { color: '#f59e0b', border: '#d97706' },
  paid: { color: '#22c55e', border: '#16a34a' },
  overdue: { color: '#ef4444', border: '#dc2626' },
  void: { color: '#ef4444', border: '#dc2626' },
  posted: { color: '#22c55e', border: '#16a34a' },
  processed: { color: '#22c55e', border: '#16a34a' },
  cleared: { color: '#3b82f6', border: '#2563eb' },
  qualified: { color: '#22c55e', border: '#16a34a' },
  unqualified: { color: '#ef4444', border: '#dc2626' },
  converted: { color: '#8b5cf6', border: '#7c3aed' },
  new: { color: '#3b82f6', border: '#2563eb' },
  contacted: { color: '#f59e0b', border: '#d97706' },
  won: { color: '#22c55e', border: '#16a34a' },
  lost: { color: '#ef4444', border: '#dc2626' },
  negotiation: { color: '#f59e0b', border: '#d97706' },
  proposal: { color: '#8b5cf6', border: '#7c3aed' },
  discovery: { color: '#3b82f6', border: '#2563eb' },
  prospecting: { color: '#94a3b8', border: '#475569' },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getStatusStyle(status: string) {
  const s = status.toLowerCase()
  const c = STATUS_COLORS[s] ?? { color: '#94a3b8', border: '#475569' }
  return { color: c.color, borderColor: c.border, backgroundColor: 'transparent', border: '1px solid ' + c.border }
}

/* ── AI ROLE SUGGESTIONS ── */
const AI_SUGGESTIONS: Record<string, Partial<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>> = {
  admin: Object.fromEntries(ALL_PAGES.map(p => [p.key, { canView: true, canCreate: true, canEdit: true, canDelete: true }])),
  manager: Object.fromEntries(ALL_PAGES.map(p => [p.key, { canView: true, canCreate: true, canEdit: true, canDelete: p.group === 'Master Data' ? false : true }])),
  'sales rep': Object.fromEntries(ALL_PAGES.map(p => {
    if (['leads','opportunities','quotes','sales-orders','fulfillments','invoices','invoice-receipts','contacts','customers'].includes(p.key))
      return [p.key, { canView: true, canCreate: true, canEdit: true, canDelete: false }]
    return [p.key, { canView: true, canCreate: false, canEdit: false, canDelete: false }]
  })),
  'purchasing agent': Object.fromEntries(ALL_PAGES.map(p => {
    if (['purchase-requisitions','purchase-orders','receipts','bills','bill-payments','vendors','items'].includes(p.key))
      return [p.key, { canView: true, canCreate: true, canEdit: true, canDelete: false }]
    return [p.key, { canView: true, canCreate: false, canEdit: false, canDelete: false }]
  })),
  accountant: Object.fromEntries(ALL_PAGES.map(p => {
    if (['journals','chart-of-accounts','invoices','bills','bill-payments','invoice-receipts','currencies','subsidiaries'].includes(p.key))
      return [p.key, { canView: true, canCreate: true, canEdit: true, canDelete: false }]
    return [p.key, { canView: true, canCreate: false, canEdit: false, canDelete: false }]
  })),
  viewer: Object.fromEntries(ALL_PAGES.map(p => [p.key, { canView: true, canCreate: false, canEdit: false, canDelete: false }])),
}

/* ── AI BLOCKED-STATE SUGGESTIONS (keyed by role → page key → blocked statuses) ── */
const AI_BLOCKED_STATES: Record<string, Partial<Record<string, string[]>>> = {
  admin: {},
  manager: {},
  'sales rep': {
    'leads':          ['Converted', 'Unqualified'],
    'opportunities':  ['Won', 'Lost'],
    'quotes':         ['Closed', 'Cancelled'],
    'sales-orders':   ['Closed', 'Cancelled', 'Shipped'],
    'invoices':       ['Paid', 'Void', 'Closed'],
  },
  'purchasing agent': {
    'purchase-requisitions': ['Closed', 'Cancelled'],
    'purchase-orders':       ['Closed', 'Cancelled', 'Received'],
    'receipts':              ['Closed', 'Cancelled'],
    'bills':                 ['Paid', 'Void', 'Closed'],
  },
  accountant: {
    'invoices':        ['Void'],
    'bills':           ['Void'],
  },
  viewer: {},
}

export default function ManagePermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedRoleName, setSelectedRoleName] = useState('')
  const [grid, setGrid] = useState<PermRow[]>(ALL_PAGES.map(p => ({ page: p.key, canView: false, canCreate: false, canEdit: false, canDelete: false, blockedStates: [] })))
  const [statusOptions, setStatusOptions] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Load roles
  useEffect(() => {
    fetch('/api/roles').then(r => r.json()).then((data: Role[]) => {
      setRoles(data)
      if (data.length > 0) { setSelectedRoleId(data[0].id); setSelectedRoleName(data[0].name) }
    })
  }, [])

  // Load status options for pages that have them
  useEffect(() => {
    fetch('/api/config/lists').then(r => r.json()).then((data: ListConfigResponse) => {
      const rowsByKey = data.rowsByKey || {}
      const map: Record<string, string[]> = {}
      for (const p of ALL_PAGES) {
        if (p.statusKey && rowsByKey[p.statusKey]) {
          map[p.statusKey] = rowsByKey[p.statusKey].map((v) => v.value)
        }
      }
      setStatusOptions(map)
    }).catch(() => {})
  }, [])

  // Load permissions for selected role
  useEffect(() => {
    if (!selectedRoleId) return
    fetch('/api/permissions?roleId=' + selectedRoleId).then(r => r.json()).then((perms: PermissionResponseRow[]) => {
      setGrid(ALL_PAGES.map(p => {
        const existing = perms.find((perm) => perm.page === p.key)
        return existing
          ? { page: p.key, canView: existing.canView, canCreate: existing.canCreate, canEdit: existing.canEdit, canDelete: existing.canDelete, blockedStates: existing.blockedStates ? existing.blockedStates.split(',').filter(Boolean) : [] }
          : { page: p.key, canView: false, canCreate: false, canEdit: false, canDelete: false, blockedStates: [] }
      }))
    })
  }, [selectedRoleId])

  const toggle = (idx: number, field: keyof PermRow) => {
    setGrid(prev => prev.map((row, i) => i === idx ? { ...row, [field]: !row[field] } : row))
  }

  const toggleAll = (idx: number) => {
    setGrid(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const allOn = row.canView && row.canCreate && row.canEdit && row.canDelete
      return { ...row, canView: !allOn, canCreate: !allOn, canEdit: !allOn, canDelete: !allOn }
    }))
  }

  const toggleBlockedState = (idx: number, status: string) => {
    setGrid(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const states = row.blockedStates.includes(status)
        ? row.blockedStates.filter(s => s !== status)
        : [...row.blockedStates, status]
      return { ...row, blockedStates: states }
    }))
  }

  const save = async () => {
    setSaving(true); setMessage('')
    try {
      const payload = grid.map(row => ({ ...row, blockedStates: row.blockedStates.join(',') }))
      const res = await fetch('/api/permissions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: selectedRoleId, permissions: payload }) })
      if (!res.ok) throw new Error('Failed to save')
      setMessage('Permissions saved.')
    } catch { setMessage('Error saving permissions.') }
    finally { setSaving(false) }
  }

  const applyStaticFallback = () => {
    const name = selectedRoleName.toLowerCase()
    let suggestion = AI_SUGGESTIONS[name]
    if (!suggestion) {
      for (const [key, val] of Object.entries(AI_SUGGESTIONS)) {
        if (name.includes(key) || key.includes(name)) { suggestion = val; break }
      }
    }
    if (!suggestion) suggestion = AI_SUGGESTIONS['viewer']
    const blockedSuggestion = AI_BLOCKED_STATES[name] ?? AI_BLOCKED_STATES[Object.keys(AI_BLOCKED_STATES).find(k => name.includes(k) || k.includes(name)) ?? ''] ?? {}
    setGrid(prev => prev.map(row => {
      const s = suggestion![row.page]
      const blocked = blockedSuggestion[row.page]
      let newBlocked = row.blockedStates
      if (blocked !== undefined) { newBlocked = blocked } else if (s) { newBlocked = [] }
      return s ? { ...row, ...s, blockedStates: newBlocked } : row
    }))
    setMessage('Suggestion applied (static rules). Review and Save.')
  }

  const applySuggestion = async () => {
    setAiLoading(true)
    setMessage('')
    try {
      const role = roles.find(r => r.id === selectedRoleId)
      const res = await fetch('/api/ai-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleName: role?.name ?? selectedRoleName,
          roleDescription: role?.description ?? '',
          statusOptions,
        }),
      })
      const data = await res.json() as AiPermissionResponse
      if (!res.ok || !data.permissions) {
        console.warn('AI API failed, falling back to static rules:', data.error)
        applyStaticFallback()
        setAiLoading(false)
        return
      }
      setGrid(prev => prev.map(row => {
        const aiPerm = data.permissions?.find((p) => p.page === row.page)
        if (!aiPerm) return row
        return {
          ...row,
          canView: aiPerm.canView,
          canCreate: aiPerm.canCreate,
          canEdit: aiPerm.canEdit,
          canDelete: aiPerm.canDelete,
          blockedStates: aiPerm.blockedStates ?? [],
        }
      }))
      setMessage('AI suggestion applied for "' + selectedRoleName + '" (powered by Claude). Review and Save.')
    } catch (err) {
      console.warn('AI API error, falling back to static rules:', err)
      applyStaticFallback()
    }
    setAiLoading(false)
  }

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId)
    const role = roles.find(r => r.id === roleId)
    setSelectedRoleName(role?.name ?? '')
  }

  let currentGroup = ''

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Manage Permissions</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Configure role-based access for each page.</p>
      </div>

      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Role</label>
        <select value={selectedRoleId} onChange={e => handleRoleChange(e.target.value)} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
          {roles.map(role => <option key={role.id} value={role.id} style={{ backgroundColor: "#1e1e2e", color: "#fff" }}>{role.name} ({role.roleId})</option>)}
        </select>
        <button onClick={applySuggestion} disabled={!selectedRoleId || aiLoading} className="rounded-md px-3 py-2 text-sm font-medium text-white transition-colors flex items-center gap-1.5" style={{ backgroundColor: '#7c3aed' }} title="AI will suggest permissions based on the role name">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
          {aiLoading ? 'Thinking...' : 'AI Suggest'}
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Page</th>
                <th className="sticky top-0 z-10 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>All</th>
                <th className="sticky top-0 z-10 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>View</th>
                <th className="sticky top-0 z-10 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Create</th>
                <th className="sticky top-0 z-10 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Edit</th>
                <th className="sticky top-0 z-10 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Delete</th>
                <th className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Blocked States</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, i) => {
                const pageDef = ALL_PAGES[i]
                const showGroupHeader = pageDef.group !== currentGroup
                if (showGroupHeader) currentGroup = pageDef.group
                const statuses = pageDef.statusKey ? (statusOptions[pageDef.statusKey] ?? []) : []
                const allOn = row.canView && row.canCreate && row.canEdit && row.canDelete

                return (
                  <Fragment key={row.page}>{showGroupHeader ? (
                    <tr key={'group-' + pageDef.group} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                      <td colSpan={7} className="px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent-primary-strong)', backgroundColor: 'rgba(99,102,241,0.08)' }}>{pageDef.group}</td>
                    </tr>
                  ) : null}
                  <tr key={row.page} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{pageDef.label}</td>
                    <td className="px-4 py-2 text-center"><input type="checkbox" checked={allOn} onChange={() => toggleAll(i)} className="h-4 w-4 rounded accent-indigo-500" /></td>
                    <td className="px-4 py-2 text-center"><input type="checkbox" checked={row.canView} onChange={() => toggle(i, 'canView')} className="h-4 w-4 rounded" /></td>
                    <td className="px-4 py-2 text-center"><input type="checkbox" checked={row.canCreate} onChange={() => toggle(i, 'canCreate')} className="h-4 w-4 rounded" /></td>
                    <td className="px-4 py-2 text-center"><input type="checkbox" checked={row.canEdit} onChange={() => toggle(i, 'canEdit')} className="h-4 w-4 rounded" /></td>
                    <td className="px-4 py-2 text-center"><input type="checkbox" checked={row.canDelete} onChange={() => toggle(i, 'canDelete')} className="h-4 w-4 rounded" /></td>
                    <td className="px-4 py-2">
                      {PROCESS_GROUPS.includes(pageDef.group) && statuses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {statuses.map(s => {
                            const selected = row.blockedStates.includes(s)
                            return (
                              <button key={s} type="button" onClick={() => toggleBlockedState(i, s)}
                                className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
                                style={selected ? { color: '#ef4444', border: '1px solid #dc2626', backgroundColor: 'rgba(239,68,68,0.1)' } : { color: 'var(--text-muted)', border: '1px solid var(--border-muted)', backgroundColor: 'transparent', opacity: 0.5 }}
                              >{s}</button>
                            )
                          })}
                        </div>
                      ) : PROCESS_GROUPS.includes(pageDef.group) ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : null}
                    </td>
                  </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 flex items-center gap-4">
        <button onClick={save} disabled={saving || !selectedRoleId} className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving\u2026' : 'Save Permissions'}</button>
        {message && <span className="text-sm" style={{ color: message.includes('Error') ? '#f87171' : '#4ade80' }}>{message}</span>}
      </div>
    </div>
  )
}
