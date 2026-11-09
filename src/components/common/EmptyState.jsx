import { Inbox } from 'lucide-react'
import { theme } from '@/crm-theme'

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon,
  className = '',
}) {
  return (
    <div className={theme.cx('empty-state', className)}>
      <span className="empty-icon">
        {icon || <Inbox size={26} aria-hidden="true" />}
      </span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}
