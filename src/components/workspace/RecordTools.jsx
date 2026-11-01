import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { Action, Empty, ErrorNotice, Field, Loading } from './Elements'

const valueText = (value) =>
  value == null || value === ''
    ? 'Not set'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

export function Pager({ resource, pages, setPages, label = 'records' }) {
  return (
    <div className="table-bottom">
      <span>
        {resource.data?.items?.length || 0} {label}
      </span>
      <div className="actions">
        <Action
          variant="secondary"
          disabled={!pages.length}
          onClick={() => setPages((current) => current.slice(0, -1))}
        >
          Previous
        </Action>
        <Action
          variant="secondary"
          disabled={!resource.data?.next}
          onClick={() =>
            setPages((current) => [...current, resource.data.next])
          }
        >
          Next
        </Action>
      </div>
    </div>
  )
}

export function ReferenceSelect({
  path,
  label,
  value,
  onChange,
  selectedLabel,
  required = false,
  disabled = false,
  labelFor = (item) => item.label || item.name,
}) {
  const [search, setSearch] = useState('')
  const [pages, setPages] = useState([])
  const resource = useResource(
    path ? queryPath(path, { search, limit: 50, after: pages.at(-1) }) : null,
  )
  const items = resource.data?.items || []
  return (
    <div className="reference-picker">
      <Field
        label={`Find ${label.toLowerCase()}`}
        maxLength={80}
        value={search}
        disabled={disabled}
        onChange={(event) => {
          setSearch(event.target.value)
          setPages([])
        }}
      />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <Field
        label={label}
        value={value || ''}
        required={required}
        disabled={disabled || resource.loading || Boolean(resource.error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {resource.loading
            ? 'Loading choices…'
            : required
              ? 'Choose an option'
              : 'Not set'}
        </option>
        {value &&
          !items.some(
            (item) => (item.id || item._id || item.actorId) === value,
          ) && (
            <option value={value}>
              {selectedLabel || 'Current selection'} (saved)
            </option>
          )}
        {items.map((item) => (
          <option
            key={item.id || item._id || item.actorId}
            value={item.id || item._id || item.actorId}
          >
            {labelFor(item)}
          </option>
        ))}
      </Field>
      {(pages.length > 0 || resource.data?.next) && (
        <Pager
          resource={resource}
          pages={pages}
          setPages={setPages}
          label="choices"
        />
      )}
    </div>
  )
}

export function DuplicateHints({
  path,
  query,
  to,
  labelFor = (item) =>
    [item.name, item.clientCode || item.supplierCode, item.accountLabel]
      .filter(Boolean)
      .join(' · '),
}) {
  const resource = useResource(query && path ? queryPath(path, query) : null)
  if (!query) return null
  return (
    <aside className="notice" aria-label="Possible duplicates">
      <strong>Possible matches</strong>
      {resource.loading ? (
        <Loading label="Checking possible matches…" />
      ) : (
        <>
          <ErrorNotice error={resource.error} retry={resource.reload} />
          {resource.error && (
            <p>
              Matches could not be checked. You may still save a separate
              record.
            </p>
          )}
          {resource.data?.items?.map((item) => (
            <p key={item.id || item._id}>
              {to ? (
                <Link className="app-link" to={`${to}/${item.id || item._id}`}>
                  Open {labelFor(item)}
                </Link>
              ) : (
                labelFor(item)
              )}
            </p>
          ))}
          {resource.data && !resource.data.items?.length && (
            <p>No matches found. This does not guarantee uniqueness.</p>
          )}
          {resource.data?.hasMore && to && (
            <Link className="app-link" to={to}>
              More matches are available in the directory.
            </Link>
          )}
          <p>
            Review matches, or save a separate record. Records are never merged
            automatically.
          </p>
        </>
      )}
    </aside>
  )
}

export function ConflictReview({
  error,
  path,
  values,
  onReview,
  project = (value) => value,
}) {
  const [reviewed, setReviewed] = useState(null)
  const active =
    error?.status === 409 &&
    /VERSION_CONFLICT|SETUP_CHANGED/.test(error.code || '') &&
    error !== reviewed
  const current = useResource(active ? path : null)
  if (!active) return null
  return (
    <section className="notice" aria-label="Review conflicting changes">
      <h3>This record changed while you were editing</h3>
      <p>
        Your draft is preserved. Review the current values before applying your
        edits.
      </p>
      <ErrorNotice error={current.error} retry={current.reload} />
      {current.loading ? (
        <Loading />
      ) : (
        current.data && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Current</th>
                    <th>Your draft</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(values).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{valueText(project(current.data)[key])}</td>
                      <td>{valueText(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Action
              variant="secondary"
              onClick={() => {
                onReview(current.data)
                setReviewed(error)
              }}
            >
              Use current revision and keep my edits
            </Action>
          </>
        )
      )}
    </section>
  )
}

export function MutationRetry({ mutation, saved }) {
  return mutation.uncertain ? (
    <Action
      variant="secondary"
      disabled={mutation.pending}
      onClick={async () => {
        if (await mutation.run()) saved()
      }}
    >
      Retry last action
    </Action>
  ) : null
}

export function ActivityHistory({
  path,
  title = 'Activity history',
  filters = {},
  actions = [],
  allowActorFilter = false,
}) {
  const [pages, setPages] = useState([])
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const resource = useResource(
    queryPath(path, {
      ...filters,
      action,
      ...(allowActorFilter ? { actorId } : {}),
      limit: 25,
      after: pages.at(-1),
    }),
  )
  return (
    <section aria-label={title}>
      <div className="section-heading">
        <h2>{title}</h2>
        <Action
          variant="secondary"
          onClick={() => {
            setPages([])
            resource.reload()
          }}
        >
          Refresh history
        </Action>
      </div>
      {actions.length > 0 && (
        <div className="toolbar">
          <Field
            label="Activity type"
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPages([])
            }}
          >
            <option value="">All activities</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll('.', ' ')}
              </option>
            ))}
          </Field>
          {allowActorFilter && (
            <Field
              label="Actor ID filter"
              pattern="[a-fA-F0-9]{24}"
              maxLength={24}
              value={actorId}
              onChange={(event) => {
                const value = event.target.value
                if (!value || /^[a-f\d]{24}$/i.test(value)) {
                  setActorId(value)
                  setPages([])
                }
              }}
            />
          )}
        </div>
      )}
      <ErrorNotice
        error={resource.error}
        retry={() => {
          if (resource.error?.code === 'INVALID_CURSOR') setPages([])
          resource.reload()
        }}
      />
      {resource.loading ? (
        <Loading label="Loading activity…" />
      ) : (
        resource.data && (
          <>
            {resource.data.coverageStartedAt && (
              <p className="notice">
                Detailed history unavailable before{' '}
                {new Date(resource.data.coverageStartedAt).toLocaleString()}.
              </p>
            )}
            {resource.data.items?.length ? (
              resource.data.items.map((event) => (
                <article className="panel activity-event" key={event.id}>
                  <h3>{event.action?.replaceAll('.', ' ')}</h3>
                  <p>
                    {event.actor?.label || 'Actor unavailable'} ·{' '}
                    {event.actor?.membershipStatus || 'Membership unavailable'}
                  </p>
                  <p className="muted">
                    {new Date(
                      event.occurredAt || event.createdAt,
                    ).toLocaleString()}
                    {event.origin ? ` · Source: ${event.origin}` : ''}
                  </p>
                  {event.reason && <p>{event.reason}</p>}
                  {event.noOp && <p>No field values changed.</p>}
                  {event.operationId && (
                    <small>Related operation: {event.operationId}</small>
                  )}
                  <details>
                    <summary>View changes</summary>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Before</th>
                            <th>After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(event.changes || [])
                            .flatMap((change) =>
                              change.differences
                                ? change.differences.map((diff) => ({
                                    ...diff,
                                    field: `${change.category} / ${change.key || change.entryId} / ${diff.field}`,
                                  }))
                                : [change],
                            )
                            .map((change, index) => (
                              <tr key={index}>
                                <th>{change.field}</th>
                                <td>{valueText(change.before)}</td>
                                <td>{valueText(change.after)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Event: {event.id} · Revision{' '}
                      {valueText(event.beforeRevision)} →{' '}
                      {valueText(event.afterRevision)}
                    </p>
                  </details>
                </article>
              ))
            ) : (
              <Empty title="No recorded activity">
                No recorded changes are available for these filters.
              </Empty>
            )}
            <Pager
              resource={resource}
              pages={pages}
              setPages={setPages}
              label="events"
            />
          </>
        )
      )}
    </section>
  )
}
