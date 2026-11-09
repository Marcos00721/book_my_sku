import { forwardRef } from 'react'
import { theme } from '@/crm-theme'

const variants = {
  primary: theme.button.primary,
  secondary: theme.button.secondary,
  outline: theme.button.secondary,
  danger: theme.button.danger,
  ghost: theme.button.ghost,
  icon: theme.button.icon,
}

/** Action control. Use TextLink / ButtonLink for navigation. */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size,
    type = 'button',
    className = '',
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={theme.cx(
        variants[variant] || variants.primary,
        size && theme.button.sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
