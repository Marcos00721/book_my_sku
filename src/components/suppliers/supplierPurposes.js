export const addressPurposes = {
  ordering: 'Ordering',
  ship_from: 'Ship from',
  returns: 'Returns',
  receiving: 'Receiving',
}

export const contactPurposes = [
  'sales_account',
  'ordering',
  'artwork_proofs',
  'production',
  'accounting',
  'general_support',
]

export function purposeLabel(value) {
  if (value === 'primaryContact') return 'Primary contact'
  if (addressPurposes[value]) return addressPurposes[value]
  return String(value || '')
    .replaceAll(/([A-Z])/g, ' $1')
    .replaceAll('_', ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())
}
