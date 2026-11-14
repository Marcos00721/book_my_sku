import { useRef, useState } from 'react'
import { Action, ErrorNotice, Field } from '../workspace/Elements'
import { PricingVariantSelect } from './PricingVariantSelect'
import { PRICE_KEY_PATTERN } from '../../schemas/pricingFormSchema'
import { displayPricingValue } from '../../utils/formatPrice'
import { previewPricing } from '../../services/pricingApi'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { Pager } from '../workspace/RecordTools'

function preventWheelChange(event) {
  event.currentTarget.blur()
}

const unknownReason = (code) =>
  ({
    CONVERSION_UNKNOWN: 'Confirm items per purchase unit',
    MOQ_UNKNOWN: 'Confirm the minimum purchase quantity',
    MULTIPLE_UNKNOWN: 'Confirm the purchase multiple',
    POOL_QUANTITY_UNKNOWN: 'A pooled variant has an unknown purchase quantity',
    TIER_MISSING: 'No supplier cost tier covers this quantity',
    NET_UNKNOWN: 'Supplier cost is missing',
    SALE_UNKNOWN: 'Selling price is missing',
  })[code] || code.replaceAll('_', ' ').toLowerCase()

export function GoodsPreview({ path, cost, historical }) {
  const form = useRef(null)
  const pending = useRef(false)
  const [pages, setPages] = useState([])
  const schedules = useResource(
    historical
      ? null
      : queryPath(`${path}/pricing/schedules`, {
          kind: 'published',
          limit: 25,
          after: pages.at(-1),
        }),
  )
  const [selected, setSelected] = useState('')
  const [coveredVariants, setCoveredVariants] = useState(null)
  const [values, setValues] = useState(() => ({
    accountId: historical?.accountId || '',
    warehouseId: historical?.warehouseId || '',
    agreementId: historical?.agreementId || '',
    asOf: (() => {
      const now = new Date()
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      return now.toISOString().slice(0, 16)
    })(),
  }))
  const [lines, setLines] = useState([
    {
      id: 'line_1',
      variantId:
        historical?.rules?.variants?.[0]?.id ||
        historical?.sales?.[0]?.id ||
        '',
      demandEach: 1,
      pool: false,
    },
  ])
  const [state, setState] = useState({
    pending: false,
    error: null,
    result: null,
    fingerprint: null,
  })
  const fingerprint = JSON.stringify({ values, lines })

  async function calculate(fresh = false) {
    if (!form.current?.reportValidity() || pending.current) return
    pending.current = true
    setState((current) => ({ ...current, pending: true, error: null }))
    try {
      const result = await previewPricing(path, {
        ...values,
        ...(historical ? { versionId: historical.id } : {}),
        asOf: new Date(values.asOf).toISOString(),
        lines,
        ...(!fresh && state.result && state.fingerprint === fingerprint
          ? { expected: state.result.sources }
          : {}),
      })
      setState({
        pending: false,
        error: null,
        result,
        fingerprint,
      })
    } catch (error) {
      setState((current) => ({ ...current, pending: false, error }))
    } finally {
      pending.current = false
    }
  }

  const result =
    state.fingerprint === fingerprint && !state.error ? state.result : null

  return (
    <div className="pricing-preview">
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault()
          void calculate()
        }}
      >
        <fieldset disabled={state.pending}>
          {historical ? (
            <p className="notice">
              Historical preview: using this version’s saved rates and
              packaging. Current product corrections are not applied.
            </p>
          ) : (
            <>
              <ErrorNotice error={schedules.error} retry={schedules.reload} />
              <label className="field">
                <span>Published price list</span>
                <select
                  aria-label="Published price list"
                  value={selected}
                  disabled={schedules.loading || Boolean(schedules.error)}
                  onChange={(event) => {
                    const schedule = schedules.data?.items?.find(
                      (item) => item.id === event.target.value,
                    )
                    setSelected(event.target.value)
                    setCoveredVariants(
                      schedule
                        ? (
                            schedule.rules?.variants ||
                            schedule.sales ||
                            []
                          ).map((item) => item.id)
                        : null,
                    )
                    if (schedule)
                      setValues((current) => ({
                        ...current,
                        accountId: schedule.accountId,
                        warehouseId: schedule.warehouseId,
                        agreementId: schedule.agreementId,
                      }))
                  }}
                >
                  <option value="">
                    Choose a price list or enter labels below
                  </option>
                  {selected &&
                    !schedules.data?.items?.some(
                      (item) => item.id === selected,
                    ) && (
                      <option value={selected}>
                        Selected price list: {values.agreementId}
                      </option>
                    )}
                  {schedules.data?.items?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.agreementId} · {item.accountId} / {item.warehouseId}{' '}
                      ·{' '}
                      {item.start
                        ? new Date(item.start).toLocaleDateString()
                        : 'No start date'}
                    </option>
                  ))}
                </select>
              </label>
              {(schedules.data?.next || pages.length > 0) && (
                <Pager
                  resource={schedules}
                  pages={pages}
                  setPages={setPages}
                  label="published price lists"
                />
              )}
            </>
          )}
          <details className="product-advanced" open={!selected && !historical}>
            <summary>Price list labels</summary>
            <div className="form-grid">
              {[
                ['accountId', 'Supplier account label'],
                ['warehouseId', 'Warehouse label'],
                ['agreementId', 'Agreement label'],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  required
                  pattern={PRICE_KEY_PATTERN}
                  maxLength={64}
                  value={values[key]}
                  disabled={Boolean(historical)}
                  onChange={(event) => {
                    setSelected('')
                    setCoveredVariants(null)
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }}
                />
              ))}
            </div>
          </details>
          <div className="form-grid">
            <Field
              label="Pricing as of"
              required
              type="datetime-local"
              value={values.asOf}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  asOf: event.target.value,
                }))
              }
            />
          </div>
          {lines.map((line, index) => (
            <section className="panel" key={line.id}>
              <PricingVariantSelect
                path={path}
                label={`Demand variant ${index + 1}`}
                required
                value={line.variantId}
                excluded={lines.map((item) => item.variantId)}
                allowed={coveredVariants}
                retained={
                  historical
                    ? (
                        historical.rules?.variants ||
                        historical.sales ||
                        []
                      ).map((item, i) => ({
                        ...item,
                        label: `Saved variant ${i + 1}`,
                      }))
                    : undefined
                }
                change={(variantId) =>
                  setLines((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, variantId } : item,
                    ),
                  )
                }
              />
              <Field
                label={`Quantity in items ${index + 1}`}
                type="number"
                min="1"
                max="1000000"
                step="1"
                required
                value={line.demandEach}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, demandEach: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                onWheel={preventWheelChange}
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={line.pool}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, pool: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                Combine quantities under the supplier agreement
              </label>
              <Action
                variant="text-button"
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((current) =>
                    current.filter((item) => item.id !== line.id),
                  )
                }
              >
                Remove variant
              </Action>
            </section>
          ))}
          <Action
            variant="secondary"
            disabled={lines.length >= 100}
            onClick={() =>
              setLines((current) => [
                ...current,
                {
                  id: `line_${crypto.randomUUID()}`,
                  variantId: '',
                  demandEach: 1,
                  pool: false,
                },
              ])
            }
          >
            Add another variant
          </Action>
        </fieldset>
        <div className="pricing-row-actions">
          <Action type="submit" disabled={state.pending}>
            {state.pending ? 'Calculating…' : 'Calculate preview'}
          </Action>
          {state.result && (
            <Action
              variant="secondary"
              disabled={state.pending}
              onClick={() => calculate(true)}
            >
              {historical
                ? 'Recalculate saved version'
                : 'Refresh preview with current sources'}
            </Action>
          )}
        </div>
      </form>
      <ErrorNotice error={state.error} />
      {state.error?.code === 'STALE_SOURCES' && (
        <p className="notice">
          Sources changed. Explicitly refresh the preview before using new
          prices.
        </p>
      )}
      {state.result && !result && !state.error && (
        <p className="notice">Inputs changed. Generate a new preview.</p>
      )}
      {result && (
        <section className="panel pricing-preview-result">
          <h3>Goods preview · {result.currency}</h3>
          <p>
            Selling total: {displayPricingValue(result.goodsSale)} USD
            {!result.saleComplete &&
              ` · Incomplete. Known selling amount: ${displayPricingValue(result.knownSale)} USD.`}
          </p>
          {cost && (
            <p>
              Supplier cost: {displayPricingValue(result.goodsCost)} USD ·
              Estimated profit: {displayPricingValue(result.goodsProfit)} USD
              {!result.costComplete &&
                ` · Incomplete. Known supplier cost: ${displayPricingValue(result.knownCost)} USD.`}
            </p>
          )}
          <details className="product-advanced">
            <summary>Calculation details</summary>
            <p>
              Effective schedule version:{' '}
              {result.sources?.scheduleVersion || 'Unavailable'}
            </p>
            {cost && <p>Margin ratio: {displayPricingValue(result.margin)}</p>}
          </details>
          <div className="table-scroll">
            <table className="data-table pricing-table">
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col">Requested items</th>
                  <th scope="col" className="pricing-num">
                    Sale USD
                  </th>
                  {cost && (
                    <th scope="col" className="pricing-num">
                      Cost USD
                    </th>
                  )}
                  <th scope="col">Missing information</th>
                </tr>
              </thead>
              <tbody>
                {result.components?.map((component) => (
                  <tr key={component.lineId}>
                    <th scope="row">
                      Variant{' '}
                      {lines.findIndex((line) => line.id === component.lineId) +
                        1}
                    </th>
                    <td>{component.demandEach}</td>
                    <td className="pricing-num">
                      {displayPricingValue(component.sale)}
                    </td>
                    {cost && (
                      <td className="pricing-num">
                        {displayPricingValue(component.cost)}
                      </td>
                    )}
                    <td>
                      {component.unknowns?.map(unknownReason).join('; ') ||
                        'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="notice">
            Goods only. Freight, tax and decoration are not included in this
            preview.
          </p>
        </section>
      )}
    </div>
  )
}
