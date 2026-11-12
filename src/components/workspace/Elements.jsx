import { useId, useRef, useEffect } from 'react'
import { AlertCircle, ArrowRight, X } from 'lucide-react'
import { Button } from '../common/Button'
import { TextLink } from '../common/TextLink'
import { PageHeader } from '../common/PageHeader'
import { StickyPageChrome, PageTabs } from '../common/StickyPageChrome'
import { SectionHeading } from './SectionHeading'
import { ActivityTimeline } from './ActivityTimeline'
import { OffsetPager } from './OffsetPager'
import { CursorPager } from './CursorPager'
import { EntityDataTable } from './EntityDataTable'
import { EmptyState } from '../common/EmptyState'
import { Loader } from '../common/Loader'
import { TextField } from '../common/TextField'
import { SelectField } from '../common/SelectField'

const actionVariants = {
  '': 'primary',
  secondary: 'secondary',
  'danger-button': 'danger',
  'icon-button': 'icon',
  'text-button': 'ghost',
}

export function Action({
  children,
  variant = '',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <Button
      type={type}
      variant={actionVariants[variant] || 'primary'}
      className={className}
      {...props}
    >
      {children}
    </Button>
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
          <TextLink to="/login">Sign in again</TextLink>
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
  return <Loader label={label} />
}

export function Empty({ title = 'Nothing here yet', children, action, icon }) {
  return (
    <EmptyState title={title} description={children} action={action} icon={icon} />
  )
}

export {
  PageHeader,
  StickyPageChrome,
  PageTabs,
  SectionHeading,
  ActivityTimeline,
  OffsetPager,
  CursorPager,
  EntityDataTable,
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

/** Workspace Field — same TextField / SelectField chrome app-wide. */
export function Field({ label, children, hint, error, className = '', ...props }) {
  if (children) {
    return (
      <SelectField
        label={label}
        hint={hint}
        error={error}
        className={className}
        {...props}
      >
        {children}
      </SelectField>
    )
  }
  return (
    <TextField
      label={label}
      hint={hint}
      error={error}
      className={className}
      {...props}
    />
  )
}

export function Dialog({
  title,
  description,
  children,
  close,
  locked = false,
  className = '',
}) {
  const ref = useRef(null)
  const dirty = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  function allowDiscard() {
    return (
      !dirty.current ||
      window.confirm(
        'Discard unsaved changes? Choose Cancel to stay and save your draft.',
      )
    )
  }
  useEffect(() => {
    const node = ref.current
    node.showModal()
    const topmost = () =>
      [...document.querySelectorAll('dialog[open]')].at(-1) === node
    const beforeUnload = (event) => {
      if (dirty.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const navigation = (event) => {
      if (
        topmost() &&
        dirty.current &&
        !window.confirm('Discard unsaved changes and leave this form?')
      ) {
        event.preventDefault()
        event.stopPropagation()
      } else if (topmost()) dirty.current = false
    }
    const link = (event) => {
      if (event.target.closest('a[href]')) navigation(event)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('workspace-before-switch', navigation)
    document.addEventListener('click', link, true)
    return () => {
      node.close()
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('workspace-before-switch', navigation)
      document.removeEventListener('click', link, true)
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`app-dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onInputCapture={() => {
        dirty.current = true
        ref.current.dataset.dirty = 'true'
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!locked && allowDiscard()) close()
      }}
    >
      <header className="app-dialog-header">
        <div className="app-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          {description ? (
            <p id={descriptionId} className="app-dialog-description">
              {description}
            </p>
          ) : null}
        </div>
        <Action
          variant="icon-button"
          aria-label="Close dialog"
          disabled={locked}
          onClick={() => {
            if (allowDiscard()) close()
          }}
        >
          <X size={20} />
        </Action>
      </header>
      <div className="app-dialog-body">{children}</div>
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
            onClick={(event) => {
              if (
                event.currentTarget.closest('dialog')?.dataset.dirty !==
                  'true' ||
                window.confirm(
                  'Discard unsaved changes? Choose Cancel to keep editing.',
                )
              )
                close()
            }}
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
