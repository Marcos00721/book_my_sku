import { z } from 'zod'

function optionalHttpUrl(value) {
  if (!value) return true
  if (!/^https?:\/\/[^/\\]/i.test(value) || value.includes('\\')) return false
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

const CAPABILITIES = ['supplier', 'decorator', 'fulfillment']

export const supplierCapabilityOptions = [
  { value: 'supplier', label: 'Supplies products' },
  { value: 'decorator', label: 'Decorates products' },
  { value: 'fulfillment', label: 'Fulfillment' },
]

export const supplierFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(160, 'Use no more than 160 characters.'),
  capabilities: z
    .array(z.enum(CAPABILITIES))
    .min(1, 'Select at least one capability')
    .max(3, 'Choose up to three capabilities.'),
  website: z
    .string()
    .trim()
    .max(300, 'Use no more than 300 characters.')
    .default('')
    .refine(optionalHttpUrl, 'Use an http or https website.'),
  email: z
    .string()
    .trim()
    .max(254, 'Use no more than 254 characters.')
    .default('')
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      'Enter a valid email address.',
    ),
  phone: z
    .string()
    .trim()
    .max(40, 'Use no more than 40 characters.')
    .default(''),
  accountNumber: z
    .string()
    .trim()
    .max(120, 'Use no more than 120 characters.')
    .default(''),
})

/** Map a Supplier record into RHF default values. */
export function supplierToFormValues(supplier) {
  const capabilities = Array.isArray(supplier?.capabilities)
    ? supplier.capabilities.filter((item) => CAPABILITIES.includes(item))
    : []
  return {
    name: supplier?.name || '',
    capabilities: capabilities.length ? capabilities : ['supplier'],
    website: supplier?.website || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    accountNumber: supplier?.accountNumber || '',
  }
}

/**
 * Build create/patch body. For edit, only dirty (and actually changed) fields.
 * Patch always needs expectedRevision.
 */
export function buildSupplierPayload(values, { supplier, dirtyFields } = {}) {
  const next = {
    name: values.name.trim(),
    capabilities: [...values.capabilities].sort(),
    website: values.website.trim() || null,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    accountNumber: values.accountNumber.trim() || null,
  }

  if (!supplier) {
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0
        return value != null
      }),
    )
  }

  const keys = dirtyFields
    ? Object.keys(dirtyFields).filter((key) => key in next)
    : Object.keys(next)

  const payload = {}
  for (const key of keys) {
    const previous = supplier[key] ?? null
    const current = next[key]
    if (Array.isArray(current)) {
      const prevList = Array.isArray(previous) ? [...previous].sort() : []
      if (JSON.stringify(current) !== JSON.stringify(prevList)) {
        payload[key] = current
      }
      continue
    }
    if (current !== previous) payload[key] = current
  }
  return payload
}
