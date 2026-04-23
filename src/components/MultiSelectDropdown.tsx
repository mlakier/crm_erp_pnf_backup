'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

type MultiSelectOption = {
  value: string
  label: string
}

type Position = {
  top: number
  left: number
  width: number
}

export default function MultiSelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select options',
  disabled = false,
}: {
  value: string[]
  options: MultiSelectOption[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const width = Math.min(Math.max(rect.width, 320), 560)
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const left = Math.min(Math.max(16, rect.left), Math.max(16, viewportWidth - width - 16))
      const estimatedHeight = 320
      const placeAbove = rect.bottom + estimatedHeight > viewportHeight - 16 && rect.top > estimatedHeight
      const top = placeAbove ? Math.max(16, rect.top - estimatedHeight - 8) : Math.min(viewportHeight - 16, rect.bottom + 8)
      setPosition({ top, left, width })
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  const selectedLabels = useMemo(() => {
    const selected = new Set(value)
    return options.filter((option) => selected.has(option.value)).map((option) => option.label)
  }, [options, value])

  function toggleOption(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((entry) => entry !== optionValue))
      return
    }
    onChange([...value, optionValue])
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: 'var(--border-muted)', backgroundColor: 'transparent', color: 'white' }}
      >
        <span className="min-w-0 flex-1 truncate" style={{ color: selectedLabels.length > 0 ? 'white' : 'var(--text-muted)' }}>
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
        </span>
        <span className="ml-3 shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {typeof document !== 'undefined' && open && position
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed rounded-xl border p-3 shadow-2xl"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: 220,
                backgroundColor: 'var(--card-elevated)',
                borderColor: 'var(--border-muted)',
              }}
            >
              <div className="max-h-72 overflow-y-auto pr-1">
                {options.length === 0 ? (
                  <p className="px-1 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No options available.
                  </p>
                ) : (
                  options.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={value.includes(option.value)}
                        onChange={() => toggleOption(option.value)}
                        className="h-4 w-4 rounded"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
