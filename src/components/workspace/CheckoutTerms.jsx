import { money } from '../../utils/format'

export function CheckoutTerms({ preview, checked, change, disabled = false }) {
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
    </>
  )
}
