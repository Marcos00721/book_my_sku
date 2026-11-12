import { z } from 'zod'
import {
  addressPurposes,
  contactPurposes,
} from '../components/suppliers/supplierPurposes'

const CONTACT_PURPOSE_VALUES = contactPurposes
const ADDRESS_PURPOSE_VALUES = Object.keys(addressPurposes)

export const supplierContactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(160, 'Use no more than 160 characters.'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(254, 'Use no more than 254 characters.')
    .refine(
      (value) => z.string().email().safeParse(value).success,
      'Enter a valid email address.',
    ),
  phone: z
    .string()
    .trim()
    .max(40, 'Use no more than 40 characters.')
    .default(''),
  jobTitle: z
    .string()
    .trim()
    .max(120, 'Use no more than 120 characters.')
    .default(''),
  purposes: z.array(z.enum(CONTACT_PURPOSE_VALUES)).default([]),
  setAsDefault: z.boolean().default(false),
})

export const supplierContactRestoreSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(254, 'Use no more than 254 characters.')
    .refine(
      (value) => z.string().email().safeParse(value).success,
      'Enter a valid email address.',
    ),
})

export const supplierAddressFormSchema = z
  .object({
    label: z
      .string()
      .trim()
      .max(80, 'Use no more than 80 characters.')
      .default(''),
    line1: z
      .string()
      .trim()
      .max(160, 'Use no more than 160 characters.')
      .default(''),
    line2: z
      .string()
      .trim()
      .max(160, 'Use no more than 160 characters.')
      .default(''),
    city: z
      .string()
      .trim()
      .max(100, 'Use no more than 100 characters.')
      .default(''),
    postalCode: z
      .string()
      .trim()
      .max(32, 'Use no more than 32 characters.')
      .default(''),
    country: z.string().default(''),
    stateCode: z.string().default(''),
    region: z.string().default(''),
    purposes: z
      .array(z.enum(ADDRESS_PURPOSE_VALUES))
      .min(1, 'Select at least one address purpose'),
    setAsDefault: z.boolean().default(false),
  })
  .superRefine((values, context) => {
    if (!values.country) {
      context.addIssue({
        code: 'custom',
        path: ['country'],
        message: 'Country is required',
      })
    }
  })

export function supplierContactToFormValues(record) {
  return {
    name: record?.name || '',
    email: record?.email || '',
    phone: record?.phone || '',
    jobTitle: record?.jobTitle || '',
    purposes: Array.isArray(record?.purposes) ? [...record.purposes] : [],
    setAsDefault: false,
  }
}

export function supplierAddressToFormValues(record) {
  return {
    label: record?.label || '',
    line1: record?.address?.line1 || '',
    line2: record?.address?.line2 || '',
    city: record?.address?.city || '',
    postalCode: record?.address?.postalCode || '',
    country: record?.address?.country || '',
    stateCode: record?.address?.stateCode || '',
    region: record?.address?.region || '',
    purposes: Array.isArray(record?.purposes)
      ? [...record.purposes]
      : record?._id
        ? []
        : ['ordering'],
    setAsDefault: false,
  }
}
