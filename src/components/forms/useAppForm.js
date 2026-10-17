import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

/** Shared defaults keep validation behavior consistent across the app. */
export function useAppForm(schema, options = {}) {
  return useForm({
    reValidateMode: 'onChange',
    shouldFocusError: true,
    ...options,
    mode: 'onTouched',
    resolver: zodResolver(schema),
  });
}
