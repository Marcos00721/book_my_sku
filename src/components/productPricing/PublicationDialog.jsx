import { useState } from 'react'
import {
  Action,
  Dialog,
  ErrorNotice,
  Field,
  Loading,
  SaveFooter,
} from '../workspace/Elements'
import { ConflictReview } from '../workspace/RecordTools'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { RateSummary } from './RateSummary'
import { toIsoInstant } from '../../schemas/pricingFormSchema'
import { pricingPaths } from '../../services/pricingApi'
import { Pager } from '../workspace/RecordTools'

export function PublicationDialog({
  path,
  id,
  close,
  saved,
  canBrowsePublished,
}) {
  const resource = useResource(`${path}/pricing/schedules/${id}?kind=draft`)
  const [reviewed, setReviewed] = useState(null)
  const draft = reviewed || resource.data
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [replace, setReplace] = useState(false)
  const [version, setVersion] = useState('')
  const [intervalRevision, setIntervalRevision] = useState('0')
  const [consent, setConsent] = useState(false)
  const [pages, setPages] = useState([])
  const published = useResource(
    replace && canBrowsePublished
      ? pricingPaths.schedules(path, 'published', pages.at(-1))
      : null,
  )
  const mutation = useMutation()

  async function publish(event) {
    event.preventDefault()
    if (
      await mutation.run('post', `${path}/pricing/schedules/${id}/publish`, {
        expectedRevision: draft.revision,
        start: toIsoInstant(start),
        end: toIsoInstant(end),
        ...(replace
          ? {
              replace: {
                versionId: version,
                revision: Number(intervalRevision),
              },
            }
          : {}),
      })
    )
      saved()
  }

  return (
    <Dialog
      title="Publish pricing schedule"
      description="Review the draft, set the interval, then publish. Issued documents keep their snapshots."
      close={close}
      locked={mutation.pending || mutation.uncertain}
      size="lg"
      className="product-form-dialog"
    >
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <div className="product-form-body">
          <Loading />
        </div>
      ) : (
        resource.data && (
          <form className="product-form" onSubmit={publish}>
            <div className="product-form-body">
              <RateSummary schedule={draft} cost />
              <fieldset disabled={mutation.pending || mutation.uncertain}>
                <div className="product-form-fields">
                  <Field
                    label="Starts at (blank means server time)"
                    type="datetime-local"
                    step="0.001"
                    value={start}
                    onChange={(event) => {
                      setStart(event.target.value)
                      setConsent(false)
                    }}
                  />
                  <Field
                    label="Ends at (blank means open-ended)"
                    type="datetime-local"
                    step="0.001"
                    min={start || undefined}
                    value={end}
                    onChange={(event) => {
                      setEnd(event.target.value)
                      setConsent(false)
                    }}
                  />
                  <div className="product-form-checks">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={replace}
                        onChange={(event) => {
                          setReplace(event.target.checked)
                          setConsent(false)
                        }}
                      />
                      Replace a current published interval
                    </label>
                  </div>
                  {replace && canBrowsePublished ? (
                    <>
                      <ErrorNotice
                        error={published.error}
                        retry={published.reload}
                      />
                      <Field
                        label="Price list to replace"
                        required
                        value={version}
                        onChange={(event) => {
                          const target = published.data?.items?.find(
                            (item) => item.id === event.target.value,
                          )
                          setVersion(event.target.value)
                          setIntervalRevision(
                            String(target?.intervalRevision ?? 0),
                          )
                          setConsent(false)
                        }}
                      >
                        <option value="">Choose the published interval</option>
                        {version &&
                          !published.data?.items?.some(
                            (item) => item.id === version,
                          ) && (
                            <option value={version}>
                              Selected published interval
                            </option>
                          )}
                        {published.data?.items
                          ?.filter((item) =>
                            ['agreementId', 'accountId', 'warehouseId'].every(
                              (key) => item[key] === draft.rules?.[key],
                            ),
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.agreementId} · {item.accountId} /{' '}
                              {item.warehouseId} ·{' '}
                              {new Date(item.start).toLocaleString()} –{' '}
                              {item.end
                                ? new Date(item.end).toLocaleString()
                                : 'Open-ended'}
                            </option>
                          ))}
                      </Field>
                      {(published.data?.next || pages.length > 0) && (
                        <Pager
                          resource={published}
                          pages={pages}
                          setPages={setPages}
                          label="published intervals"
                        />
                      )}
                      <p className="product-form-hint">
                        The old interval ends when the new one starts. Its saved
                        rates remain available in history.
                      </p>
                      <Action
                        variant="secondary"
                        onClick={() => {
                          published.reload()
                          setVersion('')
                          setConsent(false)
                        }}
                      >
                        Refresh published intervals
                      </Action>
                    </>
                  ) : (
                    replace && (
                      <>
                        <Field
                          label="Replaced version ID"
                          required
                          pattern="[a-fA-F0-9]{24}"
                          value={version}
                          onChange={(event) => {
                            setVersion(event.target.value)
                            setConsent(false)
                          }}
                        />
                        <Field
                          label="Current interval revision"
                          required
                          type="number"
                          min="0"
                          step="1"
                          value={intervalRevision}
                          onChange={(event) => {
                            setIntervalRevision(event.target.value)
                            setConsent(false)
                          }}
                          onWheel={(event) => event.currentTarget.blur()}
                        />
                      </>
                    )
                  )}
                  <div className="product-form-checks">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(event) => setConsent(event.target.checked)}
                      />
                      I reviewed this immutable schedule and its effective
                      interval. Existing issued documents keep their original
                      snapshots.
                    </label>
                  </div>
                </div>
              </fieldset>
              <ConflictReview
                error={mutation.error}
                path={`${path}/pricing/schedules/${id}?kind=draft`}
                values={{ rules: draft.rules }}
                onReview={(current) => {
                  setReviewed(current)
                  setConsent(false)
                }}
              />
            </div>
            <SaveFooter
              mutation={mutation}
              close={close}
              disabled={!consent || (replace && !version)}
              label="Publish reviewed schedule"
            />
          </form>
        )
      )}
    </Dialog>
  )
}
