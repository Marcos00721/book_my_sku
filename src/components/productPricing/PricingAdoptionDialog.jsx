import { useRef, useState } from 'react'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Loading,
} from '../workspace/Elements'
import { Pager } from '../workspace/RecordTools'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { pricingPaths, previewPricingAdoption } from '../../services/pricingApi'

const blockerText = (code) =>
  ({
    STALE_SOURCES: 'Product details changed. Review the packaging again.',
    VARIANT_NOT_SELECTABLE: 'A variant is no longer available.',
    PRODUCT_ARCHIVED: 'Restore this product before updating pricing.',
    SUPPLIER_NOT_SELECTABLE: 'The supplier is no longer available.',
    SCHEDULE_NOT_FOUND: 'This published version is unavailable.',
  })[code] || code.replaceAll('_', ' ').toLowerCase()

function unitText(unit) {
  if (!unit) return 'Unavailable'
  return `1 ${unit.procurementUnit || 'purchase unit'} = ${unit.eachPerProcurementUnit ?? '?'} items; minimum ${unit.minimum ?? '?'}, multiple ${unit.multiple ?? '?'}`
}

export function PricingAdoptionDialog({ path, close, saved }) {
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState([])
  const [review, setReview] = useState(null)
  const [reviewState, setReviewState] = useState({
    pending: false,
    error: null,
  })
  const [consent, setConsent] = useState(false)
  const [results, setResults] = useState(null)
  const intent = useRef(null)
  const reviewing = useRef(false)
  const mutation = useMutation()
  const resource = useResource(
    pricingPaths.schedules(path, 'published', pages.at(-1)),
  )
  const failed = results?.some((item) => item.status === 'failed')
  const locked =
    mutation.pending || mutation.uncertain || reviewState.pending || failed
  const ready = review?.items?.filter((item) => !item.blockers.length) || []
  async function inspect() {
    if (reviewing.current) return
    reviewing.current = true
    setReviewState({ pending: true, error: null })
    setReview(null)
    setConsent(false)
    try {
      setReview(await previewPricingAdoption(path, selected))
      setReviewState({ pending: false, error: null })
    } catch (error) {
      setReviewState({ pending: false, error })
    } finally {
      reviewing.current = false
    }
  }
  async function apply() {
    if (!intent.current)
      intent.current = {
        expectedProductRevision: review.productRevision,
        targets: ready.map(({ versionId }) => ({
          versionId,
          operationKey: crypto.randomUUID(),
        })),
      }
    const result = await mutation.run(
      'post',
      pricingPaths.adoptions(path),
      intent.current,
    )
    if (result) {
      setResults(result.data.items)
      saved?.()
    }
  }
  return (
    <Dialog
      title="Review pricing after correction"
      description="Compare saved and current packaging, then create updated pricing drafts."
      close={close}
      locked={locked}
      size="xl"
      className="product-form-dialog"
    >
      <div className="product-form-body product-form-fields">
        <p className="notice">
          The new drafts keep the existing rates and use current packaging.
          Review the rates and publish each draft when ready.
        </p>
        {!results && (
          <>
            <fieldset disabled={locked} className="product-form-fields">
              <h3>1. Choose published versions</h3>
              <p className="product-form-hint">
                Select up to 20 versions. {selected.length} selected.
              </p>
              <ErrorNotice error={resource.error} retry={resource.reload} />
              {resource.loading ? (
                <Loading />
              ) : !resource.error && !resource.data?.items?.length ? (
                <Empty title="No published pricing to update">
                  Save a pricing draft in the Pricing tab to use the current
                  packaging.
                </Empty>
              ) : (
                resource.data?.items?.map((version) => (
                  <label className="check-label" key={version.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(version.id)}
                      disabled={
                        selected.length >= 20 && !selected.includes(version.id)
                      }
                      onChange={(event) => {
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, version.id]
                            : current.filter((id) => id !== version.id),
                        )
                        setReview(null)
                        setConsent(false)
                      }}
                    />
                    <span>
                      {version.agreementId} · {version.accountId} /{' '}
                      {version.warehouseId}
                      <small className="pricing-id">
                        {version.start
                          ? new Date(version.start).toLocaleString()
                          : 'No start date'}{' '}
                        · Version {version.id.slice(-6)}
                      </small>
                    </span>
                  </label>
                ))
              )}
              {(resource.data?.next || pages.length > 0) && (
                <Pager
                  resource={resource}
                  pages={pages}
                  setPages={setPages}
                  label="published versions"
                />
              )}
              <Action
                variant="secondary"
                disabled={!selected.length}
                onClick={inspect}
              >
                Review packaging changes
              </Action>
            </fieldset>
            <ErrorNotice error={reviewState.error} />
            {review && (
              <section className="product-form-section">
                <h3>2. Review the changes</h3>
                {review.items.map((item) => (
                  <div className="pricing-adoption-target" key={item.versionId}>
                    <h4>Version {item.versionId.slice(-6)}</h4>
                    {item.blockers.length ? (
                      <p className="notice">
                        {item.blockers.map(blockerText).join(' ')}
                      </p>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th scope="col">Variant</th>
                              <th scope="col">Saved packaging</th>
                              <th scope="col">Current packaging</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.after.map((unit) => (
                              <tr key={unit.id}>
                                <th scope="row">Variant {unit.id.slice(-6)}</th>
                                <td>
                                  {unitText(
                                    item.before?.find(
                                      (before) => before.id === unit.id,
                                    ),
                                  )}
                                </td>
                                <td>{unitText(unit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
                <label className="check-label">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  I reviewed the packaging and will check the rates before
                  publishing.
                </label>
              </section>
            )}
          </>
        )}
        {results && (
          <section aria-live="polite">
            <h3>Pricing update results</h3>
            {results.map((item) => (
              <p key={item.versionId}>
                <strong>Version {item.versionId.slice(-6)}: </strong>
                {item.status === 'applied'
                  ? `Draft created (${item.draft.id.slice(-6)}). Open it in Pricing to review and publish.`
                  : `${item.status === 'failed' ? 'Could not confirm the result. Retry the same request.' : 'Blocked.'} ${blockerText(item.code)}`}
              </p>
            ))}
            {!failed && results.some((item) => item.status === 'blocked') && (
              <Action
                variant="secondary"
                onClick={() => {
                  setSelected(
                    results
                      .filter((item) => item.status === 'blocked')
                      .map((item) => item.versionId),
                  )
                  setResults(null)
                  setReview(null)
                  setConsent(false)
                  intent.current = null
                }}
              >
                Review blocked versions again
              </Action>
            )}
          </section>
        )}
        <ErrorNotice error={mutation.error} />
        {mutation.uncertain && (
          <p className="notice">
            Retry the same request to recover its result.
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <Action variant="secondary" disabled={locked} onClick={close}>
          {results ? 'Done' : 'Close'}
        </Action>
        {(!results || failed) && (
          <Action
            disabled={
              mutation.pending ||
              reviewState.pending ||
              (!mutation.uncertain && !failed && (!consent || !ready.length))
            }
            onClick={apply}
          >
            {mutation.pending
              ? 'Creating drafts…'
              : mutation.uncertain || failed
                ? 'Retry same request'
                : `Create ${ready.length || ''} updated ${ready.length === 1 ? 'draft' : 'drafts'}`}
          </Action>
        )}
      </div>
    </Dialog>
  )
}
