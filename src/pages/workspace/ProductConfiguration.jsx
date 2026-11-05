import { useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  SaveFooter,
} from '../../components/workspace/Elements'
import { ConflictReview, Pager } from '../../components/workspace/RecordTools'

const keyPattern = '[a-z][a-z0-9_-]{0,31}'
const emptyValue = () => ({ id: '', label: '' })
const emptyVariant = () => ({
  key: crypto.randomUUID(),
  selections: {},
  partCode: '',
  unitsEnabled: false,
  salesUnit: 'each',
  procurementUnit: 'each',
  salesUnitsPerProcurementUnit: '1',
  procurementMinimum: '',
  procurementMultiple: '',
})

export function ProductConfiguration({ path, product, changed }) {
  const workspace = useWorkspace()
  const [status, setStatus] = useState('selectable')
  const [pages, setPages] = useState([])
  const [editor, setEditor] = useState(null)
  const variants = useResource(
    queryPath(`${path}/variants`, { status, limit: 25, after: pages.at(-1) }),
  )
  const editable =
    workspace.can('products.edit') &&
    workspace.writesAllowed &&
    product.status === 'draft'
  const configuration = product.configuration || {
    mode: 'unresolved',
    dimensions: [],
    customIdentification: null,
  }
  return (
    <>
      <div className="section-heading">
        <h2>Configuration and variants</h2>
        {editable && (
          <div className="actions">
            <Action
              variant="secondary"
              onClick={() => setEditor('configuration')}
            >
              Edit configuration
            </Action>
            {configuration.mode !== 'unresolved' && (
              <Action onClick={() => setEditor('variants')}>
                Manage variants
              </Action>
            )}
          </div>
        )}
      </div>
      <p>
        Mode: {configuration.mode} · Selectable variants:{' '}
        {product.selectableVariantCount ?? 'Not loaded'}
      </p>
      {configuration.customIdentification && (
        <p>Reviewed identification: {configuration.customIdentification}</p>
      )}
      {configuration.dimensions.map((dimension) => (
        <p key={dimension.id}>
          <strong>{dimension.label}:</strong>{' '}
          {dimension.values.map((value) => value.label).join(', ')}
        </p>
      ))}
      {product.status === 'active' && (
        <p className="notice">
          Archive and restore this product to a draft before changing its
          physical specification.
        </p>
      )}
      <Field
        label="Variant status"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value)
          setPages([])
        }}
      >
        <option value="selectable">Selectable</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </Field>
      <ErrorNotice error={variants.error} retry={variants.reload} />
      {variants.loading ? (
        <Loading />
      ) : variants.data?.items?.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Part code</th>
                <th>Units</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.data.items.map((variant) => (
                <tr key={variant.id}>
                  <td>
                    {variant.selections
                      ?.map(
                        (selection) =>
                          `${selection.dimensionLabel}: ${selection.valueLabel}`,
                      )
                      .join(' · ') || 'Default specification'}
                    <small>{variant.id}</small>
                  </td>
                  <td>{variant.partCode || 'Unknown'}</td>
                  <td>
                    {variant.units
                      ? `${variant.units.salesUnitsPerProcurementUnit} ${variant.units.salesUnit} / ${variant.units.procurementUnit}`
                      : 'Unknown'}
                  </td>
                  <td>{variant.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !variants.error && (
          <Empty title="No variants in this view">
            Choose a configuration, then explicitly add the combinations you
            supply.
          </Empty>
        )
      )}
      <Pager
        resource={variants}
        pages={pages}
        setPages={setPages}
        label="variants"
      />
      {editor === 'configuration' && (
        <ConfigurationEditor
          path={path}
          product={product}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null)
            variants.reload()
            changed()
          }}
        />
      )}
      {editor === 'variants' && (
        <VariantEditor
          path={path}
          product={product}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null)
            variants.reload()
            changed()
          }}
        />
      )}
    </>
  )
}

function ConfigurationEditor({ path, product, close, saved }) {
  const initial = product.configuration || {
    mode: 'unresolved',
    dimensions: [],
    customIdentification: null,
  }
  const [mode, setMode] = useState(initial.mode)
  const [dimensions, setDimensions] = useState(
    structuredClone(initial.dimensions),
  )
  const [identification, setIdentification] = useState(
    initial.customIdentification || '',
  )
  const [revision, setRevision] = useState(product.revision)
  const mutation = useMutation()
  function dimension(index, patch) {
    setDimensions((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    )
  }
  async function submit(event) {
    event.preventDefault()
    if (
      await mutation.run('post', `${path}/configure`, {
        expectedRevision: revision,
        mode,
        dimensions: mode === 'variants' ? dimensions : [],
        customIdentification: identification.trim() || null,
      })
    )
      saved()
  }
  return (
    <Dialog
      title="Product configuration"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Configuration mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="unresolved">Not decided</option>
            <option value="single">Single specification</option>
            <option value="variants">Explicit variants</option>
          </Field>
          <Field
            label="Reviewed custom identification (optional)"
            maxLength={500}
            value={identification}
            onChange={(event) => setIdentification(event.target.value)}
            hint="Describe a reviewed supplier item when its item code is unavailable."
          />
          {mode === 'variants' && (
            <>
              {dimensions.map((item, index) => (
                <section className="panel" key={index}>
                  <div className="form-grid">
                    <Field
                      label={`Dimension ${index + 1} key`}
                      required
                      pattern={keyPattern}
                      maxLength={32}
                      value={item.id}
                      onChange={(event) =>
                        dimension(index, { id: event.target.value })
                      }
                    />
                    <Field
                      label={`Dimension ${index + 1} label`}
                      required
                      maxLength={80}
                      value={item.label}
                      onChange={(event) =>
                        dimension(index, { label: event.target.value })
                      }
                    />
                  </div>
                  {item.values.map((value, position) => (
                    <div className="form-grid" key={position}>
                      <Field
                        label={`Value ${position + 1} key`}
                        required
                        pattern={keyPattern}
                        maxLength={32}
                        value={value.id}
                        onChange={(event) =>
                          dimension(index, {
                            values: item.values.map((row, i) =>
                              i === position
                                ? { ...row, id: event.target.value }
                                : row,
                            ),
                          })
                        }
                      />
                      <Field
                        label={`Value ${position + 1} label`}
                        required
                        maxLength={80}
                        value={value.label}
                        onChange={(event) =>
                          dimension(index, {
                            values: item.values.map((row, i) =>
                              i === position
                                ? { ...row, label: event.target.value }
                                : row,
                            ),
                          })
                        }
                      />
                      <Action
                        variant="text-button"
                        disabled={item.values.length <= 1}
                        onClick={() =>
                          dimension(index, {
                            values: item.values.filter(
                              (_, i) => i !== position,
                            ),
                          })
                        }
                      >
                        Remove value {position + 1}
                      </Action>
                    </div>
                  ))}
                  <div className="actions">
                    <Action
                      variant="secondary"
                      disabled={item.values.length >= 50}
                      onClick={() =>
                        dimension(index, {
                          values: [...item.values, emptyValue()],
                        })
                      }
                    >
                      Add value
                    </Action>
                    <Action
                      variant="text-button"
                      onClick={() =>
                        setDimensions((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove dimension
                    </Action>
                  </div>
                </section>
              ))}
              <Action
                variant="secondary"
                disabled={dimensions.length >= 3}
                onClick={() =>
                  setDimensions((current) => [
                    ...current,
                    { id: '', label: '', values: [emptyValue()] },
                  ])
                }
              >
                Add dimension
              </Action>
              <p className="muted">
                Changing configuration must preserve every selectable tuple.
                Archive incompatible variants first.
              </p>
            </>
          )}
        </fieldset>
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
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={mode === 'variants' && !dimensions.length}
          label="Save configuration"
        />
      </form>
    </Dialog>
  )
}

function VariantEditor({ path, product, close, saved }) {
  const [rows, setRows] = useState([emptyVariant()])
  const [archive, setArchive] = useState([])
  const [pages, setPages] = useState([])
  const [revision, setRevision] = useState(product.revision)
  const existing = useResource(
    queryPath(`${path}/variants`, {
      status: 'selectable',
      limit: 50,
      after: pages.at(-1),
    }),
  )
  const mutation = useMutation()
  const dimensions = product.configuration.dimensions
  function update(key, patch) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }
  async function submit(event) {
    event.preventDefault()
    const changes = [
      ...archive.map((variantId) => ({ action: 'archive', variantId })),
      ...rows.map((row) => ({
        action: 'add',
        selections: dimensions.map((dimension) => ({
          dimensionId: dimension.id,
          valueId: row.selections[dimension.id],
        })),
        ...(row.partCode.trim() ? { partCode: row.partCode.trim() } : {}),
        ...(row.unitsEnabled
          ? {
              units: {
                salesUnit: row.salesUnit,
                procurementUnit: row.procurementUnit,
                salesUnitsPerProcurementUnit: Number(
                  row.salesUnitsPerProcurementUnit,
                ),
                ...(row.procurementMinimum
                  ? { procurementMinimum: Number(row.procurementMinimum) }
                  : {}),
                ...(row.procurementMultiple
                  ? { procurementMultiple: Number(row.procurementMultiple) }
                  : {}),
              },
            }
          : {}),
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
      title="Manage product variants"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <p>
            Only explicitly added combinations exist. Archive an old
            specification and add its replacement together.
          </p>
          <p className="muted">
            Current manual goods pricing recognizes sales unit each and
            procurement units each, pack or carton. Other or unknown unit
            definitions retain partial-cost status.
          </p>
          <ErrorNotice error={existing.error} retry={existing.reload} />
          {existing.data?.items?.map((variant) => (
            <label className="check-label" key={variant.id}>
              <input
                type="checkbox"
                checked={archive.includes(variant.id)}
                onChange={(event) =>
                  setArchive((current) =>
                    event.target.checked
                      ? [...current, variant.id]
                      : current.filter((id) => id !== variant.id),
                  )
                }
              />
              Archive{' '}
              {variant.partCode ||
                variant.selections
                  ?.map((value) => value.valueLabel)
                  .join(' / ') ||
                'Default specification'}
            </label>
          ))}
          <Pager
            resource={existing}
            pages={pages}
            setPages={setPages}
            label="existing variants"
          />
          {rows.map((row, index) => (
            <section className="panel" key={row.key}>
              <h3>New variant {index + 1}</h3>
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
              <Field
                label="Supplier part code (optional)"
                maxLength={120}
                value={row.partCode}
                onChange={(event) =>
                  update(row.key, { partCode: event.target.value })
                }
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={row.unitsEnabled}
                  onChange={(event) =>
                    update(row.key, { unitsEnabled: event.target.checked })
                  }
                />
                Specify sales and procurement units
              </label>
              {row.unitsEnabled && (
                <div className="form-grid">
                  {[
                    ['salesUnit', 'Sales unit'],
                    ['procurementUnit', 'Procurement unit'],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      required
                      maxLength={80}
                      value={row[key]}
                      onChange={(event) =>
                        update(row.key, { [key]: event.target.value })
                      }
                    />
                  ))}
                  {[
                    [
                      'salesUnitsPerProcurementUnit',
                      'Sales units per procurement unit',
                    ],
                    ['procurementMinimum', 'Procurement minimum (optional)'],
                    ['procurementMultiple', 'Procurement multiple (optional)'],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required={key === 'salesUnitsPerProcurementUnit'}
                      value={row[key]}
                      onChange={(event) =>
                        update(row.key, { [key]: event.target.value })
                      }
                    />
                  ))}
                </div>
              )}
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
            </section>
          ))}
          <Action
            variant="secondary"
            disabled={rows.length + archive.length >= 50}
            onClick={() => setRows((current) => [...current, emptyVariant()])}
          >
            Add combination
          </Action>
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={path}
          values={{ configuration: product.configuration }}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={
            (!rows.length && !archive.length) ||
            rows.length + archive.length > 50
          }
          label="Save variant changes"
        />
      </form>
    </Dialog>
  )
}
