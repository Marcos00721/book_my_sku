import { useController, useFormContext } from 'react-hook-form'
import { SelectField } from '../common/SelectField'

/** RHF select — uses shared SelectField chrome (same size as TextField). */
export function FormSelectField({
  name,
  label,
  hint,
  disabled,
  className = '',
  onChange,
  onBlur,
  children,
  ...selectProps
}) {
  const { control, formState } = useFormContext()
  const { field, fieldState } = useController({ name, control, disabled })
  const isDisabled = Boolean(
    field.disabled || formState.disabled || disabled || formState.isSubmitting,
  )

  return (
    <SelectField
      {...selectProps}
      {...field}
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
    >
      {children}
    </SelectField>
  )
}