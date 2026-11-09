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

export function PageLoader({ label = 'Opening your workspace…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-md text-center">
        <LoaderCircle
          className="size-control motion-safe:animate-spin text-primary"
          aria-hidden="true"
        />
        <p className={theme.text.muted}>{label}</p>
      </div>
    </div>
  )
}
