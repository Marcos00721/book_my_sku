import { forwardRef } from 'react'
import { theme } from '@/crm-theme'
import { FieldFrame } from './FieldFrame'

/**
 * App-wide text input. Same size/chrome as SelectField.
 * One bordered control; icons sit inside as overlays.
 * Use spacing token `none` (not `0`) — this theme has no numeric zero scale.
 */
export const TextField = forwardRef(function TextField(
  {
    label,
    hint,
    error,
    required = false,
    icon,
    prefix,
    trailing,
    id,
    className = '',
    controlClassName = '',
    disabled,
    ...props
  },
  ref,
) {
  const hasLeading = Boolean(icon || prefix)
  const hasBothLeading = Boolean(icon && prefix)

  return (
    <FieldFrame
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="relative">
          {hasLeading ? (
            <span
              aria-hidden="true"
              className={theme.cx(
                'pointer-events-none absolute inset-y-none left-none z-10 flex items-center text-text-muted',
                hasBothLeading
                  ? 'gap-xs pl-md pr-xs'
                  : 'w-control justify-center',
                '[&>svg]:size-icon [&>svg]:shrink-0',
              )}
            >
              {icon}
              {prefix ? (
                <span className="text-sm leading-none">{prefix}</span>
              ) : null}
            </span>
          ) : null}
          <input
            {...props}
            ref={ref}
            id={fieldId}
            required={required}
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={theme.cx(
              theme.input,
              invalid && theme.inputInvalid,
              hasBothLeading
                ? 'pl-3xl'
                : hasLeading
                  ? 'pl-control'
                  : 'pl-md',
              trailing ? 'pr-control' : 'pr-md',
              controlClassName,
            )}
          />
          {trailing}
        </div>
      )}
    </FieldFrame>
  )
})
