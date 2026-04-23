'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Hit = { type: 'page' | 'record' | 'list'; label: string; href: string; detail?: string }

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  page:   { bg: '#3b82f620', text: '#60a5fa', label: 'Page' },
  record: { bg: '#10b98120', text: '#34d399', label: 'Record' },
  list:   { bg: '#f59e0b20', text: '#fbbf24', label: 'List' },
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Keyboard shortcut: Ctrl+K / Cmd+K ──────────────────────── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  /* ── Focus input when opened ────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus()
        setQuery('')
        setResults([])
        setActiveIdx(0)
      }, 50)
    }
  }, [open])

  /* ── Click outside to close ─────────────────────────────────── */
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  /* ── Search with debounce ───────────────────────────────────── */
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await r.json()
        setResults(data.results || [])
        setActiveIdx(0)
      } catch { setResults([]) }
      setLoading(false)
    }, 250)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    doSearch(v)
  }

  function navigate(hit: Hit) {
    setOpen(false)
    router.push(hit.href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIdx]) { navigate(results[activeIdx]) }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-blue-400/50"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', backgroundColor: 'var(--input-background)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="opacity-60">Search…</span>
        <kbd className="ml-4 hidden rounded border px-1.5 py-0.5 text-[10px] font-medium opacity-40 sm:inline-block" style={{ borderColor: 'var(--border-primary)' }}>
          Ctrl K
        </kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        <div ref={wrapperRef} className="w-full max-w-lg rounded-xl border shadow-2xl" style={{ backgroundColor: 'var(--card-background)', borderColor: 'var(--border-primary)' }}>
          {/* Input */}
          <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, records, lists…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            )}
            <kbd className="rounded border px-1.5 py-0.5 text-[10px] opacity-40 cursor-pointer" style={{ borderColor: 'var(--border-primary)' }} onClick={() => setOpen(false)}>
              ESC
            </kbd>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-2">
              {results.map((hit, i) => {
                const badge = TYPE_BADGE[hit.type] || TYPE_BADGE.page
                return (
                  <li key={hit.href + hit.label + i}>
                    <button
                      type="button"
                      onClick={() => navigate(hit)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${i === activeIdx ? 'bg-blue-500/10' : 'hover:bg-white/5'}`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: badge.bg, color: badge.text }}>
                        {badge.label}
                      </span>
                      <span className="flex-1 truncate">{hit.label}</span>
                      {hit.detail && <span className="truncate text-xs opacity-50">{hit.detail}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm opacity-50" style={{ color: 'var(--text-secondary)' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 border-t px-4 py-2 text-[10px] opacity-40" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </>
  )
}
