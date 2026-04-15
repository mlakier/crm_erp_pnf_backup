import OtcWorkflowConfig from '@/components/OtcWorkflowConfig'

export default function OtcWorkflowPage() {
  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <h1 className="text-xl font-semibold text-white">OTC Workflow</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Configure the Order-to-Cash workflow steps, status triggers, and approval rules.
        </p>

        <div className="mt-6">
          <OtcWorkflowConfig />
        </div>
      </div>
    </div>
  )
}
