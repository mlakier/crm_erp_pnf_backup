'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SearchableSelectOption = {
  value: string
  label: string
  displayLabel?: string
  menuLabel?: string
  searchText?: string
  sortIdText?: string
  sortLabelText?: string
}

export default function SearchableSelect({
  selectedValue,
  options,
  placeholder,
  searchPlaceholder,
  sortMode = 'label',
  disabled = false,
  textClassName = 'text-sm',
  dropdownWidthMode = 'content',
  clearSelectionOnQueryChange = true,
  onSelect,
}: {
  selectedValue: string
  options: readonly SearchableSelectOption[]
  placeholder: string
  searchPlaceholder?: string
  sortMode?: 'id' | 'label'
  disabled?: boolean
  textClassName?: string
  dropdownWidthMode?: 'content' | 'trigger'
  clearSelectionOnQueryChange?: boolean
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showAllOnOpen, setShowAllOnOpen] = useState(false)
  const [blurRequest, setBlurRequest] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{ bottom: number; left: number; minWidth: number; maxWidth: number } | null>(null)

  const selectedOption = options.find((option) => option.value === selectedValue) ?? null
  const selectedLabel = selectedOption?.label ?? ''
  const selectedDisplayLabel = selectedOption?.displayLabel ?? selectedLabel

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
        setQuery(selectedLabel)
        setShowAllOnOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [selectedLabel])

  useEffect(() => {
    if (!open || !inputRef.current || disabled) return

    function updatePosition() {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const maxWidth = window.innerWidth - 32
      setDropdownStyle({
        bottom: Math.max(window.innerHeight - rect.top + 4, 8),
        left: Math.max(16, rect.left),
        minWidth: dropdownWidthMode === 'trigger' ? rect.width : rect.width + 96,
        maxWidth,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [disabled, dropdownWidthMode, open, options, placeholder, query])

  useEffect(() => {
    if (blurRequest === 0) return
    inputRef.current?.blur()
  }, [blurRequest])

  useEffect(() => {
    if (!open) return
    selectedOptionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, selectedValue, query])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const sortedOptions = [...options].sort((left, right) =>
      (sortMode === 'label' ? left.sortLabelText ?? left.displayLabel ?? left.label : left.sortIdText ?? left.label).localeCompare(
        sortMode === 'label' ? right.sortLabelText ?? right.displayLabel ?? right.label : right.sortIdText ?? right.label,
        undefined,
        {
          sensitivity: 'base',
          numeric: true,
        },
      ),
    )
    if (showAllOnOpen && !normalizedQuery) return sortedOptions
    if (!normalizedQuery) return sortedOptions
    return sortedOptions.filter((option) => (option.searchText ?? option.label).toLowerCase().includes(normalizedQuery))
  }, [options, query, showAllOnOpen, sortMode])

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? (showAllOnOpen && !query ? selectedDisplayLabel : query) : selectedDisplayLabel}
          onFocus={() => {
            if (disabled) return
            setOpen(true)
            setQuery('')
            setShowAllOnOpen(true)
          }}
          onMouseDown={() => {
            if (disabled || open) return
            setOpen(true)
            setQuery('')
            setShowAllOnOpen(true)
          }}
          onClick={() => {
            if (disabled || open) return
            setOpen(true)
            setQuery('')
            setShowAllOnOpen(true)
          }}
          onChange={(event) => {
            if (disabled) return
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setOpen(true)
            setShowAllOnOpen(false)
            if (clearSelectionOnQueryChange && selectedValue && nextQuery !== selectedLabel) {
              onSelect('')
            }
          }}
          placeholder={selectedDisplayLabel ? searchPlaceholder ?? `Search ${selectedLabel}` : placeholder}
          title={selectedLabel || placeholder}
          disabled={disabled}
          className={`w-full rounded-md border bg-transparent px-3 py-2 pr-8 text-white leading-5 ${textClassName}`}
          style={{
            borderColor: 'var(--border-muted)',
            backgroundColor: 'var(--card-elevated)',
            colorScheme: 'dark',
            WebkitTextFillColor: disabled ? 'rgba(255,255,255,0.7)' : 'white',
            opacity: disabled ? 0.7 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault()
            if (disabled) return
            const nextOpen = !open
            setOpen(nextOpen)
            if (nextOpen) {
              setQuery('')
              setShowAllOnOpen(true)
              inputRef.current?.focus()
            } else {
              setShowAllOnOpen(false)
            }
          }}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-md disabled:cursor-not-allowed"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Toggle options"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        </button>
      </div>
      {open && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[210] max-h-60 overflow-y-auto rounded-md border shadow-2xl"
              style={{
                bottom: dropdownStyle.bottom,
                left: dropdownStyle.left,
                minWidth: dropdownStyle.minWidth,
                width: dropdownWidthMode === 'trigger' ? dropdownStyle.minWidth : 'max-content',
                maxWidth: dropdownStyle.maxWidth,
                borderColor: 'var(--border-muted)',
                backgroundColor: 'var(--card-elevated)',
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect('')
                  setQuery('')
                  setOpen(false)
                  setShowAllOnOpen(false)
                  setBlurRequest((current) => current + 1)
                }}
                className={`block w-full whitespace-nowrap px-3 py-2 text-left hover:bg-white/5 ${textClassName}`}
                style={{ color: 'var(--text-secondary)' }}
              >
                {placeholder}
              </button>
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  ref={option.value === selectedValue ? selectedOptionRef : null}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(option.value)
                    setQuery(option.label)
                    setOpen(false)
                    setShowAllOnOpen(false)
                    setBlurRequest((current) => current + 1)
                  }}
                  className={`block w-full whitespace-nowrap px-3 py-2 text-left hover:bg-white/5 ${textClassName}`}
                  style={{
                    color: option.value === selectedValue ? 'white' : 'var(--text-secondary)',
                    backgroundColor: option.value === selectedValue ? 'rgba(59,130,246,0.18)' : 'transparent',
                  }}
                >
                  {option.menuLabel ?? option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
