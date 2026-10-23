import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Inbox, LoaderCircle, X } from 'lucide-react'

export function Action({ children, variant = '', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`button ${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function ErrorNotice({ error, retry }) {
  if (!error) return null
  return (
    <div className="notice error-notice" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <p>{error.message || 'This request could not be completed.'}</p>
        {error.code && <small>{error.code}</small>}
        {error.fields?.map((field, index) => (
          <p key={index}>
            {field.field}: {field.message}
          </p>
        ))}
        {error.requestId && <small>Support reference: {error.requestId}</small>}
        {error.status === 409 && (
          <p>
            Reload the latest record and review your changes before saving
            again.
          </p>
        )}
        {error.retryAfterMs > 0 && (
          <p>
            Wait {Math.ceil(error.retryAfterMs / 1000)} seconds before retrying.
          </p>
        )}
        {error.status === 401 && (
          <Link className="app-link" to="/login">
            Sign in again
          </Link>
        )}
        {retry && (
          <Action variant="secondary" onClick={retry}>
            Reload latest data
          </Action>
        )}
      </div>
    </div>
  )
}

export function Loading({ label = 'Loading your workspace…' }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} aria-hidden="true" />
      {label}
    </div>
  )
}

export function Empty({ title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={26} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}

export function PageHeader({
  eyebrow = 'YOUR WORKSPACE',
  title,
  description,
  actions,
}) {
  useEffect(() => {
    document.title = `${title} | BookMySku`
  }, [title])
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  )
}

export function Status({ value }) {
  const tone = [
    'active',
    'approved',
    'normal',
    'complete',
    'ready',
    'accepted',
    'trialing',
  ].includes(value)
    ? 'success'
    : ['rejected', 'restricted', 'failed', 'revoked', 'suspended'].includes(
          value,
        )
      ? 'danger'
      : 'neutral'
  return (
    <span className={`status ${tone}`}>
      <span />
      {String(value || 'Unknown').replaceAll('_', ' ')}
    </span>
  )
}

export function Field({ label, children, hint, ...props }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {props.required && (
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
      {children ? (
        <select id={id} {...props}>
          {children}
        </select>
      ) : (
        <input id={id} {...props} />
      )}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Dialog({ title, children, close, locked = false }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const node = ref.current
    node.showModal()
    return () => node.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!locked) close()
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <Action
          variant="icon-button"
          aria-label="Close dialog"
          disabled={locked}
          onClick={close}
        >
          <X size={20} />
        </Action>
      </header>
      {children}
    </dialog>
  )
}

export function SaveFooter({
  mutation,
  label = 'Save changes',
  close,
  disabled = false,
}) {
  return (
    <>
      <ErrorNotice error={mutation.error} />
      {mutation.uncertain && (
        <p className="notice">
          The outcome is uncertain. Retry the same request to recover it safely.
        </p>
      )}
      <div className="dialog-footer">
        {close && (
          <Action
            variant="secondary"
            disabled={mutation.pending || mutation.uncertain}
            onClick={close}
          >
            Cancel
          </Action>
        )}
        <Action type="submit" disabled={mutation.pending || disabled}>
          {mutation.pending
            ? 'Saving…'
            : mutation.uncertain
              ? 'Retry same request'
              : label}
          <ArrowRight size={16} aria-hidden="true" />
        </Action>
      </div>
    </>
  )
}

export function PermissionDenied() {
  return (
    <Empty title="Access is limited">
      Your role does not include this area. Ask your workspace owner for access.
    </Empty>
  )
}
