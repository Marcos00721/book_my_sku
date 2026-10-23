import { z } from 'zod';

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
    lastName: z.string().trim().max(80).default(''),
    email: emailFieldSchema.max(254).toLowerCase(),
    contactNumber: z.string().trim().max(40)
      .transform(value => value.replace(/[ ()-]/g, ''))
      .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, 'Include your country code, for example +14155552671.')),
    companyName: z.string().trim().min(1, 'Enter your company name.').max(160),
    companyWebsite: z.string().trim().max(500).default('')
      .transform(value => value && !value.includes('://') ? `https://${value}` : value)
      .refine(value => {
        if (!value) return true
        try {
          const url = new URL(value)
          return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        } catch { return false }
      }, 'Enter a valid HTTP or HTTPS website.'),
    termsAccepted: z.literal(true, { error: 'Accept the registration terms to continue.' }),
  })

export const unifiedSignupSchema = registerFormSchema.extend({
  password: z.string().min(8, 'Use at least 8 characters.').max(128),
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Your passwords do not match.',
  path: ['confirmPassword'],
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
