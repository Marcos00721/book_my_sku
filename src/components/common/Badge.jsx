import { theme } from '@/crm-theme'

const tones = {
  default: theme.badge.default,
  primary: theme.badge.primary,
  success: theme.badge.success,
  warning: theme.badge.warning,
  danger: theme.badge.danger,
  info: theme.badge.info,
}

export function Badge({
  tone,
  variant,
  className = '',
  children,
  ...props
}) {
  const key = tone || variant || 'default'
  return (
    <span
      className={theme.cx(tones[key] || tones.default, className)}
      {...props}
    >
      {children}
    </span>
  )
}
