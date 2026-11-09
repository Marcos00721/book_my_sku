import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { theme } from '@/crm-theme';

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
      className={theme.cx(
        theme.button.primary,
        'h-control w-full px-lg disabled:bg-primary-disabled disabled:opacity-100',
        className,
      )}
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
