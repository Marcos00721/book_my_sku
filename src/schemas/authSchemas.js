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

export const registerFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.'),
    lastName: z.string().trim().min(1, 'Enter your last name.'),
    email: emailFieldSchema,
    phone: z.string().refine(
      (value) =>
        /^[\d\s()+.-]+$/.test(value) &&
        usPhoneRegex.test(stripPhoneFormatting(value)),
      'Enter a 10-digit US phone number.',
    ),
    organizationName: z.string().trim().min(1, 'Enter your organization name.'),
  })

