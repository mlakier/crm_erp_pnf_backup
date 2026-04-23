'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export default function MasterDataDetailCreateMenu({
  newHref,
  duplicateHref,
}: {
  newHref: string
  duplicateHref?: string
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-white shadow-sm"
        style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Create actions"
      >
        +
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-lg border shadow-xl"
          style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
        >
          <Link
            href={newHref}
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setOpen(false)}
          >
            New
          </Link>
          {duplicateHref ? (
            <Link
              href={duplicateHref}
              role="menuitem"
              className="block border-t px-3 py-2 text-sm hover:bg-white/5"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-muted)' }}
              onClick={() => setOpen(false)}
            >
              Duplicate
            </Link>
          ) : (
            <button
              type="button"
              disabled
              role="menuitem"
              className="block w-full cursor-not-allowed border-t px-3 py-2 text-left text-sm opacity-50"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-muted)' }}
            >
              Duplicate
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
