export const MASTER_DATA_TABLE_DIVIDER_STYLE = {
  borderBottom: '1px solid var(--border-muted)',
} as const

export const MASTER_DATA_HEADER_CELL_CLASSNAME =
  'sticky top-0 z-10 px-2.5 py-2 text-left text-sm font-medium uppercase tracking-wide'

export const MASTER_DATA_HEADER_CELL_STYLE = {
  color: 'var(--text-muted)',
  backgroundColor: 'var(--card)',
} as const

export const MASTER_DATA_BODY_CELL_CLASSNAME = 'px-2.5 py-2 text-sm'

export const MASTER_DATA_MUTED_CELL_STYLE = {
  color: 'var(--text-secondary)',
} as const

export const MASTER_DATA_EMPTY_CELL_CLASSNAME = 'px-2.5 py-8 text-center text-sm'

export const MASTER_DATA_EMPTY_CELL_STYLE = {
  color: 'var(--text-muted)',
} as const

export function getMasterDataRowStyle(index: number, total: number) {
  return index < total - 1 ? MASTER_DATA_TABLE_DIVIDER_STYLE : {}
}
