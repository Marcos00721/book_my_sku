import { LoaderCircle } from 'lucide-react'
import { theme } from '@/crm-theme'

export function Loader({ label = 'Loading…', className = '' }) {
  return (
    <div className={theme.cx('loading-state', className)} role="status">
      <LoaderCircle className="spin" size={22} aria-hidden="true" />
      {label}
    </div>
  )
}

export function PageLoader({
  label = 'Opening your workspace…',
  description = 'Please wait while we get everything ready for you.',
}) {
  return (
    <div className="page-loading-state">
      <div className="page-loading-content" role="status" aria-live="polite" aria-atomic="true">
        <LoaderCircle
          className="size-control motion-safe:animate-spin text-primary"
          aria-hidden="true"
        />
        <p className="page-loading-title">{label}</p>
        {description && <p className="page-loading-description">{description}</p>}
      </div>
    </div>
  )
}
