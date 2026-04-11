import { promises as fs } from 'fs'
import path from 'path'
import { ListOptionsConfig, ListPageKey, mergeListConfig } from '@/lib/list-options'

const STORE_PATH = path.join(process.cwd(), 'config', 'list-options.json')

export async function loadListOptions(): Promise<ListOptionsConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return mergeListConfig(parsed)
  } catch {
    return mergeListConfig({})
  }
}

export async function saveListOptions(nextConfig: unknown): Promise<ListOptionsConfig> {
  const merged = mergeListConfig(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}

export async function updateSingleList(
  page: ListPageKey,
  list: string,
  values: unknown
): Promise<ListOptionsConfig> {
  const current = await loadListOptions()
  const next = mergeListConfig(current)
  const pageRecord = next[page] as Record<string, string[]>
  const defaults = mergeListConfig({})[page] as Record<string, string[]>

  if (!Object.prototype.hasOwnProperty.call(pageRecord, list)) {
    return next
  }

  const incoming = Array.isArray(values) ? values : []
  const normalized = incoming
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0)

  const unique: string[] = []
  for (const value of normalized) {
    if (!unique.includes(value)) unique.push(value)
  }

  pageRecord[list] = unique.length > 0 ? unique : defaults[list]
  return saveListOptions(next)
}
