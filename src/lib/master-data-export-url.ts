export function buildMasterDataExportUrl(resource: string, query?: string, sort?: string) {
  const search = new URLSearchParams({ resource })
  if (query) search.set('q', query)
  if (sort) search.set('sort', sort)
  return `/api/master-data-export?${search.toString()}`
}
