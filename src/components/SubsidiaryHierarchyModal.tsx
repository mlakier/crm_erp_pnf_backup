'use client'

import { useState } from 'react'
import SubsidiaryHierarchyFlow from '@/components/SubsidiaryHierarchyFlow'

type SubsidiaryHierarchyEntity = {
  id: string
  subsidiaryId: string
  name: string
  country: string | null
  entityType: string | null
  taxId: string | null
  parentSubsidiaryId: string | null
}

export default function SubsidiaryHierarchyModal({ entities, logoUrl, title }: { entities: SubsidiaryHierarchyEntity[]; logoUrl?: string; title?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  if (entities.length === 0) {
    return (
      <section className="mb-6 rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <h2 className="text-base font-semibold text-white">Subsidiary Hierarchy</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Consolidation roll-up view of parent and child subsidiaries.
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No subsidiaries available.</p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="mb-6 overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <h2 className="text-base font-semibold text-white">Subsidiary Hierarchy</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Open the hierarchy in a popup and save it to PDF.
          </p>
        </div>
        <div className="px-6 py-5">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-md border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: 'var(--border-muted)',
              color: 'var(--text-secondary)',
            }}
          >
            Show Hierarchy
          </button>
        </div>
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div
            className="flex max-h-[92vh] w-[min(1400px,96vw)] flex-col rounded-2xl border"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border-muted)',
            }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-muted)' }}>
              <h3 className="text-base font-semibold text-white">Subsidiary Hierarchy</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: 'var(--border-muted)',
                  color: 'var(--text-secondary)',
                }}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <SubsidiaryHierarchyFlow entities={entities} title={title} logoUrl={logoUrl} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
