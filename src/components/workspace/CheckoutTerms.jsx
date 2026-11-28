import { dateLabel, money } from '../../utils/format'

export function CheckoutTerms({
  preview,
  checked,
  change,
  disabled = false,
  subscriptionCheckout = preview.checkoutMode === 'subscription',
  children,
}) {
  return (
    <div className={children ? 'billing-checkout-layout' : undefined}>
      <div className={children ? 'billing-offer-details' : undefined}>
        {children && <h3>Plan pricing</h3>}
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
              {subscriptionCheckout && <p>{preview.initialQuantity} seat{preview.initialQuantity === 1 ? '' : 's'} × {money(phase.unitAmountMinor, preview.offer.currency)} = <strong>{money(phase.unitAmountMinor * preview.initialQuantity, preview.offer.currency)}</strong> / {preview.offer.interval}</p>}
              <small>
                {phase.months == null
                  ? 'Renews monthly'
                  : `For ${phase.months} month${phase.months === 1 ? '' : 's'}`}
              </small>
            </div>
          ))}
        </div>
        {subscriptionCheckout && preview.firstCharge && (
          <div className="notice" aria-label="First charge estimate">
            <p>
              {preview.firstCharge.trialMonths > 0 ? 'First installment after the trial: ' : 'First installment at Checkout: '}
              <strong>{money(preview.firstCharge.amountMinor, preview.firstCharge.currency)}</strong>
              {' '}total for {preview.firstCharge.quantity} seat{preview.firstCharge.quantity === 1 ? '' : 's'}.
            </p>
            {preview.firstCharge.trialMonths > 0 && (
              <p>
                Estimated date: {dateLabel(preview.firstCharge.estimatedAt)} if you complete Checkout now.
                {' '}Your {preview.firstCharge.trialMonths}-month trial starts when Checkout creates your subscription; the actual charge date depends on when you complete it.
              </p>
            )}
            {preview.firstCharge.amountMinor === 0 && <p>This installment is zero due. Review the later paid phases above.</p>}
          </div>
        )}
        <p className="muted">
          {subscriptionCheckout
            ? `Includes ${preview.initialQuantity} paid seat${preview.initialQuantity === 1 ? '' : 's'}, including you. Invitations use available purchased seats; additional seats may cost extra.`
            : `Starts with ${preview.initialQuantity} owner seat. Pending invitations reserve paid seats.`}
          {' '}Card details are required during free phases.{' '}
          {preview.taxes === 'not_enabled'
            ? 'Tax calculation is not enabled.'
            : ''}
        </p>
      </div>
      <div className={children ? 'billing-consent' : undefined}>
        {children && <h3>Review &amp; continue</h3>}
        {children && <p className="muted">Review your plan and accept the recurring terms to continue to secure payment.</p>}
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={checked}
            disabled={disabled}
            onChange={(event) => change(event.target.checked)}
          />
          <span>
            I agree to recurring billing at the prices and durations shown above.{' '}
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
        {children}
      </div>
    </div>
  )
}
