import { ArrowLeft, LoaderCircle, Package } from 'lucide-react'
import { theme } from '@/crm-theme'
import { Skeleton } from '../ui/Skeleton'
import { TextLink } from './TextLink'
import './Loader.css'

function PlaceholderFields({ form = false, count = 6 }) {
  return (
    <div className="loading-placeholder-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="loading-placeholder-field" key={index}>
          <Skeleton className="loading-placeholder-caption" />
          <Skeleton className={form ? 'loading-placeholder-input' : `loading-placeholder-value loading-placeholder-value-${index % 3}`} />
        </div>
      ))}
    </div>
  )
}

/** Use the surrounding content's shape so loading does not collapse the layout. */
export function Loader({
  label = 'Loading…',
  className = '',
  variant = 'panel',
  backTo,
  backLabel = 'Back',
}) {
  const page = ['detail', 'form', 'page'].includes(variant)

  return (
    <div className={theme.cx('loading-state', `loading-state--${variant}`, className)} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {page && backTo && (
        <TextLink to={backTo} className="back-link loading-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </TextLink>
      )}
      {variant === 'inline' ? (
        <span className="loading-inline" aria-hidden="true">
          <LoaderCircle className="motion-safe:animate-spin" size={16} />
          {label}
        </span>
      ) : variant === 'field' ? (
        <div className="loading-placeholder-field" aria-hidden="true">
          <Skeleton className="loading-placeholder-caption" />
          <Skeleton className="loading-placeholder-input" />
        </div>
      ) : (
        <div className="loading-placeholder" aria-hidden="true">
          {page && (
            <div className="loading-placeholder-header">
              <div className="loading-placeholder-heading">
                <Skeleton className="loading-placeholder-title" />
                <Skeleton className="loading-placeholder-subtitle" />
              </div>
              <Skeleton className="loading-placeholder-button" />
            </div>
          )}
          {variant === 'detail' && (
            <div className="loading-placeholder-tabs">
              {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="loading-placeholder-tab" />)}
            </div>
          )}
          <div className="loading-placeholder-panel">
            <Skeleton className="loading-placeholder-section" />
            <PlaceholderFields form={variant === 'form'} count={page ? 6 : 4} />
            {variant === 'form' && (
              <div className="loading-placeholder-footer">
                <Skeleton className="loading-placeholder-button" />
                <Skeleton className="loading-placeholder-button" />
              </div>
            )}
          </div>
          {page && variant !== 'form' && (
            <div className="loading-placeholder-panel loading-placeholder-secondary">
              <Skeleton className="loading-placeholder-section" />
              <Skeleton className="loading-placeholder-copy" />
              <Skeleton className="loading-placeholder-copy loading-placeholder-copy-short" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PageLoader({
  label = 'Opening your workspace…',
  description = 'Please wait while we get everything ready for you.',
}) {
  return (
    <div className="page-loading-state">
      <div className="page-loading-content" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
        <div className="page-loading-emblem" aria-hidden="true"><Package size={28} strokeWidth={1.5} /></div>
        <p className="page-loading-title">{label}</p>
        {description && <p className="page-loading-description">{description}</p>}
        <div className="page-loading-track" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}
