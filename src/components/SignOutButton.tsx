'use client'

import { signOut } from 'next-auth/react'

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
      className="rounded-md border px-3 py-1.5 text-sm transition"
      style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = 'var(--accent-primary-strong)'
        event.currentTarget.style.color = 'var(--foreground)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = 'var(--border-muted)'
        event.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      Sign out
    </button>
  )
}