import { useController, useFormContext } from 'react-hook-form'
import { TextEditor } from '../common/TextEditor'

/** RHF HTML editor — same FieldFrame chrome as FormTextField / FormSelectField. */
export function FormTextEditor({
  name,
  label,
  hint,
  disabled,
  readOnly = false,
  className = '',
  onChange,
  onBlur,
  ...editorProps
}) {
  const { control, formState } = useFormContext()
  const { field, fieldState } = useController({ name, control, disabled })
  const isDisabled = Boolean(
    field.disabled || formState.disabled || disabled || readOnly || formState.isSubmitting,
  )

  return (
    <TextEditor
      {...editorProps}
      name={name}
      label={label}
      hint={hint}
      error={fieldState.error?.message}
      disabled={isDisabled}
      className={className}
      value={field.value ?? ''}
      onChange={(event) => {
        field.onChange(event.target.value)
        onChange?.(event)
      }}
      onBlur={(event) => {
        field.onBlur()
        onBlur?.(event)
      }}
    />
  )
}
