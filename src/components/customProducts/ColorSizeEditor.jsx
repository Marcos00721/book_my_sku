import { useState } from 'react'
import { X } from 'lucide-react'
import { Action, Dialog, Field, SaveFooter } from '../workspace/Elements'
import { ConflictReview } from '../workspace/RecordTools'
import { useMutation } from '../../hooks/useMutation'
import { optionKey } from './variantHelpers'

const names = ['Color', 'Size']
const normalized = (value) => value.trim().normalize('NFC')

export function ColorSizeEditor({ path, product, close, saved }) {
  const initial = product.configuration || { dimensions: [] }
  const [dimensions, setDimensions] = useState(() =>
    structuredClone(initial.dimensions),
  )
  const [inputs, setInputs] = useState({ Color: '', Size: '' })
  const [errors, setErrors] = useState({})
  const [identification, setIdentification] = useState(
    initial.customIdentification || '',
  )
  const [revision, setRevision] = useState(product.revision)
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain

  function findDimension(rows, name) {
    return rows.find((row) =>
      (name === 'Color' ? /^(color|colour)$/i : /^size$/i).test(row.label),
    )
  }

  function append(rows, name, input) {
    const label = normalized(input)
    if (!label) throw new Error(`Enter a ${name.toLowerCase()} to add.`)
    const dimension = findDimension(rows, name)
    const original = findDimension(initial.dimensions, name)
    const values = dimension?.values || []
    if (
      values.some(
        (value) =>
          normalized(value.label).toLowerCase() === label.toLowerCase(),
      )
    )
      throw new Error(`${label} is already added.`)
    if (values.length >= 50)
      throw new Error(
        `You can add up to 50 ${name === 'Color' ? 'colors' : 'sizes'}.`,
      )
    const originalValue = original?.values.find(
      (value) => normalized(value.label).toLowerCase() === label.toLowerCase(),
    )
    const next = {
      id:
        dimension?.id ||
        original?.id ||
        optionKey(name, [...rows, ...initial.dimensions]),
      label: dimension?.label || original?.label || name,
      values: [
        ...values,
        {
          id:
            originalValue?.id ||
            optionKey(label, [...values, ...(original?.values || [])]),
          label: originalValue?.label || label,
        },
      ],
    }
    return dimension
      ? rows.map((row) => (row.id === dimension.id ? next : row))
      : [...rows, next]
  }

  function add(name) {
    try {
      setDimensions(append(dimensions, name, inputs[name]))
      setInputs((current) => ({ ...current, [name]: '' }))
      setErrors((current) => ({ ...current, [name]: '' }))
    } catch (error) {
      setErrors((current) => ({ ...current, [name]: error.message }))
    }
  }

  function remove(dimensionId, valueId) {
    setDimensions((current) =>
      current
        .map((row) =>
          row.id === dimensionId
            ? {
                ...row,
                values: row.values.filter((value) => value.id !== valueId),
              }
            : row,
        )
        .filter((row) => row.values.length),
    )
  }

  async function submit(event) {
    event.preventDefault()
    let next = dimensions
    const nextErrors = {}
    // Include typed values even when the user saves without pressing Add first.
    for (const name of names) {
      if (!inputs[name].trim()) continue
      try {
        next = append(next, name, inputs[name])
      } catch (error) {
        nextErrors[name] = error.message
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const result = await mutation.run('post', `${path}/configure`, {
      expectedRevision: revision,
      mode: next.length ? 'variants' : 'single',
      dimensions: next,
      customIdentification: identification.trim() || null,
    })
    if (result) saved()
  }

  return (
    <Dialog
      title="Colors & sizes"
      description="Add the colors and sizes you offer. Leave both empty for one standard variant."
      close={close}
      locked={locked}
      hasUnsavedChanges={
        JSON.stringify(dimensions) !== JSON.stringify(initial.dimensions) ||
        Object.values(inputs).some(Boolean) ||
        identification !== (initial.customIdentification || '')
      }
      size="lg"
      className="product-form-dialog"
    >
      <form className="product-form" onSubmit={submit}>
        <div className="product-form-body">
          <fieldset disabled={locked} className="product-form-fields">
            <div className="color-size-grid">
              {names.map((name) => {
                const dimension = findDimension(dimensions, name)
                return (
                  <section
                    className="color-size-option"
                    key={name}
                    aria-label={`${name} options`}
                  >
                    <div className="color-size-input">
                      <Field
                        label={name}
                        placeholder={
                          name === 'Color' ? 'e.g. Navy blue' : 'e.g. Medium'
                        }
                        maxLength={80}
                        value={inputs[name]}
                        error={errors[name]}
                        onChange={(event) => {
                          setInputs((current) => ({
                            ...current,
                            [name]: event.target.value,
                          }))
                          setErrors((current) => ({ ...current, [name]: '' }))
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault()
                            add(name)
                          }
                        }}
                      />
                      <Action
                        variant="secondary"
                        aria-label={`Add ${name.toLowerCase()}`}
                        disabled={
                          !inputs[name].trim() || dimension?.values.length >= 50
                        }
                        onClick={() => add(name)}
                      >
                        Add
                      </Action>
                    </div>
                    <ul
                      className="color-size-values"
                      aria-label={`Added ${name === 'Color' ? 'colors' : 'sizes'}`}
                    >
                      {dimension?.values.map((value) => (
                        <li key={value.id}>
                          <span>{value.label}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${name.toLowerCase()} ${value.label}`}
                            onClick={() => remove(dimension.id, value.id)}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
            {product.selectableVariantCount > 0 && (
              <p className="product-form-hint">
                Colors and sizes used by existing variants must stay. Retire
                those variants before removing their choices.
              </p>
            )}
            <details className="product-advanced">
              <summary>Supplier identification (optional)</summary>
              <Field
                label="Reviewed item description"
                maxLength={500}
                value={identification}
                hint="If a supplier item code is unavailable, describe the item you reviewed."
                onChange={(event) => setIdentification(event.target.value)}
              />
            </details>
          </fieldset>
          {mutation.error?.code === 'ARCHIVE_VARIANTS_FIRST' && (
            <p className="notice" role="status">
              An existing variant uses these options. Retire it before removing
              a color or size, or changing between standard and color/size
              variants.
            </p>
          )}
          <ConflictReview
            error={mutation.error}
            path={path}
            values={{
              configuration: {
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
          label="Save colors & sizes"
          onClear={() => {
            setDimensions(structuredClone(initial.dimensions))
            setInputs({ Color: '', Size: '' })
            setErrors({})
            setIdentification(initial.customIdentification || '')
          }}
        />
      </form>
    </Dialog>
  )
}
