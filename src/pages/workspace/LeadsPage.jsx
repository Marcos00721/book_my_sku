import { useState } from 'react'
import { Building2, RefreshCw, Search, UserRoundSearch } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { queryPath } from '../../services/workspace'
import { dateLabel } from '../../utils/format'
import { Badge } from '../../components/common/Badge'
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

const stages = {
  new: { label: 'New', tone: 'info' },
  reviewing: { label: 'Reviewing', tone: 'warning' },
  qualified: { label: 'Qualified', tone: 'success' },
  converted: { label: 'Converted', tone: 'primary' },
  closed: { label: 'Closed', tone: 'default' },
}

const columns = [
  {
    key: 'company',
    label: 'Company',
    render: (lead) => (
      <span className="entity-link lead-company">
        <span className="entity-icon">
          <Building2 size={17} aria-hidden="true" />
        </span>
        <span>
          {lead.corrections?.companyName ?? lead.submitted?.companyName ?? 'Unnamed company'}
        </span>
      </span>
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
  if (!workspace.can('inquiries.view')) return <PermissionDenied />

  return (
    <>
      <PageHeader
        title="Leads"
        description="Keep track of incoming interest, from first inquiry to a qualified opportunity."
      />
      <LeadsDirectory key={workspace.base} path={`${workspace.base}/inquiries`} />
    </>
  )
}

function LeadsDirectory({ path }) {
  const [draft, setDraft] = useState('')
  const [stage, setStage] = useState('')
  const search = useDebouncedValue(draft.trim(), 400)
  const filterKey = JSON.stringify([search, stage])
  const [pagination, setPagination] = useState({ filterKey, pages: [] })
  // Cursors are bound to the exact search and stage by the backend.
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
      before: before ? JSON.stringify(before) : undefined,
    }),
  )
  const items = resource.data?.items || []
  const filtered = Boolean(search || stage)
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
    setPagination({ filterKey: JSON.stringify(['', '']), pages: [] })
  }

  return (
    <section className="panel" aria-label="Lead list">
      <div className="toolbar leads-toolbar">
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
        <div className="leads-toolbar-actions">
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
          {(draft || stage) && (
            <Action variant="text-button" onClick={resetFilters}>
              Clear filters
            </Action>
          )}
          <Action
            variant="secondary"
            aria-label="Refresh leads"
            onClick={resource.reload}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </Action>
        </div>
      </div>
      <p className="muted leads-search-hint">
        Search matches the start of the company name. Newest leads appear first.
      </p>
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
                ? 'Try another company name or choose a different stage.'
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
    </section>
  )
}
