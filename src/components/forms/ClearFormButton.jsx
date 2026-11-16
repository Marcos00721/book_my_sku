import { useFormContext } from 'react-hook-form'
import { Button } from '../common/Button'

export function ClearFormButton({ disabled = false, onClear }) {
  const form = useFormContext()
  const locked = disabled || form?.formState.isSubmitting || form?.formState.disabled

  function clear(event) {
    if (locked) return
    const element = event.currentTarget.form
    // Native reset also notifies the dialog that its draft has been discarded.
    if (element) element.reset()
    else event.currentTarget.closest('dialog')?.dispatchEvent(new Event('reset', { bubbles: true }))
    if (form) form.reset(form.formState.defaultValues || {})
    onClear?.()
    requestAnimationFrame(() => {
      element?.querySelector(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not(:disabled):not([readonly]), textarea:not(:disabled), button[aria-haspopup="listbox"]:not(:disabled)',
      )?.focus()
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="form-clear-button"
      disabled={locked}
      onClick={clear}
    >
      Clear
    </Button>
  )
}
