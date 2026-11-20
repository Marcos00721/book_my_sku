import { z } from 'zod'

export const managementFormSchema = z.object({
  relationshipStatus: z.enum(['prospect', 'customer', 'dormant']),
  accountManagerId: z.string().default(''),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(250, 'Use no more than 250 characters.'),
})

export const archiveRestoreFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(250, 'Use no more than 250 characters.'),
})

export const addressFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(80, 'Use no more than 80 characters.'),
  companyName: z
    .string()
    .trim()
    .min(1, 'Company name is required')
    .max(160, 'Use no more than 160 characters.'),
  usage: z.enum(['billing', 'shipping', 'both']),
  active: z.boolean().default(true),
  line1: z
    .string()
    .trim()
    .min(1, 'Address line 1 is required')
    .max(160, 'Use no more than 160 characters.'),
  line2: z
    .string()
    .trim()
    .max(160, 'Use no more than 160 characters.')
    .default(''),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'Use no more than 100 characters.'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Postal code is required')
    .max(32, 'Use no more than 32 characters.'),
  country: z.string().trim().min(1, 'Country is required'),
  // `__none__` is set by the address form when the country has no states.
  stateCode: z.string().trim().min(1, 'State is required'),
  region: z.string().default(''),
})

export function addressToFormValues(address) {
  return {
    label: address?.label || '',
    companyName: address?.companyName || '',
    usage: address?.usage || 'billing',
    active: address?.active ?? true,
    line1: address?.address?.line1 || '',
    line2: address?.address?.line2 || '',
    city: address?.address?.city || '',
    postalCode: address?.address?.postalCode || '',
    country: address?.address?.country || '',
    stateCode: address?.address?.stateCode || '',
    region: address?.address?.region || '',
  }
}
