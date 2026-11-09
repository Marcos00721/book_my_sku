import { theme } from '@/crm-theme'

export function FormLabel({ className = '', children, ...props }) {
  return (
    <label {...props} className={theme.cx(theme.label, className)}>
      {children}
    </label>
  )
}