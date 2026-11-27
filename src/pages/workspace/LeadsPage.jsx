import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowDownWideNarrow, Building2, Plus, RefreshCw, RotateCcw, Search, Settings2, SlidersHorizontal, UserRoundSearch } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { queryPath } from '../../services/workspace'
import { dateLabel } from '../../utils/format'
import { Badge } from '../../components/common/Badge'
import { TextLink } from '../../components/common/TextLink'
import { LeadForm } from '../../components/leads/LeadForm'
import { canAddLead, leadStages as stages } from '../../services/leads'
import { LeadOwnerPicker } from '../../components/leads/LeadPickers'
import { LeadFormSettings } from '../../components/leads/LeadFormSettings'
import {
  Action,
  CursorPager,
  Empty,
  EntityDataTable,
  ErrorNotice,
  Field,
  ListSkeleton,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'
import '../../styles/leads.css'

const columns = [
  {
    key: 'company',
    label: 'Company',
    render: (lead) => (
      <TextLink to={`/app/leads/${lead._id}`} className="entity-link lead-company">
        <span className="entity-icon">
          <Building2 size={17} aria-hidden="true" />
        </span>
        <span>
          {lead.corrections?.companyName ?? lead.submitted?.companyName ?? 'Unnamed company'}
        </span>
      </TextLink>
    ),
  },
  {
    key: 'stage',
    label: 'Stage',
    render: (lead) => (
      <Badge tone={stages[lead.stage]?.tone}>
        {stages[lead.stage]?.label || 'Unknown'}
      </Badge>
    ),
  },
  {
    key: 'source',
    label: 'Source',
    render: (lead) =>
      ({ manual: 'Staff entry', public: 'Public form' })[lead.source] || 'Unknown',
  },
  {
    key: 'created',
    label: 'Created',
    className: 'muted lead-created',
    render: (lead) => dateLabel(lead.createdAt),
  },
]

export function LeadsPage() {
  const workspace = useWorkspace()
  const location = useLocation()
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState(0)
  const [flash, setFlash] = useState('')
  const [settings, setSettings] = useState(false)
  if (!workspace.can('inquiries.view')) return <PermissionDenied />
  const canCreate = canAddLead(workspace)
  const createUnavailable = !canCreate
    ? 'Your role does not include permission to add leads.'
    : !workspace.writesAllowed ? 'Workspace changes are paused.' : undefined

  return (
    <div className="leads-page">
      <PageHeader
        title="Leads"
        description="Keep track of incoming interest, from first inquiry to a qualified opportunity."
        actions={<>
          {workspace.owner && <Action variant="secondary" onClick={() => setSettings(true)}><Settings2 size={16} aria-hidden="true" />Intake settings</Action>}
          {canCreate && <Action disabled={Boolean(createUnavailable)} title={createUnavailable} onClick={() => setCreating(true)}><Plus size={16} />Add lead</Action>}
        </>}
      />
      {flash && <p className="notice" role="status">{flash}</p>}
      <LeadsDirectory key={`${workspace.base}:${location.state?.createdLead || ''}:${version}`} path={`${workspace.base}/inquiries`} />
      {creating && canCreate && workspace.writesAllowed && <LeadForm path={`${workspace.base}/inquiries`} close={() => setCreating(false)} saved={() => {
        setCreating(false)
        setVersion(value => value + 1)
        setFlash('Lead added.')
      }} />}
      {settings && <LeadFormSettings close={() => setSettings(false)} />}
    </div>
  )
}

function LeadsDirectory({ path }) {
  const workspace = useWorkspace()
  const [draft, setDraft] = useState('')
  const [stage, setStage] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const search = useDebouncedValue(draft.trim(), 400)
  const filterKey = JSON.stringify([search, stage, ownerId])
  const [pagination, setPagination] = useState({ filterKey, pages: [] })
  // Cursors are bound to the exact search, stage, and owner by the backend.
  const pages = pagination.filterKey === filterKey ? pagination.pages : []
  function setPages(update) {
    setPagination({ filterKey, pages: update(pages) })
  }
  const before = pages.at(-1)
  const resource = useResource(
    queryPath(path, {
      limit: 25,
      search,
      stage,
      ownerId,
      before: before ? JSON.stringify(before) : undefined,
    }),
  )
  const items = resource.data?.items || []
  const filtered = Boolean(search || stage || ownerId)
  const activeFilterCount = [draft.trim(), stage, ownerId].filter(Boolean).length
  const error =
    resource.error?.status === 404
      ? {
          ...resource.error,
          message: 'Leads are not available for this workspace yet. Please try again later.',
        }
      : resource.error

  function resetFilters() {
    setDraft('')
    setStage('')
    setOwnerId('')
    setPagination({ filterKey: JSON.stringify(['', '', '']), pages: [] })
  }

  return (
    <section className="panel leads-directory" aria-label="Lead list">
      <div className="leads-filters" role="search" aria-label="Filter leads">
        <div className="leads-filters-heading">
          <div className="leads-filter-title">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <h2>Filters</h2>
            {activeFilterCount > 0 && <span className="leads-filter-count">{activeFilterCount} active</span>}
          </div>
          <Action variant="text-button" className="leads-clear-filters" disabled={!activeFilterCount} onClick={resetFilters}>
            <RotateCcw size={14} aria-hidden="true" />
            Clear filters
          </Action>
        </div>
        <div className={`leads-filter-fields${workspace.can('inquiries.edit') ? ' leads-filter-fields--with-owner' : ''}`}>
          <Field
            className="leads-search"
            type="search"
            label="Search leads"
            icon={<Search size={17} aria-hidden="true" />}
            placeholder="Search by company name…"
            maxLength={80}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setPagination({ filterKey: '', pages: [] })
            }}
          />
          <Field
            className="leads-stage"
            label="Lead stage"
            value={stage}
            searchable={false}
            onChange={(event) => {
              setStage(event.target.value)
              setPagination({ filterKey: '', pages: [] })
            }}
          >
            <option value="">All stages</option>
            {Object.entries(stages).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Field>
          {workspace.can('inquiries.edit') && (
            <LeadOwnerPicker label="Lead owner filter" emptyLabel="All owners" value={ownerId} onChange={setOwnerId} filter />
          )}
        </div>
        <p className="leads-search-hint">
          Search matches the start of the company name.
        </p>
      </div>
      <div className="leads-results-heading">
        <div className="leads-results-title">
          <h2>{filtered ? 'Filtered leads' : 'All leads'}</h2>
          <span className="leads-sort-label"><ArrowDownWideNarrow size={14} aria-hidden="true" />Newest first</span>
        </div>
        <Action variant="secondary" aria-label="Refresh leads" onClick={resource.reload}>
          <RefreshCw size={15} aria-hidden="true" />
          Refresh
        </Action>
      </div>
      <div className="leads-results">
        <ErrorNotice error={error} retry={resource.reload} />
        {resource.loading ? (
          <ListSkeleton label="Loading leads…" columns={columns.map((column) => column.label)} />
        ) : !error && (
          <>
            {items.length ? (
              <EntityDataTable columns={columns} rows={items} rowKey={(lead) => lead._id} />
            ) : (
              <Empty
                title={filtered ? 'No matching leads' : 'No leads yet'}
                icon={<UserRoundSearch size={24} aria-hidden="true" />}
                action={filtered ? (
                  <Action variant="secondary" onClick={resetFilters}>Clear filters</Action>
                ) : null}
              >
                {filtered
                  ? 'Try another company name or adjust the stage or owner filters.'
                  : 'Your incoming inquiries will appear here as leads.'}
              </Empty>
            )}
            {(items.length > 0 || pages.length > 0) && (
              <CursorPager
                count={items.length}
                label="lead"
                pages={pages}
                setPages={setPages}
                next={resource.data?.next}
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}
