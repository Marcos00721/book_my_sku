import { useRef, useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { api } from '../../services/api'
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
import { VariantSelect } from '../../components/workspace/VariantSelect'

const ratePattern = '(0|[1-9][0-9]{0,8})(\\.[0-9]{1,6})?'
const keyPattern = '[a-zA-Z0-9_-]{1,64}'
function nextKey(prefix, rows) {
  let index = 1
  while (rows.some((row) => row.id === `${prefix}_${index}`)) index++
  return `${prefix}_${index}`
}
const blankRules = () => ({
  currency: 'USD',
  accountId: '',
  warehouseId: '',
  agreementId: '',
  tiers: [{ id: 'tier_1', min: 1, maxExclusive: 101, net: null, list: null }],
  variants: [],
  poolEligible: [],
})
const display = (value) =>
  value == null
    ? 'Unknown'
    : typeof value === 'object'
      ? `${value.numerator} / ${value.denominator}`
      : String(value)
const iso = (value) => (value ? new Date(value).toISOString() : null)

export function ProductPricing({ path, product }) {
  const workspace = useWorkspace()
  const rights = ['edit', 'publish', 'preview', 'cost'].map((action) =>
    workspace.can(`products.pricing.${action}`),
  )
  if (!rights.slice(0, 3).some(Boolean))
    return (
      <Empty title="Pricing access is limited">
        Ask your workspace owner for pricing access.
      </Empty>
    )
  return (
    <PricingWorkspace
      key={rights.join(':')}
      path={path}
      product={product}
      edit={rights[0]}
      publish={rights[1]}
      preview={rights[2]}
      cost={rights[3]}
    />
  )
}

function PricingWorkspace({ path, product, edit, publish, preview, cost }) {
  const workspace = useWorkspace()
  const [kind, setKind] = useState(edit || publish ? 'draft' : 'published')
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [publishing, setPublishing] = useState(null)
  const [tab, setTab] = useState('schedules')
  const resource = useResource(
    queryPath(`${path}/pricing/schedules`, {
      kind,
      limit: 25,
      after: pages.at(-1),
    }),
  )
  const writable = workspace.writesAllowed && product.status !== 'archived'
  function changed() {
    setSelected(null)
    setCreating(false)
    setPublishing(null)
    resource.reload()
  }
  return (
    <>
      <div className="section-heading">
        <h2>Manual goods pricing</h2>
        {edit && cost && writable && (
          <Action onClick={() => setCreating(true)}>
            Add pricing schedule
          </Action>
        )}
      </div>
      <p>
        USD rates are saved as decimal values. Published intervals determine
        which schedule applies. This preview covers goods only; freight, tax and
        decoration remain separate.
      </p>
      <div className="tabs" role="tablist" aria-label="Pricing views">
        <button
          role="tab"
          aria-selected={tab === 'schedules'}
          onClick={() => setTab('schedules')}
        >
          Schedules
        </button>
        {preview && (
          <button
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => setTab('preview')}
          >
            Goods preview
          </button>
        )}
      </div>
      {tab === 'preview' ? (
        <GoodsPreview path={path} cost={cost} />
      ) : (
        <>
          <Field
            label="Pricing schedule view"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value)
              setPages([])
            }}
          >
            {(edit || publish) && (
              <option value="draft">Draft schedules</option>
            )}
            {preview && <option value="published">Published versions</option>}
          </Field>
          <ErrorNotice error={resource.error} retry={resource.reload} />
          {resource.loading ? (
            <Loading />
          ) : resource.data?.items?.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agreement / account / warehouse</th>
                    <th>Version</th>
                    <th>Effective interval</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((schedule) => (
                    <tr key={schedule.id}>
                      <td>
                        {schedule.agreementId}
                        <small>
                          {schedule.accountId} / {schedule.warehouseId}
                        </small>
                      </td>
                      <td>
                        {kind} · {schedule.revision}
                        <small>{schedule.id}</small>
                      </td>
                      <td>
                        {kind === 'published'
                          ? `${new Date(schedule.start).toLocaleString()} – ${schedule.end ? new Date(schedule.end).toLocaleString() : 'Open-ended'}`
                          : 'Not published'}
                      </td>
                      <td>
                        <div className="actions">
                          <Action
                            variant="secondary"
                            onClick={() => setSelected(schedule.id)}
                          >
                            {kind === 'draft' && edit && writable
                              ? 'Open editor'
                              : 'View details'}
                          </Action>
                          {kind === 'draft' && publish && cost && writable && (
                            <Action
                              variant="secondary"
                              onClick={() => setPublishing(schedule.id)}
                            >
                              Publish schedule
                            </Action>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !resource.error && (
              <Empty title="No pricing schedules">
                Create a draft using the product's selectable variants, then
                review and publish its effective interval.
              </Empty>
            )
          )}
          <Pager
            resource={resource}
            pages={pages}
            setPages={setPages}
            label="schedules"
          />
        </>
      )}
      {creating && (
        <ScheduleEditor
          path={path}
          cost={cost}
          editable={edit && writable}
          close={() => setCreating(false)}
          saved={changed}
        />
      )}
      {selected && (
        <ScheduleDetail
          path={path}
          id={selected}
          kind={kind}
          cost={cost}
          editable={edit && writable && kind === 'draft'}
          close={() => setSelected(null)}
          saved={changed}
        />
      )}
      {publishing && (
        <Publication
          path={path}
          id={publishing}
          close={() => setPublishing(null)}
          saved={changed}
        />
      )}
    </>
  )
}

function ScheduleDetail({ path, id, kind, cost, editable, close, saved }) {
  const resource = useResource(`${path}/pricing/schedules/${id}?kind=${kind}`)
  if (resource.loading || resource.error)
    return (
      <Dialog title="Pricing schedule" close={close}>
        {resource.loading ? (
          <Loading />
        ) : (
          <ErrorNotice error={resource.error} retry={resource.reload} />
        )}
      </Dialog>
    )
  if (editable)
    return (
      <ScheduleEditor
        path={path}
        schedule={resource.data}
        cost={cost}
        editable
        close={close}
        saved={saved}
      />
    )
  const schedule = resource.data
  return (
    <Dialog title="Pricing schedule version" close={close}>
      <p>
        {schedule.agreementId} · {schedule.accountId} · {schedule.warehouseId}
      </p>
      <p>
        Version {schedule.id} · Revision {schedule.revision}
      </p>
      <p>
        Effective: {schedule.start || 'Draft'} – {schedule.end || 'Open-ended'}
      </p>
      {schedule.originalStart && (
        <p>
          Original interval: {schedule.originalStart} –{' '}
          {schedule.originalEnd || 'Open-ended'} · Current interval revision{' '}
          {schedule.intervalRevision}
        </p>
      )}
      <RateSummary schedule={schedule} cost={cost} />
    </Dialog>
  )
}

function RateSummary({ schedule, cost }) {
  return (
    <>
      {cost && schedule.rules && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Purchased quantity</th>
                <th>Net cost / each</th>
                <th>List / each</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rules.tiers.map((tier) => (
                <tr key={tier.id}>
                  <td>{tier.id}</td>
                  <td>
                    {tier.min}–{tier.maxExclusive - 1}
                  </td>
                  <td>{display(tier.net)}</td>
                  <td>{display(tier.list)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Variant</th>
              {cost && <th>Net premium / each</th>}
              <th>Sale / each</th>
            </tr>
          </thead>
          <tbody>
            {(cost && schedule.rules
              ? schedule.rules.variants
              : schedule.sales || []
            ).map((variant) => (
              <tr key={variant.id}>
                <td>{variant.id}</td>
                {cost && <td>{display(variant.netPremium)}</td>}
                <td>{display(variant.sale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ScheduleEditor({ path, schedule, cost, editable, close, saved }) {
  const [rules, setRules] = useState(() =>
    structuredClone(schedule?.rules || blankRules()),
  )
  const [sales, setSales] = useState(() =>
    structuredClone(
      schedule?.sales ||
        schedule?.rules?.variants?.map(({ id, sale }) => ({ id, sale })) ||
        [],
    ),
  )
  const [revision, setRevision] = useState(schedule?.revision)
  const mutation = useMutation()
  function set(key, value) {
    setRules((current) => ({ ...current, [key]: value }))
  }
  function tier(index, patch) {
    set(
      'tiers',
      rules.tiers.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }
  function variant(index, patch) {
    setRules((current) => ({
      ...current,
      variants: current.variants.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
      poolEligible:
        patch.id && patch.id !== current.variants[index].id
          ? current.poolEligible.filter(
              (id) => id !== current.variants[index].id,
            )
          : current.poolEligible,
    }))
  }
  async function submit(event) {
    event.preventDefault()
    const target = `${path}/pricing/schedules${schedule ? `/${schedule.id}${cost ? '' : '/sales'}` : ''}`
    const result = await mutation.run(
      schedule ? 'patch' : 'post',
      target,
      cost
        ? { ...(schedule ? { expectedRevision: revision } : {}), rules }
        : { expectedRevision: revision, sales },
    )
    if (result) saved()
  }
  return (
    <Dialog
      title={schedule ? 'Edit pricing draft' : 'Add pricing draft'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset
          disabled={!editable || mutation.pending || mutation.uncertain}
        >
          {cost ? (
            <>
              <div className="form-grid">
                {[
                  ['accountId', 'Supplier account label'],
                  ['warehouseId', 'Warehouse label'],
                  ['agreementId', 'Agreement label'],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    required
                    pattern={keyPattern}
                    maxLength={64}
                    value={rules[key]}
                    onChange={(event) => set(key, event.target.value)}
                  />
                ))}
              </div>
              <p className="muted">
                These are local schedule labels, with exact spelling. Rates are
                USD per purchased each. Blank means unknown; an explicit zero is
                preserved.
              </p>
              <h3>Quantity tiers</h3>
              {rules.tiers.map((row, index) => (
                <section className="panel" key={index}>
                  <div className="form-grid">
                    <Field
                      label="Tier key"
                      required
                      pattern={keyPattern}
                      maxLength={64}
                      value={row.id}
                      onChange={(event) =>
                        tier(index, { id: event.target.value })
                      }
                    />
                    <Field
                      label="Minimum purchased quantity"
                      type="number"
                      min="1"
                      max="100000000"
                      step="1"
                      required
                      value={row.min}
                      onChange={(event) =>
                        tier(index, { min: Number(event.target.value) })
                      }
                    />
                    <Field
                      label="Upper quantity (exclusive)"
                      type="number"
                      min="2"
                      max="100000001"
                      step="1"
                      required
                      value={row.maxExclusive}
                      onChange={(event) =>
                        tier(index, {
                          maxExclusive: Number(event.target.value),
                        })
                      }
                    />
                    {[
                      ['net', 'Net cost per each'],
                      ['list', 'List per each'],
                    ].map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        inputMode="decimal"
                        pattern={ratePattern}
                        value={row[key] ?? ''}
                        onChange={(event) =>
                          tier(index, { [key]: event.target.value || null })
                        }
                      />
                    ))}
                  </div>
                  <Action
                    variant="text-button"
                    onClick={() =>
                      set(
                        'tiers',
                        rules.tiers.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove tier {index + 1}
                  </Action>
                </section>
              ))}
              <Action
                variant="secondary"
                disabled={rules.tiers.length >= 100}
                onClick={() =>
                  set('tiers', [
                    ...rules.tiers,
                    {
                      id: nextKey('tier', rules.tiers),
                      min: 1,
                      maxExclusive: 101,
                      net: null,
                      list: null,
                    },
                  ])
                }
              >
                Add quantity tier
              </Action>
              <h3>Variant rates</h3>
              {rules.variants.map((row, index) => (
                <section className="panel" key={index}>
                  <VariantSelect
                    path={path}
                    label={`Pricing variant ${index + 1}`}
                    required
                    value={row.id}
                    change={(id) => variant(index, { id })}
                  />
                  <Field
                    label="Net premium per each"
                    required
                    inputMode="decimal"
                    pattern={ratePattern}
                    value={row.netPremium}
                    onChange={(event) =>
                      variant(index, { netPremium: event.target.value })
                    }
                  />
                  <Field
                    label="Sale per each"
                    inputMode="decimal"
                    pattern={ratePattern}
                    value={row.sale ?? ''}
                    onChange={(event) =>
                      variant(index, { sale: event.target.value || null })
                    }
                  />
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={rules.poolEligible.includes(row.id)}
                      disabled={!row.id}
                      onChange={(event) =>
                        set(
                          'poolEligible',
                          event.target.checked
                            ? [...new Set([...rules.poolEligible, row.id])]
                            : rules.poolEligible.filter((id) => id !== row.id),
                        )
                      }
                    />
                    Eligible for named agreement pooling
                  </label>
                  <Action
                    variant="text-button"
                    onClick={() => {
                      setRules((current) => ({
                        ...current,
                        variants: current.variants.filter(
                          (_, i) => i !== index,
                        ),
                        poolEligible: current.poolEligible.filter(
                          (id) => id !== row.id,
                        ),
                      }))
                    }}
                  >
                    Remove pricing variant {index + 1}
                  </Action>
                </section>
              ))}
              <Action
                variant="secondary"
                disabled={rules.variants.length >= 100}
                onClick={() =>
                  set('variants', [
                    ...rules.variants,
                    { id: '', netPremium: '0', sale: null },
                  ])
                }
              >
                Add pricing variant
              </Action>
            </>
          ) : (
            <>
              <p>
                Your role can update existing sale rates. Cost and premium
                fields are private.
              </p>
              {sales.map((row, index) => (
                <Field
                  key={row.id}
                  label={`Sale per each · ${row.id}`}
                  inputMode="decimal"
                  pattern={ratePattern}
                  value={row.sale ?? ''}
                  onChange={(event) =>
                    setSales((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, sale: event.target.value || null }
                          : item,
                      ),
                    )
                  }
                />
              ))}
            </>
          )}
        </fieldset>
        {schedule && (
          <ConflictReview
            error={mutation.error}
            path={`${path}/pricing/schedules/${schedule.id}?kind=draft`}
            values={cost ? { rules } : { sales }}
            onReview={(current) => setRevision(current.revision)}
          />
        )}
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!editable || (cost && !rules.variants.length)}
          label="Save pricing draft"
        />
      </form>
    </Dialog>
  )
}

function Publication({ path, id, close, saved }) {
  const resource = useResource(`${path}/pricing/schedules/${id}?kind=draft`)
  const [reviewed, setReviewed] = useState(null)
  const draft = reviewed || resource.data
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [replace, setReplace] = useState(false)
  const [version, setVersion] = useState('')
  const [intervalRevision, setIntervalRevision] = useState('0')
  const [consent, setConsent] = useState(false)
  const mutation = useMutation()
  async function publish(event) {
    event.preventDefault()
    if (
      await mutation.run('post', `${path}/pricing/schedules/${id}/publish`, {
        expectedRevision: draft.revision,
        start: iso(start),
        end: iso(end),
        ...(replace
          ? {
              replace: {
                versionId: version,
                revision: Number(intervalRevision),
              },
            }
          : {}),
      })
    )
      saved()
  }
  return (
    <Dialog
      title="Publish pricing schedule"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <form onSubmit={publish}>
            <RateSummary schedule={draft} cost />
            <fieldset disabled={mutation.pending || mutation.uncertain}>
              <Field
                label="Starts at (blank means server time)"
                type="datetime-local"
                step="0.001"
                value={start}
                onChange={(event) => {
                  setStart(event.target.value)
                  setConsent(false)
                }}
              />
              <Field
                label="Ends at (blank means open-ended)"
                type="datetime-local"
                step="0.001"
                min={start || undefined}
                value={end}
                onChange={(event) => {
                  setEnd(event.target.value)
                  setConsent(false)
                }}
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(event) => {
                    setReplace(event.target.checked)
                    setConsent(false)
                  }}
                />
                Replace a current published interval
              </label>
              {replace && (
                <>
                  <Field
                    label="Replaced version ID"
                    required
                    pattern="[a-fA-F0-9]{24}"
                    value={version}
                    onChange={(event) => {
                      setVersion(event.target.value)
                      setConsent(false)
                    }}
                  />
                  <Field
                    label="Current interval revision"
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={intervalRevision}
                    onChange={(event) => {
                      setIntervalRevision(event.target.value)
                      setConsent(false)
                    }}
                  />
                </>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                I reviewed this immutable schedule and its effective interval.
                Existing issued documents keep their original snapshots.
              </label>
            </fieldset>
            <ConflictReview
              error={mutation.error}
              path={`${path}/pricing/schedules/${id}?kind=draft`}
              values={{ rules: draft.rules }}
              onReview={(current) => {
                setReviewed(current)
                setConsent(false)
              }}
            />
            <SaveFooter
              mutation={mutation}
              close={close}
              disabled={!consent}
              label="Publish reviewed schedule"
            />
          </form>
        )
      )}
    </Dialog>
  )
}

function GoodsPreview({ path, cost }) {
  const form = useRef(null)
  const [values, setValues] = useState(() => ({
    accountId: '',
    warehouseId: '',
    agreementId: '',
    asOf: (() => {
      const now = new Date()
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      return now.toISOString().slice(0, 16)
    })(),
  }))
  const [lines, setLines] = useState([
    { id: 'line_1', variantId: '', demandEach: 1, pool: false },
  ])
  const [state, setState] = useState({
    pending: false,
    error: null,
    result: null,
    fingerprint: null,
  })
  const fingerprint = JSON.stringify({ values, lines })
  async function calculate(fresh = false) {
    if (!form.current?.reportValidity() || state.pending) return
    setState((current) => ({ ...current, pending: true, error: null }))
    try {
      const response = await api.post(`${path}/pricing/preview`, {
        ...values,
        asOf: new Date(values.asOf).toISOString(),
        lines,
        ...(!fresh && state.result && state.fingerprint === fingerprint
          ? { expected: state.result.sources }
          : {}),
      })
      setState({
        pending: false,
        error: null,
        result: response.data,
        fingerprint,
      })
    } catch (error) {
      setState((current) => ({ ...current, pending: false, error }))
    }
  }
  const result =
    state.fingerprint === fingerprint && !state.error ? state.result : null
  return (
    <>
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault()
          void calculate()
        }}
      >
        <fieldset disabled={state.pending}>
          <div className="form-grid">
            {[
              ['accountId', 'Supplier account label'],
              ['warehouseId', 'Warehouse label'],
              ['agreementId', 'Agreement label'],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                required
                pattern={keyPattern}
                maxLength={64}
                value={values[key]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            ))}
            <Field
              label="Pricing as of"
              required
              type="datetime-local"
              value={values.asOf}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  asOf: event.target.value,
                }))
              }
            />
          </div>
          {lines.map((line, index) => (
            <section className="panel" key={line.id}>
              <VariantSelect
                path={path}
                label={`Demand variant ${index + 1}`}
                required
                value={line.variantId}
                change={(variantId) =>
                  setLines((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, variantId } : item,
                    ),
                  )
                }
              />
              <Field
                label={`Demand each ${index + 1}`}
                type="number"
                min="1"
                max="1000000"
                step="1"
                required
                value={line.demandEach}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, demandEach: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={line.pool}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, pool: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                Request pooling under this named agreement
              </label>
              <Action
                variant="text-button"
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((current) =>
                    current.filter((item) => item.id !== line.id),
                  )
                }
              >
                Remove demand line
              </Action>
            </section>
          ))}
          <Action
            variant="secondary"
            disabled={lines.length >= 100}
            onClick={() =>
              setLines((current) => [
                ...current,
                {
                  id: `line_${crypto.randomUUID()}`,
                  variantId: '',
                  demandEach: 1,
                  pool: false,
                },
              ])
            }
          >
            Add demand line
          </Action>
        </fieldset>
        <Action type="submit" disabled={state.pending}>
          {state.pending ? 'Calculating…' : 'Preview saved goods prices'}
        </Action>
        {state.result && (
          <Action
            variant="secondary"
            disabled={state.pending}
            onClick={() => calculate(true)}
          >
            Refresh preview with current sources
          </Action>
        )}
      </form>
      <ErrorNotice error={state.error} />
      {state.error?.code === 'STALE_SOURCES' && (
        <p className="notice">
          Sources changed. Explicitly refresh the preview before using new
          prices.
        </p>
      )}
      {state.result && !result && !state.error && (
        <p className="notice">Inputs changed. Generate a new preview.</p>
      )}
      {result && (
        <section className="panel">
          <h3>Goods preview · {result.currency}</h3>
          <p>
            Sale completeness: {result.saleComplete ? 'Complete' : 'Incomplete'}{' '}
            · Goods sale: {display(result.goodsSale)} · Known sale:{' '}
            {display(result.knownSale)}
          </p>
          {cost && (
            <p>
              Cost completeness:{' '}
              {result.costComplete ? 'Complete' : 'Incomplete'} · Known cost:{' '}
              {display(result.knownCost)} · Goods cost:{' '}
              {display(result.goodsCost)} · Profit:{' '}
              {display(result.goodsProfit)} · Margin ratio:{' '}
              {display(result.margin)}
            </p>
          )}
          <p>
            Effective schedule version:{' '}
            {result.sources?.scheduleVersion || 'Unavailable'}
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Demand line</th>
                  <th>Requested each</th>
                  <th>Sale USD</th>
                  {cost && <th>Cost USD</th>}
                  <th>Unknowns</th>
                </tr>
              </thead>
              <tbody>
                {result.components?.map((component) => (
                  <tr key={component.lineId}>
                    <td>{component.lineId}</td>
                    <td>{component.demandEach}</td>
                    <td>{display(component.sale)}</td>
                    {cost && <td>{display(component.cost)}</td>}
                    <td>{component.unknowns?.join(', ') || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="notice">
            Firm total:{' '}
            {result.firmTotal == null ? 'Unavailable' : result.firmTotal}.{' '}
            {result.firmBlockers?.join(', ')}
          </p>
        </section>
      )}
    </>
  )
}
