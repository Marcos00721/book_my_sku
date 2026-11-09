import { forwardRef } from 'react'
import { theme } from '@/crm-theme'
import { FieldFrame } from './FieldFrame'

/**
 * App-wide text input. Same size/chrome as SelectField.
 * Controlled or uncontrolled — pass value/onChange or defaultValue.
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
        <div className="relative isolate">
          {(icon || prefix) && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-md z-10 flex items-center gap-xs text-text-muted [&>svg]:size-icon"
            >
              {icon}
              {prefix ? <span className="text-sm">{prefix}</span> : null}
            </span>
          )}
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
              icon || prefix ? 'pl-control' : '',
              icon && prefix ? 'pl-3xl' : '',
              trailing ? 'pr-control' : '',
              controlClassName,
            )}
          />
          {trailing}
        </div>
      )}
    </FieldFrame>
  )
})