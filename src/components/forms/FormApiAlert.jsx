import { AlertCircle } from 'lucide-react'
import { theme } from '@/crm-theme'
import { Action } from '../workspace/Elements'

const FALLBACK = 'Something went wrong. Please try again.'

/** Prefer backend message; never surface raw objects or opaque codes alone. */
export function apiErrorMessage(error) {
  if (!error) return null
  const message =
    typeof error.message === 'string' ? error.message.trim() : ''
  if (message && message !== error.code) return message
  const fieldMessage = error.fields?.find(
    (field) => typeof field?.message === 'string' && field.message.trim(),
  )?.message
  if (fieldMessage) return fieldMessage.trim()
  return FALLBACK
}

/**
 * Compact form-level API error banner for setup/company flows.
 * Shows a human message only; optional Retry for recoverable payment failures.
 */
export function FormApiAlert({
  error,
  onRetry,
  retryLabel = 'Retry',
  retryDisabled = false,
}) {
  if (!error) return null
  const message = apiErrorMessage(error)
  const fieldHints = Array.isArray(error.fields)
    ? error.fields.filter(
        (field) =>
          typeof field?.message === 'string' &&
          field.message.trim() &&
          field.message.trim() !== message,
      )
    : []

  return (
    <div className={theme.cx(theme.notice.error, 'flex gap-sm')} role="alert">
      <AlertCircle size={18} className="mt-micro shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-xs">
        <p className="m-0 text-sm leading-relaxed">{message}</p>
        {fieldHints.map((field, index) => (
          <p key={`${field.field || 'field'}-${index}`} className="m-0 text-xs">
            {field.message}
          </p>
        ))}
        {onRetry ? (
          <Action
            variant="secondary"
            disabled={retryDisabled}
            onClick={onRetry}
          >
            {retryLabel}
          </Action>
        ) : null}
      </div>
    </div>
  )
}
