import { z } from 'zod'

const keyPattern = /^[a-zA-Z0-9_-]{1,64}$/
const ratePattern = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/

const optionalRate = z
  .string()
  .trim()
  .refine((value) => value === '' || ratePattern.test(value), {
    message: 'Use a non-negative USD rate with up to 6 decimals.',
  })

const requiredRate = z
  .string()
  .trim()
  .min(1, 'This rate is required.')
  .refine((value) => ratePattern.test(value), {
    message: 'Use a non-negative USD rate with up to 6 decimals.',
  })

const priceTierSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, 'Tier key is required.')
      .regex(keyPattern, 'Use letters, digits, _ or - (max 64).'),
    min: z.coerce
      .number()
      .int('Quantity must be a whole number.')
      .min(1, 'Minimum is 1.')
      .max(100_000_000, 'Maximum is 100,000,000.'),
    maxExclusive: z.coerce
      .number()
      .int('Quantity must be a whole number.')
      .min(2, 'Upper bound must be at least 2.')
      .max(100_000_001, 'Upper bound max is 100,000,001.'),
    netBasis: z.enum(['base_item', 'procurement_unit']).optional(),
    net: optionalRate,
    list: optionalRate,
  })
  .refine((tier) => Number(tier.min) < Number(tier.maxExclusive), {
    message: 'Minimum must be less than the exclusive upper quantity.',
    path: ['maxExclusive'],
  })

const pricingVariantSchema = z.object({
  id: z.string().trim().min(1, 'Choose a variant.'),
  netPremium: requiredRate,
  sale: optionalRate,
})

export const pricingRulesSchema = z
  .object({
    currency: z.literal('USD'),
    accountId: z
      .string()
      .trim()
      .min(1, 'Supplier account label is required.')
      .regex(keyPattern, 'Use letters, digits, _ or - (max 64).'),
    warehouseId: z
      .string()
      .trim()
      .min(1, 'Warehouse label is required.')
      .regex(keyPattern, 'Use letters, digits, _ or - (max 64).'),
    agreementId: z
      .string()
      .trim()
      .min(1, 'Agreement label is required.')
      .regex(keyPattern, 'Use letters, digits, _ or - (max 64).'),
    tiers: z.array(priceTierSchema).max(100, 'At most 100 tiers.'),
    variants: z
      .array(pricingVariantSchema)
      .min(1, 'Add at least one pricing variant.')
      .max(100, 'At most 100 variants.'),
    poolEligible: z.array(z.string()),
  })
  .superRefine((rules, context) => {
    const ids = new Set()
    for (const [index, tier] of rules.tiers.entries()) {
      if (ids.has(tier.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Tier keys must be unique.',
          path: ['tiers', index, 'id'],
        })
      }
      ids.add(tier.id)
    }

    const sorted = [...rules.tiers].sort(
      (a, b) => Number(a.min) - Number(b.min),
    )
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (Number(current.min) < Number(previous.maxExclusive)) {
        const pathIndex = rules.tiers.findIndex(
          (tier) => tier.id === current.id,
        )
        context.addIssue({
          code: 'custom',
          message:
            'Quantity ranges must not overlap. Adjust the minimum or maximum quantity.',
          path: ['tiers', pathIndex, 'min'],
        })
      }
    }

    const variantIds = new Set()
    for (const [index, variant] of rules.variants.entries()) {
      if (variantIds.has(variant.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Each variant can appear once.',
          path: ['variants', index, 'id'],
        })
      }
      variantIds.add(variant.id)
    }
  })

export const PRICE_RATE_PATTERN = '(0|[1-9][0-9]{0,8})(\\.[0-9]{1,6})?'
export const PRICE_KEY_PATTERN = '[a-zA-Z0-9_-]{1,64}'

export function blankPricingRules() {
  return {
    currency: 'USD',
    accountId: 'standard',
    warehouseId: 'default',
    agreementId: '',
    tiers: [{ id: 'tier_1', min: 1, maxExclusive: 101, net: null, list: null }],
    variants: [],
    poolEligible: [],
  }
}

export function nextPricingKey(prefix, rows) {
  let index = 1
  while (rows.some((row) => row.id === `${prefix}_${index}`)) index += 1
  return `${prefix}_${index}`
}

export function sortPriceTiers(tiers) {
  return [...tiers].sort((a, b) => Number(a.min) - Number(b.min))
}

export function toIsoInstant(value) {
  return value ? new Date(value).toISOString() : null
}

function emptyToNull(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

/** Convert validated form values into the backend rules payload. */
export function normalizePricingRules(values) {
  return {
    currency: 'USD',
    accountId: values.accountId.trim(),
    warehouseId: values.warehouseId.trim(),
    agreementId: values.agreementId.trim(),
    tiers: values.tiers.map((tier) => ({
      id: tier.id.trim(),
      min: Number(tier.min),
      maxExclusive: Number(tier.maxExclusive),
      ...(tier.netBasis ? { netBasis: tier.netBasis } : {}),
      net: emptyToNull(tier.net),
      list: emptyToNull(tier.list),
    })),
    variants: values.variants.map((variant) => ({
      id: variant.id,
      netPremium: String(variant.netPremium).trim(),
      sale: emptyToNull(variant.sale),
    })),
    poolEligible: [...(values.poolEligible || [])],
  }
}
