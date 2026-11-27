import { useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { Button } from '../common/Button'
import { TextField } from '../common/TextField'
import { SelectField } from '../common/SelectField'
import { Empty, ErrorNotice, Loading } from '../workspace/Elements'
import { Pager } from '../workspace/RecordTools'
import { variantName } from '../customProducts/variantHelpers'
import {
  buildPriceTables,
  newPriceBreak,
  priceTablesToEditor,
  priceTableValues,
} from '../../utils/priceTable'
import './price-tables.css'

const blockerMessage = (blocker) =>
  ({
    NET_UNKNOWN: 'Enter the missing cost.',
    SALE_UNKNOWN: 'Enter a price or margin %.',
    PROCUREMENT_UNCONFIRMED:
      'Confirm packaging in Product setup before making pricing current.',
    PUBLISH_PERMISSION_REQUIRED:
      'Someone with pricing publish access must save to make these prices current.',
  })[blocker.code || blocker] ||
  'Review product setup and pricing before making these prices current.'

export function PriceTableEditor(props) {
  const [generation, setGeneration] = useState(0)
  const [receipt, setReceipt] = useState(null)
  return (
    <PriceTableWorkspace
      {...props}
      key={generation}
      receipt={receipt}
      setReceipt={setReceipt}
      reload={() => setGeneration((value) => value + 1)}
    />
  )
}

function PriceTableWorkspace({
  path,
  product,
  edit,
  preview,
  cost,
  legacy,
  receipt,
  setReceipt,
  reload,
}) {
  const workspace = useWorkspace()
  const resource = useResource(
    preview && product.status !== 'archived' ? `${path}/pricing/tables` : null,
  )
  if (product.status === 'archived')
    return (
      <Empty title="Pricing is unavailable for archived products">
        Restore the product to view its pricing.
      </Empty>
    )
  // Existing records retain the established editor until their terms are explicitly adopted.
  if (!preview) return legacy
  if (resource.data?.blocker === 'PRICE_TABLE_ADOPTION_REQUIRED')
    return (
      <>
        <p className="notice">
          This product has pricing saved in the previous format. Review it
          below; it needs to be converted before using the simple price tables.
        </p>
        {legacy}
      </>
    )
  if (resource.loading) return <Loading label="Loading pricing…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={reload} />
  if (!Array.isArray(resource.data?.eligibleVariantIds))
    return (
      <ErrorNotice
        error={{ message: 'Pricing could not be loaded. Reload to try again.' }}
        retry={reload}
      />
    )
  const editable =
    edit && cost && workspace.canWrite('products.edit')
  return (
    <div className="product-pricing simple-pricing">
      <div className="section-heading">
        <div>
          <h2>Pricing</h2>
          <p className="product-pricing-lead">
            {editable
              ? 'Enter cost and price. Your margin is calculated for you.'
              : 'Your saved prices, per item.'}
          </p>
        </div>
        <div className="simple-pricing-meta">
          <span>USD / item</span>
          <span className="simple-pricing-status">
            {resource.data.source?.draft &&
            editable &&
            JSON.stringify(resource.data.draft) !==
              JSON.stringify(resource.data.current)
              ? 'Saved draft'
              : resource.data.current?.length
                ? 'Current prices'
                : 'New pricing'}
          </span>
        </div>
      </div>
      {receipt && (
        <div className="notice" role="status">
          <p>
            {receipt.outcome === 'current'
              ? receipt.current
                ? 'Pricing saved and current.'
                : 'Pricing removed.'
              : receipt.outcome === 'draft'
                ? 'Draft saved. Current prices have not changed.'
                : 'Pricing is already saved. Review any remaining requirements below.'}
          </p>
          {receipt.blockers?.length > 0 && (
            <ul>
              {receipt.blockers.map((blocker, i) => (
                <li key={i}>
                  {blockerMessage(blocker)}
                  {blocker.from ? ` (Qty ${blocker.from}+)` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!resource.data.eligibleVariantIds.length && (
        <p className="notice">
          Add a variant in the Variants tab before creating pricing.
        </p>
      )}
      <PriceTablesForm
        key={JSON.stringify([path, resource.data, editable])}
        path={path}
        data={resource.data}
        editable={editable}
        cost={cost}
        reload={reload}
        saved={(result) => {
          setReceipt(result)
          reload()
        }}
      />
    </div>
  )
}

function PriceTablesForm({ path, data, editable, cost, reload, saved }) {
  const eligible = data.eligibleVariantIds
  const initial = editable && data.draft !== null ? data.draft : data.current
  const [startingTables] = useState(() =>
    Array.isArray(initial)
      ? priceTablesToEditor(initial)
      : editable && eligible.length
        ? [freshTable()]
        : [],
  )
  const [tables, setTables] = useState(startingTables)
  const [validation, setValidation] = useState('')
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const dirty = JSON.stringify(tables) !== JSON.stringify(startingTables)
  const conflict = [
    'STALE_SOURCES',
    'PRICE_TABLE_VARIANT_UNAVAILABLE',
    'PRICE_TABLE_ADOPTION_REQUIRED',
    'IDEMPOTENCY_CONFLICT',
  ].includes(mutation.error?.code)

  function freshTable() {
    return {
      key: crypto.randomUUID(),
      name: 'Standard',
      mode: 'all',
      variantIds: [],
      breaks: [newPriceBreak()],
    }
  }
  function update(key, change) {
    mutation.reset()
    setValidation('')
    setTables((current) =>
      current.map((table) =>
        table.key === key ? { ...table, ...change } : table,
      ),
    )
  }
  function addTable() {
    const next = freshTable()
    next.name = tables.length
      ? 'Price table ' + (tables.length + 1)
      : 'Standard'
    if (tables.length) next.mode = 'selected'
    setTables((current) => [...current, next])
    setValidation('')
  }
  async function save(event) {
    event.preventDefault()
    if (locked || conflict) return
    let payload
    try {
      payload = {
        productRevision: data.productRevision,
        source: data.source,
        tables: buildPriceTables(tables, eligible),
      }
      setValidation('')
    } catch (error) {
      setValidation(error.message)
      return
    }
    const result = await mutation.run('post', path + '/pricing/tables', payload)
    if (result) saved(result.data)
  }
  return (
    <form className="simple-pricing-form" onSubmit={save}>
      <fieldset disabled={!editable || locked || conflict}>
        {tables.map((table, index) => (
          <section
            className="simple-price-table"
            key={table.key}
            aria-label={'Price table ' + (index + 1)}
          >
            {(tables.length > 1 || table.name !== 'Standard') && (
              <h3 className="simple-price-table-name">
                {table.name || 'Untitled pricing'}
              </h3>
            )}
            <PriceGrid
              table={table}
              index={index}
              editable={editable}
              cost={cost}
              change={(breaks) => update(table.key, { breaks })}
            />
            {editable ? (
              <details className="simple-pricing-options">
                <summary>
                  Pricing options{' '}
                  <span>
                    {table.mode === 'all'
                      ? 'All current variants'
                      : table.variantIds.length +
                        (table.variantIds.length === 1
                          ? ' variant'
                          : ' variants')}
                  </span>
                  <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <div className="simple-price-table-settings">
                  <TextField
                    label="Price list name"
                    aria-label={'Table name ' + (index + 1)}
                    value={table.name}
                    maxLength={80}
                    onChange={(event) =>
                      update(table.key, { name: event.target.value })
                    }
                  />
                  <SelectField
                    label="Apply these prices to"
                    aria-label={'Applies to ' + (index + 1)}
                    value={table.mode}
                    onChange={(event) =>
                      update(table.key, { mode: event.target.value })
                    }
                  >
                    <option value="all">All current variants</option>
                    <option value="selected">Selected variants</option>
                  </SelectField>
                  {table.mode === 'selected' && (
                    <TableVariants
                      path={path}
                      eligible={eligible}
                      value={table.variantIds}
                      onChange={(variantIds) =>
                        update(table.key, { variantIds })
                      }
                      label={'Variants for table ' + (index + 1)}
                      disabled={locked || conflict}
                    />
                  )}
                </div>
                <div className="simple-pricing-options-actions">
                  {index === tables.length - 1 && (
                    <Button
                      variant="secondary"
                      disabled={tables.length >= 100}
                      onClick={addTable}
                    >
                      <Plus size={15} />
                      Add price table
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    aria-label={'Remove price table ' + (index + 1)}
                    onClick={() => {
                      setTables((current) =>
                        current.filter((item) => item.key !== table.key),
                      )
                      setValidation('')
                    }}
                  >
                    <Trash2 size={15} />
                    Remove price table
                  </Button>
                </div>
              </details>
            ) : (
              <p className="simple-price-coverage">
                {table.variantIds.length === eligible.length
                  ? 'All current variants'
                  : table.variantIds.length + ' variants'}
              </p>
            )}
          </section>
        ))}
        {!tables.length && (
          <Empty title="No prices yet">
            {editable
              ? 'Add a quantity to get started.'
              : 'Prices will appear here once they are saved.'}
          </Empty>
        )}
        {!tables.length && editable && eligible.length > 0 && (
          <Button variant="secondary" onClick={addTable}>
            <Plus size={16} />
            Add pricing
          </Button>
        )}
      </fieldset>
      {validation && (
        <p className="notice error-notice" role="alert">
          {validation}
        </p>
      )}
      <ErrorNotice
        error={mutation.error}
        retry={conflict ? reload : undefined}
      />
      {mutation.uncertain && (
        <div className="notice">
          <p>The save could not be confirmed.</p>
          <Button
            variant="secondary"
            disabled={mutation.pending}
            onClick={async () => {
              const result = await mutation.run()
              if (result) saved(result.data)
            }}
          >
            Retry save
          </Button>
        </div>
      )}
      {editable && eligible.length > 0 && (
        <div className="simple-pricing-footer">
          <p className="simple-price-save-state" aria-live="polite">
            {!tables.length && dirty
              ? 'Saving will remove existing pricing.'
              : mutation.uncertain
                ? 'Waiting for save confirmation'
                : dirty
                  ? 'Unsaved changes'
                  : data.source.draft || data.source.current
                    ? 'All changes saved'
                    : 'Start with a cost and price'}
          </p>
          <Button type="submit" disabled={locked || conflict || !dirty}>
            {mutation.pending ? 'Saving?' : 'Save pricing'}
          </Button>
        </div>
      )}
    </form>
  )
}

function TableVariants({ path, eligible, value, onChange, label, disabled }) {
  const [pages, setPages] = useState([])
  const resource = useResource(
    queryPath(`${path}/variants`, {
      status: 'selectable',
      limit: 50,
      after: pages.at(-1),
    }),
  )
  const items = resource.data?.items || []
  const labels = new Map(
    items.map((variant) => [variant.id, variantName(variant)]),
  )
  const ids = [
    ...new Set([...value, ...items.map((variant) => variant.id)]),
  ].filter((id) => eligible.includes(id))
  return (
    <div>
      <SelectField
        multiple
        label={label}
        value={value}
        disabled={disabled || resource.loading || Boolean(resource.error)}
        onChange={(event) => onChange(event.target.value)}
      >
        {ids.map((id) => (
          <option value={id} key={id}>
            {labels.get(id) || `Selected variant ${eligible.indexOf(id) + 1}`}
          </option>
        ))}
      </SelectField>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {(pages.length > 0 || resource.data?.next) && (
        <Pager
          resource={resource}
          pages={pages}
          setPages={setPages}
          label="variant choices"
        />
      )}
    </div>
  )
}

function PriceGrid({ table, index, editable, cost, change }) {
  const label = (field, position) =>
    field + ', table ' + (index + 1) + ', break ' + (position + 1)
  function updateRow(key, fields) {
    change(
      table.breaks.map((row) =>
        row.key === key ? { ...row, ...fields } : row,
      ),
    )
  }
  const amount = (value) => {
    if (value === '') return '?'
    const [whole, fraction = ''] = value.split('.')
    return whole + '.' + fraction.padEnd(2, '0')
  }
  return (
    <>
      <div
        className="simple-price-rows"
        role="group"
        aria-label={'Quantity pricing for table ' + (index + 1)}
      >
        {table.breaks.map((row, position) => {
          const values = priceTableValues(row)
          const editIntent = (driver) => (event) =>
            updateRow(row.key, { driver, value: event.target.value })
          return (
            <div
              className={
                'simple-price-row' + (cost ? '' : ' simple-price-row-sale')
              }
              key={row.key}
            >
              <TextField
                label="Qty"
                aria-label={label('Qty', position)}
                inputMode="numeric"
                value={row.from}
                onChange={(event) =>
                  updateRow(row.key, { from: event.target.value })
                }
              />
              {cost && (
                <TextField
                  label="Cost"
                  aria-label={label('Cost', position)}
                  inputMode="decimal"
                  prefix="$"
                  placeholder="0.00"
                  value={row.cost}
                  onChange={(event) =>
                    updateRow(row.key, { cost: event.target.value })
                  }
                />
              )}
              {cost && (
                <div className="simple-price-margin-field">
                  <TextField
                    label="Margin %"
                    aria-label={label('Margin %', position)}
                    inputMode="decimal"
                    placeholder="Auto"
                    value={
                      row.driver === 'margin' ? row.value : values.marginPercent
                    }
                    onInput={editIntent('margin')}
                    onChange={editIntent('margin')}
                  />
                  {row.driver === 'margin' &&
                    values.marginPercent !== '' &&
                    values.marginPercent !== row.value && (
                      <small>Effective: {values.marginPercent}%</small>
                    )}
                </div>
              )}
              <TextField
                label="Price"
                aria-label={label('Price', position)}
                inputMode="decimal"
                prefix="$"
                placeholder="0.00"
                value={row.driver === 'price' ? row.value : values.price}
                onInput={editIntent('price')}
                onChange={editIntent('price')}
              />
              {cost && (
                <div className="simple-price-profit-cell">
                  <span className="simple-price-profit-label">
                    Margin <small>/ item</small>
                  </span>
                  <div
                    className={
                      'simple-price-profit' +
                      (values.marginAmount.startsWith('-')
                        ? ' simple-price-loss'
                        : '')
                    }
                  >
                    {values.marginAmount !== '' && (
                      <span aria-hidden="true">$</span>
                    )}
                    <output aria-label={label('Margin amount', position)}>
                      {amount(values.marginAmount)}
                    </output>
                  </div>
                </div>
              )}
              <div className="simple-price-remove">
                {editable && table.breaks.length > 1 && (
                  <Button
                    variant="ghost"
                    aria-label={label('Remove quantity', position)}
                    title="Remove quantity"
                    onClick={() =>
                      change(
                        table.breaks.filter((item) => item.key !== row.key),
                      )
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
              {values.error && (
                <p className="simple-price-row-error" role="alert">
                  {values.error}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {editable && (
        <Button
          className="simple-price-add"
          variant="ghost"
          disabled={table.breaks.length >= 100}
          onClick={() =>
            change([
              ...table.breaks,
              newPriceBreak(
                Math.min(
                  1_000_000,
                  (Number(table.breaks.at(-1)?.from) || 0) + 1,
                ),
              ),
            ])
          }
        >
          <Plus size={16} aria-hidden="true" />
          Add quantity
        </Button>
      )}
    </>
  )
}
