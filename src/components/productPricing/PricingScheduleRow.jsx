import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { ScheduleTierSummary } from './PricingSummary'

function intervalLabel(kind, schedule) {
  if (kind !== 'published') return 'Not published'
  const start = schedule.start
    ? new Date(schedule.start).toLocaleString()
    : '—'
  const end = schedule.end
    ? new Date(schedule.end).toLocaleString()
    : 'Open-ended'
  return `${start} – ${end}`
}

export function PricingScheduleRow({
  schedule,
  kind,
  editable,
  canPublish,
  onOpen,
  onPublish,
}) {
  return (
    <tr>
      <th scope="row">
        <div className="pricing-schedule-title">
          <strong>{schedule.agreementId || 'Untitled agreement'}</strong>
          <small>
            {schedule.accountId || '—'} / {schedule.warehouseId || '—'}
          </small>
        </div>
        <ScheduleTierSummary rules={schedule.rules} cost={editable} />
      </th>
      <td>
        <Badge tone={kind === 'draft' ? 'warning' : 'success'}>
          {kind} · rev {schedule.revision}
        </Badge>
        <small className="pricing-id">{schedule.id}</small>
      </td>
      <td className="pricing-cell-muted">{intervalLabel(kind, schedule)}</td>
      <td>
        <div className="pricing-row-actions">
          <Button variant="secondary" onClick={() => onOpen(schedule.id)}>
            {kind === 'draft' && editable ? 'Open editor' : 'View details'}
          </Button>
          {kind === 'draft' && canPublish && (
            <Button variant="secondary" onClick={() => onPublish(schedule.id)}>
              Publish schedule
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

export function PricingScheduleCard({
  schedule,
  kind,
  editable,
  canPublish,
  onOpen,
  onPublish,
}) {
  return (
    <article className="pricing-schedule-card">
      <header>
        <div>
          <strong>{schedule.agreementId || 'Untitled agreement'}</strong>
          <p className="muted">
            {schedule.accountId || '—'} / {schedule.warehouseId || '—'}
          </p>
        </div>
        <Badge tone={kind === 'draft' ? 'warning' : 'success'}>
          {kind} · rev {schedule.revision}
        </Badge>
      </header>
      <p className="pricing-cell-muted">{intervalLabel(kind, schedule)}</p>
      <ScheduleTierSummary rules={schedule.rules} cost={editable} />
      <div className="pricing-row-actions">
        <Button variant="secondary" onClick={() => onOpen(schedule.id)}>
          {kind === 'draft' && editable ? 'Open editor' : 'View details'}
        </Button>
        {kind === 'draft' && canPublish && (
          <Button variant="secondary" onClick={() => onPublish(schedule.id)}>
            Publish schedule
          </Button>
        )}
      </div>
    </article>
  )
}
