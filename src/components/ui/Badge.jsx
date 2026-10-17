const variantClasses = {
  default:
    'bg-surface-muted text-text-muted border border-border-subtle',
  primary:
    'bg-primary-soft text-primary',
  success:
    'bg-success-muted text-success',
  warning:
    'bg-warning-muted text-warning',
  danger:
    'bg-danger-muted text-danger',
  info:
    'bg-info-muted text-info',
  accent:
    'bg-accent-soft text-accent-hover',
}

const sizeClasses = {
  sm: 'px-xs py-micro text-xs',
  md: 'px-sm py-micro text-xs',
  lg: 'px-sm py-xs text-sm',
}

/**
 * Status badge / label with theme-driven color variants.
 *
 * @example
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="danger" size="sm">Overdue</Badge>
 */
export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-micro rounded-pill font-medium leading-snug',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
