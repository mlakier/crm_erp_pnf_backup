'use client'

import { useEffect, useRef, useState } from 'react'
import CustomerDetailContactForm from '@/components/CustomerDetailContactForm'
import CustomerDetailOpportunityForm from '@/components/CustomerDetailOpportunityForm'
import QuoteCreateFromOpportunityForm from '@/components/QuoteCreateFromOpportunityForm'
import InvoiceCreateFromSalesOrderForm from '@/components/InvoiceCreateFromSalesOrderForm'
import type { SelectOption } from '@/lib/list-source'

type Option = {
  id: string
  label: string
}

type CreateKind = 'contact' | 'opportunity' | 'estimate' | 'invoice' | null

export default function CustomerCreateMenu({
  customerId,
  userId,
  opportunities,
  salesOrders,
  opportunityStageOptions,
}: {
  customerId: string
  userId: string
  opportunities: Option[]
  salesOrders: Option[]
  opportunityStageOptions: SelectOption[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState<CreateKind>(null)
  const [dismissPrompt, setDismissPrompt] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onWindowClick(event: MouseEvent) {
      if (!menuRef.current) return
      if (menuRef.current.contains(event.target as Node)) return
      setMenuOpen(false)
    }

    if (!menuOpen) return
    window.addEventListener('mousedown', onWindowClick)
    return () => window.removeEventListener('mousedown', onWindowClick)
  }, [menuOpen])

  const closeModal = () => {
    setActive(null)
    setDismissPrompt('')
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>Create
        </button>

        {menuOpen ? (
          <div
            className="absolute right-0 z-40 mt-2 min-w-[180px] overflow-hidden rounded-lg border shadow-xl"
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
          >
            <button
              type="button"
              onClick={() => {
                setActive('contact')
                setMenuOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => {
                setActive('opportunity')
                setMenuOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Opportunity
            </button>
            <button
              type="button"
              onClick={() => {
                setActive('estimate')
                setMenuOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Estimate
            </button>
            <button
              type="button"
              onClick={() => {
                setActive('invoice')
                setMenuOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Invoice
            </button>
          </div>
        ) : null}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDismissPrompt('Use Save or Cancel in the form to close this window.')
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-3xl font-semibold text-white">
                {active === 'contact'
                  ? 'Create Contact'
                  : active === 'opportunity'
                    ? 'Create Opportunity'
                    : active === 'estimate'
                      ? 'Create Estimate'
                      : 'Create Invoice'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
            {dismissPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{dismissPrompt}</p> : null}

            {active === 'contact' ? (
              <CustomerDetailContactForm customerId={customerId} userId={userId} onSuccess={closeModal} onCancel={closeModal} />
            ) : null}
            {active === 'opportunity' ? (
              <CustomerDetailOpportunityForm customerId={customerId} userId={userId} stageOptions={opportunityStageOptions} onSuccess={closeModal} onCancel={closeModal} />
            ) : null}
            {active === 'estimate' ? (
              <QuoteCreateFromOpportunityForm opportunities={opportunities} onSuccess={closeModal} onCancel={closeModal} />
            ) : null}
            {active === 'invoice' ? (
              <InvoiceCreateFromSalesOrderForm salesOrders={salesOrders} onSuccess={closeModal} onCancel={closeModal} />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
