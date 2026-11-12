import { Action } from './Elements'

/**
 * Shared cursor pager for list and activity footers.
 */
export function CursorPager({
  count = 0,
  label = 'records',
  pages,
  setPages,
  next,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}) {
  const plural =
    count === 1
      ? label
      : label.endsWith('s')
        ? label
        : `${label}s`

  return (
    <div className="table-bottom">
      <span>
        {count} {plural}
      </span>
      <div className="actions">
        <Action
          variant="secondary"
          disabled={!pages?.length}
          onClick={() => setPages((current) => current.slice(0, -1))}
        >
          {previousLabel}
        </Action>
        <Action
          variant="secondary"
          disabled={!next}
          onClick={() => setPages((current) => [...current, next])}
        >
          {nextLabel}
        </Action>
      </div>
    </div>
  )
}
