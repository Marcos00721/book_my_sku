import { displayPricingValue } from '../../utils/formatPrice'
import { sortPriceTiers } from '../../schemas/pricingFormSchema'

export function PricingSummary({ schedules }) {
  const drafts = schedules || []
  const tierCount = drafts.reduce(
    (sum, schedule) => sum + (schedule.rules?.tiers?.length || 0),
    0,
  )

  if (!drafts.length) return null

  return (
    <div className="pricing-summary" aria-live="polite">
      <p>
        {drafts.length} schedule{drafts.length === 1 ? '' : 's'}
        {tierCount
          ? ` · ${tierCount} quantity tier${tierCount === 1 ? '' : 's'}`
          : ''}
      </p>
    </div>
  )
}

export function ScheduleTierSummary({ rules, cost }) {
  if (!rules?.tiers?.length) return null
  const tiers = sortPriceTiers(rules.tiers)
  const first = tiers[0]
  const last = tiers[tiers.length - 1]
  return (
    <p className="pricing-summary-inline muted">
      {tiers.length} tier{tiers.length === 1 ? '' : 's'} · qty {first.min}–
      {last.maxExclusive - 1}
      {cost && first.net != null
        ? ` · first tier ${displayPricingValue(first.net)} USD / ${first.netBasis === 'procurement_unit' ? 'purchase unit' : 'item'}`
        : ''}
    </p>
  )
}
