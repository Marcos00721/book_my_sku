import { displayPricingValue } from '../../utils/formatPrice'
import { sortPriceTiers } from '../../schemas/pricingFormSchema'

export function RateSummary({ schedule, cost }) {
  const tiers = sortPriceTiers(schedule.rules?.tiers || [])
  const variants =
    cost && schedule.rules ? schedule.rules.variants : schedule.sales || []

  return (
    <div className="pricing-rate-summary">
      {cost && schedule.rules && (
        <div className="table-scroll">
          <table className="data-table pricing-table">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Purchased quantity</th>
                <th scope="col" className="pricing-num">
                  Supplier cost (USD)
                </th>
                <th scope="col" className="pricing-num">
                  Reference list / item
                </th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id}>
                  <th scope="row">{tier.id}</th>
                  <td>
                    {tier.min}–{tier.maxExclusive - 1}
                  </td>
                  <td className="pricing-num">
                    {displayPricingValue(tier.net)} /{' '}
                    {tier.netBasis === 'procurement_unit'
                      ? 'purchase unit'
                      : 'item'}
                  </td>
                  <td className="pricing-num">
                    {displayPricingValue(tier.list)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table pricing-table">
          <thead>
            <tr>
              <th scope="col">Variant</th>
              {cost && (
                <th scope="col" className="pricing-num">
                  Extra supplier cost / item
                </th>
              )}
              <th scope="col" className="pricing-num">
                Selling price / item
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id}>
                <th scope="row">{variant.id}</th>
                {cost && (
                  <td className="pricing-num">
                    {displayPricingValue(variant.netPremium)}
                  </td>
                )}
                <td className="pricing-num">
                  {displayPricingValue(variant.sale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
