import { useState } from 'react'
import {
  Action,
  Dialog,
  ErrorNotice,
  Field,
  SaveFooter,
} from '../workspace/Elements'
import { ConflictReview, Pager } from '../workspace/RecordTools'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { PackagingFields } from './PackagingFields'
import {
  packagingPayload,
  packagingValues,
  variantName,
} from './variantHelpers'

const newVariant = () => ({
  key: crypto.randomUUID(),
  selections: {},
  partCode: '',
  ...packagingValues(null),
})

export function VariantEditor({ path, product, close, saved }) {
  const [rows, setRows] = useState(() =>
    product.selectableVariantCount ? [] : [newVariant()],
  )
  const [archive, setArchive] = useState([])
  const [pages, setPages] = useState([])
  const [revision, setRevision] = useState(product.revision)
  const [error, setError] = useState('')
  const existing = useResource(
    queryPath(`${path}/variants`, {
      status: 'selectable',
      limit: 50,
      after: pages.at(-1),
    }),
  )
  const mutation = useMutation()
  const dimensions = product.configuration.dimensions
  const count = rows.length + archive.length
  function update(key, patch) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }
  async function submit(event) {
    event.preventDefault()
    if (
      rows.some((row) =>
        dimensions.some((dimension) => !row.selections[dimension.id]),
      )
    ) {
      setError('Choose a value for every option on each new variant.')
      return
    }
    const tuples = rows.map((row) =>
      dimensions.map((dimension) => row.selections[dimension.id]).join('|'),
    )
    if (new Set(tuples).size !== tuples.length) {
      setError('Each new variant needs a different combination of options.')
      return
    }
    setError('')
    const changes = [
      ...archive.map((variantId) => ({ action: 'archive', variantId })),
      ...rows.map((row) => ({
        action: 'add',
        selections: dimensions.map((dimension) => ({
          dimensionId: dimension.id,
          valueId: row.selections[dimension.id],
        })),
        ...(row.partCode.trim() ? { partCode: row.partCode.trim() } : {}),
        ...(row.unitsEnabled ? { units: packagingPayload(row) } : {}),
      })),
    ]
    if (
      await mutation.run('post', `${path}/variants`, {
        expectedRevision: revision,
        changes,
      })
    )
      saved()
  }
  return (
    <Dialog
      title="Manage variants"
      description="Add the combinations you sell. Part code and packaging are optional."
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
            {rows.map((row, index) => (
              <section className="product-form-section" key={row.key}>
                <div className="pricing-section-head">
                  <h3>New variant {index + 1}</h3>
                  <Action
                    variant="text-button"
                    onClick={() =>
                      setRows((current) =>
                        current.filter((item) => item.key !== row.key),
                      )
                    }
                  >
                    Remove new variant {index + 1}
                  </Action>
                </div>
                <div className="form-grid">
                  {dimensions.map((dimension) => (
                    <Field
                      label={dimension.label}
                      key={dimension.id}
                      required
                      value={row.selections[dimension.id] || ''}
                      onChange={(event) =>
                        update(row.key, {
                          selections: {
                            ...row.selections,
                            [dimension.id]: event.target.value,
                          },
                        })
                      }
                    >
                      <option value="">
                        Choose {dimension.label.toLowerCase()}
                      </option>
                      {dimension.values.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.label}
                        </option>
                      ))}
                    </Field>
                  ))}
                </div>
                {dimensions.length === 0 && (
                  <p className="product-form-hint">
                    Standard variant, with no color or size.
                  </p>
                )}
                <details className="product-advanced">
                  <summary>Part code &amp; packaging (optional)</summary>
                  <Field
                    label="Supplier part code (optional)"
                    maxLength={120}
                    value={row.partCode}
                    onChange={(event) =>
                      update(row.key, { partCode: event.target.value })
                    }
                  />
                  <PackagingFields
                    values={row}
                    change={(patch) => update(row.key, patch)}
                  />
                </details>
              </section>
            ))}
            <Action
              variant="secondary"
              disabled={
                count >= 50 ||
                (product.configuration.mode === 'single' &&
                  (rows.length > 0 ||
                    product.selectableVariantCount > archive.length))
              }
              onClick={() => setRows((current) => [...current, newVariant()])}
            >
              Add variant
            </Action>
            <details className="product-advanced">
              <summary>
                Retire existing variants
                {archive.length ? ` (${archive.length} selected)` : ''}
              </summary>
              <p className="product-form-hint">
                For a typo or packaging fix, use Correct details on the variant
                instead. Retired variants remain in history.
              </p>
              {product.configuration.mode === 'single' &&
                product.selectableVariantCount > 0 && (
                  <p className="product-form-hint">
                    To replace the standard variant, select it here first, then
                    add its replacement.
                  </p>
                )}
              <ErrorNotice error={existing.error} retry={existing.reload} />
              {existing.data?.items?.map((variant) => (
                <label className="check-label" key={variant.id}>
                  <input
                    type="checkbox"
                    checked={archive.includes(variant.id)}
                    disabled={count >= 50 && !archive.includes(variant.id)}
                    onChange={(event) =>
                      setArchive((current) =>
                        event.target.checked
                          ? [...current, variant.id]
                          : current.filter((id) => id !== variant.id),
                      )
                    }
                  />
                  Retire {variantName(variant)}
                </label>
              ))}
              {(existing.data?.next || pages.length > 0) && (
                <Pager
                  resource={existing}
                  pages={pages}
                  setPages={setPages}
                  label="existing variants"
                />
              )}
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
            values={{ additions: rows, retire: archive }}
            onReview={(current) => setRevision(current.revision)}
          />
        </div>
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!count || count > 50}
          label="Save variants"
        />
      </form>
    </Dialog>
  )
}
