import { prisma } from '@/lib/prisma'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ensureRegisteredManagedLists } from '@/lib/manage-lists'

function getDisplayOrder(key: string): string {
  try {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'config', 'list-display-order.json'), 'utf-8'))
    return config[key] ?? 'list'
  } catch {
    return 'list'
  }
}

/**
 * Load list option values for a given key from the ListOption table.
 * Respects the per-key display order setting (alphabetical or list order).
 */
export async function loadListValues(key: string): Promise<string[]> {
  await ensureRegisteredManagedLists()
  const displayOrder = getDisplayOrder(key)
  const rows = await prisma.listOption.findMany({
    where: { key },
    orderBy: displayOrder === 'alpha' ? { value: 'asc' } : { sortOrder: 'asc' },
    select: { value: true },
  })
  return rows.map((r) => r.value)
}
