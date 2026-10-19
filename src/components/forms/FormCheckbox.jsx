import { useId } from 'react'
import { useFormContext } from 'react-hook-form'

export function FormCheckbox({ name, children }) {
  const id = useId()
  const { register, formState } = useFormContext()
  const error = formState.errors[name]
  return <div>
    <label htmlFor={id} className="flex items-start gap-sm text-sm leading-relaxed">
      <input
        id={id}
        type="checkbox"
        {...register(name)}
        disabled={formState.isSubmitting}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-xs size-icon shrink-0 accent-primary"
      />
      <span>{children}</span>
    </label>
    {error && <p id={`${id}-error`} role="alert" className="mt-xs text-xs text-danger">{error.message}</p>}
  </div>
}
