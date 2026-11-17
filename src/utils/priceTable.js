// Match the backend's six-place decimal arithmetic. Never calculate money with floats.
const scale = 1_000_000n
const hundred = 100n * scale
const maximum = 999_999_999_999_999n
const moneyPattern = /^(0|[1-9]\d{0,8})(\.\d{1,6})?$/
const marginPattern = /^-?(0|[1-9]\d{0,8})(\.\d{1,6})?$/

function parse(value) {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.')
  const result = BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'))
  return negative ? -result : result
}

function format(value) {
  const magnitude = value < 0n ? -value : value
  const fraction = String(magnitude % scale)
    .padStart(6, '0')
    .replace(/0+$/, '')
  return `${value < 0n ? '-' : ''}${magnitude / scale}${fraction ? `.${fraction}` : ''}`
}

function round(numerator, denominator) {
  const magnitude = numerator < 0n ? -numerator : numerator
  const result = (magnitude * 2n + denominator) / (denominator * 2n)
  return numerator < 0n ? -result : result
}

export function priceTableValues(row) {
  const empty = { price: '', marginPercent: '', marginAmount: '', error: '' }
  if (row.cost !== '' && !moneyPattern.test(row.cost))
    return {
      ...empty,
      error: 'Cost must be a nonnegative decimal with up to 6 decimal places.',
    }
  const pattern = row.driver === 'margin' ? marginPattern : moneyPattern
  if (row.value !== '' && !pattern.test(row.value))
    return {
      ...empty,
      error: `${row.driver === 'margin' ? 'Margin %' : 'Price'} must be a decimal with up to 6 decimal places.`,
    }
  const cost = row.cost === '' ? null : parse(row.cost)
  const value = row.value === '' ? null : parse(row.value)
  if (row.driver === 'margin' && value !== null && value >= hundred)
    return { ...empty, error: 'Margin % must be less than 100.' }
  const price =
    row.driver === 'price'
      ? value
      : cost === null || value === null
        ? null
        : round(cost * hundred, hundred - value)
  if (price !== null && price > maximum)
    return {
      ...empty,
      error: 'The calculated price exceeds the supported amount.',
    }
  return {
    price: price === null ? '' : format(price),
    marginPercent:
      cost !== null && price !== null && price > 0n
        ? format(round((price - cost) * hundred, price))
        : '',
    marginAmount: cost !== null && price !== null ? format(price - cost) : '',
    error: '',
  }
}

export function newPriceBreak(from = '1') {
  return {
    key: crypto.randomUUID(),
    from: String(from),
    cost: '',
    driver: 'price',
    value: '',
  }
}

export function priceTablesToEditor(tables) {
  return tables.map((table) => ({
    key: table.id || crypto.randomUUID(),
    id: table.id,
    name: table.name || 'Standard',
    mode: 'selected',
    variantIds: table.variantIds || [],
    breaks: table.breaks.map((row) => ({
      key: crypto.randomUUID(),
      from: String(row.from),
      cost: row.cost ?? '',
      driver: row.intent?.driver || 'price',
      value: row.intent ? (row.intent.value ?? '') : (row.price ?? ''),
    })),
  }))
}

export function buildPriceTables(tables, eligibleVariantIds) {
  if (tables.length > 100) throw new Error('Use at most 100 price tables.')
  const assigned = new Set()
  const names = new Set()
  return tables.map((table, tableIndex) => {
    const name = table.name.normalize('NFKC').trim()
    if (!name || name.length > 80 || /[\p{Cc}\p{Cf}]/u.test(name))
      throw new Error(
        `Table ${tableIndex + 1}: enter a name of up to 80 characters.`,
      )
    if (names.has(name.toLowerCase()))
      throw new Error('Price table names must be different.')
    names.add(name.toLowerCase())
    const variantIds =
      table.mode === 'all' ? eligibleVariantIds : table.variantIds
    if (!variantIds.length)
      throw new Error(`${name}: select at least one variant.`)
    if (variantIds.length > 100)
      throw new Error('Use at most 100 variants across the price tables.')
    for (const id of variantIds) {
      if (!eligibleVariantIds.includes(id))
        throw new Error(
          `${name}: a selected variant is no longer available. Reload pricing.`,
        )
      if (assigned.has(id))
        throw new Error('Each variant can belong to only one price table.')
      assigned.add(id)
    }
    if (assigned.size > 100)
      throw new Error('Use at most 100 variants across the price tables.')
    if (!table.breaks.length || table.breaks.length > 100)
      throw new Error(`${name}: use between 1 and 100 quantity breaks.`)
    let previous = 0
    const breaks = table.breaks.map((row, index) => {
      const from = Number(row.from)
      const context = `${name}, quantity break ${index + 1}`
      if (
        !/^\d+$/.test(row.from) ||
        !Number.isInteger(from) ||
        from < 1 ||
        from > 1_000_000
      )
        throw new Error(
          `${context}: Qty must be a whole number from 1 to 1,000,000.`,
        )
      if (from <= previous)
        throw new Error(
          `${name}: quantities must increase from left to right without duplicates.`,
        )
      previous = from
      const values = priceTableValues(row)
      if (values.error) throw new Error(`${context}: ${values.error}`)
      return {
        from,
        cost: row.cost || null,
        intent: { driver: row.driver, value: row.value || null },
      }
    })
    return {
      ...(table.id ? { id: table.id } : {}),
      name,
      applicability:
        table.mode === 'all'
          ? { mode: 'all' }
          : { mode: 'selected', variantIds },
      breaks,
    }
  })
}
