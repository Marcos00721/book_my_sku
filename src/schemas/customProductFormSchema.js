import { z } from 'zod'

export const customProductFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(160, 'Use no more than 160 characters.'),
  supplierId: z.string().trim().min(1, 'Supplier is required'),
  supplierItemCode: z
    .string()
    .max(120, 'Use no more than 120 characters.')
    .default(''),
  categoryId: z.string().default(''),
  description: z
    .string()
    .max(4000, 'Use no more than 4000 characters.')
    .default(''),
  privateNotes: z
    .string()
    .max(4000, 'Use no more than 4000 characters.')
    .default(''),
})

/** Map a product record into RHF default values. */
export function productToFormValues(product) {
  return {
    name: product?.name || '',
    supplierId: product?.supplierId || '',
    supplierItemCode: product?.supplierItemCode || '',
    categoryId: product?.categoryId || '',
    description: product?.description || '',
    privateNotes: product?.privateNotes || '',
  }
}

function trimOrNull(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed ? trimmed : null
}

/**
 * Build create/patch body from form values.
 * Create sends all optional fields as null when empty (handoff / tests).
 * Edit sends only dirty fields that actually changed.
 */
export function buildCustomProductPayload(
  values,
  { product, dirtyFields } = {},
) {
  const next = {
    name: String(values.name || '').trim(),
    supplierId: String(values.supplierId || '').trim(),
    supplierItemCode: trimOrNull(values.supplierItemCode),
    categoryId: values.categoryId || null,
    description: trimOrNull(values.description),
    privateNotes: trimOrNull(values.privateNotes),
  }

  if (!product) {
    return next
  }

  const editable = {
    name: next.name,
    supplierItemCode: next.supplierItemCode,
    categoryId: next.categoryId,
    description: next.description,
    privateNotes: next.privateNotes,
  }

  const keys = dirtyFields
    ? Object.keys(dirtyFields).filter((key) => key in editable)
    : Object.keys(editable)

  const payload = {}
  for (const key of keys) {
    if (editable[key] !== (product[key] ?? null)) {
      payload[key] = editable[key]
    }
  }
  return payload
}
