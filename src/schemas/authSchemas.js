import { z } from 'zod';
import { stripPhoneFormatting, usPhoneRegex } from '../utils/phone';

const emailFieldSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.');

export const loginFormSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signupFormSchema = z.object({
  email: emailFieldSchema.max(254).toLowerCase(),
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'Use no more than 128 characters.'),
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Your passwords do not match.',
  path: ['confirmPassword'],
});

export const registerFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
    lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
    email: emailFieldSchema.max(254).toLowerCase(),
    contactNumber: z.string().trim().max(40)
      .transform(stripPhoneFormatting)
      .pipe(z.string().regex(usPhoneRegex, 'Enter a 10-digit US phone number.'))
      .transform(value => `+1${value}`),
    companyName: z.string().trim().min(1, 'Enter your company name.').max(160),
    companyWebsite: z.string().trim().min(1, 'Enter your company website.').max(500)
      .transform(value => value.includes('://') ? value : `https://${value}`)
      .refine(value => {
        try {
          const url = new URL(value)
          return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        } catch { return false }
      }, 'Enter a valid HTTP or HTTPS website.'),
    termsAccepted: z.literal(true, { error: 'Accept the registration terms to continue.' }),
  })

export const registrationApplicationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected']),
  revision: z.number().int().nonnegative(),
  companyName: z.string(),
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactNumber: z.string().optional(),
  companyWebsite: z.string().optional(),
  reason: z.string().optional(),
})

export const onboardingStatusSchema = z.object({
  termsVersion: z.string().min(1),
  application: registrationApplicationSchema.nullable(),
})
