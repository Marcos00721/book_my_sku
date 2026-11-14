export function displayPricingValue(
  value:
    | string
    | number
    | null
    | undefined
    | { numerator: number; denominator: number },
): string {
  if (value == null) return 'Unknown'
  if (typeof value === 'object')
    return `${value.numerator} / ${value.denominator}`
  return String(value)
}
