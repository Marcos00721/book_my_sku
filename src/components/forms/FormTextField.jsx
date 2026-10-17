import { useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useController, useFormContext } from 'react-hook-form';
import { FormLabel } from './FormLabel';

export function FormTextField({
  name,
  label,
  id,
  icon,
  hint,
  trailingControl,
  formatValue,
  disabled,
  className = '',
  onChange,
  onBlur,
  'aria-describedby': describedBy,
  ...inputProps
}) {
  const generatedId = useId();
  const inputId = id ?? `${name}-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const { control, formState } = useFormContext();
  const { field, fieldState } = useController({ name, control, disabled });
  const reducedMotion = useReducedMotion();
  const errorMessage = fieldState.error?.message;
  const isDisabled = Boolean(
    field.disabled || formState.disabled || disabled || formState.isSubmitting,
  );
  const descriptionIds = [
    hint ? hintId : undefined,
    errorMessage ? errorId : undefined,
    describedBy,
  ]
    .filter(Boolean)
    .join(' ');

  const handleChange = (event) => {
    const input = event.currentTarget;
    const originalValue = input.value;
    const nextValue = formatValue ? formatValue(originalValue) : originalValue;
    const selectionStart = input.selectionStart;

    field.onChange(nextValue);
    onChange?.(event);

    // Preserve the edit position when formatting an insertion or a paste.
    if (formatValue && selectionStart !== null) {
      const digitsBeforeCaret = originalValue
        .slice(0, selectionStart)
        .replace(/\D/g, '').length;
      let nextCaret = 0;
      let digitsSeen = 0;

      while (nextCaret < nextValue.length && digitsSeen < digitsBeforeCaret) {
        if (/\d/.test(nextValue[nextCaret])) digitsSeen += 1;
        nextCaret += 1;
      }

      // Delete moves past a restored separator so repeated Delete keeps editing.
      if (event.nativeEvent.inputType === 'deleteContentForward') {
        while (nextCaret < nextValue.length && /\D/.test(nextValue[nextCaret])) {
          nextCaret += 1;
        }
      }

      requestAnimationFrame(() => {
        if (document.activeElement === input) {
          input.setSelectionRange(nextCaret, nextCaret);
        }
      });
    }
  };

  return (
    <motion.div
      className={`min-w-none ${className}`}
      variants={{
        hidden: { opacity: 0, y: reducedMotion ? 0 : 8 },
        visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.28 } },
      }}
    >
      <FormLabel htmlFor={inputId}>
        {label}
      </FormLabel>
      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-none left-md flex items-center text-text-muted [&>svg]:size-icon"
          >
            {icon}
          </span>
        )}
        <input
          {...inputProps}
          {...field}
          id={inputId}
          value={field.value ?? ''}
          disabled={isDisabled}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={descriptionIds || undefined}
          onChange={handleChange}
          onBlur={(event) => {
            field.onBlur();
            onBlur?.(event);
          }}
          className={[
            'h-control w-full min-w-none rounded-control border bg-surface px-md py-sm text-base text-text-base',
            'placeholder:text-text-muted focus-visible:border-primary focus-visible:shadow-focus focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted motion-safe:transition-shadow',
            errorMessage ? 'border-danger' : 'border-border-control',
            icon ? 'pl-control' : '',
            trailingControl ? 'pr-control' : '',
          ].join(' ')}
        />
        {trailingControl}
      </div>
      {hint && (
        <p id={hintId} className="mt-xs text-xs leading-relaxed text-text-muted">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {errorMessage && (
          <motion.p
            id={errorId}
            key={errorId}
            role="alert"
            initial={reducedMotion ? false : { opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: reducedMotion ? 0 : -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            className="overflow-hidden pt-xs text-xs leading-relaxed text-danger"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
