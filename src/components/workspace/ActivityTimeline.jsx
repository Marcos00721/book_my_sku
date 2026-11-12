import { useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import {
  activityActionLabel,
  activityActorLabel,
  activityEntityLabel,
  activityFieldLabel,
  formatActivityValue,
} from '../../utils/activityDisplay'
import {
  Action,
  Empty,
  ErrorNotice,
  Loading,
  PermissionDenied,
} from './Elements'
import { SectionHeading } from './SectionHeading'
import { CursorPager } from './CursorPager'

function formatWhen(value) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return 'Time unavailable'
  return new Date(parsed).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function membershipLabel(status) {
  if (status === 'current') return 'Current member'
  if (status === 'former') return 'Former member'
  return null
}

function actionTone(action) {
  const key = String(action || '').toLowerCase()
  if (/(archiv|delet|remov|disabl)/.test(key)) return 'danger'
  if (/(creat|add|restor|enabl)/.test(key)) return 'success'
  return 'neutral'
}

function originLabel(origin) {
  if (!origin) return null
  const value = String(origin).trim()
  if (!value) return null
  if (value.toLowerCase() === 'api') return 'API'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function actorInitials(label) {
  const parts = String(label || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function ActivityChanges({ changes }) {
  if (!changes?.length) {
    return (
      <p className="activity-timeline-empty-change">No field values changed.</p>
    )
  }

  return (
    <ul className="activity-timeline-changes">
      {changes.map((change) => {
        const before = formatActivityValue(change.before, change.field)
        const after = formatActivityValue(change.after, change.field)
        return (
          <li key={change.field} className="activity-timeline-change">
            <span className="activity-timeline-change-field">
              {activityFieldLabel(change.field)}
            </span>
            <div className="activity-timeline-change-values">
              <span className="activity-timeline-value activity-timeline-value-before">
                {before}
              </span>
              <span className="activity-timeline-arrow" aria-hidden="true">
                →
              </span>
              <span className="activity-timeline-value activity-timeline-value-after">
                {after}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ActivityEvent({ event, isLast }) {
  const title = activityActionLabel(event.action)
  const actor = activityActorLabel(event.actor)
  const entity = activityEntityLabel(event.entity?.type)
  const membership = membershipLabel(event.actor?.membershipStatus)
  const origin = originLabel(event.origin)
  const tone = actionTone(event.action)

  return (
    <li className="activity-timeline-item">
      <div className="activity-timeline-rail" aria-hidden="true">
        <span
          className={`activity-timeline-dot activity-timeline-dot-${tone}`}
        />
        {!isLast ? <span className="activity-timeline-line" /> : null}
      </div>

      <article className="activity-timeline-card" aria-label={title}>
        <header className="activity-timeline-card-head">
          <div className="activity-timeline-title-block">
            <h3>{title}</h3>
            <div className="activity-timeline-tags">
              <span className="activity-timeline-tag">{entity}</span>
              {origin ? (
                <span className="activity-timeline-tag activity-timeline-tag-muted">
                  {origin}
                </span>
              ) : null}
            </div>
          </div>
          <time className="activity-timeline-time" dateTime={event.occurredAt}>
            {formatWhen(event.occurredAt)}
          </time>
        </header>

        <div className="activity-timeline-actor">
          <span className="activity-timeline-avatar" aria-hidden="true">
            {actorInitials(actor)}
          </span>
          <div className="activity-timeline-actor-copy">
            <p className="activity-timeline-actor-name">{actor}</p>
            {membership ? (
              <p className="muted activity-timeline-actor-meta">{membership}</p>
            ) : null}
          </div>
        </div>

        <ActivityChanges changes={event.changes} />
      </article>
    </li>
  )
}

/**
 * Shared activity timeline for clients, suppliers, and other records.
 */
export function ActivityTimeline({
  path,
  permission,
  description = 'Recorded changes for this record.',
  title = 'Activity history',
}) {
  const workspace = useWorkspace()
  const allowed = permission ? workspace.can(permission) : true
  const [pages, setPages] = useState([])
  const resource = useResource(
    allowed
      ? queryPath(path, {
          limit: 25,
          after: pages.at(-1),
        })
      : null,
  )
  if (!allowed) return <PermissionDenied />

  const items = resource.data?.items || []

  return (
    <div className="activity-timeline">
      <SectionHeading
        title={title}
        description={description}
        actions={
          <Action
            variant="secondary"
            onClick={() => {
              setPages([])
              resource.reload()
            }}
          >
            <RefreshCw size={15} />
            Refresh history
          </Action>
        }
      />

      <ErrorNotice error={resource.error} retry={resource.reload} />

      {resource.loading ? (
        <Loading label="Loading activity history…" />
      ) : (
        resource.data && (
          <>
            {resource.data.coverageStartedAt ? (
              <p className="notice activity-timeline-coverage">
                Detailed history unavailable before{' '}
                {formatWhen(resource.data.coverageStartedAt)}.
              </p>
            ) : null}

            {items.length ? (
              <ol className="activity-timeline-list">
                {items.map((event, index) => (
                  <ActivityEvent
                    key={event.id}
                    event={event}
                    isLast={index === items.length - 1}
                  />
                ))}
              </ol>
            ) : (
              <Empty
                title="No recorded activity"
                icon={<History size={22} />}
              >
                Changes recorded after history coverage began will appear here.
              </Empty>
            )}

            <CursorPager
              count={items.length}
              label="event"
              pages={pages}
              setPages={setPages}
              next={resource.data.next}
              previousLabel="Previous activity"
              nextLabel="Next activity"
            />
          </>
        )
      )}
    </div>
  )
}
