import { z } from 'zod'

/** Company details form (setup). Add/remove fields here. */
export const companySetupFormSchema = z.object({
  industry: z
    .string()
    .trim()
    .min(1, 'Industry is required')
    .max(100, 'Industry must be 100 characters or less'),
  line1: z
    .string()
    .trim()
    .min(1, 'Address line 1 is required')
    .max(160, 'Address line 1 must be 160 characters or less'),
  line2: z
    .string()
    .trim()
    .max(160, 'Address line 2 must be 160 characters or less')
    .default(''),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City must be 100 characters or less'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Postal code is required')
    .max(24, 'Postal code must be 24 characters or less'),
  country: z
    .string()
    .trim()
    .min(1, 'Country is required')
    .max(2),
  stateCode: z.string().trim().max(20).default(''),
  region: z.string().trim().default(''),
})

export function companySetupDefaults(setup = {}) {
  const address = setup.address || {}
  return {
    industry: setup.industry || '',
    line1: address.line1 || '',
    line2: address.line2 || '',
    city: address.city || '',
    postalCode: address.postalCode || '',
    country: address.country || '',
    stateCode: address.stateCode || '',
    region: address.region || '',
  }
}

export function companySetupPayload(values) {
  return {
    industry: values.industry.trim(),
    address: {
      line1: values.line1.trim(),
      line2: values.line2.trim(),
      city: values.city.trim(),
      postalCode: values.postalCode.trim(),
      country: values.country.trim().toUpperCase(),
      stateCode: values.stateCode.trim(),
    },
  }
}