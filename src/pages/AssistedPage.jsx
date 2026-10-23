import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { useMutation } from '../hooks/useMutation'
import { useResource } from '../hooks/useResource'
import { getAuthClient } from '../services/auth'
import { mutate, paymentDestination } from '../services/workspace'
import { money } from '../utils/format'
import { Action, Empty, ErrorNotice, Field, Loading, PageHeader, Status } from '../components/workspace/Elements'

let pendingInvite
function captureAssistedInvite() {
  if (window.location.hash) {
    const values = new URLSearchParams(window.location.hash.slice(1))
    const grantId = values.get('grantId')
    const token = values.get('token')
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    pendingInvite = /^[a-f\d]{24}$/i.test(grantId || '') && token ? { grantId, token } : null
  }
  return pendingInvite
}

export function AssistedAcceptPage() {
  const [invite] = useState(captureAssistedInvite)
  const auth = useAuthSession()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [sent, setSent] = useState(false)
  const grantResource = useResource(invite && auth.session?.user?.email_confirmed_at ? `/assisted/${invite.grantId}` : null)
  const applicant = useResource(invite && auth.session?.user?.email_confirmed_at ? '/onboarding/me' : null)
  const acceptance = useMutation()
  if (auth.loading) return <Loading label="Checking your sign-in…" />
  if (!invite) return <div className="setup-layout"><PageHeader title="Invitation link unavailable" description="This link has no valid invitation token. Ask the sender to issue a fresh link." /><Link className="button secondary" to="/login">Sign in</Link></div>
  if (auth.session && !auth.session.user.email_confirmed_at) return <div className="setup-layout"><PageHeader title="Confirm your email" description="Keep this invitation page open. After confirming your email, return here to accept the offer." /><p className="muted">If you opened the confirmation link in another tab, this page will update when the sign-in session is ready.</p></div>
  if (!auth.session) return <div className="setup-layout"><PageHeader title={mode === 'signup' ? 'Create your BookMySku account' : 'Sign in to accept'} description="The invited email must match this verified BookMySku account. Your invitation is not a company application." /><section className="panel"><form onSubmit={async (event) => { event.preventDefault(); setAuthError(null); try { const client = getAuthClient(); if (mode === 'signup') { const { data, error } = await client.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }); if (error) throw error; setSent(!data.session); } else { const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (error) throw error; } } catch (error) { setAuthError(error) } }}><fieldset><Field label="Email address" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /><Field label="Password" type="password" required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></fieldset><ErrorNotice error={authError} />{sent && <p className="notice">Check your inbox to confirm your account. Keep this page open, then return after confirmation.</p>}<div className="actions"><Action type="submit">{mode === 'signup' ? 'Create account' : 'Sign in'}</Action><Action variant="secondary" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setAuthError(null) }}>{mode === 'signup' ? 'I already have an account' : 'Create an account'}</Action></div></form></section></div>
  if (grantResource.loading || applicant.loading) return <Loading label="Loading the invitation details…" />
  if (grantResource.error || applicant.error) return <div className="setup-layout"><PageHeader title="We could not load this invitation" /><ErrorNotice error={grantResource.error || applicant.error} retry={() => { grantResource.reload(); applicant.reload() }} /></div>
  const grant = grantResource.data.grant || grantResource.data
  async function accept(event) {
    event.preventDefault()
    const result = await acceptance.run('post', `/assisted/${invite.grantId}/accept`, { token: invite.token, expectedRevision: grant.revision, termsAccepted: true, termsVersion: applicant.data.termsVersion })
    if (result) { pendingInvite = null; navigate('/continue', { replace: true }) }
  }
  return <div className="setup-layout"><PageHeader eyebrow="ASSISTED ONBOARDING" title={grant.profile?.companyName || 'Review your invitation'} description="Review who invited you, the proposed setup, and its expiry before accepting." /><section className="panel"><dl className="detail-list">{[['Company',grant.profile?.companyName],['Invited email',grant.profile?.email],['Offer type',grant.terms?.kind],['Billing starts',grant.terms?.billingStartsAt ? new Date(grant.terms.billingStartsAt).toLocaleString() : 'No recurring billing'],['Expires',grant.expiresAt ? new Date(grant.expiresAt).toLocaleString() : '—']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><p className="muted">Accepting gives you the assisted workspace and does not authorize recurring charges. Payment consent is a separate step.</p><form onSubmit={accept}><label className="check-label"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />I have read and accept the current BookMySku terms.</label><ErrorNotice error={acceptance.error} />{acceptance.uncertain && <p className="notice">Retry with the same invitation details to safely recover the result.</p>}<div className="actions"><Action type="submit" disabled={!termsAccepted || acceptance.pending}>{acceptance.pending ? 'Accepting…' : acceptance.uncertain ? 'Retry acceptance' : 'Accept invitation'}</Action><Action variant="secondary" onClick={async () => { await getAuthClient().auth.signOut(); pendingInvite = null; navigate('/login', { replace: true }) }}>Decline and sign out</Action></div></form></section></div>
}

export function AssistedWorkspacePage() {
  const [selected, setSelected] = useState(null)
  const resource = useResource('/assisted?limit=25')
  if (resource.loading) return <Loading label="Loading assisted onboarding…" />
  if (resource.error) return <div className="setup-layout"><PageHeader title="Assisted onboarding" /><ErrorNotice error={resource.error} retry={resource.reload} /><Link className="button secondary" to="/continue">Back to next step</Link></div>
  const grants = resource.data.items || []
  if (selected) return <AssistedWorkspaceRecord key={selected} id={selected} back={() => { setSelected(null); resource.reload() }} />
  return <div className="setup-layout"><PageHeader eyebrow="ASSISTED ONBOARDING" title="Your assisted setup" description="Keep company details, workspace readiness, and payment authorization as separate steps." /><div className="panel">{grants.length ? grants.map((grant) => <div className="grant-row" key={grant.id}><span>{grant.profile?.companyName || grant.organization?.name || grant.email}<small className="muted"> {grant.scope} · expires {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : '—'}</small></span><div className="actions"><Status value={grant.status || grant.state} /><Action variant="secondary" onClick={() => setSelected(grant.id)}>Open checklist</Action></div></div>) : <Empty title="No assisted onboarding offers">Open the invitation link sent to your verified email, or continue with the regular application flow.</Empty>}<div className="actions"><Link className="button secondary" to="/setup">Company setup</Link><Link className="button secondary" to="/app">Workspace</Link></div></div></div>
}

function AssistedWorkspaceRecord({ id, back }) {
  const resource = useResource(`/assisted/${id}`)
  const setup = useResource(resource.data?.scope === 'organization' ? '/onboarding/setup' : null)
  const onboarding = useResource(resource.data?.scope === 'organization' ? '/onboarding/me' : null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const prepare = useMutation()
  const agree = useMutation()
  const schedule = useMutation()
  const refresh = useMutation()
  if (resource.loading) return <Loading label="Loading your setup checklist…" />
  if (resource.error) return <><Action variant="text-button" onClick={back}>← Back</Action><ErrorNotice error={resource.error} retry={resource.reload} /></>
  const record = resource.data
  const grant = record.grant || record
  if (grant.scope === 'seat') return <SeatRequestRecord grant={grant} preview={record.billing} back={back} />
  if (setup.loading) return <Loading label="Checking company setup…" />
  if (setup.error) return <ErrorNotice error={setup.error} retry={setup.reload} />
  if (onboarding.loading) return <Loading label="Checking workspace readiness…" />
  if (onboarding.error) return <ErrorNotice error={onboarding.error} retry={onboarding.reload} />
  const billing = record.billing || grant.billing || {}
  const payload = { expectedRevision: grant.revision, expectedQuantity: billing.quantity, recurringConsent: true, termsVersion: billing.termsVersion || 'assisted-recurring-v1' }
  async function startCheckout() {
    setError(null); setCheckoutBusy(true)
    try {
      const result = await mutate('post', `/assisted/${id}/checkout`, payload)
      window.location.assign(paymentDestination(result.checkoutUrl))
    } catch (failure) { setError(failure); setCheckoutBusy(false); resource.reload() }
  }
  async function prepareWorkspace() { if (await prepare.run('post', `/assisted/${id}/prepare`, {})) resource.reload() }
  async function giveConsent() { if (await agree.run('post', `/assisted/${id}/consent`, payload)) { setConsent(false); resource.reload() } }
  async function schedulePayment() { if (await schedule.run('post', `/assisted/${id}/schedule`, {})) resource.reload() }
  async function refreshBilling() {
    if (grant.applicationId && await refresh.run('post', `/applications/${grant.applicationId}/billing/refresh`, {})) resource.reload()
  }
  const nextAction = billing.nextAction
  return <div className="setup-layout"><Action variant="text-button" onClick={back}>← Back to offers</Action><PageHeader eyebrow="YOUR SETUP CHECKLIST" title={grant.profile?.companyName || 'Assisted workspace'} description="Complete these items in the order shown by the backend." />
    <section className="panel"><div className="section-heading"><h2>Workspace readiness</h2><Status value={onboarding.data.organization?.status || grant.state} /></div><p className="muted">Workspace access, company details, and payment authorization are tracked separately.</p>{setup.data.blockers?.length > 0 && <p className="notice">Complete the listed company details before preparing the workspace: {setup.data.blockers.join(', ')}.</p>}<ErrorNotice error={prepare.error} retry={resource.reload} />{grant.state === 'accepted' && setup.data.complete && onboarding.data.organization?.status !== 'active' && <Action disabled={prepare.pending || prepare.uncertain} onClick={prepareWorkspace}>{prepare.pending ? 'Preparing workspace…' : prepare.uncertain ? 'Retry preparation' : 'Prepare workspace'}</Action>}<Link className="button secondary" to="/setup">Review company details</Link></section>
    <section className="panel"><div className="section-heading"><h2>Future billing agreement</h2><Status value={billing.status || 'not started'} /></div><dl className="detail-list">{[['Next action',nextAction],['Billing boundary',billing.boundary],['Seats',billing.quantity],['Consent current',billing.consentCurrent ? 'Yes' : 'No'],['Card authorized',billing.paymentAuthorized ? 'Yes' : 'No']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? '—' : String(value)}</dd></div>)}</dl><p className="muted">The exact server agreement is shown above. Accepting the invitation did not authorize recurring billing or charge your card.</p><ErrorNotice error={agree.error || schedule.error || refresh.error || error} retry={resource.reload} />
      {nextAction === 'accept_agreement' && <><label className="check-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I agree to the displayed future recurring charge and seat quantity.</label><Action disabled={!consent || agree.pending || agree.uncertain} onClick={giveConsent}>{agree.pending ? 'Saving consent…' : 'Accept billing agreement'}</Action></>}
      {nextAction === 'setup_card' && <Action disabled={checkoutBusy} onClick={startCheckout}>{checkoutBusy ? 'Opening secure checkout…' : 'Set up payment method'}</Action>}
      {nextAction === 'schedule_payment' && <Action disabled={schedule.pending || schedule.uncertain} onClick={schedulePayment}>{schedule.pending ? 'Scheduling…' : 'Schedule future billing'}</Action>}
      {nextAction === 'wait_billing' && <p className="notice">Your future billing schedule is confirmed. No payment is due now. Refresh the status as the billing date approaches.</p>}
      {nextAction === 'refresh_billing' && <><p className="notice">The payment provider is still confirming the original operation. Do not create another checkout.</p><Action variant="secondary" disabled={refresh.pending || refresh.uncertain} onClick={refreshBilling}>{refresh.pending ? 'Refreshing billing…' : refresh.uncertain ? 'Retry status refresh' : 'Refresh billing status'}</Action></>}
      {nextAction === 'new_agreement_required' && <p className="notice">This agreement has expired. Ask your BookMySku administrator to review a new prospective agreement before continuing.</p>}
      {checkoutBusy && <p className="muted">If checkout was interrupted, reopen this checklist to recover the existing payment setup.</p>}
    </section>
  </div>
}

function SeatRequestRecord({ grant, preview, back }) {
  const [consent, setConsent] = useState(false)
  const mutation = useMutation()
  const [result, setResult] = useState(null)
  async function accept(event) {
    event.preventDefault()
    const payload = {
      expectedRevision: grant.revision,
      expectedQuantity: preview.renewalQuantity,
      recurringConsent: true,
      termsVersion: 'assisted-recurring-v1',
      expectedBillingRevision: preview.billingRevision,
      expectedBoundary: preview.billableAt,
      expectedUnitAmountMinor: preview.unitAmountMinor,
    }
    const response = await mutation.run('post', `/assisted/${grant.id}/seat`, payload)
    if (response) setResult(response.data)
  }
  return <div className="setup-layout"><Action variant="text-button" onClick={back}>← Back to offers</Action><PageHeader eyebrow="TEAM SEAT REQUEST" title="Review the next renewal" description="This request does not invite the person or charge you now. It asks BookMySku to reserve the seat for the displayed renewal boundary." /><section className="panel"><dl className="detail-list">{[['Recipient',grant.email],['Role',grant.role],['Billing boundary',preview.billableAt],['Renewal quantity',preview.renewalQuantity],['Immediate amount',money(preview.immediateAmountMinor,preview.currency)],['Renewal subtotal',money(preview.renewalSubtotalMinor,preview.currency)],['Uses paid capacity',preview.reusesPaidCapacity ? 'Yes' : 'No'],['Additional deferred seats',preview.additionalDeferredCapacity]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? '—' : String(value)}</dd></div>)}</dl>{result ? <div className="notice"><p>Seat request accepted. The invitation still needs to be sent and accepted by the recipient.</p><p>Invitation status: {result.state || result.status}</p><Link className="button secondary" to="/app/team">Review team</Link></div> : <form onSubmit={accept}><label className="check-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I approve the displayed seat quantity and next-renewal amount.</label><ErrorNotice error={mutation.error} />{mutation.uncertain && <p className="notice">Retry this same request to safely recover the original result.</p>}<Action type="submit" disabled={!consent || mutation.pending || mutation.uncertain}>{mutation.pending ? 'Saving seat approval…' : mutation.uncertain ? 'Retry approval' : 'Approve seat for renewal'}</Action></form>}</section></div>
}
