'use client'

import { cloneElement, isValidElement, ReactElement, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'

type CreateModalButtonProps = {
  buttonLabel: string
  title: string
  children: ReactElement<{ onSuccess?: () => void; onCancel?: () => void }>
  buttonClassName?: string
  buttonStyle?: CSSProperties
  modalWidthClassName?: string
}

export default function CreateModalButton({
  buttonLabel,
  title,
  children,
  buttonClassName,
  buttonStyle,
  modalWidthClassName,
}: CreateModalButtonProps) {
  const [open, setOpen] = useState(false)
  const [dismissPrompt, setDismissPrompt] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const close = () => {
    setDismissPrompt('')
    setOpen(false)
  }
  const content = useMemo(() => {
    if (!isValidElement(children)) return children
    return cloneElement(children, {
      onSuccess: close,
      onCancel: close,
    })
  }, [children])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDismissPrompt('')
          setOpen(true)
        }}
        className={`inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition ${buttonClassName ?? ''}`}
        style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff', ...(buttonStyle ?? {}) }}
      >
        <span className="mr-1.5 text-lg leading-none">+</span>{buttonLabel}
      </button>

      {open && mounted ? createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDismissPrompt('Use Save or Cancel in the form to close this window.')
            }
          }}
        >
          <div
            className={`relative w-full ${modalWidthClassName ?? 'max-w-2xl'} rounded-xl border p-6 shadow-2xl`}
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-3xl font-semibold text-white">{title}</h2>
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
            {dismissPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{dismissPrompt}</p> : null}
            {content}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  )
}
