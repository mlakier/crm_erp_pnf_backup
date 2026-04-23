'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function HelpTooltipIcon({ content }: { content: string }) {
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const lines = content.split('\n')

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      left: Math.min(window.innerWidth - 320, Math.max(12, rect.left)),
      top: rect.bottom + 8,
    })
  }

  function show() {
    updatePosition()
    setOpen(true)
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        aria-label={content}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        ?
      </span>
      {typeof document !== 'undefined' && open
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[200] w-72 rounded-lg border px-3 py-2 text-left text-xs leading-5 shadow-xl"
              style={{
                left: position.left,
                top: position.top,
                backgroundColor: 'var(--card-elevated)',
                borderColor: 'var(--border-muted)',
                color: 'var(--text-secondary)',
              }}
            >
              {lines.map((line, index) => (
                <span key={`${line}-${index}`} className="block whitespace-pre-wrap">
                  {line || '\u00A0'}
                </span>
              ))}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
