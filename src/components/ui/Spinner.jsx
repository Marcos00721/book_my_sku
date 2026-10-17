import { LoaderCircle } from 'lucide-react'

/**
 * Accessible loading spinner — pairs with any container.
 *
 * @example
 *   <Spinner />
 *   <Spinner size="lg" label="Loading leads…" />
 */
export function Spinner({
  size = 'md',
  label = 'Loading…',
  className = '',
}) {
  const sizeMap = {
    sm: 'size-icon-sm',
    md: 'size-icon',
    lg: 'size-control',
  }

  return (
    <span role="status" className={`inline-flex items-center gap-xs ${className}`}>
      <LoaderCircle
        aria-hidden="true"
        className={`motion-safe:animate-spin text-primary ${sizeMap[size]}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * Full-page centered spinner for route-level loading states.
 */
export function PageSpinner({ label = 'Opening your workspace…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-md text-center">
        <Spinner size="lg" label={label} />
        <p className="text-sm text-text-muted motion-safe:animate-pulse-soft">
          {label}
        </p>
      </div>
    </div>
  )
}
