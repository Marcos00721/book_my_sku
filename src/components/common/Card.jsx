import { theme } from '@/crm-theme'

export function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag className={theme.cx('panel', theme.panel, className)} {...props}>
      {children}
    </Tag>
  )
}
