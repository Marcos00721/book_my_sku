import { theme } from '@/crm-theme'

const variantClasses = {
  default: theme.badge.default,
  primary: theme.badge.primary,
  success: theme.badge.success,
  warning: theme.badge.warning,
  danger: theme.badge.danger,
  info: theme.badge.info,
  accent: theme.badge.primary,
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
  const sizeClass =
    size === 'sm'
      ? 'px-xs py-micro text-xs'
      : size === 'lg'
        ? 'px-sm py-xs text-sm'
        : ''

  return (
    <span
      className={theme.cx(
        variantClasses[variant] || theme.badge.default,
        sizeClass,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
