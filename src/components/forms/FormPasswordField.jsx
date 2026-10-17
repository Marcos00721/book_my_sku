import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormTextField } from './FormTextField';

export function FormPasswordField({
  label,
  icon = <LockKeyhole />,
  disabled,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);
  const { formState } = useFormContext();
  const VisibilityIcon = isVisible ? EyeOff : Eye;

  return (
    <FormTextField
      {...props}
      label={label}
      disabled={disabled}
      type={isVisible ? 'text' : 'password'}
      icon={icon}
      trailingControl={
        <button
          type="button"
          aria-label={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          disabled={disabled || formState.disabled || formState.isSubmitting}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute inset-y-none right-micro my-auto flex size-touch items-center justify-center rounded-control text-text-muted hover:text-primary focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed"
        >
          <VisibilityIcon aria-hidden="true" className="size-icon" />
        </button>
      }
    />
  );
}
