'use client'

import { cloneElement, isValidElement, ReactElement, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

type CreateModalButtonProps = {
  buttonLabel: string
  title: string
  children: ReactElement<{ onSuccess?: () => void; onCancel?: () => void }>
  buttonClassName?: string
  buttonStyle?: CSSProperties
}

export default function CreateModalButton({ buttonLabel, title, children, buttonClassName, buttonStyle }: CreateModalButtonProps) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)
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
        onClick={() => setOpen(true)}
        className={`inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition ${buttonClassName ?? ''}`}
        style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff', ...(buttonStyle ?? {}) }}
      >
        <span className="mr-1.5 text-lg leading-none">+</span>{buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
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
                Close
              </button>
            </div>
            {content}
          </div>
        </div>
      ) : null}
    </>
  )
}
