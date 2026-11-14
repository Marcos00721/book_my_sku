import { useState } from 'react'
import { Action, Dialog, Field, SaveFooter } from '../workspace/Elements'
import { ConflictReview } from '../workspace/RecordTools'
import { useMutation } from '../../hooks/useMutation'
import { PricingVariantSelect } from './PricingVariantSelect'
import {
  PRICE_KEY_PATTERN,
  PRICE_RATE_PATTERN,
  blankPricingRules,
  nextPricingKey,
  normalizePricingRules,
  pricingRulesSchema,
} from '../../schemas/pricingFormSchema'

const wheel = (event) => event.currentTarget.blur()

export function ScheduleEditor({
  path,
  schedule,
  cost,
  editable,
  close,
  saved,
}) {
  const [rules, setRules] = useState(() =>
    structuredClone(schedule?.rules || blankPricingRules()),
  )
  const [sales, setSales] = useState(() =>
    structuredClone(
      schedule?.sales ||
        schedule?.rules?.variants?.map(({ id, sale }) => ({ id, sale })) ||
        [],
    ),
  )
  const [revision, setRevision] = useState(schedule?.revision)
  const [errors, setErrors] = useState([])
  const mutation = useMutation()
  const set = (key, value) =>
    setRules((current) => ({ ...current, [key]: value }))
  const tier = (index, patch) =>
    setRules((current) => ({
      ...current,
      tiers: current.tiers.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }))
  function variant(index, patch) {
    setRules((current) => ({
      ...current,
      variants: current.variants.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
      poolEligible:
        patch.id && patch.id !== current.variants[index].id
          ? current.poolEligible.filter(
              (id) => id !== current.variants[index].id,
            )
          : current.poolEligible,
    }))
  }
  async function submit(event) {
    event.preventDefault()
    let payload
    if (cost) {
      const parsed = pricingRulesSchema.safeParse({
        ...rules,
        tiers: rules.tiers.map((row) => ({
          ...row,
          net: row.net ?? '',
          list: row.list ?? '',
        })),
        variants: rules.variants.map((row) => ({
          ...row,
          sale: row.sale ?? '',
        })),
      })
      if (!parsed.success) {
        setErrors([
          ...new Set(parsed.error.issues.map((issue) => issue.message)),
        ])
        return
      }
      payload = {
        ...(schedule ? { expectedRevision: revision } : {}),
        rules: normalizePricingRules(parsed.data),
      }
    } else payload = { expectedRevision: revision, sales }
    setErrors([])
    const target = `${path}/pricing/schedules${schedule ? `/${schedule.id}${cost ? '' : '/sales'}` : ''}`
    if (await mutation.run(schedule ? 'patch' : 'post', target, payload))
      saved()
  }
  function addTier() {
    const start = rules.tiers.length
      ? Math.max(...rules.tiers.map((row) => Number(row.maxExclusive)))
      : 1
    set('tiers', [
      ...rules.tiers,
      {
        id: nextPricingKey('tier', rules.tiers),
        min: start,
        maxExclusive: Math.min(start + 100, 100000001),
        net: null,
        list: null,
      },
    ])
  }
  return (
    <Dialog
      title={schedule ? 'Edit pricing draft' : 'Add pricing'}
      description="Set supplier costs and your selling prices. Save a draft, then publish when ready."
      close={close}
      locked={mutation.pending || mutation.uncertain}
      size="xl"
      className="product-form-dialog"
    >
      <form className="product-form pricing-schedule-form" onSubmit={submit}>
        <div className="product-form-body">
          <fieldset
            disabled={!editable || mutation.pending || mutation.uncertain}
            className="product-form-fields"
          >
            {cost ? (
              <>
                <section className="product-form-section">
                  <h3>1. Name this price list</h3>
                  <Field
                    label="Price list name"
                    placeholder="e.g. standard-2026"
                    required
                    pattern={PRICE_KEY_PATTERN}
                    maxLength={64}
                    hint="Use letters, numbers, hyphens or underscores. All prices are in USD."
                    value={rules.agreementId}
                    onChange={(event) => set('agreementId', event.target.value)}
                  />
                  <details className="product-advanced">
                    <summary>Account and warehouse labels</summary>
                    <p className="product-form-hint">
                      Local labels distinguish pricing terms. Use the same
                      labels when previewing prices.
                    </p>
                    <div className="form-grid">
                      {[
                        ['accountId', 'Supplier account label'],
                        ['warehouseId', 'Warehouse label'],
                      ].map(([key, label]) => (
                        <Field
                          key={key}
                          label={label}
                          required
                          pattern={PRICE_KEY_PATTERN}
                          maxLength={64}
                          value={rules[key]}
                          onChange={(event) => set(key, event.target.value)}
                        />
                      ))}
                    </div>
                  </details>
                </section>
                <section className="product-form-section">
                  <div className="pricing-section-head">
                    <h3>2. Enter supplier costs</h3>
                    <Action
                      variant="secondary"
                      disabled={
                        rules.tiers.length >= 100 ||
                        rules.tiers.some((row) => row.maxExclusive >= 100000001)
                      }
                      onClick={addTier}
                    >
                      Add quantity tier
                    </Action>
                  </div>
                  <p className="product-form-hint">
                    Quantity ranges count purchased individual items, even when
                    the supplier charges per box. Leave an unknown cost blank;
                    enter 0 only for a confirmed zero cost.
                  </p>
                  {rules.tiers.map((row, index) => (
                    <section
                      className="panel pricing-tier-card"
                      key={row.id}
                      aria-label={`Price tier ${index + 1}`}
                    >
                      <div className="pricing-tier-card-head">
                        <h4>Quantity tier {index + 1}</h4>
                        <Action
                          variant="text-button"
                          onClick={() =>
                            set(
                              'tiers',
                              rules.tiers.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Remove tier {index + 1}
                        </Action>
                      </div>
                      <div className="form-grid">
                        <Field
                          label="From quantity"
                          type="number"
                          min="1"
                          max="100000000"
                          step="1"
                          required
                          value={row.min}
                          onChange={(event) =>
                            tier(index, { min: event.target.value })
                          }
                          onWheel={wheel}
                        />
                        <Field
                          label="Through quantity"
                          type="number"
                          min="1"
                          max="100000000"
                          step="1"
                          required
                          value={
                            row.maxExclusive === ''
                              ? ''
                              : Number(row.maxExclusive) - 1
                          }
                          hint="Includes this quantity. For example, 1 through 100."
                          onChange={(event) =>
                            tier(index, {
                              maxExclusive:
                                event.target.value === ''
                                  ? ''
                                  : Number(event.target.value) + 1,
                            })
                          }
                          onWheel={wheel}
                        />
                        <Field
                          label="Supplier charges per"
                          value={row.netBasis || 'base_item'}
                          onChange={(event) =>
                            tier(index, { netBasis: event.target.value })
                          }
                        >
                          <option value="base_item">Individual item</option>
                          <option value="procurement_unit">
                            Purchase unit
                          </option>
                        </Field>
                        <Field
                          label={
                            row.netBasis === 'procurement_unit'
                              ? 'Supplier cost per purchase unit (USD)'
                              : 'Supplier cost per item (USD)'
                          }
                          inputMode="decimal"
                          pattern={PRICE_RATE_PATTERN}
                          value={row.net ?? ''}
                          onChange={(event) =>
                            tier(index, { net: event.target.value || null })
                          }
                        />
                      </div>
                      {row.netBasis === 'procurement_unit' && (
                        <p className="notice">
                          Enter the full price for one purchase unit. For
                          example, $24 per box of 12 items. Packaging comes from
                          each selected variant.
                        </p>
                      )}
                      <details className="product-advanced">
                        <summary>Reference list price (optional)</summary>
                        <Field
                          label="Reference list price per item (USD)"
                          inputMode="decimal"
                          pattern={PRICE_RATE_PATTERN}
                          value={row.list ?? ''}
                          hint="For reference only. Your selling price is entered below."
                          onChange={(event) =>
                            tier(index, { list: event.target.value || null })
                          }
                        />
                      </details>
                    </section>
                  ))}
                  {!rules.tiers.length && (
                    <p className="notice">
                      No supplier cost tiers. Selling prices can still be saved,
                      but costs will be incomplete.
                    </p>
                  )}
                </section>
                <section className="product-form-section">
                  <div className="pricing-section-head">
                    <h3>3. Set selling prices by variant</h3>
                    <Action
                      variant="secondary"
                      disabled={rules.variants.length >= 100}
                      onClick={() =>
                        set('variants', [
                          ...rules.variants,
                          { id: '', netPremium: '0', sale: null },
                        ])
                      }
                    >
                      Add variant price
                    </Action>
                  </div>
                  <p className="product-form-hint">
                    Selling prices are always per individual item. They are
                    entered directly and are independent of supplier cost.
                  </p>
                  {!rules.variants.length && (
                    <p>
                      Choose Add variant price to include the variants this
                      price list covers.
                    </p>
                  )}
                  {rules.variants.map((row, index) => (
                    <section
                      className="panel pricing-variant-card"
                      key={`variant-${index}`}
                    >
                      <PricingVariantSelect
                        path={path}
                        label={`Pricing variant ${index + 1}`}
                        required
                        value={row.id}
                        excluded={rules.variants.map((item) => item.id)}
                        showPackaging
                        change={(id) => variant(index, { id })}
                      />
                      <Field
                        label="Selling price per item (USD)"
                        inputMode="decimal"
                        pattern={PRICE_RATE_PATTERN}
                        value={row.sale ?? ''}
                        hint="Leave blank if the selling price is not yet known."
                        onChange={(event) =>
                          variant(index, { sale: event.target.value || null })
                        }
                      />
                      <details className="product-advanced">
                        <summary>
                          Variant cost adjustment and quantity pooling
                        </summary>
                        <Field
                          label="Extra supplier cost per item (USD)"
                          required
                          inputMode="decimal"
                          pattern={PRICE_RATE_PATTERN}
                          value={row.netPremium}
                          hint="Added to supplier cost for this variant. Use 0 when there is no extra cost."
                          onChange={(event) =>
                            variant(index, { netPremium: event.target.value })
                          }
                        />
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={rules.poolEligible.includes(row.id)}
                            disabled={!row.id}
                            onChange={(event) =>
                              set(
                                'poolEligible',
                                event.target.checked
                                  ? [
                                      ...new Set([
                                        ...rules.poolEligible,
                                        row.id,
                                      ]),
                                    ]
                                  : rules.poolEligible.filter(
                                      (id) => id !== row.id,
                                    ),
                              )
                            }
                          />
                          Allow quantity pooling under this agreement
                        </label>
                        <p className="product-form-hint">
                          Only enable this when the supplier agreement allows
                          combining variant quantities for a price tier.
                        </p>
                      </details>
                      <Action
                        variant="text-button"
                        onClick={() =>
                          setRules((current) => ({
                            ...current,
                            variants: current.variants.filter(
                              (_, i) => i !== index,
                            ),
                            poolEligible: current.poolEligible.filter(
                              (id) => id !== row.id,
                            ),
                          }))
                        }
                      >
                        Remove variant price {index + 1}
                      </Action>
                    </section>
                  ))}
                </section>
              </>
            ) : (
              <>
                <p className="product-form-hint">
                  Update the selling price per individual item for the existing
                  variants.
                </p>
                {sales.map((row, index) => (
                  <Field
                    key={row.id}
                    label={`Selling price per item · ${row.id}`}
                    inputMode="decimal"
                    pattern={PRICE_RATE_PATTERN}
                    value={row.sale ?? ''}
                    onChange={(event) =>
                      setSales((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, sale: event.target.value || null }
                            : item,
                        ),
                      )
                    }
                  />
                ))}
              </>
            )}
          </fieldset>
          {errors.length > 0 && (
            <div className="notice error-notice" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
          {schedule && (
            <ConflictReview
              error={mutation.error}
              path={`${path}/pricing/schedules/${schedule.id}?kind=draft`}
              values={cost ? { rules } : { sales }}
              onReview={(current) => setRevision(current.revision)}
            />
          )}
        </div>
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!editable || (cost && !rules.variants.length)}
          label="Save pricing draft"
        />
      </form>
    </Dialog>
  )
}
