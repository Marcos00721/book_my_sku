import { Skeleton } from '../ui/Skeleton'
import './ListSkeleton.css'

/** Match the list layout while keeping decorative placeholders out of the accessibility tree. */
export function ListSkeleton({
  label = 'Loading records…',
  columns = ['', '', '', ''],
  rows = 6,
  variant = 'table',
  thumbnail = false,
}) {
  const placeholders = Array.from({ length: rows }, (_, index) => index)

  return (
    <div className="list-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {variant === 'table' ? (
        <div className="table-scroll" aria-hidden="true">
          <table className="data-table list-skeleton-table" style={{ '--list-skeleton-columns': columns.length }}>
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th key={index} scope="col">
                    {column || <Skeleton className="list-skeleton-heading" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {placeholders.map((row) => (
                <tr key={row}>
                  {columns.map((_, column) => (
                    <td key={column}>
                      <div className="list-skeleton-cell">
                        {thumbnail && column === 0 && (
                          <Skeleton className="list-skeleton-thumbnail" />
                        )}
                        <div className="list-skeleton-lines">
                          <Skeleton className={`list-skeleton-line list-skeleton-width-${(row + column) % 3}`} />
                          {column === 0 && <Skeleton className="list-skeleton-line list-skeleton-secondary" />}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`list-skeleton-items list-skeleton-${variant}`} aria-hidden="true">
          {placeholders.map((row) => (
            <div className="list-skeleton-item" key={row}>
              <div className="list-skeleton-lines">
                <Skeleton className={`list-skeleton-line list-skeleton-width-${row % 3}`} />
                <Skeleton className="list-skeleton-line list-skeleton-secondary" />
                {variant === 'cards' && <Skeleton className="list-skeleton-line" />}
              </div>
              <Skeleton className="list-skeleton-action" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
