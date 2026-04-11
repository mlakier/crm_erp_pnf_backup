export function getPagination(totalItems: number, rawPage: string | undefined, pageSize = 50) {
  const parsedPage = Number(rawPage ?? '1')
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(requestedPage, totalPages)
  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, totalItems)

  return {
    pageSize,
    currentPage,
    totalPages,
    startRow,
    endRow,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    skip: (currentPage - 1) * pageSize,
  }
}
