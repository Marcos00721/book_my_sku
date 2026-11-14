import { useState } from 'react'
import { Action, Dialog, Field, SaveFooter } from '../workspace/Elements'
import { ConflictReview } from '../workspace/RecordTools'
import { useMutation } from '../../hooks/useMutation'
import { optionKey } from './variantHelpers'

const newValue = () => ({ id: crypto.randomUUID(), label: '', fresh: true })

export function ConfigurationEditor({ path, product, close, saved }) {
  const initial = product.configuration || {
    mode: 'unresolved',
    dimensions: [],
  }
  const [mode, setMode] = useState(initial.mode)
  const [dimensions, setDimensions] = useState(
    structuredClone(initial.dimensions),
  )
  const [identification, setIdentification] = useState(
    initial.customIdentification || '',
  )
  const [revision, setRevision] = useState(product.revision)
  const [error, setError] = useState('')
  const mutation = useMutation()
  function dimension(index, patch) {
    setDimensions((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }
  async function submit(event) {
    event.preventDefault()
    const optionKeys = dimensions
      .filter((row) => !row.fresh)
      .map(({ id }) => ({ id }))
    const mapped = dimensions.map((row) => {
      const id = row.fresh ? optionKey(row.label, optionKeys) : row.id
      optionKeys.push({ id })
      const valueKeys = row.values
        .filter((value) => !value.fresh)
        .map(({ id }) => ({ id }))
      return {
        id,
        label: row.label.trim(),
        values: row.values.map((value) => {
          const valueId = value.fresh
            ? optionKey(value.label, valueKeys)
            : value.id
          valueKeys.push({ id: valueId })
          return { id: valueId, label: value.label.trim() }
        }),
      }
    })
    const duplicates = (rows) =>
      new Set(rows.map((row) => row.label.normalize('NFC').toLowerCase()))
        .size !== rows.length ||
      new Set(rows.map((row) => row.id)).size !== rows.length
    if (
      mode === 'variants' &&
      (duplicates(mapped) || mapped.some((row) => duplicates(row.values)))
    ) {
      setError('Use a different name for each option and each value within it.')
      return
    }
    setError('')
    if (
      await mutation.run('post', `${path}/configure`, {
        expectedRevision: revision,
        mode,
        dimensions: mode === 'variants' ? mapped : [],
        customIdentification: identification.trim() || null,
      })
    )
      saved()
  }
  return (
    <Dialog
      title="Set up product options"
      description="Start with one standard variant, or add choices such as colour and size."
      close={close}
      locked={mutation.pending || mutation.uncertain}
      size="lg"
      className="product-form-dialog"
    >
      <form className="product-form" onSubmit={submit}>
        <div className="product-form-body">
          <fieldset
            disabled={mutation.pending || mutation.uncertain}
            className="product-form-fields"
          >
            <Field
              label="How is this product offered?"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="unresolved">Decide later</option>
              <option value="single">One standard variant</option>
              <option value="variants">
                Multiple options, such as colour or size
              </option>
            </Field>
            {mode === 'variants' && (
              <>
                <p className="product-form-hint">
                  Add up to 3 options. Next, choose which combinations you
                  supply.
                </p>
                {dimensions.map((row, index) => (
                  <section className="product-form-section" key={row.id}>
                    <div className="pricing-section-head">
                      <h3>Option {index + 1}</h3>
                      <Action
                        variant="text-button"
                        onClick={() =>
                          setDimensions((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove option {index + 1}
                      </Action>
                    </div>
                    <Field
                      label={`Option ${index + 1} name`}
                      placeholder="e.g. Colour"
                      required
                      maxLength={80}
                      value={row.label}
                      onChange={(event) =>
                        dimension(index, { label: event.target.value })
                      }
                    />
                    <div className="variant-values">
                      {row.values.map((value, i) => (
                        <div className="variant-value-row" key={value.id}>
                          <Field
                            label={`Option ${index + 1}, value ${i + 1}`}
                            placeholder="e.g. Navy"
                            required
                            maxLength={80}
                            value={value.label}
                            onChange={(event) =>
                              dimension(index, {
                                values: row.values.map((entry, j) =>
                                  j === i
                                    ? { ...entry, label: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                          />
                          <Action
                            variant="text-button"
                            disabled={row.values.length === 1}
                            onClick={() =>
                              dimension(index, {
                                values: row.values.filter((_, j) => j !== i),
                              })
                            }
                          >
                            Remove value {i + 1}
                          </Action>
                        </div>
                      ))}
                    </div>
                    <Action
                      variant="secondary"
                      disabled={row.values.length >= 50}
                      onClick={() =>
                        dimension(index, {
                          values: [...row.values, newValue()],
                        })
                      }
                    >
                      Add value
                    </Action>
                  </section>
                ))}
                <Action
                  variant="secondary"
                  disabled={dimensions.length >= 3}
                  onClick={() =>
                    setDimensions((current) => [
                      ...current,
                      {
                        id: crypto.randomUUID(),
                        label: '',
                        fresh: true,
                        values: [newValue()],
                      },
                    ])
                  }
                >
                  Add option
                </Action>
                {product.selectableVariantCount > 0 && (
                  <p className="notice">
                    Keep the options used by existing variants. Retire those
                    variants before removing their options.
                  </p>
                )}
              </>
            )}
            <details className="product-advanced">
              <summary>Supplier identification</summary>
              <Field
                label="Reviewed item description"
                maxLength={500}
                value={identification}
                hint="If a supplier item code is unavailable, describe the item you reviewed."
                onChange={(event) => setIdentification(event.target.value)}
              />
            </details>
          </fieldset>
          {error && (
            <p className="notice error-notice" role="alert">
              {error}
            </p>
          )}
          <ConflictReview
            error={mutation.error}
            path={path}
            values={{
              configuration: {
                mode,
                dimensions,
                customIdentification: identification,
              },
            }}
            onReview={(current) => setRevision(current.revision)}
          />
        </div>
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={mode === 'variants' && !dimensions.length}
          label="Save options"
        />
      </form>
    </Dialog>
  )
}
