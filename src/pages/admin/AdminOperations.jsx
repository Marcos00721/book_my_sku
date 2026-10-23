import { useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { dateLabel, money } from '../../utils/format'
import { Action, Dialog, Empty, ErrorNotice, Field, Loading, SaveFooter, Status } from '../../components/workspace/Elements'

const isoSecond = (value) => new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z')

export function RegistrationIntakes() {
  const [history, setHistory] = useState([])
  const resource = useResource(queryPath('/admin/registration-intakes', { limit: 20, after: history.at(-1) }))
  return <section className="panel"><div className="section-heading"><div><h2>Registration awaiting verification</h2><p className="muted">These records are separate from applications and cannot be approved until the person verifies their email.</p></div><Action variant="secondary" onClick={resource.reload}>Refresh</Action></div><ErrorNotice error={resource.error} retry={resource.reload} />{resource.loading ? <Loading /> : resource.data?.items?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Contact</th><th>Created</th><th>Expires</th><th>State</th></tr></thead><tbody>{resource.data.items.map((item) => <tr key={item.id}><td>{item.profile.companyName}</td><td>{item.profile.firstName} {item.profile.lastName}<small>{item.profile.email}</small></td><td>{dateLabel(item.createdAt)}</td><td>{dateLabel(item.expiresAt)}</td><td><Status value={item.status} />{item.recoveryRequired && <small>Recovery required</small>}</td></tr>)}</tbody></table></div> : !resource.error && <Empty title="No pending registrations">New email-verification intakes appear here separately from review-ready applications.</Empty>}{resource.data && <div className="table-bottom"><span>{resource.data.items.length} intakes</span><div className="actions"><Action variant="secondary" disabled={!history.length} onClick={() => setHistory((items) => items.slice(0,-1))}>Previous</Action><Action variant="secondary" disabled={!resource.data.next} onClick={() => setHistory((items) => [...items,resource.data.next])}>Next</Action></div></div>}</section>
}

export function AssistedAdmin() {
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const resource = useResource(queryPath('/admin/assisted', { limit: 25, after: history.at(-1) }))
  if (selected) return <AssistedRecord id={selected} back={() => { setSelected(null); resource.reload() }} />
  return <section className="panel"><div className="section-heading"><div><h2>Assisted onboarding</h2><p className="muted">Create and track reviewed customer offers and seat requests. Recurring billing still needs the owner’s separate consent.</p></div><div className="actions"><Action variant="secondary" onClick={resource.reload}>Refresh</Action><Action onClick={() => setCreating(true)}>New assisted offer</Action></div></div><div className="notice">This feature requires the backend rollout flag and a qualified staging environment. A disabled endpoint should remain a clear rollout response.</div><ErrorNotice error={resource.error} retry={resource.reload} />{resource.loading ? <Loading /> : resource.data?.items?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Recipient</th><th>Scope</th><th>Status</th><th>Expires</th><th>Revision</th><th /></tr></thead><tbody>{resource.data.items.map((grant) => <tr key={grant.id}><td>{grant.profile?.companyName || grant.email || grant.profile?.email || grant.organizationId}</td><td>{grant.scope}</td><td><Status value={grant.status || grant.state} /></td><td>{dateLabel(grant.expiresAt)}</td><td>{grant.revision}</td><td><Action variant="secondary" onClick={() => setSelected(grant.id)}>Open</Action></td></tr>)}</tbody></table></div> : !resource.error && <Empty title="No assisted offers yet">Create an offer after verifying the customer request through an approved channel.</Empty>}{resource.data && <div className="table-bottom"><span>{resource.data.items.length} offers</span><div className="actions"><Action variant="secondary" disabled={!history.length} onClick={() => setHistory((items) => items.slice(0,-1))}>Previous</Action><Action variant="secondary" disabled={!resource.data.next} onClick={() => setHistory((items) => [...items,resource.data.next])}>Next</Action></div></div>}{creating && <AssistedCreate close={() => setCreating(false)} saved={() => { setCreating(false); setHistory([]); resource.reload() }} />}</section>
}

function AssistedCreate({ close, saved }) {
  const [scope, setScope] = useState('organization')
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', companyName:'', contactNumber:'', companyWebsite:'', organizationId:'', role:'member', termsKind:'deferred', startsAt:'', unitAmountMinor:'4900', currency:'usd', expiresAt:'', reason:'', requestReference:'', verifiedChannel:'verified_email' })
  const mutation = useMutation()
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  async function submit(event) {
    event.preventDefault()
    const evidence = { reason: form.reason.trim(), requestReference: form.requestReference.trim(), verifiedChannel: form.verifiedChannel }
    const expiresAt = isoSecond(form.expiresAt)
    const body = scope === 'organization' ? {
      scope,
      profile: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase(), companyName: form.companyName.trim(), contactNumber: form.contactNumber.trim(), companyWebsite: form.companyWebsite.trim() },
      terms: form.termsKind === 'complimentary' ? { kind:'complimentary' } : { kind:'deferred', billingStartsAt: isoSecond(form.startsAt), displayTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone, unitAmountMinor: Number(form.unitAmountMinor), currency: form.currency.toLowerCase(), interval:'month', unit:'seat', offerRevision:1 },
      expiresAt, ...evidence,
    } : { scope, organizationId: form.organizationId.trim(), email: form.email.trim().toLowerCase(), role: form.role, expiresAt, ...evidence }
    if (await mutation.run('post','/admin/assisted',body)) saved()
  }
  return <Dialog title="Create an assisted offer" close={close} locked={mutation.pending || mutation.uncertain}><form onSubmit={submit}><fieldset disabled={mutation.pending || mutation.uncertain}><Field label="Offer type" value={scope} onChange={(event) => setScope(event.target.value)}><option value="organization">New workspace</option><option value="seat">Team seat request</option></Field>
    {scope === 'organization' ? <div className="form-grid">{[['firstName','First name'],['lastName','Last name'],['email','Verified recipient email'],['companyName','Company name'],['contactNumber','Phone'],['companyWebsite','Website (optional)']].map(([key,label]) => <Field key={key} label={label} type={key === 'email' ? 'email' : 'text'} required={!['companyWebsite','lastName'].includes(key)} value={form[key]} onChange={(event) => set(key,event.target.value)} />)}<Field label="Billing agreement" value={form.termsKind} onChange={(event) => set('termsKind',event.target.value)}><option value="deferred">Future monthly billing</option><option value="complimentary">Complimentary</option></Field>{form.termsKind === 'deferred' && <><Field label="Billing starts at" type="datetime-local" required value={form.startsAt} onChange={(event) => set('startsAt',event.target.value)} /><Field label="Monthly price per seat (USD cents)" type="number" min="1" required value={form.unitAmountMinor} onChange={(event) => set('unitAmountMinor',event.target.value)} /></>}</div> : <div className="form-grid"><Field label="Workspace ID" required value={form.organizationId} onChange={(event) => set('organizationId',event.target.value)} /><Field label="Recipient email" type="email" required value={form.email} onChange={(event) => set('email',event.target.value)} /><Field label="Requested role" value={form.role} onChange={(event) => set('role',event.target.value)}><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option></Field></div>}
    <Field label="Offer expires at" type="datetime-local" required value={form.expiresAt} onChange={(event) => set('expiresAt',event.target.value)} />
    <Field label="Verification channel" value={form.verifiedChannel} onChange={(event) => set('verifiedChannel',event.target.value)}><option value="verified_email">Verified email</option><option value="verified_call">Verified call</option><option value="signed_request">Signed request</option></Field>
    <Field label="Support case / request reference" required maxLength={120} value={form.requestReference} onChange={(event) => set('requestReference',event.target.value)} /><Field label="Reason for offer" required maxLength={500} value={form.reason} onChange={(event) => set('reason',event.target.value)} />
    </fieldset><SaveFooter mutation={mutation} close={close} label="Create reviewed offer" /></form></Dialog>
}

function AssistedRecord({ id, back }) {
  const resource = useResource(`/admin/assisted/${id}`)
  const [command, setCommand] = useState(null)
  if (resource.loading) return <Loading />
  if (resource.error) return <><Action variant="text-button" onClick={back}>← Back</Action><ErrorNotice error={resource.error} retry={resource.reload} /></>
  const grant = resource.data.grant || resource.data
  return <><Action variant="text-button" onClick={back}>← Back to offers</Action><section className="panel"><div className="section-heading"><div><h2>{grant.profile?.companyName || grant.email || grant.profile?.email}</h2><p className="muted">{grant.scope} · revision {grant.revision}</p></div><Status value={grant.status || grant.state} /></div><dl className="detail-list">{[['Recipient',grant.profile?.email || grant.email],['Expires',dateLabel(grant.expiresAt)],['Billing start',dateLabel(grant.terms?.billingStartsAt)],['Price per seat',grant.terms?.unitAmountMinor ? money(grant.terms.unitAmountMinor,grant.terms.currency) : 'Complimentary'],['Request reference',grant.requestReference]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><p className="muted">Record verified request evidence for every change. These controls never start billing.</p><div className="actions"><Action variant="secondary" onClick={() => setCommand('resend')}>Resend invite</Action>{grant.scope === 'organization' && <Action variant="secondary" onClick={() => setCommand('edit')}>Revise future offer</Action>}<Action variant="danger-button" onClick={() => setCommand('revoke')}>Revoke offer</Action></div></section><section className="panel"><h2>Recent delivery history</h2>{resource.data.deliveries?.length ? resource.data.deliveries.map((item) => <div className="grant-row" key={item.id}><span>{item.action}<small className="muted"> · {item.failureCode || 'No failure reported'}</small></span><Status value={item.status} /></div>) : <p className="muted">No delivery events are available.</p>}</section>{command && <AssistedChange id={id} grant={grant} command={command} close={() => setCommand(null)} saved={() => { setCommand(null); resource.reload() }} />}</>
}

function AssistedChange({ id, grant, command, close, saved }) {
  const [reason, setReason] = useState('')
  const [requestReference, setRequestReference] = useState('')
  const [verifiedChannel, setVerifiedChannel] = useState('verified_email')
  const [startsAt, setStartsAt] = useState('')
  const [amount, setAmount] = useState(grant.terms?.unitAmountMinor || 4900)
  const [kind, setKind] = useState(grant.terms?.kind || 'deferred')
  const mutation = useMutation()
  const title = command === 'edit' ? 'Revise future offer' : command === 'resend' ? 'Resend invitation' : 'Revoke invitation'
  async function submit(event) {
    event.preventDefault()
    const evidence = { expectedRevision: grant.revision, reason: reason.trim(), requestReference: requestReference.trim(), verifiedChannel }
    const terms = command !== 'edit' ? null : kind === 'complimentary' ? { kind } : { kind, billingStartsAt: isoSecond(startsAt), displayTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone, unitAmountMinor: Number(amount), currency: 'usd', interval: 'month', unit: 'seat', offerRevision: (grant.terms?.offerRevision || 0) + 1 }
    const body = command === 'edit' ? { ...evidence, terms } : evidence
    if (await mutation.run('post', `/admin/assisted/${id}/${command}`, body)) saved()
  }
  return <Dialog title={title} close={close} locked={mutation.pending || mutation.uncertain}><form onSubmit={submit}><fieldset disabled={mutation.pending || mutation.uncertain}>{command === 'edit' && <><Field label="Agreement type" value={kind} onChange={(event) => setKind(event.target.value)}><option value="deferred">Future monthly billing</option><option value="complimentary">Complimentary</option></Field>{kind === 'deferred' && <div className="form-grid"><Field label="Billing starts at" type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /><Field label="Monthly price per seat (USD cents)" type="number" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} /></div>}</>}<Field label="Verified channel" value={verifiedChannel} onChange={(event) => setVerifiedChannel(event.target.value)}><option value="verified_email">Verified email</option><option value="verified_call">Verified call</option><option value="signed_request">Signed request</option></Field><Field label="Request or support case reference" required maxLength={160} value={requestReference} onChange={(event) => setRequestReference(event.target.value)} /><Field label="Reason" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></fieldset><SaveFooter mutation={mutation} close={close} label={command === 'edit' ? 'Save revised offer' : command === 'resend' ? 'Resend link' : 'Revoke offer'} /></form></Dialog>
}
