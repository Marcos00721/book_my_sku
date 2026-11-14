import { Field } from '../workspace/Elements'

export function PackagingFields({ values, change }) {
  return (
    <div className="variant-packaging">
      <label className="check-label">
        <input
          type="checkbox"
          checked={values.unitsEnabled}
          onChange={(event) => change({ unitsEnabled: event.target.checked })}
        />
        Add packaging details
      </label>
      {!values.unitsEnabled ? (
        <p className="product-form-hint">
          You can add these later. Supplier cost needs a confirmed conversion.
        </p>
      ) : (
        <>
          <div className="form-grid">
            <Field
              label="Item label"
              required
              maxLength={80}
              value={values.salesUnit}
              hint="What you sell, for example pen or bottle. Quantities count individual items."
              onChange={(event) => change({ salesUnit: event.target.value })}
            />
            <Field
              label="Purchase unit"
              required
              maxLength={80}
              value={values.procurementUnit}
              hint="What your supplier ships, for example box, pack or carton."
              onChange={(event) =>
                change({ procurementUnit: event.target.value })
              }
            />
            {[
              [
                'salesUnitsPerProcurementUnit',
                'Items per purchase unit',
                true,
                'Total individual items in one purchase unit.',
              ],
              [
                'procurementMinimum',
                'Minimum purchase units',
                false,
                'Optional. A minimum of 2 means at least 2 boxes, if the purchase unit is box.',
              ],
              [
                'procurementMultiple',
                'Order in multiples of',
                false,
                'Optional. A multiple of 2 means 2, 4, 6 purchase units.',
              ],
            ].map(([key, label, required, hint]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min="1"
                max="1000000"
                step="1"
                required={required}
                value={values[key]}
                hint={hint}
                onWheel={(event) => event.currentTarget.blur()}
                onChange={(event) => change({ [key]: event.target.value })}
              />
            ))}
          </div>
          <p className="variant-conversion" role="status">
            1 {values.procurementUnit || 'purchase unit'} ={' '}
            {values.salesUnitsPerProcurementUnit || '?'} individual items
          </p>
        </>
      )}
    </div>
  )
}
