import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  PageHeader,
  PermissionDenied,
  SaveFooter,
  Status,
  StickyPageChrome,
} from '../../components/workspace/Elements'
import {
  ConflictReview,
  Pager,
  ReferenceSelect,
} from '../../components/workspace/RecordTools'

const ratePattern = '(0|[1-9][0-9]{0,8})(\\.[0-9]{1,6})?'
const idPattern = '[a-z][a-z0-9_-]{0,63}'
function nextKey(prefix, rows) {
  let index = 1
  while (rows.some((row) => row.id === `${prefix}_${index}`)) index++
  return `${prefix}_${index}`
}
const money = (value) => (value == null ? 'Unknown' : value)
const blankCell = (id) => ({
  id,
  quantity: { min: 1, maxExclusive: 101 },
  parameter: { min: 1, maxExclusive: 2 },
  available: true,
  cost: null,
  sale: null,
})
const blankRule = (id, type = 'color') =>
  type === 'color' || type === 'stitch'
    ? { id, type, cells: [] }
    : { id, type, cost: null, sale: null }

export function DecorationMatricesPage() {
  const workspace = useWorkspace()
  if (!workspace.owner || !workspace.can('master_data.view'))
    return <PermissionDenied />
  return <MatrixDirectory />
}
function MatrixDirectory() {
  const workspace = useWorkspace(),
    navigate = useNavigate()
  const base = `${workspace.base}/decoration-matrices`
  const [status, setStatus] = useState('active'),
    [pages, setPages] = useState([]),
    [creating, setCreating] = useState(false)
  const resource = useResource(
    queryPath(base, { status, limit: 25, after: pages.at(-1) }),
  )
  return (
    <>
      <PageHeader
        title="Decoration matrices"
        description="Owner-managed color, stitch, setup and extra-charge definitions."
        actions={
          workspace.writesAllowed && (
            <Action onClick={() => setCreating(true)}>
              Add decoration matrix
            </Action>
          )
        }
      />
      <p className="notice">
        These definitions store commercial rates. Applying them to products,
        projects or orders and calculating decoration totals are separate
        workflows.
      </p>
      <section className="panel">
        <Field
          label="Matrix status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPages([])
          }}
        >
          {['active', 'archived', 'all'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Field>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? (
          <Loading />
        ) : resource.data?.items?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Draft revision</th>
                  <th>Published version</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((matrix) => (
                  <tr key={matrix.id}>
                    <td>
                      <Link
                        className="entity-link"
                        to={`/app/decoration-matrices/${matrix.id}`}
                      >
                        {matrix.content.name}
                      </Link>
                    </td>
                    <td>{matrix.revision}</td>
                    <td>{matrix.publishedVersion || 'Not published'}</td>
                    <td>
                      <Status value={matrix.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.error && (
            <Empty title="No decoration matrices">
              You can save an incomplete draft and finish it before publishing.
            </Empty>
          )
        )}
        <Pager
          resource={resource}
          pages={pages}
          setPages={setPages}
          label="matrices"
        />
      </section>
      {creating && (
        <MatrixEditor
          base={base}
          close={() => setCreating(false)}
          saved={(result) => navigate(`/app/decoration-matrices/${result.id}`)}
        />
      )}
    </>
  )
}

export function DecorationMatrixDetailPage() {
  const workspace = useWorkspace(),
    { matrixId } = useParams()
  if (!workspace.owner || !workspace.can('master_data.view'))
    return <PermissionDenied />
  return (
    <MatrixRecord
      key={matrixId}
      base={`${workspace.base}/decoration-matrices`}
      id={matrixId}
    />
  )
}
function MatrixRecord({ base, id }) {
  const workspace = useWorkspace(),
    navigate = useNavigate(),
    resource = useResource(`${base}/${id}`)
  const [editor, setEditor] = useState(false),
    [command, setCommand] = useState(null),
    [tab, setTab] = useState('definition')
  if (resource.loading) return <Loading />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const matrix = resource.data,
    writable = workspace.writesAllowed,
    active = matrix.status === 'active'
  const blockers = matrixBlockers(matrix.content)
  return (
    <>
      <StickyPageChrome
        before={
          <Link className="back-link" to="/app/decoration-matrices">
            ← Back to decoration matrices
          </Link>
        }
        title={matrix.content.name}
        description={`Draft revision ${matrix.revision} · Published version ${matrix.publishedVersion || 'None'}`}
        actions={
          writable && (
            <div className="actions">
              {active && (
                <>
                  <Action onClick={() => setEditor(true)}>
                    Edit matrix draft
                  </Action>
                  <Action
                    variant="secondary"
                    disabled={blockers.length > 0}
                    onClick={() => setCommand('publish')}
                  >
                    Publish matrix
                  </Action>
                </>
              )}
              <Action variant="secondary" onClick={() => setCommand('copy')}>
                Copy matrix
              </Action>
              <Action
                variant="secondary"
                onClick={() => setCommand(active ? 'archive' : 'restore')}
              >
                {active ? 'Archive' : 'Restore'} matrix
              </Action>
            </div>
          )
        }
        meta={
          <>
            <Status value={matrix.status} />
            {blockers.length > 0 && (
              <p className="notice">
                Publication needs: {blockers.join(', ')}.
              </p>
            )}
          </>
        }
        tabs={{
          label: 'Matrix views',
          value: tab,
          onChange: setTab,
          items: [
            { value: 'definition', label: 'Definition' },
            { value: 'versions', label: 'Versions' },
            { value: 'history', label: 'History' },
          ],
        }}
      >
        <section className="panel" role="tabpanel">
          {tab === 'definition' ? (
            <MatrixDefinition content={matrix.content} />
          ) : (
            <MatrixEvidence
              key={`${tab}:${matrix.revision}`}
              path={`${base}/${id}`}
              kind={tab}
            />
          )}
        </section>
      </StickyPageChrome>
      {editor && (
        <MatrixEditor
          base={base}
          matrix={matrix}
          close={() => setEditor(false)}
          saved={() => {
            setEditor(false)
            resource.reload()
          }}
        />
      )}
      {command && (
        <MatrixCommand
          base={base}
          matrix={matrix}
          command={command}
          close={() => setCommand(null)}
          saved={(result) => {
            setCommand(null)
            if (command === 'copy')
              navigate(`/app/decoration-matrices/${result.id}`)
            else resource.reload()
          }}
        />
      )}
    </>
  )
}

function matrixBlockers(content) {
  const result = []
  if (!content.supplierId) result.push('supplier or decorator')
  if (!content.methodId) result.push('decoration method')
  if (!content.rules.length) result.push('at least one rule')
  for (const rule of content.rules) {
    if (!rule.chargeUnit) result.push(`${rule.id}: charge unit`)
    if (rule.type === 'setup' ? !rule.occurrence : !rule.quantityBasis)
      result.push(
        `${rule.id}: ${rule.type === 'setup' ? 'occurrence' : 'quantity basis'}`,
      )
    if (rule.cells && !rule.cells.length) result.push(`${rule.id}: cells`)
  }
  return result
}
function MatrixDefinition({ content }) {
  return (
    <>
      <p>
        Currency: {content.currency} · Supplier/decorator:{' '}
        {content.supplierId || 'Not selected'} · Method:{' '}
        {content.methodId || 'Not selected'}
      </p>
      {content.rules.map((rule) => (
        <article className="panel" key={rule.id}>
          <h3>
            {rule.id} · {rule.type}
          </h3>
          <p>
            {rule.quantityBasis
              ? `${rule.quantityBasis} quantity`
              : rule.occurrence || 'Occurrence not set'}{' '}
            · {rule.chargeUnit || 'Charge unit not set'}
          </p>
          {rule.cells ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cell</th>
                    <th>Quantity</th>
                    <th>{rule.type === 'stitch' ? 'Stitches' : 'Colors'}</th>
                    <th>Cost USD</th>
                    <th>Sale USD</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.cells.map((cell) => (
                    <tr key={cell.id}>
                      <td>{cell.id}</td>
                      <td>
                        {cell.quantity.min}–{cell.quantity.maxExclusive - 1}
                      </td>
                      <td>
                        {cell.parameter.min}–{cell.parameter.maxExclusive - 1}
                      </td>
                      <td>
                        {cell.available ? money(cell.cost) : 'Unavailable'}
                      </td>
                      <td>
                        {cell.available ? money(cell.sale) : 'Unavailable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              Cost: {money(rule.cost)} · Sale: {money(rule.sale)}
            </p>
          )}
        </article>
      ))}
      {!content.rules.length && (
        <Empty title="Incomplete matrix draft">
          Add the commercial definitions when you know their terms.
        </Empty>
      )}
    </>
  )
}

function MatrixEditor({ base, matrix, close, saved }) {
  const workspace = useWorkspace()
  const [content, setContent] = useState(() =>
    structuredClone(
      matrix?.content || {
        name: '',
        currency: 'USD',
        supplierId: null,
        methodId: null,
        rules: [],
      },
    ),
  )
  const [revision, setRevision] = useState(matrix?.revision),
    [validation, setValidation] = useState(null)
  const mutation = useMutation()
  const size = new TextEncoder().encode(JSON.stringify(content)).length
  function set(key, value) {
    setContent((current) => ({ ...current, [key]: value }))
  }
  function rule(index, patch) {
    set(
      'rules',
      content.rules.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }
  function cell(index, position, patch) {
    rule(index, {
      cells: content.rules[index].cells.map((row, i) =>
        i === position ? { ...row, ...patch } : row,
      ),
    })
  }
  function overlap(rule) {
    return (
      rule.cells?.flatMap((a, i) =>
        rule.cells
          .slice(i + 1)
          .filter(
            (b) =>
              a.quantity.min < b.quantity.maxExclusive &&
              b.quantity.min < a.quantity.maxExclusive &&
              a.parameter.min < b.parameter.maxExclusive &&
              b.parameter.min < a.parameter.maxExclusive,
          )
          .map((b) => `${a.id} / ${b.id}`),
      ) || []
    )
  }
  async function submit(event) {
    event.preventDefault()
    setValidation(null)
    if (content.rules.some((row) => overlap(row).length)) {
      setValidation(
        new Error(
          'Quantity and color/stitch rectangles overlap. Review the marked rules.',
        ),
      )
      return
    }
    const result = await mutation.run(
      matrix ? 'patch' : 'post',
      `${base}${matrix ? `/${matrix.id}` : ''}`,
      { ...(matrix ? { expectedRevision: revision } : {}), content },
    )
    if (result) saved(result.data)
  }
  return (
    <Dialog
      title={matrix ? 'Edit decoration matrix' : 'Add decoration matrix'}
      close={close}
      className="matrix-dialog"
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Matrix name"
            required
            maxLength={120}
            value={content.name}
            onChange={(event) => set('name', event.target.value)}
          />
          <ReferenceSelect
            path={
              workspace.can('suppliers.view')
                ? `${workspace.base}/suppliers`
                : null
            }
            label="Supplier or decorator"
            value={content.supplierId}
            onChange={(value) => set('supplierId', value || null)}
            filter={(item) =>
              item.capabilities?.some((value) =>
                ['supplier', 'decorator'].includes(value),
              )
            }
          />
          <ReferenceSelect
            path={`${workspace.base}/master-data/decoration_method`}
            label="Decoration method"
            value={content.methodId}
            onChange={(value) => set('methodId', value || null)}
          />
          <p className="muted">
            Incomplete references and rules can be saved. Available blank rates
            mean Unknown; zero is an explicit rate. Table upper bounds below are
            exclusive.
          </p>
          {content.rules.map((row, index) => (
            <section className="panel" key={index}>
              <div className="form-grid">
                <Field
                  label={`Rule ${index + 1} ID`}
                  required
                  pattern={idPattern}
                  maxLength={64}
                  value={row.id}
                  onChange={(event) => rule(index, { id: event.target.value })}
                />
                <Field
                  label="Rule type"
                  value={row.type}
                  onChange={(event) =>
                    set(
                      'rules',
                      content.rules.map((value, i) =>
                        i === index
                          ? blankRule(row.id, event.target.value)
                          : value,
                      ),
                    )
                  }
                >
                  {['color', 'stitch', 'extra', 'setup'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Field>
                {row.type === 'setup' ? (
                  <Field
                    label="Setup occurrence"
                    value={row.occurrence || ''}
                    onChange={(event) =>
                      rule(index, {
                        occurrence: event.target.value || undefined,
                        chargeUnit: event.target.value
                          ? 'setup_occurrence'
                          : undefined,
                      })
                    }
                  >
                    <option value="">Not decided</option>
                    {[
                      'per_design',
                      'per_location',
                      'per_batch',
                      'per_order',
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </Field>
                ) : (
                  <Field
                    label="Quantity basis"
                    value={row.quantityBasis || ''}
                    onChange={(event) =>
                      rule(index, {
                        quantityBasis: event.target.value || undefined,
                        chargeUnit: event.target.value
                          ? 'decorated_item'
                          : undefined,
                      })
                    }
                  >
                    <option value="">Not decided</option>
                    {['attempted', 'received', 'good'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Field>
                )}
              </div>
              {overlap(row).length > 0 && (
                <p className="notice error-notice" role="alert">
                  Overlapping cells: {overlap(row).join(', ')}
                </p>
              )}
              {row.cells ? (
                <>
                  {row.cells.map((item, position) => (
                    <section className="matrix-cell" key={position}>
                      <Field
                        label={`Cell ${position + 1} ID`}
                        required
                        pattern={idPattern}
                        maxLength={64}
                        value={item.id}
                        onChange={(event) =>
                          cell(index, position, { id: event.target.value })
                        }
                      />
                      <div className="form-grid">
                        {[
                          ['quantity', 'Quantity'],
                          [
                            'parameter',
                            row.type === 'stitch' ? 'Stitches' : 'Colors',
                          ],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <Field
                              label={`${label} from`}
                              required
                              type="number"
                              min="1"
                              max="1000000"
                              step="1"
                              value={item[key].min}
                              onChange={(event) =>
                                cell(index, position, {
                                  [key]: {
                                    ...item[key],
                                    min: Number(event.target.value),
                                  },
                                })
                              }
                            />
                            <Field
                              label={`${label} upper bound (exclusive)`}
                              required
                              type="number"
                              min={item[key].min + 1}
                              max="1000001"
                              step="1"
                              value={item[key].maxExclusive}
                              onChange={(event) =>
                                cell(index, position, {
                                  [key]: {
                                    ...item[key],
                                    maxExclusive: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={item.available}
                          onChange={(event) =>
                            cell(index, position, {
                              available: event.target.checked,
                              ...(!event.target.checked
                                ? { cost: null, sale: null }
                                : {}),
                            })
                          }
                        />
                        Available cell
                      </label>
                      <div className="form-grid">
                        {['cost', 'sale'].map((key) => (
                          <Field
                            key={key}
                            label={`Cell ${key} USD`}
                            inputMode="decimal"
                            pattern={ratePattern}
                            disabled={!item.available}
                            value={item[key] ?? ''}
                            onChange={(event) =>
                              cell(index, position, {
                                [key]: event.target.value || null,
                              })
                            }
                          />
                        ))}
                      </div>
                      <Action
                        variant="text-button"
                        onClick={() =>
                          rule(index, {
                            cells: row.cells.filter((_, i) => i !== position),
                          })
                        }
                      >
                        Remove cell {position + 1}
                      </Action>
                    </section>
                  ))}
                  <Action
                    variant="secondary"
                    disabled={row.cells.length >= 100}
                    onClick={() =>
                      rule(index, {
                        cells: [
                          ...row.cells,
                          blankCell(nextKey('cell', row.cells)),
                        ],
                      })
                    }
                  >
                    Add matrix cell
                  </Action>
                </>
              ) : (
                <div className="form-grid">
                  {['cost', 'sale'].map((key) => (
                    <Field
                      key={key}
                      label={`Rule ${key} USD`}
                      inputMode="decimal"
                      pattern={ratePattern}
                      value={row[key] ?? ''}
                      onChange={(event) =>
                        rule(index, { [key]: event.target.value || null })
                      }
                    />
                  ))}
                </div>
              )}
              <Action
                variant="text-button"
                onClick={() =>
                  set(
                    'rules',
                    content.rules.filter((_, i) => i !== index),
                  )
                }
              >
                Remove rule {index + 1}
              </Action>
            </section>
          ))}
          <Action
            variant="secondary"
            disabled={content.rules.length >= 20}
            onClick={() =>
              set('rules', [
                ...content.rules,
                blankRule(nextKey('rule', content.rules)),
              ])
            }
          >
            Add matrix rule
          </Action>
          <p>
            {content.rules.length}/20 rules · {size}/60,000 bytes
          </p>
        </fieldset>
        <ErrorNotice error={validation} />
        {matrix && (
          <ConflictReview
            error={mutation.error}
            path={`${base}/${matrix.id}`}
            values={{ content }}
            onReview={(current) => setRevision(current.revision)}
          />
        )}
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={size > 60000}
          label="Save matrix draft"
        />
      </form>
    </Dialog>
  )
}

function MatrixCommand({ base, matrix, command, close, saved }) {
  const [name, setName] = useState(`${matrix.content.name} copy`),
    [revision, setRevision] = useState(matrix.revision),
    [consent, setConsent] = useState(false)
  const mutation = useMutation()
  async function submit(event) {
    event.preventDefault()
    const result = await mutation.run(
      'post',
      `${base}/${matrix.id}/${command}`,
      {
        expectedRevision: revision,
        ...(command === 'copy' ? { name: name.trim() } : {}),
      },
    )
    if (result) saved(result.data)
  }
  return (
    <Dialog
      title={`${command[0].toUpperCase() + command.slice(1)} decoration matrix`}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <p>
        {command === 'copy'
          ? 'The copy has a new identity, no publication and independent future edits.'
          : command === 'publish'
            ? 'This publishes an immutable definition. Existing consumers keep their selected versions and require explicit correction review.'
            : 'History and published definitions are retained.'}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          {command === 'copy' && (
            <Field
              label="New matrix name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I reviewed this {command} action.
          </label>
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={`${base}/${matrix.id}`}
          values={{ content: matrix.content }}
          onReview={(current) => {
            setRevision(current.revision)
            setConsent(false)
          }}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!consent}
          label={`Confirm ${command}`}
        />
      </form>
    </Dialog>
  )
}

function MatrixEvidence({ path, kind }) {
  const [pages, setPages] = useState([]),
    [version, setVersion] = useState(null)
  const resource = useResource(
      queryPath(`${path}/${kind}`, { limit: 25, after: pages.at(-1) }),
    ),
    detail = useResource(version ? `${path}/versions/${version}` : null)
  return (
    <>
      <h2>{kind === 'history' ? 'Matrix history' : 'Immutable versions'}</h2>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items?.length ? (
        resource.data.items.map((item) => (
          <article className="panel" key={item.id}>
            {kind === 'versions' ? (
              <>
                <h3>Published revision {item.revision}</h3>
                <p>{new Date(item.publishedAt).toLocaleString()}</p>
                <Action variant="secondary" onClick={() => setVersion(item.id)}>
                  View immutable version
                </Action>
              </>
            ) : (
              <>
                <h3>
                  {item.action} · Revision {item.revision}
                </h3>
                <p>
                  {item.actor?.label || 'Actor unavailable'} ·{' '}
                  {new Date(item.occurredAt).toLocaleString()}
                </p>
                {item.before && (
                  <details>
                    <summary>Before</summary>
                    <MatrixDefinition content={item.before} />
                  </details>
                )}
                {item.after && (
                  <details>
                    <summary>After</summary>
                    <MatrixDefinition content={item.after} />
                  </details>
                )}
              </>
            )}
          </article>
        ))
      ) : (
        !resource.error && (
          <Empty title="No recorded entries">
            No historical records are available yet.
          </Empty>
        )
      )}
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label={kind}
      />
      {version && (
        <Dialog
          title="Published decoration matrix"
          close={() => setVersion(null)}
          className="matrix-dialog"
        >
          <ErrorNotice error={detail.error} retry={detail.reload} />
          {detail.loading ? (
            <Loading />
          ) : (
            detail.data && (
              <>
                <p>
                  Version {detail.data.id} · Revision {detail.data.revision}
                </p>
                <p>
                  Supplier: {detail.data.supplier?.name} · Method:{' '}
                  {detail.data.method?.label}
                </p>
                <MatrixDefinition content={detail.data.content} />
              </>
            )
          )}
        </Dialog>
      )}
    </>
  )
}
