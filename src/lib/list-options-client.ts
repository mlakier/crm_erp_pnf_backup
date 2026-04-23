'use client'

import { useEffect, useState } from 'react'
import {
  getDefaultListValues,
  ListOptionsConfig,
  ListPageKey,
  sortListValues,
} from '@/lib/list-options'

const CLIENT_KEY_MAP: Record<string, string> = {
  'customer.industry': 'CUST-INDUSTRY',
  'item.type': 'ITEM-TYPE',
  'lead.source': 'LEAD-SRC',
  'lead.rating': 'LEAD-RAT',
  'lead.status': 'LEAD-STATUS',
  'opportunity.stage': 'OPP-STAGE',
}

export function useListOptions<P extends ListPageKey>(
  page: P,
  list: keyof ListOptionsConfig[P] & string
) {
  const [options, setOptions] = useState<string[]>(() => sortListValues(getDefaultListValues(page, list), 'table'))

  useEffect(() => {
    let mounted = true

    async function loadOptions() {
      try {
        const response = await fetch('/api/config/lists', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !mounted) return

        const dbKey = CLIENT_KEY_MAP[`${page}.${list}`]
        if (dbKey && body?.rowsByKey?.[dbKey]) {
          const rows = body.rowsByKey[dbKey] as Array<{ value: string }>
          if (rows.length > 0) {
            setOptions(rows.map((r) => r.value))
            return
          }
        }

        setOptions(sortListValues(getDefaultListValues(page, list), 'table'))
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
