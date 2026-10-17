import { Layers3 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BrandMark() {
  return (
    <Link
      to="/login"
      aria-label="BookMySku home"
      className="inline-flex w-fit items-center gap-sm rounded-control font-display text-xl font-semibold tracking-tight text-text-base outline-none motion-safe:transition-transform hover:scale-105 focus-visible:ring-focus focus-visible:ring-primary focus-visible:ring-offset-focus focus-visible:ring-offset-brand-surface"
    >
      <span className="flex h-touch w-touch items-center justify-center rounded-control bg-primary text-surface shadow-subtle">
        <Layers3 className="h-icon w-icon" aria-hidden="true" />
      </span>
      BookMySku<span className="sr-only"> home</span>
    </Link>
  )
}
