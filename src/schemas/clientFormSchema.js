import { z } from 'zod'
import { hasRichTextContent, toEditorHtml } from '../utils/richText'

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

export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(160, 'Use no more than 160 characters.'),
  accountLabel: z
    .string()
    .trim()
    .max(120, 'Use no more than 120 characters.')
    .default(''),
  website: z
    .string()
    .trim()
    .max(300, 'Use no more than 300 characters.')
    .default('')
    .refine(optionalHttpUrl, 'Use an http or https website.'),
  industryId: z.string().default(''),
  notes: z.string().trim().max(2000, 'Use no more than 2000 characters.').default(''),
})

/** Map a Client record into RHF default values. */
export function clientToFormValues(client) {
  return {
    name: client?.name || '',
    accountLabel: client?.accountLabel || '',
    website: client?.website || '',
    industryId: client?.industryId || '',
    notes: toEditorHtml(client?.notes || ''),
  }
}

/**
 * Build create/patch body. For edit, only dirty (and actually changed) fields.
 * Patch always needs `expectedVersion`.
 */
export function buildClientPayload(values, { client, dirtyFields } = {}) {
  const next = {
    name: values.name.trim(),
    website: values.website.trim() || null,
    accountLabel: values.accountLabel.trim() || null,
    industryId: values.industryId || null,
    notes: hasRichTextContent(values.notes) ? values.notes.trim() : null,
  }

  if (!client) {
    return Object.fromEntries(
      Object.entries(next).filter(([, value]) => value != null),
    )
  }

  const keys = dirtyFields
    ? Object.keys(dirtyFields).filter((key) => key in next)
    : Object.keys(next)

  const payload = {}
  for (const key of keys) {
    const previous = key === 'notes' ? toEditorHtml(client.notes || '') || null : client[key] ?? null
    if (next[key] !== previous) payload[key] = next[key]
  }
  return payload
}
