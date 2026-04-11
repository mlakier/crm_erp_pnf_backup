'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
}

type NavGroup = {
  section: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    section: 'DASHBOARD',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    section: 'CONFIGURATION',
    items: [{ label: 'Configuration', href: '/configuration' }],
  },
  {
    section: 'MASTER DATA',
    items: [
      { label: 'Contacts', href: '/contacts' },
      { label: 'Customers', href: '/crm' },
      { label: 'Vendors', href: '/vendors' },
      { label: 'Subsidiaries', href: '/entities' },
      { label: 'Currencies', href: '/currencies' },
      { label: 'Items', href: '/items' },
      { label: 'Employees', href: '/employees' },
      { label: 'Lists', href: '/lists' },
    ],
  },
  {
    section: 'Q2C',
    items: [
      { label: 'Leads', href: '/leads' },
      { label: 'Opportunities', href: '/opportunities' },
      { label: 'Estimates', href: '/quotes' },
      { label: 'Sales Orders', href: '/sales-orders' },
      { label: 'Invoices', href: '/invoices' },
    ],
  },
  {
    section: 'P2P',
    items: [
      { label: 'Purchase Requisitions', href: '/purchase-requisitions' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Bills', href: '/bills' },
    ],
  },
  {
    section: 'AP',
    items: [{ label: 'AP Portal', href: '/ap' }],
  },
]

export default function AppSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

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
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {group.section}
            </p>
            {group.items.map((item) => {
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
        ))}
      </nav>
    </aside>
  )
}
