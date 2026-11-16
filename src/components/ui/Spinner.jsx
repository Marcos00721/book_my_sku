import { LoaderCircle } from 'lucide-react'
import { PageLoader } from '../common/Loader'

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
  return <PageLoader label={label} />
}
