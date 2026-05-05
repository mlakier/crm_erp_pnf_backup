'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
}

type NavSubgroup = {
  label: string
  items: NavItem[]
}

type NavGroup = {
  section: string
  items: Array<NavItem | NavSubgroup>
}

function isNavSubgroup(item: NavItem | NavSubgroup): item is NavSubgroup {
  return 'items' in item
}

const NAV: NavGroup[] = [
  {
    section: 'Dashboard',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    section: 'Company',
    items: [
      { label: 'Company Information', href: '/company-information' },
      { label: 'Company Setup', href: '/company-setup' },
      { label: 'Company Prefs', href: '/company-preferences' },
      { label: 'File Cabinet', href: '/company-information/file-cabinet' },
    ],
  },
  {
    section: 'Configuration',
    items: [],
  },
  {
    section: 'Utilities',
    items: [
      { label: 'Exchange Rates', href: '/exchange-rates' },
      { label: 'Manage Lists', href: '/lists' },
      { label: 'Manage Integrations', href: '/integrations' },
      { label: 'Manage Permissions', href: '/manage-permissions' },
      { label: 'Import Master Data', href: '/master-data-import' },
    ],
  },
  {
    section: 'Master Data',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'Roles', href: '/roles' },
      { label: 'Contacts', href: '/contacts' },
      { label: 'Customers', href: '/customers' },
      { label: 'Vendors', href: '/vendors' },
      { label: 'Subsidiaries', href: '/subsidiaries' },
      { label: 'Currencies', href: '/currencies' },
      { label: 'Locations', href: '/locations' },
      { label: 'Accounting Periods', href: '/accounting-periods' },
      { label: 'Items', href: '/items' },
      { label: 'Chart of Accounts', href: '/chart-of-accounts' },
      { label: 'Departments', href: '/departments' },
      { label: 'Employees', href: '/employees' },
    ],
  },
  {
    section: 'Treasury',
    items: [],
  },
  {
    section: 'Workflows',
    items: [
      { label: 'LTC Workflow', href: '/otc-workflow' },
      { label: 'PTP Workflow', href: '/ptp-workflow' },
    ],
  },
  {
    section: 'Lead To Cash',
    items: [
      { label: 'Leads', href: '/leads' },
      { label: 'Opportunities', href: '/opportunities' },
      { label: 'Quotes', href: '/quotes' },
      { label: 'Sales Orders', href: '/sales-orders' },
      { label: 'Fulfillments', href: '/fulfillments' },
      { label: 'Invoices', href: '/invoices' },
      { label: 'Credit Memos', href: '/credit-memos' },
      { label: 'Invoice Receipts', href: '/invoice-receipts' },
      { label: 'Customer Refunds', href: '/customer-refunds' },
    ],
  },
  {
    section: 'Procure To Pay',
    items: [
      { label: 'AP Portal', href: '/ap' },
      { label: 'Purchase Requisitions', href: '/purchase-requisitions' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Receipts', href: '/receipts' },
      { label: 'Bills', href: '/bills' },
      { label: 'Bill Credits', href: '/bill-credits' },
      { label: 'Bill Payments', href: '/bill-payments' },
      { label: 'Vendor Refunds', href: '/vendor-refunds' },
    ],
  },
  {
    section: 'Record To Report',
    items: [
      { label: 'Journals', href: '/journals' },
      { label: 'Intercompany Journals', href: '/intercompany-journals' },
      { label: 'Clearing Documents', href: '/clearing-documents' },
      { label: 'FX Revaluation', href: '/fx-revaluation' },
      { label: 'Rollforwards', href: '/rollforwards' },
    ],
  },
]

export default function AppSidebar({ companyLogoUrl: _companyLogoUrl }: { companyLogoUrl?: string | null }) {
  void _companyLogoUrl
  const pathname = usePathname()
  const [openSection, setOpenSection] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement | null>(null)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const activeSection = (() => {
    const activeGroup = NAV.find((group) =>
      group.items.some((item) => {
        if (isNavSubgroup(item)) {
          return item.items.some((subItem) => isActive(subItem.href))
        }
        return isActive(item.href)
      }),
    )

    return activeGroup?.section ?? null
  })()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenSection(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function handleLinkClick() {
    setOpenSection(null)
  }

  return (
    <div
      ref={navRef}
      className="relative z-30 border-b"
      style={{ backgroundColor: 'var(--sidebar-background)', borderColor: 'var(--border-muted)' }}
    >
      <div className="flex items-center gap-6 px-5 py-3">
        <div className="min-w-fit">
          <p className="text-sm font-semibold tracking-wide text-white">CRM/ERP</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: 'var(--text-muted)' }}>
            Platform
          </p>
        </div>

        <nav className="min-w-0 flex-1 overflow-visible">
          <div className="flex flex-wrap items-center gap-2">
            {NAV.map((group) => {
              const hasItems = group.items.length > 0
              const expanded = openSection === group.section
              const isCurrentSection = activeSection === group.section

              return (
                <div key={group.section} className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                    style={
                      isCurrentSection || expanded
                        ? { backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#ffffff' }
                        : { color: 'var(--text-secondary)' }
                    }
                    onClick={() => setOpenSection((current) => (current === group.section ? null : group.section))}
                    disabled={!hasItems}
                    aria-expanded={hasItems && expanded ? 'true' : 'false'}
                  >
                    <span>{group.section}</span>
                    {hasItems ? <span aria-hidden="true" className="text-[10px]">{expanded ? '▲' : '▼'}</span> : null}
                  </button>

                  {hasItems && expanded ? (
                    <div
                      className="absolute left-0 top-full mt-2 min-w-[17rem] rounded-xl border p-2 shadow-2xl"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border-muted)',
                      }}
                    >
                      {group.items.map((item) => {
                        if (isNavSubgroup(item)) {
                          return (
                            <div key={`${group.section}-${item.label}`} className="mb-2 last:mb-0">
                              <p
                                className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {item.label}
                              </p>
                              <div className="space-y-1">
                                {item.items.map((subItem) => {
                                  const active = isActive(subItem.href)
                                  return (
                                    <Link
                                      key={subItem.href}
                                      href={subItem.href}
                                      onClick={handleLinkClick}
                                      className="block rounded-lg px-3 py-2 text-sm transition-colors"
                                      style={
                                        active
                                          ? { backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#ffffff' }
                                          : { color: 'var(--text-secondary)' }
                                      }
                                    >
                                      {subItem.label}
                                    </Link>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }

                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={handleLinkClick}
                            className="block rounded-lg px-3 py-2 text-sm transition-colors"
                            style={
                              active
                                ? { backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#ffffff' }
                                : { color: 'var(--text-secondary)' }
                            }
                          >
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
