import { useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import {
  Action,
  Empty,
  ErrorNotice,
  Loading,
  PermissionDenied,
} from '../../components/workspace/Elements'

function text(value) {
  if (value == null || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function date(value) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? 'Time unavailable'
    : parsed.toLocaleString()
}

export function ClientActivity({ path }) {
  const workspace = useWorkspace()
  const allowed = workspace.can('clients.history.view')
  const [pages, setPages] = useState([])
  const resource = useResource(
    allowed
      ? queryPath(`${path}/activity`, {
          limit: 25,
          after: pages.at(-1),
        })
      : null,
  )
  if (!allowed) return <PermissionDenied />
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Activity history</h2>
          <p className="muted">
            Recorded changes to this client, its contacts and addresses.
          </p>
        </div>
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
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading label="Loading activity history…" />
      ) : (
        resource.data && (
          <>
            {resource.data.coverageStartedAt && (
              <p className="notice">
                Detailed history unavailable before{' '}
                {date(resource.data.coverageStartedAt)}.
              </p>
            )}
            {resource.data.items.length ? (
              resource.data.items.map((event) => (
                <article
                  className="panel"
                  key={event.id}
                  aria-label={event.action.replaceAll('.', ' ')}
                >
                  <h3>{event.action.replaceAll('.', ' ')}</h3>
                  <p>
                    {event.actor?.label || 'Actor unavailable'} ·{' '}
                    {event.actor?.membershipStatus === 'current'
                      ? 'Current member'
                      : event.actor?.membershipStatus === 'former'
                        ? 'Former member'
                        : 'Membership unavailable'}
                  </p>
                  <p className="muted">
                    <time dateTime={event.occurredAt}>
                      {date(event.occurredAt)}
                    </time>{' '}
                    · Source: {event.origin}
                  </p>
                  <p className="muted">
                    {event.entity.type}: {event.entity.id} · Revision{' '}
                    {text(event.beforeRevision)} → {text(event.afterRevision)}
                  </p>
                  {event.changes.length ? (
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
                          {event.changes.map((change) => (
                            <tr key={change.field}>
                              <th scope="row">{change.field}</th>
                              <td>{text(change.before)}</td>
                              <td>{text(change.after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No field values changed.</p>
                  )}
                </article>
              ))
            ) : (
              <Empty title="No recorded activity">
                Changes recorded after history coverage began will appear here.
              </Empty>
            )}
            <div className="table-bottom">
              <span>{resource.data.items.length} events</span>
              <div className="actions">
                <Action
                  variant="secondary"
                  disabled={!pages.length}
                  onClick={() => setPages((current) => current.slice(0, -1))}
                >
                  Previous activity
                </Action>
                <Action
                  variant="secondary"
                  disabled={!resource.data.next}
                  onClick={() =>
                    setPages((current) => [...current, resource.data.next])
                  }
                >
                  Next activity
                </Action>
              </div>
            </div>
          </>
        )
      )}
    </>
  )
}
