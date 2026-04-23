'use client'

import Link from 'next/link'
import { useState } from 'react'
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
    section: 'DASHBOARD',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    section: 'COMPANY',
    items: [
      { label: 'Company Information', href: '/company-information' },
      { label: 'Company Prefs', href: '/company-preferences' },
      { label: 'File Cabinet', href: '/company-information/file-cabinet' },
    ],
  },
  {
    section: 'CONFIGURATION',
    items: [],
  },
  {
    section: 'UTILITIES',
    items: [
      { label: 'Exchange Rates', href: '/exchange-rates' },
      { label: 'Manage Lists', href: '/lists' },
      { label: 'Manage Integrations', href: '/integrations' },
      { label: 'Manage Permissions', href: '/manage-permissions' },
      { label: 'Import Master Data', href: '/master-data-import' },
    ],
  },
  {
    section: 'MASTER DATA',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'Roles', href: '/roles' },
      { label: 'Contacts', href: '/contacts' },
      { label: 'Customers', href: '/customers' },
      { label: 'Vendors', href: '/vendors' },
      { label: 'Subsidiaries', href: '/subsidiaries' },
      { label: 'Currencies', href: '/currencies' },
      { label: 'Locations', href: '/locations' },
      { label: 'Items', href: '/items' },
      { label: 'Chart of Accounts', href: '/chart-of-accounts' },
      { label: 'Departments', href: '/departments' },
      { label: 'Employees', href: '/employees' },
    ],
  },
  {
    section: 'TREASURY',
    items: [],
  },
  {
    section: 'WORKFLOWS',
    items: [
      { label: 'OTC Workflow', href: '/otc-workflow' },
      { label: 'PTP Workflow', href: '/ptp-workflow' },
    ],
  },
  {
    section: 'ORDER TO CASH',
    items: [
      { label: 'Leads', href: '/leads' },
      { label: 'Opportunities', href: '/opportunities' },
      { label: 'Quotes', href: '/quotes' },
      { label: 'Sales Orders', href: '/sales-orders' },
      { label: 'Fulfillments', href: '/fulfillments' },
      { label: 'Invoices', href: '/invoices' },
      { label: 'Invoice Receipts', href: '/invoice-receipts' },
    ],
  },
  {
    section: 'PROCURE TO PAY',
    items: [
      { label: 'AP Portal', href: '/ap' },
      { label: 'Purchase Requisitions', href: '/purchase-requisitions' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Receipts', href: '/receipts' },
      { label: 'Bills', href: '/bills' },
      { label: 'Bill Payments', href: '/bill-payments' },
    ],
  },
  {
    section: 'RECORD TO REPORT',
    items: [
      { label: 'Journals', href: '/journals' },
    ],
  },
]

export default function AppSidebar() {
  const pathname = usePathname()
  const [openSection, setOpenSection] = useState<string | null>(null)

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
      })
    )

    return activeGroup?.section ?? null
  })()

  function toggleSection(section: string) {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  return (
    <aside
      className="relative z-40 flex h-screen w-52 flex-shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: 'var(--sidebar-background)' }}
    >
      <div className="px-5 py-5">
        <p className="text-sm font-semibold tracking-wide text-white">CRM/ERP</p>
        <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Platform</p>
      </div>

      <div className="mx-4 border-t" style={{ borderColor: 'var(--border-muted)' }} />

      <nav className="mt-2 flex-1 px-2 pb-4">
        {NAV.map((group) => {
          const sectionId = `sidebar-section-${group.section.toLowerCase().replace(/\s+/g, '-')}`
          const expanded = openSection ? openSection === group.section : activeSection === group.section

          return (
            <div key={group.section} className="mt-5">
              <button
                type="button"
                onClick={() => toggleSection(group.section)}
                className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)' }}
                aria-expanded={expanded ? 'true' : 'false'}
                aria-controls={sectionId}
              >
                <span>{group.section}</span>
                <span className="text-xs" aria-hidden="true">
                  {expanded ? '▾' : '▸'}
                </span>
              </button>
              <div id={sectionId}>
                {expanded && group.items.map((item) => {
                  if (isNavSubgroup(item)) {
                    return (
                      <div key={`${group.section}-${item.label}`} className="mt-2">
                        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                          {item.label}
                        </p>
                        {item.items.map((subItem) => {
                          const active = isActive(subItem.href)
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className={`ml-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                active ? 'border-l-2 pl-[10px] font-medium text-white' : 'hover:text-white'
                              }`}
                              style={active ? { borderColor: 'var(--accent-primary)', backgroundColor: 'rgba(59, 130, 246, 0.14)' } : { color: 'var(--text-secondary)' }}
                            >
                              {subItem.label}
                            </Link>
                          )
                        })}
                      </div>
                    )
                  }

                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        active ? 'border-l-2 pl-[10px] font-medium text-white' : 'hover:text-white'
                      }`}
                      style={active ? { borderColor: 'var(--accent-primary)', backgroundColor: 'rgba(59, 130, 246, 0.14)' } : { color: 'var(--text-secondary)' }}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
