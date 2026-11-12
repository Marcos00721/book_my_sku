import { dateLabel, money } from '../../utils/format'
import { useEffect, useRef, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
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
  function reload() {
    if (!snapshot) {
      offerResource.reload()
      billingResource.reload()
    }
    changed?.()
  }
  async function reconcile(action) {
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
  }
  // Workspace billing page: sync once on open so writes unlock without a
  // manual click. Setup waiting states keep refresh disabled/manual.
  useEffect(() => {
    if (autoRefreshDone.current || snapshot || waiting) return
    if (offer.loading || billing.loading || offer.error || billing.error) return
    if (!billing.data) return
    autoRefreshDone.current = true
    void reconcile('refresh')
  }, [
    snapshot,
    waiting,
    offer.loading,
    offer.error,
    billing.loading,
    billing.error,
    billing.data,
  ])
  if (offer.loading || billing.loading)
    return <Loading label="Loading your billing details…" />
  if (offer.error || billing.error)
    return <ErrorNotice error={offer.error || billing.error} retry={reload} />
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
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>One workspace. Room for your whole team.</h2>
          <p className="muted">
            Review your agreed offer and keep payment details up to date.
          </p>
        </div>
        <Status value={status.status} />
      </div>
      <ErrorNotice error={error} />
      {offer.data.state === 'available' ? (
        <CheckoutOffer
          key={`${offer.data.offer.revision}:${offer.data.consent.termsVersion}`}
          path={path}
          preview={
            snapshot
              ? {
                  ...offer.data,
                  checkoutAllowed:
                    offer.data.checkoutAllowed &&
                    snapshot.platform?.ready === true &&
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
        <>
          <dl className="detail-list">
            <div>
              <dt>Subscription</dt>
              <dd>
                <Status value={status.status} />
              </dd>
            </div>
            <div>
              <dt>Paid seats</dt>
              <dd>{status.quantity}</dd>
            </div>
            <div>
              <dt>Payment verified</dt>
              <dd>
                {status.billingEligible
                  ? 'Verified'
                  : 'Awaiting current verification'}
              </dd>
            </div>
            <div>
              <dt>Synchronization</dt>
              <dd>{String(status.synchronization).replaceAll('_', ' ')}</dd>
            </div>
            {Object.entries(status.dates || {})
              .filter(
                ([, value]) =>
                  typeof value === 'string' || typeof value === 'number',
              )
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
                  <dd>{dateLabel(value)}</dd>
                </div>
              ))}
          </dl>
          {status.terms && (
            <p className="muted">
              Agreed standard price:{' '}
              {money(
                status.terms.unitAmountMinor,
                status.terms.currency || 'USD',
              )}{' '}
              per seat / month
              {status.terms.trialMonths
                ? `, after ${status.terms.trialMonths} trial months`
                : ''}
              . Accepted offer revision {status.offerRevision}.
            </p>
          )}
          {status.terms?.discount && status.terms.discount.type !== 'none' && (
            <p className="muted">
              Introductory discount:{' '}
              {status.terms.discount.type === 'percent'
                ? `${status.terms.discount.percent}%`
                : money(
                    status.terms.discount.amountMinor,
                    status.terms.currency,
                  )}{' '}
              off per seat for {status.terms.discount.months} months.
            </p>
          )}
          {!pendingRecovery && (
            <p className="muted">
              Payment confirmation comes from the billing service. A return from
              Stripe may still need a status refresh.
            </p>
          )}
        </>
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
      <div
        className="actions"
        style={{ marginTop: pendingRecovery || busy || waiting ? '1rem' : '1.5rem' }}
        aria-busy={busy || undefined}
      >
        {status.flowVersion === 2 && status.status !== 'canceled' && (
          <Action
            variant="secondary"
            disabled={busy}
            onClick={() => setCanceling(true)}
          >
            Cancel before workspace access
          </Action>
        )}
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

function CheckoutOffer({ path, preview, reload }) {
  const [consent, setConsent] = useState(false)
  const [linkError, setLinkError] = useState(null)
  const mutation = useMutation()
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
          checked={consent}
          change={setConsent}
          disabled={mutation.pending || mutation.uncertain}
        />
        <ErrorNotice error={mutation.error || linkError} />
        {mutation.error?.code === 'OFFER_REVISION_CONFLICT' && (
          <Action variant="secondary" onClick={reload}>
            Reload offer and review again
          </Action>
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
              : 'Continue to secure Checkout'}
          <ExternalLink size={15} />
        </Action>
      </form>
    </>
  )
}
