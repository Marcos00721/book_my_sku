import { Action } from './Elements'

/**
 * Shared page-number pager for client/supplier directory lists.
 */
export function OffsetPager({
  total,
  page,
  pageCount,
  onPageChange,
  label = 'records',
  matchingLabel = '',
}) {
  const plural =
    total === 1 ? label : label.endsWith('s') ? label : `${label}s`

  return (
    <div className="table-bottom">
      <span>
        {total} {plural}
        {matchingLabel}
      </span>
      <div className="actions">
        <Action
          variant="secondary"
          disabled={page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          Previous
        </Action>
        <Action
          variant="secondary"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          Next
        </Action>
      </div>
    </div>
  )
}
