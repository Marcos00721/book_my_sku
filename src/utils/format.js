export function dateLabel(value) {
  if (value == null || value === '') return '—'
  const date = new Date(
    typeof value === 'number' && value < 1e12 ? value * 1000 : value,
  )
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
export function money(amount, currency = 'USD') {
  return Number.isSafeInteger(amount)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
        amount / 100,
      )
    : '—'
}
