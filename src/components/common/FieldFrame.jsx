import { useId } from 'react'
import { theme } from '@/crm-theme'

/** Shared label + hint + error chrome for TextField / SelectField. */
export function FieldFrame({
  id,
  label,
  required = false,
  hint,
  error,
  className = '',
  children,
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={theme.cx('min-w-0', className)}>
      {label ? (
        <label htmlFor={fieldId} className={theme.label}>
          {label}
          {required ? (
            <span className="required-mark" aria-hidden="true">
              {' '}
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children({
        id: fieldId,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
      })}
      {hint && !error ? (
        <p id={hintId} className="mt-xs text-xs leading-relaxed text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-xs text-xs leading-relaxed text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}