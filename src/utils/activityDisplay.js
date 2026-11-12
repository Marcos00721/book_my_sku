const OBJECT_ID = /\b[a-f\d]{24}\b/gi
const PURE_OBJECT_ID = /^[a-f\d]{24}$/i

const ENTITY_LABELS = {
  client: 'Client',
  supplier: 'Supplier',
  contact: 'Contact',
  address: 'Address',
  note: 'Note',
  defaults: 'Defaults',
}

const FIELD_LABELS = {
  name: 'Name',
  website: 'Website',
  accountLabel: 'Account label',
  industryId: 'Industry',
  email: 'Email',
  phone: 'Phone',
  jobTitle: 'Job title',
  active: 'Active',
  status: 'Status',
  label: 'Label',
  companyName: 'Company name',
  usage: 'Usage',
  relationshipStatus: 'Relationship',
  accountManagerId: 'Account manager',
  defaultBillingAddressId: 'Billing default',
  defaultShippingAddressId: 'Shipping default',
  text: 'Note',
  reason: 'Reason',
  capabilities: 'Capabilities',
  accountNumber: 'Account number',
  purposes: 'Purposes',
  supplierCode: 'Supplier code',
  primaryContactId: 'Primary contact',
  orderingAddressId: 'Ordering address',
  shipFromAddressId: 'Ship-from address',
  returnsAddressId: 'Returns address',
  receivingAddressId: 'Receiving address',
}

/** Remove raw MongoDB ObjectIds from any display string. */
export function stripObjectIds(value) {
  if (value == null) return ''
  return String(value)
    .replace(OBJECT_ID, '')
    .replace(/\s*[·|,—-]\s*(?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isObjectId(value) {
  return typeof value === 'string' && PURE_OBJECT_ID.test(value.trim())
}

/** Human title for an activity action key. */
export function activityActionLabel(action) {
  if (!action) return 'Activity'
  const parts = String(action)
    .split('.')
    .map((part) => part.replaceAll('_', ' ').trim())
    .filter(Boolean)
  if (!parts.length) return 'Activity'
  // Prefer the verb ("renamed") over "Client · Renamed" — entity is shown separately.
  const verb = parts.at(-1)
  return verb.charAt(0).toUpperCase() + verb.slice(1)
}

export function activityEntityLabel(type) {
  return ENTITY_LABELS[type] || String(type || 'Record')
}

export function activityFieldLabel(field) {
  if (!field) return 'Field'
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  return field
    .replace(/Id$/i, '')
    .replaceAll(/([A-Z])/g, ' $1')
    .replaceAll('_', ' ')
    .trim()
}

export function activityActorLabel(actor) {
  const cleaned = stripObjectIds(actor?.label)
  return cleaned || 'Actor unavailable'
}

/**
 * Format activity before/after values without leaking raw MongoDB ids.
 */
export function formatActivityValue(value, field) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (isObjectId(value)) return '—'
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      if (!value.length) return '—'
      const parts = value
        .map((item) => formatActivityValue(item, field))
        .filter((item) => item && item !== '—')
      return parts.length ? parts.join(', ') : '—'
    }
    const entries = Object.entries(value).filter(
      ([key, item]) =>
        item != null &&
        item !== '' &&
        !/^(id|_id|.*Id)$/i.test(key) &&
        !isObjectId(item),
    )
    if (!entries.length) return '—'
    return entries
      .map(
        ([key, item]) =>
          `${activityFieldLabel(key)}: ${formatActivityValue(item, key)}`,
      )
      .join(' · ')
  }

  const cleaned = stripObjectIds(value)
  if (!cleaned || isObjectId(cleaned)) return '—'
  return cleaned
}
