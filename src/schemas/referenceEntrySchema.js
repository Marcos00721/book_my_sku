import { z } from 'zod'

export const referenceEntrySchema = z.object({
  label: z.string().trim().normalize('NFC')
    .min(1, 'Enter a name.')
    .max(120, 'Use 120 characters or fewer.')
    .refine((value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value), 'Remove control characters from the name.'),
  description: z.string().trim().normalize('NFC')
    .max(500, 'Use 500 characters or fewer.')
    .refine((value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value), 'Remove control characters from the description.'),
})
