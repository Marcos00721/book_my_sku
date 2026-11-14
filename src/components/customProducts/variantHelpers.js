export function hasColorSizeOptions(configuration) {
  const dimensions = configuration?.dimensions || []
  const kinds = dimensions.map((row) =>
    /^(color|colour)$/i.test(row.label)
      ? 'color'
      : /^size$/i.test(row.label)
        ? 'size'
        : null,
  )
  return kinds.every(Boolean) && new Set(kinds).size === kinds.length
}

export function variantName(variant) {
  const options = variant.selections
    ?.map((selection) => selection.valueLabel)
    .join(' / ')
  return [options || 'Standard variant', variant.partCode]
    .filter(Boolean)
    .join(' · ')
}

export function packagingValues(units) {
  return {
    unitsEnabled: Boolean(units),
    salesUnit: units?.salesUnit || 'item',
    procurementUnit: units?.procurementUnit || 'box',
    salesUnitsPerProcurementUnit: units?.salesUnitsPerProcurementUnit ?? '',
    procurementMinimum: units?.procurementMinimum ?? '',
    procurementMultiple: units?.procurementMultiple ?? '',
  }
}

export function packagingPayload(values) {
  if (!values.unitsEnabled) return null
  return {
    baseUnit: 'item',
    salesUnit: values.salesUnit.trim(),
    procurementUnit: values.procurementUnit.trim(),
    salesUnitsPerProcurementUnit: Number(values.salesUnitsPerProcurementUnit),
    ...(values.procurementMinimum !== ''
      ? { procurementMinimum: Number(values.procurementMinimum) }
      : {}),
    ...(values.procurementMultiple !== ''
      ? { procurementMultiple: Number(values.procurementMultiple) }
      : {}),
  }
}

export function packagingDescription(units) {
  if (!units) return 'Packaging not confirmed'
  if (
    units.baseUnit !== 'item' &&
    !(
      units.salesUnit === 'each' &&
      ['each', 'pack', 'carton'].includes(units.procurementUnit)
    )
  ) {
    return `1 ${units.procurementUnit} = ${units.salesUnitsPerProcurementUnit} ${units.salesUnit} (item conversion unconfirmed)`
  }
  return `1 ${units.procurementUnit} = ${units.salesUnitsPerProcurementUnit} items`
}

export function optionKey(label, entries) {
  const base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 26)
  const prefix = (
    /^[a-z]/.test(base) ? base : `option_${base || 'value'}`
  ).slice(0, 28)
  let key = prefix
  let suffix = 2
  while (entries.some((entry) => entry.id === key))
    key = `${prefix}_${suffix++}`
  return key
}
