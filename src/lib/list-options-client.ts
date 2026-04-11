'use client'

import { useEffect, useState } from 'react'
import { getDefaultListValues, ListOptionsConfig, ListPageKey } from '@/lib/list-options'

export function useListOptions<P extends ListPageKey>(
  page: P,
  list: keyof ListOptionsConfig[P] & string
) {
  const [options, setOptions] = useState<string[]>(() => getDefaultListValues(page, list))

  useEffect(() => {
    let mounted = true

    async function loadOptions() {
      try {
        const response = await fetch('/api/config/lists', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !mounted) return

        const incoming = body?.config?.[page]?.[list]
        if (Array.isArray(incoming) && incoming.length > 0) {
          setOptions(incoming.map((value: unknown) => String(value)))
        }
      } catch {
        // Keep local defaults if loading managed options fails.
      }
    }

    loadOptions()
    return () => {
      mounted = false
    }
  }, [page, list])

  return options
}
