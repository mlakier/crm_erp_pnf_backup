'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import SearchableSelect from '@/components/SearchableSelect'

type SavedListViewOption = {
  id: string
  name: string
  isDefault: boolean
}

const BUILT_IN_VIEW_ID = '__built-in-default'

export default function SavedSearchViewSelector({
  tableId,
}: {
  tableId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [views, setViews] = useState<SavedListViewOption[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadViews() {
      try {
        const response = await fetch(`/api/list-views?tableId=${encodeURIComponent(tableId)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load saved searches')
        const body = await response.json() as { views?: Array<{ id: string; name: string; isDefault: boolean }> }
        if (cancelled) return
        setViews(Array.isArray(body.views) ? body.views.map((view) => ({
          id: view.id,
          name: view.name,
          isDefault: view.isDefault,
        })) : [])
      } catch {
        if (!cancelled) setViews([])
      }
    }

    void loadViews()
    return () => {
      cancelled = true
    }
  }, [tableId])

  const selectedViewId = searchParams.get('view')?.trim() || BUILT_IN_VIEW_ID

  const options = useMemo(
    () => [
      { value: BUILT_IN_VIEW_ID, label: 'Page Default' },
      ...views.map((view) => ({ value: view.id, label: view.name })),
    ],
    [views],
  )

  function handleSelect(nextViewId: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (!nextViewId || nextViewId === BUILT_IN_VIEW_ID) {
      next.set('view', BUILT_IN_VIEW_ID)
    } else {
      next.set('view', nextViewId)
    }
    next.set('page', '1')
    const query = next.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="flex items-center shrink-0">
      <div className="w-52 shrink-0">
        <SearchableSelect
          selectedValue={selectedViewId}
          options={options}
          placeholder="Select saved search"
          searchPlaceholder="Search saved view"
          dropdownWidthMode="trigger"
          clearSelectionOnQueryChange={false}
          onSelect={handleSelect}
        />
      </div>
    </div>
  )
}
