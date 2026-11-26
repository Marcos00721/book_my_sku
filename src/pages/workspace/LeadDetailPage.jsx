import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pencil, RefreshCw } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { acceptedLead, leadFields, leadStages } from '../../services/leads'
import { queryPath } from '../../services/workspace'
import { dateLabel } from '../../utils/format'
import { Badge } from '../../components/common/Badge'
import { TextLink } from '../../components/common/TextLink'
import { RichText } from '../../components/common/RichText'
import { LeadActivity } from '../../components/leads/LeadActivity'
import { LeadEditor } from '../../components/leads/LeadEditor'
import { LeadConversion, LinkedLeadProject } from '../../components/leads/LeadConversion'
import { Action, Empty, ErrorNotice, Loading, PermissionDenied, StickyPageChrome } from '../../components/workspace/Elements'
import '../../styles/leads.css'

export function LeadDetailPage() {
  const workspace = useWorkspace()
  const { leadId } = useParams()
  if (!workspace.can('inquiries.view')) return <PermissionDenied />
  if (!/^[a-f\d]{24}$/i.test(leadId || '')) return <Empty title="Lead not found" action={<TextLink to="/app/leads">Back to leads</TextLink>}>This lead link is invalid.</Empty>
  return <LeadRecord key={`${workspace.base}:${leadId}`} path={`${workspace.base}/inquiries/${leadId}`} />
}

function LeadRecord({ path }) {
  const workspace = useWorkspace()
  const resource = useResource(path)
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(null)
  const [conversion, setConversion] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [flash, setFlash] = useState('')
  if (resource.loading) return <Loading variant="detail" label="Loading lead…" backTo="/app/leads" backLabel="Back to leads" />
  if (resource.error) return <><TextLink to="/app/leads" className="back-link"><ArrowLeft size={16} />Back to leads</TextLink><ErrorNotice error={resource.error} retry={resource.reload} /></>
  const lead = resource.data
  const accepted = acceptedLead(lead)
  const terminal = ['closed', 'converted'].includes(lead.stage)
  const editable = workspace.can('inquiries.edit') && workspace.writesAllowed && !terminal
  const canConvert = editable && workspace.can('projects.add') && workspace.can('clients.view') && (!lead.contactId || workspace.can('contacts.view')) && lead.stage === 'qualified' && Boolean(lead.clientId)

  function saved(message, result) {
    setEditing(null)
    setConversion(false)
    if (result?.reference) setReceipt(result)
    setFlash(message)
    resource.reload()
  }

  return (
    <StickyPageChrome className="lead-detail-page" title={accepted.companyName || 'Lead'}
      description="Lead details and qualification"
      before={<TextLink to="/app/leads" className="back-link"><ArrowLeft size={16} />Back to leads</TextLink>}
      meta={<div className="lead-meta"><Badge tone={leadStages[lead.stage]?.tone}>{leadStages[lead.stage]?.label || 'Unknown'}</Badge><span className="muted">{lead.source === 'manual' ? 'Staff entry' : 'Public form'} · Created {dateLabel(lead.createdAt)}</span></div>}
      actions={<>
        <Action variant="secondary" onClick={resource.reload} aria-label="Refresh lead"><RefreshCw size={16} />Refresh</Action>
        {editable && <Action variant="secondary" onClick={() => setEditing('')}><Pencil size={15} />Edit lead</Action>}
        {editable && ['new', 'reviewing'].includes(lead.stage) && <Action onClick={() => setEditing(lead.stage === 'new' ? 'review' : 'qualify')}>{lead.stage === 'new' ? 'Start reviewing' : 'Mark qualified'}<ArrowRight size={16} /></Action>}
        {canConvert && <Action onClick={() => setConversion(true)}>Convert to project<ArrowRight size={16} /></Action>}
      </>}
      tabs={{ label: 'Lead information', value: tab, onChange: setTab, items: [{ value: 'overview', label: 'Overview' }, { value: 'submission', label: 'Original submission' }, { value: 'activity', label: 'Activity' }] }}>
      {flash && <p className="notice" role="status">{flash}</p>}
      {lead.stage === 'qualified' && !lead.clientId && <div className="notice lead-waiting"><strong>Waiting for Client selection</strong><p>Select an active client before converting this qualified lead.</p>{editable && workspace.can('clients.view') && <Action variant="secondary" onClick={() => setEditing('')}>Select client</Action>}</div>}
      {lead.stage === 'converted' && <LinkedLeadProject lead={lead} reference={receipt?.reference} />}
      {lead.stage === 'closed' && <p className="notice"><strong>Lead closed.</strong> {lead.closeReason}</p>}
      <section className="panel" role="tabpanel" aria-label={tab === 'activity' ? 'Activity' : tab === 'submission' ? 'Original submission' : 'Overview'}>
        {tab === 'activity' ? <LeadActivity key={lead.revision} path={path} /> : <>
          <h2>{tab === 'submission' ? 'Original submission' : 'Contact and requirement'}</h2>
          {tab === 'submission' && <p className="muted">The original capture is kept for reference. Accepted corrections appear in Overview.</p>}
          <LeadSnapshot value={tab === 'submission' ? lead.submitted : accepted} />
          {tab === 'overview' && <LeadRelationships lead={lead} />}
        </>}
      </section>
      {editing !== null && editable && <LeadEditor lead={lead} path={path} initialTransition={editing} close={() => setEditing(null)} saved={() => saved('Lead updated.')} />}
      {conversion && canConvert && <LeadConversion lead={lead} path={path} close={() => setConversion(false)} saved={result => saved(result.alreadyConverted ? 'This lead was already converted. Latest details loaded.' : 'Lead converted to project.', result)} />}
    </StickyPageChrome>
  )
}

function LeadSnapshot({ value = {} }) {
  return <>
    <dl className="lead-detail-grid">{Object.entries(leadFields).filter(([key]) => key !== 'requirement').map(([key, label]) => <div key={key}>
      <dt>{label}</dt><dd>{key === 'requestedInHandsDate' ? value[key] || 'Not provided' : value[key] || 'Not provided'}</dd>
    </div>)}</dl>
    <div className="lead-requirement"><h3>Requirement</h3><RichText value={value.requirement || ''} /></div>
  </>
}

function LeadRelationships({ lead }) {
  const workspace = useWorkspace()
  const owners = useResource(workspace.can('inquiries.edit') ? queryPath(`${workspace.base}/assignment-options`, { purpose: 'inquiry', limit: 50 }) : null)
  const client = useResource(lead.clientId && workspace.can('clients.view') ? `${workspace.base}/clients/${lead.clientId}` : null)
  const contact = useResource(lead.clientId && lead.contactId && workspace.can('contacts.view') ? `${workspace.base}/clients/${lead.clientId}/contacts/${lead.contactId}` : null)
  const owner = owners.data?.items?.find(item => item.actorId === lead.ownerId)
  return <div className="lead-relationships"><h3>Assignment and client</h3><dl className="lead-detail-grid">
    <div><dt>Lead owner</dt><dd>{owner?.label || (lead.ownerId ? `Saved member · ${lead.ownerId}` : 'Unavailable')}</dd></div>
    <div><dt>Client</dt><dd>{!lead.clientId ? 'Not selected' : client.data ? <TextLink to={`/app/clients/${lead.clientId}`}>{client.data.name}{client.data.status === 'archived' ? ' (archived)' : ''}</TextLink> : client.loading ? 'Loading…' : 'Saved client unavailable'}</dd></div>
    <div><dt>Client contact</dt><dd>{!lead.contactId ? 'Not selected' : contact.data ? `${contact.data.name}${contact.data.active === false ? ' (archived)' : ''}` : contact.loading ? 'Loading…' : 'Saved contact unavailable'}</dd></div>
  </dl></div>
}
