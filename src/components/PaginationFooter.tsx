import Link from 'next/link'

export default function PaginationFooter({
  startRow,
  endRow,
  total,
  currentPage,
  totalPages,
  hasPrevPage,
  hasNextPage,
  prevHref,
  nextHref,
}: {
  startRow: number
  endRow: number
  total: number
  currentPage: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevHref: string
  nextHref: string
}) {
  return (
    <div
      className="flex items-center justify-between border-t px-6 py-4 text-sm"
      style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
    >
      <p>
        Showing {startRow}-{endRow} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={hasPrevPage ? prevHref : '#'}
          aria-disabled={!hasPrevPage}
          className="rounded-md border px-3 py-2 font-medium"
          style={{
            borderColor: 'var(--border-muted)',
            color: hasPrevPage ? 'var(--text-secondary)' : 'var(--text-muted)',
            pointerEvents: hasPrevPage ? 'auto' : 'none',
          }}
        >
          Previous
        </Link>
        <span className="px-2" style={{ color: 'var(--text-muted)' }}>
          Page {currentPage} of {totalPages}
        </span>
        <Link
          href={hasNextPage ? nextHref : '#'}
          aria-disabled={!hasNextPage}
          className="rounded-md border px-3 py-2 font-medium"
          style={{
            borderColor: 'var(--border-muted)',
            color: hasNextPage ? 'var(--text-secondary)' : 'var(--text-muted)',
            pointerEvents: hasNextPage ? 'auto' : 'none',
          }}
        >
          Next
        </Link>
      </div>
    </div>
  )
}
