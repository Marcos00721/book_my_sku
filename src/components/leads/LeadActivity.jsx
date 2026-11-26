import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useResource } from '../../hooks/useResource'
import { readLeadActivity, leadFields } from '../../services/leads'
import { queryPath } from '../../services/workspace'
import { dateLabel } from '../../utils/format'
import { Action, CursorPager, Empty, ErrorNotice, ListSkeleton, SectionHeading } from '../workspace/Elements'

const eventLabels = {
  created: 'Lead captured', edited: 'Lead details updated', resolved: 'Client selection updated',
  assigned: 'Lead assigned', reviewed: 'Review started', qualified: 'Lead qualified',
  returned: 'Returned to reviewing', closed: 'Lead closed', converted: 'Converted to project',
}

export function LeadActivity({ path }) {
  const [pages, setPages] = useState([])
  const resource = useResource(queryPath(`${path}/activity`, { limit: 25, beforeRevision: pages.at(-1) }), { load: readLeadActivity })
  const items = resource.data?.items || []
  // The API returns a bounded array, with no next cursor. Probe the next revision page when full.
  const next = items.length === 25 && items.at(-1).targetRevision > 0 ? items.at(-1).targetRevision : null
  return (
    <div className="lead-activity">
      <SectionHeading title="Activity history" description="Recorded changes from capture through conversion."
        actions={<Action variant="secondary" onClick={() => { setPages([]); resource.reload() }}><RefreshCw size={15} />Refresh history</Action>} />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? <ListSkeleton variant="list" label="Loading lead activity…" /> : resource.data && <>
        {items.length ? <ol className="lead-history-list">{items.map(event => <li key={event._id} className="lead-history-event">
          <div><strong>{eventLabels[event.event] || 'Lead updated'}</strong><time dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time></div>
          <p className="muted">{event.actorType === 'public' ? 'Public form' : event.actor?.label || `Workspace member · ${event.actorId || 'Unavailable'}`} · Revision {event.targetRevision}</p>
          {event.changedFields?.length > 0 && <p>Changed: {event.changedFields.map(field => leadFields[field] || ({ ownerId: 'Lead owner', clientId: 'Client', contactId: 'Client contact' })[field] || field).join(', ')}</p>}
          {event.reason && <p>{event.reason}</p>}
        </li>)}</ol> : <Empty title="No recorded activity">Changes to this lead will appear here.</Empty>}
        <CursorPager count={items.length} label="event" pages={pages} setPages={setPages} next={next} previousLabel="Previous activity" nextLabel="Older activity" />
      </>}
    </div>
  )
}
