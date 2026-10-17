import { Phone } from 'lucide-react';
import { formatUSPhoneNumber } from '../../utils/phone';
import { FormTextField } from './FormTextField';

export function FormPhoneField({
  icon = <Phone />,
  autoComplete = 'tel-national',
  placeholder = '202-555-0123',
  ...props
}) {
  return (
    <FormTextField
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      placeholder={placeholder}
      icon={icon}
      formatValue={formatUSPhoneNumber}
    />
  );
}
