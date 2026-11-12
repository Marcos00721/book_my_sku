import { Phone } from 'lucide-react';
import { formatNumber } from '../../utils/phone';
import { FormTextField } from './FormTextField';

export function FormPhoneField({
  icon = <Phone />,
  autoComplete = 'tel-national',
  placeholder = '123-456-7890',
  hint = 'Enter 10 digits. Country code +1 is added automatically.',
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
      prefix="+1"
      hint={hint}
      maxLength={12}
      formatValue={formatNumber}
    />
  );
}
