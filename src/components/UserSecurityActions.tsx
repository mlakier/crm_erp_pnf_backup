'use client'

export default function UserSecurityActions({ locked }: { locked: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled
        className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
        style={{ backgroundColor: 'var(--accent-primary-strong)' }}
      >
        Reset Password
      </button>
      <button
        type="button"
        disabled={!locked}
        className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-55"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        Unlock Account
      </button>
    </div>
  )
}
