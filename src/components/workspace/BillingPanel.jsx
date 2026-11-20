import { dateLabel, money } from '../../utils/format'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, CreditCard, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react'
import '../../styles/billing.css'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { mutate, paymentDestination } from '../../services/workspace'
import { CheckoutTerms } from './CheckoutTerms'
import { ButtonLink } from '../common/ButtonLink'
import {
  Action,
  Dialog,
  ErrorNotice,
  Loading,
  SaveFooter,
  Status,
} from './Elements'

export function BillingPanel({ applicationId, changed, snapshot }) {
  const path = `/applications/${applicationId}/billing`
  const offerResource = useResource(snapshot ? null : `${path}/offer`)
  const billingResource = useResource(snapshot ? null : path)
  const offer = snapshot ? { data: snapshot.offer } : offerResource
  const billing = snapshot ? { data: snapshot.billing } : billingResource
  const waiting =
    snapshot &&
    ['wait_billing', 'wait_provisioning', 'contact_support'].includes(
      snapshot.nextAction,
    )
  const [busyAction, setBusyAction] = useState(null)
  const [error, setError] = useState(null)
  const [recovery, setRecovery] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const reconcileLocked = useRef(false)
  const autoRefreshDone = useRef(false)
  const busy = Boolean(busyAction)
  const reloadOffer = offerResource.reload
  const reloadBilling = billingResource.reload
  const reload = useCallback(() => {
    if (!snapshot) {
      reloadOffer()
      reloadBilling()
    }
    changed?.()
  }, [snapshot, reloadOffer, reloadBilling, changed])
  const reconcile = useCallback(async (action) => {
    if (reconcileLocked.current) return
    reconcileLocked.current = true
    setBusyAction(action)
    setError(null)
    setRecovery(null)
    try {
      const result = await mutate(
        'post',
        `${path}/${action}`,
        {},
        { idempotent: false },
      )
      if (action === 'recovery')
        setRecovery({
          ...result,
          paymentUrl: result.paymentUrl
            ? paymentDestination(result.paymentUrl)
            : null,
        })
      reload()
    } catch (failure) {
      setError(failure)
      return failure
    } finally {
      reconcileLocked.current = false
      setBusyAction(null)
    }
  }, [path, reload])
  // Workspace billing page: sync once on open so writes unlock without a
  // manual click. Setup waiting states keep refresh disabled/manual.
  useEffect(() => {
    if (autoRefreshDone.current || snapshot || waiting) return
    if (offer.loading || billing.loading || offer.error || billing.error) return
    if (!billing.data) return
    let canceled = false
    queueMicrotask(() => {
      if (canceled || autoRefreshDone.current) return
      autoRefreshDone.current = true
      void reconcile('refresh')
    })
    return () => { canceled = true }
  }, [
    snapshot,
    waiting,
    offer.loading,
    offer.error,
    billing.loading,
    billing.error,
    billing.data,
    reconcile,
  ])
  if (offer.loading || billing.loading)
    return <Loading label="Loading your billing details…" />
  if (offer.error || billing.error)
    return <ErrorNotice error={offer.error || billing.error} retry={reload} />
  if (offer.data.state === 'preparing')
    return (
      <section className="panel setup-preparation-panel" aria-labelledby={`preparation-${applicationId}`}>
        <div className="setup-preparation-heading">
          <span className="setup-preparation-icon" aria-hidden="true"><LoaderCircle size={24} className="spin" /></span>
          <div className="setup-preparation-copy">
            <h2 id={`preparation-${applicationId}`}>Getting your workspace ready</h2>
            <p className="muted">Your workspace is being prepared automatically. Your plan and payment options will appear here when it’s ready.</p>
          </div>
          <Status value="preparing" />
        </div>
        <div className="setup-preparation-next">
          <CreditCard size={20} aria-hidden="true" />
          <div>
            <h3>Next: review your plan</h3>
            <p className="muted">You’ll confirm your offer before continuing to secure payment.</p>
          </div>
        </div>
        <ErrorNotice error={error} />
      </section>
    )
  const status = billing.data
  const pendingRecovery =
    snapshot?.nextAction === 'wait_billing' &&
    ['billing_started', 'awaiting_start'].includes(offer.data.state) &&
    !status.cancellation?.state &&
    recovery?.state !== 'support_required'
  const showRecovery =
    recovery &&
    !status.cancellation?.state &&
    !['card_ready', 'active', 'trialing', 'canceled'].includes(status.status) &&
    snapshot?.nextAction !== 'review_and_start' &&
    snapshot?.nextAction !== 'contact_support'
  return (
    <section className="panel billing-panel" aria-label="Workspace billing">
      <div className="billing-heading">
        <div className="billing-heading-copy">
          <span className="billing-icon" aria-hidden="true"><CreditCard size={22} /></span>
          <div>
            <h2>{offer.data.state === 'available' ? 'Your workspace plan' : 'Your subscription'}</h2>
            <p className="muted">One workspace. Room for your whole team.</p>
          </div>
        </div>
        <Status value={status.status} />
      </div>
      <ErrorNotice error={error} />
      {offer.data.state === 'available' ? (
        <CheckoutOffer
          key={`${offer.data.offer.revision}:${offer.data.consent.termsVersion}`}
          flowVersion={status.flowVersion}
          path={path}
          preview={
            snapshot
              ? {
                  ...offer.data,
                  checkoutAllowed:
                    offer.data.checkoutAllowed &&
                    snapshot.platform?.ready === true &&
                    (status.flowVersion !== 4 || snapshot.nextAction === 'review_offer') &&
                    !waiting,
                }
              : offer.data
          }
          reload={reload}
        />
      ) : offer.data.state === 'awaiting_offer' ? (
        <p className="notice">
          Your application is approved. Your offer is being prepared; check back
          shortly.
        </p>
      ) : offer.data.state === 'awaiting_approval' ? (
        <p className="notice">
          Your application needs approval before billing can begin.
        </p>
      ) : status.flowVersion === 2 &&
        offer.data.state === 'awaiting_start' &&
        (!snapshot || snapshot.nextAction === 'review_and_start') ? (
        <StartSubscription
          key={`${offer.data.offer.revision}:${offer.data.consent.termsVersion}:${offer.data.initialQuantity}`}
          path={path}
          preview={offer.data}
          reload={reload}
        />
      ) : (
        <BillingOverview status={status} pendingRecovery={pendingRecovery} />
      )}
      {showRecovery &&
        !(pendingRecovery && recovery.state === 'processing') && (
          <div className="notice">
            <div>
              <p>
                {recovery.state === 'processing'
                  ? 'Your existing billing request is still processing. Wait for the next status check before trying recovery again.'
                  : recovery.state === 'support_required'
                    ? 'Your billing setup needs support review. Contact support with any request reference shown on this page.'
                    : recovery.paymentUrl
                      ? 'Your secure payment page is ready. Continue on Stripe to complete the required step.'
                      : recovery.state === 'card_ready'
                        ? 'Your card is saved. Review your accepted offer and choose Start subscription.'
                        : recovery.state === 'eligible'
                          ? 'Billing is verified. Checking your workspace access.'
                          : 'Your existing billing setup has been checked. Review the next step above.'}
              </p>
              {recovery.paymentUrl && (
                <ButtonLink href={recovery.paymentUrl} rel="noreferrer">
                  Continue secure payment <ExternalLink size={15} />
                </ButtonLink>
              )}
            </div>
          </div>
        )}
      <div className="billing-toolbar">
        <div className="billing-toolbar-copy">
          <h3>Billing status</h3>
          <p className="muted">Refresh to check the latest payment confirmation.</p>
          {(busy || waiting) && (
            <p className="billing-check-status" aria-live="polite">
              <RefreshCw size={14} className="spin" aria-hidden="true" />
              {busyAction === 'recovery'
                ? 'Recovering existing billing setup…'
                : busyAction === 'refresh'
                  ? 'Checking billing status…'
                  : 'Payment is still confirming. Status checks continue automatically.'}
            </p>
          )}
        </div>
        <div
          className="actions billing-actions"
          aria-busy={busy || undefined}
        >
          <Action
            variant="secondary"
            disabled={busy || waiting}
            onClick={() => reconcile('refresh')}
          >
            <RefreshCw
              size={15}
              className={busyAction === 'refresh' || waiting ? 'spin' : undefined}
              aria-hidden="true"
            />
            {busyAction === 'refresh' ? 'Checking…' : 'Refresh billing status'}
          </Action>
          {offer.data.state === 'billing_started' &&
            !['card_ready', 'active', 'trialing', 'canceled'].includes(status.status) &&
            !status.cancellation?.state &&
            !waiting &&
            recovery?.state !== 'support_required' && (
              <Action
                variant="secondary"
                disabled={busy}
                onClick={() => reconcile('recovery')}
              >
                {busyAction === 'recovery'
                  ? 'Recovering…'
                  : 'Resume payment / recover'}
              </Action>
            )}
        </div>
      </div>
      {pendingRecovery && (
        <h3>{['checkout_creating', 'checkout_pending'].includes(status.status)
          ? status.flowVersion === 4 ? 'Your subscription Checkout is being prepared' : 'Your secure card setup is being prepared'
          : 'Your billing confirmation is processing'}</h3>
      )}
      {pendingRecovery && (
        <PendingBillingRecovery
          key={`${path}:${status.status}:${status.revision ?? 0}`}
          retryAfter={status.retryAfter || snapshot.retryAfter}
          checkout={['checkout_creating', 'checkout_pending'].includes(
            status.status,
          )}
          busy={busyAction === 'recovery'}
          locked={busy}
          recover={() => reconcile('recovery')}
        />
      )}
      {status.flowVersion === 2 && status.status !== 'canceled' && (
        <div className="billing-cancellation">
          <Action
            variant="text-button"
            disabled={busy}
            onClick={() => setCanceling(true)}
          >
            Cancel before workspace access
          </Action>
        </div>
      )}
      {canceling && (
        <CancelBeforeAccess
          path={path}
          close={() => setCanceling(false)}
          saved={() => {
            setCanceling(false)
            reload()
          }}
        />
      )}
    </section>
  )
}

function BillingOverview({ status, pendingRecovery }) {
  const terms = status.terms
  const discount = terms?.discount
  const dates = Object.entries(status.dates || {}).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number',
  )
  return (
    <>
      <dl className="billing-summary">
        <div className="billing-stat billing-stat-price">
          <dt><Wallet size={17} aria-hidden="true" /> Standard price</dt>
          <dd>{terms ? money(terms.unitAmountMinor, terms.currency || 'USD') : 'Not available'}
            <span>{terms ? 'per seat / month' : 'Your agreed price will appear here'}</span>
          </dd>
        </div>
        <div className="billing-stat">
          <dt><Users size={17} aria-hidden="true" /> Paid seats</dt>
          <dd>{status.quantity ?? '—'}<span>Seats on your subscription</span></dd>
        </div>
        <div className={`billing-stat billing-stat-verification${status.billingEligible ? ' is-verified' : ''}`}>
          <dt><ShieldCheck size={17} aria-hidden="true" /> Payment verification</dt>
          <dd>{status.billingEligible ? 'Verified' : 'Pending'}
            <span>{status.billingEligible ? 'Current payment verified' : 'Awaiting current verification'}</span>
          </dd>
        </div>
      </dl>
      <div className="billing-details-grid">
        <section className="billing-detail-section" aria-label="Billing timeline">
          <h3><CalendarDays size={18} aria-hidden="true" /> Billing timeline</h3>
          {dates.length > 0 ? (
            <dl className="detail-list billing-date-list">
              {dates.map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').trim().toLowerCase()}</dt>
                  <dd>{dateLabel(value)}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="muted">Billing dates will appear once your subscription is confirmed.</p>}
        </section>
        <section className="billing-detail-section" aria-label="Plan agreement">
          <h3><CreditCard size={18} aria-hidden="true" /> Plan agreement</h3>
          {terms ? (
            <>
              <p>Monthly billing per paid seat{terms.trialMonths ? `, after ${terms.trialMonths} trial month${terms.trialMonths === 1 ? '' : 's'}` : ''}.</p>
              {discount && discount.type !== 'none' && (
                <p className="billing-discount">
                  {discount.type === 'percent'
                    ? `${discount.percent}%`
                    : money(discount.amountMinor, terms.currency || 'USD')}{' '}
                  off per seat for {discount.months} month{discount.months === 1 ? '' : 's'}.
                </p>
              )}
              {status.offerRevision != null && <p className="billing-meta">Accepted offer revision {status.offerRevision}</p>}
            </>
          ) : <p className="muted">Your accepted plan terms will appear here when available.</p>}
          <dl className="detail-list billing-date-list">
            <div>
              <dt>Synchronization</dt>
              <dd>{status.synchronization ? String(status.synchronization).replaceAll('_', ' ') : 'Not available'}</dd>
            </div>
          </dl>
        </section>
      </div>
      {!pendingRecovery && (
        <p className="billing-payment-note">
          <ShieldCheck size={16} aria-hidden="true" />
          Payment updates can take a moment after returning from Stripe. Refresh to check your latest status.
        </p>
      )}
    </>
  )
}

function formatWait(seconds) {
  const whole = Math.max(0, Math.ceil(seconds))
  if (whole >= 60) {
    const minutes = Math.floor(whole / 60)
    const rest = whole % 60
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
  }
  return `${whole}s`
}

function PendingBillingRecovery({
  retryAfter,
  checkout,
  busy,
  locked,
  recover,
}) {
  // Backend billing operations hold a two-minute worker lease. Give the current
  // operation that window, then recover it explicitly; never create a new intent.
  const [notBefore, setNotBefore] = useState(() => Date.now() + 120000)
  const [observed, setObserved] = useState(() => Date.now())
  const serverTime = Date.parse(retryAfter || '')
  const retryAt = Math.max(
    notBefore,
    Number.isFinite(serverTime) ? serverTime : 0,
  )
  const ready = observed >= retryAt
  const secondsLeft = Math.max(0, (retryAt - observed) / 1000)
  useEffect(() => {
    if (ready) return
    const timer = setInterval(() => setObserved(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ready])
  async function resume() {
    if (!ready || locked) return
    const now = Date.now()
    setNotBefore(now + 120000)
    setObserved(now)
    const failure = await recover()
    if (failure?.retryAfterMs)
      setNotBefore(Date.now() + Math.max(120000, failure.retryAfterMs))
  }
  return (
    <div className="notice billing-recovery-notice" aria-label="Recover pending billing">
      <div>
        <p>
          {busy
            ? 'Recovering the existing billing setup…'
            : ready
              ? 'If payment is still pending, resume the existing billing setup. This recovers the original request and does not start a new one.'
              : `Billing is still processing. Recovery unlocks in ${formatWait(secondsLeft)}.`}
        </p>
        <Action
          variant="secondary"
          disabled={!ready || locked}
          onClick={resume}
        >
          {busy ? (
            <>
              <RefreshCw size={15} className="spin" aria-hidden="true" />
              Recovering…
            </>
          ) : checkout ? (
            'Resume existing Checkout'
          ) : (
            'Recover existing billing setup'
          )}
        </Action>
      </div>
    </div>
  )
}

function CancelBeforeAccess({ path, close, saved }) {
  const mutation = useMutation()
  return (
    <Dialog
      title="Cancel before workspace access"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <p>
        Canceling preserves prepared workspace data. Any existing invoices
        remain subject to review; this does not promise a refund or no charge.
        Cancellation after workspace activation requires support review.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (await mutation.run('post', `${path}/cancel-before-access`, {}))
            saved()
        }}
      >
        <SaveFooter
          mutation={mutation}
          close={close}
          label="Confirm cancellation"
        />
      </form>
    </Dialog>
  )
}

function StartSubscription({ path, preview, reload }) {
  const [consent, setConsent] = useState(false)
  const mutation = useMutation()
  const offer = preview.offer
  async function start(event) {
    event.preventDefault()
    if (
      await mutation.run('post', `${path}/start`, {
        expectedOfferRevision: offer.revision,
        recurringConsent: true,
        termsVersion: preview.consent.termsVersion,
      })
    )
      reload()
  }
  return (
    <section className="panel">
      <h2>Your card is saved</h2>
      <p className="notice">
        Your subscription has not started. Review the exact agreement and choose
        when to start it.
      </p>
      <div className="billing-phases">
        {offer.phases.map((phase, index) => (
          <div className="price-phase" key={index}>
            <span className="eyebrow">
              {phase.kind === 'standard'
                ? 'THEN, ONGOING'
                : phase.kind.toUpperCase()}
            </span>
            <strong>{money(phase.unitAmountMinor, offer.currency)}</strong>
            <small>per seat / {offer.interval}</small>
            <small>
              {phase.months == null
                ? 'Renews monthly'
                : `For ${phase.months} months`}
            </small>
          </div>
        ))}
      </div>
      <form onSubmit={start}>
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={consent}
            disabled={mutation.pending || mutation.uncertain}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            I explicitly agree to start recurring billing under these terms (
            {preview.consent.termsVersion}).{' '}
            <a
              className="app-link"
              href={preview.consent.termsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Read recurring terms
            </a>
          </span>
        </label>
        <ErrorNotice error={mutation.error} retry={reload} />
        {mutation.uncertain && (
          <p className="notice">
            Retry the same start request to recover its result safely. Do not
            create another subscription.
          </p>
        )}
        <Action type="submit" disabled={!consent || mutation.pending}>
          {mutation.pending
            ? 'Starting subscription…'
            : mutation.uncertain
              ? 'Retry subscription start'
              : 'Start subscription'}
        </Action>
      </form>
    </section>
  )
}

function CheckoutOffer({ path, preview, flowVersion, reload }) {
  const [consent, setConsent] = useState(false)
  const [linkError, setLinkError] = useState(null)
  const mutation = useMutation()
  const subscriptionCheckout = flowVersion != null ? flowVersion === 4 : preview.checkoutMode === 'subscription'
  const startTrial = subscriptionCheckout && preview.firstCharge?.trialMonths > 0
  async function checkout(event) {
    event.preventDefault()
    const result = await mutation.run('post', `${path}/checkout`, {
      expectedOfferRevision: preview.offer.revision,
      recurringConsent: true,
      termsVersion: preview.consent.termsVersion,
    })
    if (result) {
      try {
        window.location.assign(paymentDestination(result.data.checkoutUrl))
      } catch (error) {
        setLinkError(error)
      }
    }
  }
  return (
    <>
      <form onSubmit={checkout}>
        <CheckoutTerms
          preview={preview}
          subscriptionCheckout={subscriptionCheckout}
          checked={consent}
          change={setConsent}
          disabled={mutation.pending || mutation.uncertain}
        >
          <ErrorNotice error={mutation.error || linkError} />
          {mutation.error?.code === 'OFFER_REVISION_CONFLICT' && (
            <Action variant="secondary" onClick={reload}>
              Reload offer and review again
            </Action>
          )}
          {['BILLING_BUSY', 'CHECKOUT_ALREADY_STARTED'].includes(mutation.error?.code) && (
            <Action variant="secondary" onClick={reload}>Check existing payment status</Action>
          )}
          {mutation.uncertain && (
            <p className="notice">
              Retry this same Checkout request to recover the existing attempt.
            </p>
          )}
          <Action
            type="submit"
            disabled={!consent || !preview.checkoutAllowed || mutation.pending}
          >
            {mutation.pending
              ? 'Preparing secure Checkout…'
              : mutation.uncertain
                ? 'Retry same Checkout'
                : subscriptionCheckout
                  ? startTrial ? 'Start trial' : 'Pay and subscribe'
                  : 'Continue to secure Checkout'}
            <ExternalLink size={15} />
          </Action>
        </CheckoutTerms>
      </form>
    </>
  )
}
