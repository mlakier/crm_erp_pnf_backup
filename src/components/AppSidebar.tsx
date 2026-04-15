'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
      { label: 'Manage Lists', href: '/lists' },
      { label: 'Manage Integrations', href: '/integrations' },
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
    section: 'ORDER TO CASH',
    items: [
      { label: 'OTC Workflow', href: '/otc-workflow' },
      { label: 'Leads', href: '/leads' },
      { label: 'Opportunities', href: '/opportunities' },
      { label: 'Quotes', href: '/quotes' },
      { label: 'Sales Orders', href: '/sales-orders' },
      { label: 'Invoices', href: '/invoices' },
    ],
  },
  {
    section: 'PROCURE TO PAY',
    items: [
      { label: 'AP Portal', href: '/ap' },
      { label: 'Purchase Requisitions', href: '/purchase-requisitions' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Bills', href: '/bills' },
    ],
  },
  {
    section: 'RECORD TO REPORT',
    items: [],
  },
]

export default function AppSidebar() {
  const pathname = usePathname()

  const initialExpanded = useMemo(() => {
    const expanded: Record<string, boolean> = {}
    for (const group of NAV) {
      expanded[group.section] = false
    }
    return expanded
  }, [])

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(initialExpanded)

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function toggleSection(section: string) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  useEffect(() => {
    const activeGroup = NAV.find((group) =>
      group.items.some((item) => {
        if (isNavSubgroup(item)) {
          return item.items.some((subItem) => isActive(subItem.href))
        }
        return isActive(item.href)
      })
    )
    if (!activeGroup) return
    setExpandedSections((prev) =>
      prev[activeGroup.section] ? prev : { ...prev, [activeGroup.section]: true }
    )
  }, [pathname])

  return (
    <aside className="flex h-screen w-52 flex-shrink-0 flex-col overflow-y-auto" style={{ backgroundColor: 'var(--sidebar-background)' }}>
      {/* Brand */}
      <div className="px-5 py-5">
        <p className="text-sm font-semibold tracking-wide text-white">CRM/ERP</p>
        <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Platform</p>
      </div>

      <div className="mx-4 border-t" style={{ borderColor: 'var(--border-muted)' }} />

      {/* Nav groups */}
      <nav className="mt-2 flex-1 px-2 pb-4">
        {NAV.map((group) => (
          <div key={group.section} className="mt-5">
            {(() => {
              const sectionId = `sidebar-section-${group.section.toLowerCase().replace(/\s+/g, '-')}`
              return (
                <>
            <button
              type="button"
              onClick={() => toggleSection(group.section)}
              className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              aria-expanded={expandedSections[group.section] ? 'true' : 'false'}
              aria-controls={sectionId}
            >
              <span>{group.section}</span>
              <span className="text-xs" aria-hidden="true">
                {expandedSections[group.section] ? '▾' : '▸'}
              </span>
            </button>
            <div id={sectionId}>
            {expandedSections[group.section] && group.items.map((item) => {
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
                            active
                              ? 'border-l-2 pl-[10px] font-medium text-white'
                              : 'hover:text-white'
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
                    active
                      ? 'border-l-2 pl-[10px] font-medium text-white'
                      : 'hover:text-white'
                  }`}
                  style={active ? { borderColor: 'var(--accent-primary)', backgroundColor: 'rgba(59, 130, 246, 0.14)' } : { color: 'var(--text-secondary)' }}
                >
                  {item.label}
                </Link>
              )
            })}
            </div>
                </>
              )
            })()}
          </div>
        ))}
      </nav>
    </aside>
  )
}
