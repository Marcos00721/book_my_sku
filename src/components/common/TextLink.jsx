import { Link } from 'react-router-dom'
import { theme } from '@/crm-theme'

/** Inline text link (looks like a link). */
export function TextLink({ to, href, className = '', children, ...props }) {
  const classes = theme.cx('app-link', theme.link, className)

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
