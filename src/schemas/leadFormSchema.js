import { z } from 'zod'

const plainText = (limit) => z.string()
  .refine((value) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value), 'Use plain text.')
  .pipe(z.string().trim().min(1, 'This field is required.').max(limit, `Use no more than ${limit} characters.`))

export const leadFormSchema = z.object({
  companyName: plainText(160),
  contactName: plainText(160),
  email: plainText(254).pipe(z.email('Enter a valid email address.')),
  phone: z.union([z.literal(''), plainText(40)]).default(''),
  requestedInHandsDate: z.union([z.literal(''), z.iso.date('Enter a valid date.')]).default(''),
  requirement: z.string()
    .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value.replace(/\r\n|\n/g, '')), 'Use plain paragraph text.')
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().min(1, 'Describe the requirement.').max(2000, 'Use no more than 2000 characters.')),
})
