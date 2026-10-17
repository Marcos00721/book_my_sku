import { Inbox } from 'lucide-react'

/**
 * Empty-state placeholder for lists with no data.
 *
 * @example
 *   <EmptyState title="No leads yet" description="Create your first lead to get started." />
 *   <EmptyState icon={<Search />} title="No results" />
 */
export function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-md px-lg py-3xl text-center',
        className,
      ].join(' ')}
    >
      <span className="flex size-control items-center justify-center rounded-pill bg-surface-muted text-text-subtle">
        {icon || <Inbox aria-hidden="true" className="size-icon" />}
      </span>
      <div className="space-y-xs">
        <p className="text-sm font-semibold text-text-base">{title}</p>
        {description && (
          <p className="mx-auto max-w-form text-sm leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-xs">{action}</div>}
    </div>
  )
}
