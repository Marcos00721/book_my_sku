import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

export function FormSubmitButton({
  children,
  pendingLabel = 'Submitting…',
  disabled = false,
  className = '',
}) {
  const { formState } = useFormContext();
  const reducedMotion = useReducedMotion();
  const isDisabled = disabled || formState.disabled || formState.isSubmitting;

  return (
    <motion.button
      type="submit"
      disabled={isDisabled}
      aria-busy={formState.isSubmitting}
      whileHover={reducedMotion || isDisabled ? undefined : { y: -1 }}
      whileTap={reducedMotion || isDisabled ? undefined : { scale: 0.985 }}
      className={[
        'flex h-control w-full items-center justify-center gap-sm rounded-control bg-primary px-lg py-sm text-sm font-semibold text-on-primary shadow-subtle',
        'hover:bg-primary-hover focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-primary-disabled motion-safe:transition-colors',
        className,
      ].join(' ')}
    >
      <span aria-live="polite">{formState.isSubmitting ? pendingLabel : children}</span>
      {formState.isSubmitting ? (
        <LoaderCircle aria-hidden="true" className="size-icon motion-safe:animate-spin" />
      ) : (
        <ArrowRight aria-hidden="true" className="size-icon-sm" />
      )}
    </motion.button>
  );
}
