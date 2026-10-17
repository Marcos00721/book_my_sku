import { useEffect } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { FormProvider } from 'react-hook-form';

/** Pair with useAppForm(schema) to apply the shared Zod resolver. */
export function AppFormProvider({
  form,
  onSubmit,
  onInvalid,
  children,
  className,
  'aria-labelledby': labelledBy,
}) {
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    void controls.start('visible');
  }, [controls]);

  const handleInvalidSubmit = (errors, event) => {
    if (!reducedMotion) {
      void controls.start({
        x: [0, -5, 5, -3, 3, 0],
        transition: { duration: 0.32 },
      });
    }

    void onInvalid?.(errors, event);
  };

  return (
    <FormProvider {...form}>
      <motion.form
        noValidate
        aria-labelledby={labelledBy}
        className={className}
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
        initial={reducedMotion ? false : 'hidden'}
        animate={controls}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: reducedMotion ? 0 : 0.055,
            },
          },
        }}
      >
        {children}
      </motion.form>
    </FormProvider>
  );
}
