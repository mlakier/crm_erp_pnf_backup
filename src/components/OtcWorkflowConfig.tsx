'use client'

import { useEffect, useState, useCallback } from 'react'
import type { OtcWorkflowConfig, OtcStep, OtcTrigger, OtcApproval } from '@/lib/otc-workflow-store'

/* ------------------------------------------------------------------ */
/*  Toggle switch component                                            */
/* ------------------------------------------------------------------ */

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
      style={{ backgroundColor: enabled ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OtcWorkflowConfig() {
  const [config, setConfig] = useState<OtcWorkflowConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/config/otc-workflow')
      .then((r) => r.json())
      .then((body) => setConfig(body.config))
      .catch(() => {})
  }, [])

  const save = useCallback(async (next: OtcWorkflowConfig) => {
    setSaving(true)
    setToast('')
    try {
      const res = await fetch('/api/config/otc-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next }),
      })
      const body = await res.json()
      if (res.ok) {
        setConfig(body.config)
        setToast('Saved')
        setTimeout(() => setToast(''), 2000)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }, [])

  if (!config) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  /* ---------- helpers to update local state + auto-save ---------- */

  function updateStep(id: string, patch: Partial<OtcStep>) {
    if (!config) return
    const next: OtcWorkflowConfig = {
      steps: config.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      triggers: config.triggers,
      approvals: config.approvals,
    }
    setConfig(next)
    save(next)
  }

  function updateTrigger(id: string, patch: Partial<OtcTrigger>) {
    if (!config) return
    const next: OtcWorkflowConfig = {
      steps: config.steps,
      triggers: config.triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      approvals: config.approvals,
    }
    setConfig(next)
    save(next)
  }

  function updateTriggerCondition(id: string, field: string, value: string) {
    if (!config) return
    const next: OtcWorkflowConfig = {
      steps: config.steps,
      triggers: config.triggers.map((t) =>
        t.id === id ? { ...t, condition: { ...t.condition, [field]: value } } : t,
      ),
      approvals: config.approvals,
    }
    setConfig(next)
    save(next)
  }

  function updateApproval(id: string, patch: Partial<OtcApproval>) {
    if (!config) return
    const next: OtcWorkflowConfig = {
      steps: config.steps,
      triggers: config.triggers,
      approvals: config.approvals.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }
    setConfig(next)
    save(next)
  }

  function updateApprovalCondition(id: string, field: string, value: string | number) {
    if (!config) return
    const next: OtcWorkflowConfig = {
      steps: config.steps,
      triggers: config.triggers,
      approvals: config.approvals.map((a) =>
        a.id === id ? { ...a, condition: { ...a.condition, [field]: value } } : a,
      ),
    }
    setConfig(next)
    save(next)
  }

  const enabledSteps = config.steps.filter((s) => s.enabled)

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>
          {toast}
        </div>
      )}

      {/* ============================================================ */}
      {/*  SECTION 1 – Workflow Steps                                   */}
      {/* ============================================================ */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Workflow Steps</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Toggle which stages are active in the Order-to-Cash flow.</p>

        {/* Visual flow */}
        <div className="flex items-center flex-wrap gap-2 mb-5">
          {enabledSteps.sort((a, b) => a.order - b.order).map((step, idx) => (
            <span key={step.id} className="flex items-center gap-2">
              <span
                className="rounded-md px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
              >
                {step.label}
              </span>
              {idx < enabledSteps.length - 1 && (
                <span style={{ color: 'var(--text-muted)' }}>→</span>
              )}
            </span>
          ))}
        </div>

        {/* Step toggles */}
        <div className="rounded-lg border" style={{ borderColor: 'var(--border-muted)' }}>
          {config.steps.map((step, idx) => (
            <div
              key={step.id}
              className="flex items-center justify-between px-4 py-3"
              style={idx < config.steps.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
            >
              <div>
                <span className="text-sm font-medium text-white">{step.label}</span>
                <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{step.href}</span>
              </div>
              <Toggle enabled={step.enabled} onChange={(v) => updateStep(step.id, { enabled: v })} />
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 2 – Status Triggers                                  */}
      {/* ============================================================ */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Status Triggers</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Auto-create the next record when a status condition is met.</p>

        <div className="rounded-lg border" style={{ borderColor: 'var(--border-muted)' }}>
          {config.triggers.map((trigger, idx) => (
            <div
              key={trigger.id}
              className="px-4 py-4 space-y-3"
              style={idx < config.triggers.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{trigger.label}</span>
                <Toggle enabled={trigger.enabled} onChange={(v) => updateTrigger(trigger.id, { enabled: v })} />
              </div>

              {trigger.enabled && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Field</label>
                    <input
                      value={trigger.condition.field}
                      onChange={(e) => updateTriggerCondition(trigger.id, 'field', e.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Operator</label>
                    <select
                      value={trigger.condition.operator}
                      onChange={(e) => updateTriggerCondition(trigger.id, 'operator', e.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                      <option value="contains">contains</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Value</label>
                    <input
                      value={trigger.condition.value}
                      onChange={(e) => updateTriggerCondition(trigger.id, 'value', e.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 3 – Approval Workflows                               */}
      {/* ============================================================ */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Approval Workflows</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Require approval before a record can advance past a step.</p>

        <div className="rounded-lg border" style={{ borderColor: 'var(--border-muted)' }}>
          {config.approvals.map((approval, idx) => (
            <div
              key={approval.id}
              className="px-4 py-4 space-y-3"
              style={idx < config.approvals.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{approval.label}</span>
                <Toggle enabled={approval.enabled} onChange={(v) => updateApproval(approval.id, { enabled: v })} />
              </div>

              {approval.enabled && (
                <div className="grid grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Field</label>
                    <input
                      value={approval.condition.field}
                      onChange={(e) => updateApprovalCondition(approval.id, 'field', e.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Operator</label>
                    <select
                      value={approval.condition.operator}
                      onChange={(e) => updateApprovalCondition(approval.id, 'operator', e.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value=">=">≥ (greater or equal)</option>
                      <option value=">"> (greater than)</option>
                      <option value="<=">≤ (less or equal)</option>
                      <option value="<">&lt; (less than)</option>
                      <option value="equals">equals</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Threshold</label>
                    <input
                      type="number"
                      value={approval.condition.value}
                      onChange={(e) => updateApprovalCondition(approval.id, 'value', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Approver Role</label>
                    <select
                      value={approval.approverRole}
                      onChange={(e) => updateApproval(approval.id, { approverRole: e.target.value })}
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value="manager">Manager</option>
                      <option value="director">Director</option>
                      <option value="vp">VP</option>
                      <option value="cfo">CFO</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {saving && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving…</p>
      )}
    </div>
  )
}
