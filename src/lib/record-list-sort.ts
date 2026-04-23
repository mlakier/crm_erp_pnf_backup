import type { MasterDataListSortOption } from '@/components/MasterDataListToolbar'

export const DEFAULT_RECORD_LIST_SORT = 'id'

export const ID_SORT_OPTION: MasterDataListSortOption = { value: 'id', label: 'Id' }

export const ID_NEWEST_OLDEST_OPTIONS: MasterDataListSortOption[] = [
  ID_SORT_OPTION,
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

export const ID_NEWEST_OLDEST_NAME_SORT_OPTIONS: MasterDataListSortOption[] = [
  ...ID_NEWEST_OLDEST_OPTIONS,
  { value: 'name', label: 'Name A-Z' },
]

export function prependIdSortOption(options: MasterDataListSortOption[]) {
  return options.some((option) => option.value === 'id')
    ? options
    : [ID_SORT_OPTION, ...options]
}
