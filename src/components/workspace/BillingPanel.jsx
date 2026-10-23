import { dateLabel, money } from '../../utils/format'
import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { mutate, paymentDestination } from '../../services/workspace'
import { Action, ErrorNotice, Loading, Status } from './Elements'

export function BillingPanel({ applicationId, changed }) {
  const path = `/applications/${applicationId}/billing`
  const offer = useResource(`${path}/offer`)
  const billing = useResource(path)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [recovery, setRecovery] = useState(null)
  function reload() {
    offer.reload()
    billing.reload()
    changed?.()
  }
  async function reconcile(action) {
    setBusy(true)
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
    } finally {
      setBusy(false)
    }
  }
  if (offer.loading || billing.loading)
    return <Loading label="Loading your billing details…" />
  if (offer.error || billing.error)
    return <ErrorNotice error={offer.error || billing.error} retry={reload} />
  const status = billing.data
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
          preview={offer.data}
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
      ) : status.flowVersion === 2 && offer.data.state === 'awaiting_start' ? (
        <StartSubscription path={path} preview={offer.data} reload={reload} />
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
          <p className="muted">
            Payment confirmation comes from the billing service. A return from
            Stripe may still need a status refresh.
          </p>
        </>
      )}
      {recovery && (
        <div className="notice">
          <div>
            <p>
              {String(recovery.state).replaceAll('_', ' ')} ·{' '}
              {String(recovery.reason || recovery.nextAction).replaceAll(
                '_',
                ' ',
              )}
            </p>
            {recovery.paymentUrl && (
              <a className="button" href={recovery.paymentUrl} rel="noreferrer">
                Continue secure payment <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>
      )}
      <div className="actions" style={{ marginTop: '1.5rem' }}>
        <Action
          variant="secondary"
          disabled={busy}
          onClick={() => reconcile('refresh')}
        >
          <RefreshCw size={15} />
          {busy ? 'Checking…' : 'Refresh billing status'}
        </Action>
        {offer.data.state === 'billing_started' && (
          <Action
            variant="secondary"
            disabled={busy}
            onClick={() => reconcile('recovery')}
          >
            Resume payment / recover
          </Action>
        )}
      </div>
    </section>
  )
}

function StartSubscription({ path, preview, reload }) {
  const [consent, setConsent] = useState(false)
  const mutation = useMutation()
  const offer = preview.offer
  async function start(event) {
    event.preventDefault()
    if (await mutation.run('post', `${path}/start`, {
      expectedOfferRevision: offer.revision,
      recurringConsent: true,
      termsVersion: preview.consent.termsVersion,
    })) reload()
  }
  return <section className="panel">
    <h2>Your card is saved</h2>
    <p className="notice">Your subscription has not started. Review the exact agreement and choose when to start it.</p>
    <div className="billing-phases">{offer.phases.map((phase, index) => <div className="price-phase" key={index}><span className="eyebrow">{phase.kind === 'standard' ? 'THEN, ONGOING' : phase.kind.toUpperCase()}</span><strong>{money(phase.unitAmountMinor, offer.currency)}</strong><small>per seat / {offer.interval}</small><small>{phase.months == null ? 'Renews monthly' : `For ${phase.months} months`}</small></div>)}</div>
    <form onSubmit={start}><label className="check-label"><input type="checkbox" required checked={consent} disabled={mutation.pending || mutation.uncertain} onChange={(event) => setConsent(event.target.checked)} /><span>I explicitly agree to start recurring billing under these terms ({preview.consent.termsVersion}).</span></label><ErrorNotice error={mutation.error} retry={reload} />{mutation.uncertain && <p className="notice">Retry the same start request to recover its result safely. Do not create another subscription.</p>}<Action type="submit" disabled={!consent || mutation.pending}>{mutation.pending ? 'Starting subscription…' : mutation.uncertain ? 'Retry subscription start' : 'Start subscription'}</Action></form>
  </section>
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
      <div className="billing-phases">
        {preview.offer.phases.map((phase, index) => (
          <div className="price-phase" key={index}>
            <span className="eyebrow">
              {phase.kind === 'standard'
                ? 'THEN, ONGOING'
                : phase.kind.toUpperCase()}
            </span>
            <strong>
              {money(phase.unitAmountMinor, preview.offer.currency)}
            </strong>
            <small>per seat / {preview.offer.interval}</small>
            <small>
              {phase.months == null
                ? 'Renews monthly'
                : `For ${phase.months} month${phase.months === 1 ? '' : 's'}`}
            </small>
          </div>
        ))}
      </div>
      <p className="muted">
        Starts with {preview.initialQuantity} owner seat. Pending invitations
        reserve paid seats. Card details are required during free phases.{' '}
        {preview.taxes === 'not_enabled'
          ? 'Tax calculation is not enabled.'
          : ''}
      </p>
      <form onSubmit={checkout}>
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={consent}
            disabled={mutation.pending || mutation.uncertain}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            I agree to recurring billing at the prices and durations shown
            above.{' '}
            <a
              className="app-link"
              href={preview.consent.termsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Read recurring terms
            </a>{' '}
            ({preview.consent.termsVersion}).
          </span>
        </label>
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
