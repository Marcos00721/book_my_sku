import { z } from 'zod'
import { formatNumber, stripPhoneFormatting, usPhoneRegex } from '../utils/phone'

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(160, 'Use no more than 160 characters.'),
  email: z
    .string()
    .trim()
    .max(254, 'Use no more than 254 characters.')
    .default('')
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Enter a valid email address.',
    ),
  phone: z
    .string()
    .trim()
    .max(12, 'Use no more than 12 characters.')
    .default('')
    .refine(
      (value) => !value || usPhoneRegex.test(stripPhoneFormatting(value)),
      'Enter a valid 10-digit phone number.',
    ),
  jobTitle: z
    .string()
    .trim()
    .max(120, 'Use no more than 120 characters.')
    .default(''),
})

export function contactToFormValues(contact) {
  return {
    name: contact?.name || '',
    email: contact?.email || '',
    phone: formatNumber(contact?.phone || ''),
    jobTitle: contact?.jobTitle || '',
  }
}

export function buildContactPayload(values) {
  return {
    name: values.name.trim(),
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    jobTitle: values.jobTitle.trim() || null,
  }
}
