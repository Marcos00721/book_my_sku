import { forwardRef } from 'react'

const variantClasses = {
  primary:
    'bg-primary text-on-primary shadow-subtle hover:bg-primary-hover hover:shadow-card active:shadow-xs',
  secondary:
    'bg-secondary text-on-secondary shadow-subtle hover:bg-secondary-hover hover:shadow-card active:shadow-xs',
  outline:
    'border border-border-control bg-surface text-text-base hover:bg-surface-muted hover:border-primary hover:text-primary active:bg-surface',
  ghost:
    'text-text-muted hover:text-text-base hover:bg-surface-muted active:bg-border-subtle',
  danger:
    'bg-danger text-on-primary shadow-subtle hover:shadow-card active:shadow-xs',
}

const sizeClasses = {
  sm: 'h-touch px-sm text-xs gap-micro rounded-md',
  md: 'h-control px-lg text-sm gap-xs rounded-control',
  lg: 'px-xl py-sm text-base gap-sm rounded-lg',
}

/**
 * Reusable button with theme-driven variants and sizes.
 *
 * @example
 *   <Button variant="primary" size="md">Save</Button>
 *   <Button variant="outline" size="sm">Cancel</Button>
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center font-semibold',
        'motion-safe:transition-all focus-visible:shadow-focus focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
})
