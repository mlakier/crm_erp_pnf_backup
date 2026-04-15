'use client'

import { usePathname } from 'next/navigation'
import AppSidebar from './AppSidebar'
import TableFilterSortEnhancer from './TableFilterSortEnhancer'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Auth pages and the root redirect don't get the sidebar
  const isAuthPage = pathname === '/' || pathname?.startsWith('/auth') || pathname?.startsWith('/login')

  if (isAuthPage) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <TableFilterSortEnhancer />
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-y-auto" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
