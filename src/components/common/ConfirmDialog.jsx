import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'

/**
 * Native confirm modal (top-layer dialog). Controlled by ConfirmProvider.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className="app-dialog confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <header className="app-dialog-header">
        <div className="app-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId} className="app-dialog-description">
            {message}
          </p>
        </div>
      </header>
      <div className="dialog-footer confirm-dialog-footer">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
