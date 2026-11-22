import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, CheckCircle2, CreditCard, History, Info, Plus,
  RefreshCw, ShieldCheck, Users,
} from 'lucide-react'
import {
  Action, Dialog, Empty, ErrorNotice, Field, ListSkeleton, SaveFooter,
} from '../../components/workspace/Elements'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath, readData } from '../../services/workspace'
import { dateLabel, money } from '../../utils/format'
import '../../styles/admin-plan.css'

// Parse decimal input as integer cents without floating-point multiplication.
function priceInCents(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 100_000_000 ? cents : null
}

function PlanNote({ children, success = false }) {
  const Icon = success ? ShieldCheck : Info
  return <div className={`standard-plan-note${success ? ' standard-plan-note--protected' : ''}`}><Icon size={19} aria-hidden="true" /><p>{children}</p></div>
}

export function StandardPlan() {
  const resource = useResource('/admin/plan')
  const [editing, setEditing] = useState(false)
  const [historyRevision, setHistoryRevision] = useState(0)
  const [saved, setSaved] = useState(false)
  const plan = resource.data?.plan

  return (
    <div className="standard-plan">
      {saved && <div className="standard-plan-success" role="status"><CheckCircle2 size={19} aria-hidden="true" />New plan version created. Future offers can use the updated price.</div>}
      <div className="standard-plan-grid">
        <section className="panel standard-plan-current" aria-labelledby="standard-plan-current-title" aria-busy={resource.loading}>
          <div className="standard-plan-heading"><span className="standard-plan-icon"><CreditCard size={22} aria-hidden="true" /></span><div><h2 id="standard-plan-current-title">Current standard plan</h2><p>Base pricing for new commercial offers</p></div></div>
          <ErrorNotice error={resource.error} retry={resource.reload} />
          {resource.loading ? <ListSkeleton label="Loading standard plan…" variant="list" rows={3} /> : resource.error ? <Empty title="Plan unavailable" action={<Action variant="secondary" onClick={resource.reload}>Reload plan</Action>}>The current price could not be loaded.</Empty> : plan ? <>
            <div className="standard-plan-price-line"><span className="standard-plan-price">{money(plan.unitAmountMinor, plan.currency)}</span><span className="standard-plan-currency">{plan.currency.toUpperCase()}</span></div>
            <p className="standard-plan-cadence">per seat, billed monthly</p>
            <div className="standard-plan-version-line"><span className="standard-plan-badge"><CheckCircle2 size={14} aria-hidden="true" />Current · Version {plan.version}</span><span>Created {dateLabel(plan.createdAt)}</span></div>
            <dl className="standard-plan-facts"><div><dt><CalendarDays size={16} aria-hidden="true" />Billing cycle</dt><dd>Monthly</dd></div><div><dt><Users size={16} aria-hidden="true" />Pricing unit</dt><dd>Per seat</dd></div><div><dt>Currency</dt><dd>{plan.currency.toUpperCase()}</dd></div></dl>
            <Action className="standard-plan-create" onClick={() => setEditing(true)}><Plus size={17} aria-hidden="true" />Create a new plan version</Action>
          </> : <Empty title="No standard plan available">Plan configuration needs to be initialized before pricing can be managed.</Empty>}
        </section>

        <section className="panel standard-plan-policy" aria-labelledby="standard-plan-policy-title">
          <div className="standard-plan-heading"><span className="standard-plan-icon"><ShieldCheck size={22} aria-hidden="true" /></span><div><h2 id="standard-plan-policy-title">How plan changes work</h2><p>Clear pricing, preserved agreements</p></div></div>
          <ul className="standard-plan-rules">
            <li><Plus size={19} aria-hidden="true" /><div><h3>New offers use the new price</h3><p>Create a version to make a new base price available when preparing future offers.</p></div></li>
            <li><ShieldCheck size={19} aria-hidden="true" /><div><h3>Agreed prices stay in place</h3><p>Existing offer snapshots and accepted agreements keep their original pricing.</p></div></li>
            <li><History size={19} aria-hidden="true" /><div><h3>Every change has a record</h3><p>Previous versions are preserved with the price change, date and reason.</p></div></li>
          </ul>
          <PlanNote>Trials and discounts are configured on individual offers.</PlanNote>
        </section>
      </div>
      <PlanHistory key={historyRevision} currentVersion={plan?.version} />
      {editing && plan && <PlanEditor plan={plan} close={() => setEditing(false)} saved={() => {
        setEditing(false)
        setSaved(true)
        setHistoryRevision(value => value + 1)
        resource.reload()
      }} />}
    </div>
  )
}

function PlanHistory({ currentVersion }) {
  const [cursors, setCursors] = useState([])
  const resource = useResource(queryPath('/admin/plan/history', { after: cursors.at(-1), limit: 10 }))
  const items = resource.data?.items || []
  return <section className="panel standard-plan-history" aria-labelledby="standard-plan-history-title" aria-busy={resource.loading}>
    <div className="standard-plan-history-heading"><div className="standard-plan-heading"><span className="standard-plan-icon"><History size={21} aria-hidden="true" /></span><div><h2 id="standard-plan-history-title">Version history</h2><p>A permanent record of standard plan changes, oldest first.</p></div></div><Action variant="secondary" aria-label="Refresh plan history" disabled={resource.loading} onClick={resource.reload}><RefreshCw size={15} aria-hidden="true" />Refresh</Action></div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading ? <ListSkeleton label="Loading plan history…" rows={3} variant="list" /> : resource.error ? <Empty title="History unavailable" action={<Action variant="secondary" onClick={resource.reload}>Reload history</Action>}>The change history could not be loaded.</Empty> : items.length ? <div className="standard-plan-history-rows">
      <div className="standard-plan-history-columns" aria-hidden="true"><span>Version</span><span>Price per seat / month</span><span>Reason for change</span><span>Created</span></div>
      <ul>{items.map(item => <li className="standard-plan-history-row" key={item.id}>
        <div className="standard-plan-history-version"><strong>{item.after?.version != null ? `Version ${item.after.version}` : 'Plan created'}</strong>{item.after?.version === currentVersion && <span className="standard-plan-badge">Current</span>}</div>
        <div className="standard-plan-history-price"><strong>{money(item.after?.unitAmountMinor, item.after?.currency)}</strong>{item.before && <span>Previously {money(item.before.unitAmountMinor, item.before.currency)}</span>}</div>
        <p>{item.reason || 'No reason recorded'}</p>
        <time dateTime={item.occurredAt}>{dateLabel(item.occurredAt)}</time>
      </li>)}</ul>
    </div> : <Empty title="No plan changes yet" icon={<History size={26} aria-hidden="true" />}>New versions will appear here with their price and reason for change.</Empty>}
    <div className="standard-plan-history-footer"><span>{resource.loading ? 'Loading…' : resource.error ? 'History unavailable' : `Page ${cursors.length + 1} · ${items.length} ${items.length === 1 ? 'change' : 'changes'}`}</span><nav aria-label="Plan history pages"><Action variant="secondary" disabled={!cursors.length || resource.loading} onClick={() => setCursors(value => value.slice(0, -1))}>Previous</Action><Action variant="secondary" disabled={!resource.data?.nextCursor || resource.loading || Boolean(resource.error)} onClick={() => setCursors(value => [...value, resource.data.nextCursor])}>Next</Action></nav></div>
  </section>
}

function PlanEditor({ plan, close, saved }) {
  const priceInput = useRef(null)
  const [basePlan, setBasePlan] = useState(plan)
  const [amount, setAmount] = useState((plan.unitAmountMinor / 100).toFixed(2))
  const [reason, setReason] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [reviewLatest, setReviewLatest] = useState(false)
  const mutation = useMutation()
  const cents = priceInCents(amount)
  const conflict = mutation.error?.status === 409
  const valid = cents !== null && Boolean(reason.trim())
  const locked = mutation.pending || mutation.uncertain || refreshing

  useEffect(() => {
    const frame = requestAnimationFrame(() => priceInput.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  async function loadLatest() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const latest = await readData('/admin/plan')
      setBasePlan(latest.plan)
      setReviewLatest(true)
      mutation.reset()
    } catch (error) {
      setRefreshError(error)
    } finally {
      setRefreshing(false)
    }
  }

  return <Dialog title="Create a plan version" description="Set the base price for future offers. Every version is saved to history." className="standard-plan-editor" close={close} locked={locked}>
    <form onSubmit={async event => {
      event.preventDefault()
      if (refreshing || conflict || (!valid && !mutation.uncertain)) return
      if (await mutation.run('post', '/admin/plan/versions', { expectedVersion: basePlan.version, unitAmountMinor: cents, reason: reason.trim() })) saved()
    }}>
      <fieldset disabled={locked}>
        <div className="standard-plan-editor-context"><CreditCard size={20} aria-hidden="true" /><span>Standard plan <strong>New version</strong></span><span>{basePlan.currency.toUpperCase()} · Monthly · Per seat</span></div>
        <Field ref={priceInput} label="Price per seat / month (USD)" autoFocus required inputMode="decimal" prefix="$" maxLength={16} value={amount} onChange={event => setAmount(event.target.value)} error={amount !== '' && cents === null ? 'Enter $0.01–$1,000,000.00 with up to two decimal places.' : undefined} hint="Enter the dollar amount, for example 49.00." />
        <div className="standard-plan-comparison" aria-live="polite"><div><span>Current · Version {basePlan.version}</span><strong>{money(basePlan.unitAmountMinor, basePlan.currency)}</strong></div><div><span>New price</span><strong>{money(cents, basePlan.currency)}</strong></div></div>
        <Field label="Reason for change" required maxLength={500} placeholder="e.g. Updated pricing for new customers" value={reason} onChange={event => setReason(event.target.value)} hint="Saved with this version so other administrators can understand the change." />
        <PlanNote success>Existing offers and accepted agreements keep their original prices.</PlanNote>
      </fieldset>
      {conflict && <div className="standard-plan-conflict"><p>The plan changed while you were editing. Load the latest price and review your draft before saving.</p><Action variant="secondary" disabled={refreshing} onClick={loadLatest}>{refreshing ? 'Loading latest plan…' : 'Load latest plan'}</Action></div>}
      {reviewLatest && <p className="standard-plan-review" role="status">Latest version loaded. Your draft is preserved; review it against the current price before creating a version.</p>}
      <PlanEditorError error={refreshError || mutation.error} />
      <SaveFooter mutation={{ ...mutation, error: null }} close={close} label="Create plan version" disabled={refreshing || conflict || (!valid && !mutation.uncertain)} onClear={() => { setAmount((basePlan.unitAmountMinor / 100).toFixed(2)); setReason(''); setReviewLatest(false) }} />
    </form>
  </Dialog>
}

function PlanEditorError({ error }) {
  if (!error) return null
  return <div className="standard-plan-error" role="alert"><p>{error.message || 'The request could not be completed.'}</p>{error.fields?.map((field, index) => <p key={index}>{field.field}: {field.message}</p>)}{error.requestId && <small>Support reference: {error.requestId}</small>}</div>
}
