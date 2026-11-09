import { useController, useFormContext } from 'react-hook-form'
import { TextField } from '../common/TextField'

/** RHF text field — uses shared TextField chrome. */
export function FormTextField({
  name,
  label,
  hint,
  icon,
  prefix,
  trailingControl,
  formatValue,
  disabled,
  className = '',
  onChange,
  onBlur,
  ...inputProps
}) {
  const { control, formState } = useFormContext()
  const { field, fieldState } = useController({ name, control, disabled })
  const isDisabled = Boolean(
    field.disabled || formState.disabled || disabled || formState.isSubmitting,
  )

  const handleChange = (event) => {
    const input = event.currentTarget
    const originalValue = input.value
    const nextValue = formatValue ? formatValue(originalValue) : originalValue
    const selectionStart = input.selectionStart

    field.onChange(nextValue)
    onChange?.(event)

    if (formatValue && selectionStart !== null) {
      const digitsBeforeCaret = originalValue
        .slice(0, selectionStart)
        .replace(/\D/g, '').length
      let nextCaret = 0
      let digitsSeen = 0
      while (nextCaret < nextValue.length && digitsSeen < digitsBeforeCaret) {
        if (/\d/.test(nextValue[nextCaret])) digitsSeen += 1
        nextCaret += 1
      }
      if (event.nativeEvent.inputType === 'deleteContentForward') {
        while (nextCaret < nextValue.length && /\D/.test(nextValue[nextCaret])) {
          nextCaret += 1
        }
      }
      requestAnimationFrame(() => {
        if (document.activeElement === input) {
          input.setSelectionRange(nextCaret, nextCaret)
        }
      })
    }
  }

  return (
    <TextField
      {...inputProps}
      {...field}
      name={name}
      label={label}
      hint={hint}
      icon={icon}
      prefix={prefix}
      trailing={trailingControl}
      error={fieldState.error?.message}
      disabled={isDisabled}
      className={className}
      value={field.value ?? ''}
      onChange={handleChange}
      onBlur={(event) => {
        field.onBlur()
        onBlur?.(event)
      }}
    />
  )
}