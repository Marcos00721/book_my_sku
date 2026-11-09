import { Link } from 'react-router-dom'
import { theme } from '@/crm-theme'

const variants = {
  primary: theme.button.primary,
  secondary: theme.button.secondary,
  ghost: theme.button.ghost,
  icon: theme.button.icon,
}

/**
 * Navigation that must look like a CTA button (explicit exception).
 * Prefer TextLink when a normal link is enough.
 */
export function ButtonLink({
  to,
  href,
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  const classes = theme.cx(variants[variant] || variants.primary, className)

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} className={classes} {...props}>
      {children}
    </Link>
  )
}
