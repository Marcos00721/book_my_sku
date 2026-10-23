/**
 * Skeleton shimmer placeholder for loading states.
 * Inherits the parent's width/height or use className to set size.
 *
 * @example
 *   <Skeleton className="h-control w-full rounded-control" />
 *   <Skeleton circle className="size-touch" />
 */
export function Skeleton({ circle = false, className = '', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={[
        'relative overflow-hidden bg-surface-muted',
        circle ? 'rounded-pill' : 'rounded-control',
        className,
      ].join(' ')}
      {...props}
    >
      <div className="absolute inset-none motion-safe:animate-pulse bg-border-subtle/40" />
    </div>
  )
}

/**
 * Pre-composed skeleton for a typical form field (label + input).
 */
export function SkeletonField() {
  return (
    <div className="space-y-xs">
      <Skeleton className="h-icon-sm w-xl" />
      <Skeleton className="h-control w-full" />
    </div>
  )
}
