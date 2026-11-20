import { useMemo, useState } from 'react'
import { Archive, History, Layers, Pencil, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useReferenceOrdering } from '../../hooks/useReferenceOrdering'
import { queryPath, readData } from '../../services/workspace'
import { ActivityHistory } from '../../components/workspace/RecordTools'
import { ReferenceEntryEditor } from '../../components/masterData/ReferenceEntryEditor'
import { ReferenceDragHandle } from '../../components/masterData/ReferenceDragHandle'
import { ReferenceDraggableRow } from '../../components/masterData/ReferenceDraggableRow'
import { ReferenceDragPreview } from '../../components/masterData/ReferenceDragPreview'
import { Badge } from '../../components/common/Badge'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  ListSkeleton,
  PermissionDenied,
  Status,
  StickyPageChrome,
} from '../../components/workspace/Elements'
import { askConfirm } from '../../components/common/confirm'
import '../../styles/reference-lists.css'

const categoryDetails = {
  industry: {
    label: 'Industries', singular: 'industry', article: 'an', example: 'e.g. Education',
    description: 'Organize clients and suppliers by the industries they serve.',
  },
  product_category: {
    label: 'Product categories', singular: 'product category', article: 'a', example: 'e.g. Drinkware',
    description: 'Keep your product catalog organized with consistent categories.',
  },
  decoration_method: {
    label: 'Decoration methods', singular: 'decoration method', article: 'a', example: 'e.g. Screen printing',
    description: 'Define the techniques used to personalize your products.',
  },
  decoration_location: {
    label: 'Decoration locations', singular: 'decoration location', article: 'a', example: 'e.g. Front chest',
    description: 'Define where decoration can be placed on your products.',
  },
}

export function MasterDataPage() {
  const workspace = useWorkspace()
  if (!workspace.can('master_data.view')) return <PermissionDenied />
  return <ReferenceLists key={workspace.base} workspace={workspace} />
}

function ReferenceLists({ workspace }) {
  const [category, setCategory] = useState('industry')
  const [status, setStatus] = useState('active')
  const [pagination, setPagination] = useState({ key: '', pages: [] })
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [searchReset, setSearchReset] = useState(0)
  const [activity, setActivity] = useState(false)
  const [historyEntry, setHistoryEntry] = useState(null)
  const [drag, setDrag] = useState(null)
  const searchInput = useMemo(() => ({ value: search.trim(), reset: searchReset }), [search, searchReset])
  const debouncedInput = useDebouncedValue(searchInput, 400)
  // Category changes and explicit resets must never use the previous search.
  const debouncedSearch = debouncedInput.reset === searchReset ? debouncedInput.value : ''
  const searching = debouncedSearch !== search.trim()
  const filterKey = JSON.stringify([category, status, debouncedSearch])
  const history = pagination.key === filterKey ? pagination.pages : []
  const details = categoryDetails[category]
  const path = queryPath(`${workspace.base}/master-data/${category}`, {
    status,
    limit: 25,
    after: history.at(-1),
    search: debouncedSearch,
  })
  const entries = useResource(!activity ? path : null)
  const loading = entries.loading
  const canEdit = workspace.owner && workspace.writesAllowed
  const canReorder = canEdit && status === 'active' && !search.trim() && !debouncedSearch && !loading && !searching && !activity
  const ordering = useReferenceOrdering({
    base: `${workspace.base}/master-data/${category}`,
    items: entries.data?.items || [],
    enabled: canReorder,
    reload: entries.reload,
    refresh: async () => {
      // Reassigned positions invalidate page boundaries stored in old cursors.
      if (history.length) resetPagination()
      else entries.accept(await readData(path))
    },
  })
  const interactionLocked = ordering.locked || Boolean(drag)

  function resetPagination() {
    setPagination({ key: '', pages: [] })
  }

  function clearFilters() {
    setSearch('')
    setSearchReset((value) => value + 1)
    setStatus('active')
    resetPagination()
  }

  function createButton() {
    return canEdit && (
      <Action disabled={interactionLocked} onClick={() => setEditing({})}>
        <Plus size={17} aria-hidden="true" />
        Create {details.singular}
      </Action>
    )
  }

  const tabItems = [
    ...Object.entries(categoryDetails).map(([value, details]) => ({ value, label: details.label, disabled: interactionLocked })),
    ...(workspace.owner ? [{ value: '__activity__', label: 'Activity', disabled: interactionLocked }] : []),
  ]

  return (
    <>
      <StickyPageChrome
        title="Business reference lists"
        description="Manage workspace industries, product categories, decoration methods and locations."
        className="reference-lists"
        actions={!activity && createButton()}
        tabs={{
          label: 'Reference categories',
          value: activity ? '__activity__' : category,
          onChange: (value) => {
            if (value === '__activity__') {
              setActivity(true)
              return
            }
            setCategory(value)
            setActivity(false)
            resetPagination()
            setSearch('')
            setSearchReset((value) => value + 1)
            setStatus('active')
          },
          items: tabItems,
        }}
      >
        <section
          className="panel reference-list-panel"
          role="tabpanel"
          aria-label={activity ? 'Reference list activity' : details.label}
          aria-busy={!activity && (loading || searching || ordering.phase === 'saving')}
        >
          {activity ? (
            <ActivityHistory
              key={category}
              path={`${workspace.base}/master-data/history`}
              actions={[
                'master.create',
                'master.update',
                'master.archive',
                'master.restore',
              ]}
            />
          ) : (
            <>
              <div className="reference-list-heading">
                <span className="reference-list-icon"><Layers size={21} aria-hidden="true" /></span>
                <div>
                  <h2>{details.label}</h2>
                  <p className="muted">{details.description}</p>
                </div>
              </div>
              <div className="toolbar reference-list-toolbar">
                <Field
                  className="reference-list-search"
                  type="search"
                  label={`Search ${details.label.toLowerCase()}`}
                  placeholder="Search by name…"
                  icon={<Search size={17} aria-hidden="true" />}
                  value={search}
                  disabled={interactionLocked}
                  maxLength={80}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    resetPagination()
                  }}
                />
                <div className="reference-list-filters">
                  <Field
                    className="reference-list-status"
                    label="Status"
                    searchable={false}
                    value={status}
                    disabled={interactionLocked}
                    onChange={(event) => {
                      setStatus(event.target.value)
                      resetPagination()
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="all">All statuses</option>
                  </Field>
                  {(search || status !== 'active') && (
                    <Action variant="text-button" disabled={interactionLocked} onClick={clearFilters}>Clear filters</Action>
                  )}
                  <Action
                    variant="secondary"
                    aria-label={`Refresh ${details.label.toLowerCase()}`}
                    disabled={loading || searching || interactionLocked}
                    onClick={entries.reload}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Refresh
                  </Action>
                </div>
              </div>
              {!workspace.owner && (
                <p className="muted">
                  You can view this list. Only the workspace owner can change its
                  entries.
                </p>
              )}
              <ErrorNotice
                error={entries.error}
                retry={entries.reload}
              />
              {canEdit && (
                <div className="reference-order-toolbar">
                  <p id="reference-order-instructions" className="muted">
                    {canReorder
                      ? <>Drag the handle beside a name to reorder.<span className="sr-only"> Focus a handle and use the up and down arrow keys to reorder with a keyboard.</span></>
                      : 'Show active entries and clear search to drag entries into order.'}
                  </p>
                  <span role="status" aria-live="polite" className={drag ? 'sr-only' : 'reference-order-status'}>
                    {drag ? `Moving “${drag.entry.label}” · Release to drop, Esc to cancel`
                      : ordering.phase === 'saving'
                      ? `Saving order${ordering.total ? ` (${ordering.completed}/${ordering.total})` : ''}…`
                      : ordering.message}
                  </span>
                </div>
              )}
              {ordering.error && (
                <div className="reference-order-error">
                  <ErrorNotice error={ordering.error} />
                  <p>Order could not be fully saved. {ordering.uncertain ? 'Retry to finish saving the same order.' : 'Reload the list to review its current order.'}</p>
                  <Action variant="secondary" onClick={ordering.uncertain ? ordering.retry : ordering.reset}>
                    {ordering.uncertain ? 'Retry saving order' : 'Reload list'}
                  </Action>
                </div>
              )}
              {loading ? (
                <ListSkeleton label="Loading reference lists…" columns={['Name', 'Description', 'Source', 'Status', 'Actions']} />
              ) : entries.data?.items?.length ? (
                <div className="table-scroll">
                  <table className="data-table reference-list-table" aria-label={details.label}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordering.items.map((entry, index) => (
                        <ReferenceDraggableRow
                          key={entry.id}
                          entry={entry}
                          disabled={!canReorder || ordering.locked}
                          drag={drag}
                          setDrag={setDrag}
                          move={ordering.move}
                          data-reference-id={entry.id}
                          className={[
                            drag?.from === entry.id ? 'reference-row-dragging' : '',
                            drag?.to === entry.id && drag.from !== entry.id
                              ? `reference-row-drop-${ordering.items.findIndex((item) => item.id === drag.from) < index ? 'after' : 'before'}`
                              : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <td data-label="Name" className="reference-entry-name">
                            <div className="reference-entry-name-content">
                              {canEdit && <ReferenceDragHandle
                                entry={entry}
                                items={ordering.items}
                                disabled={!canReorder || ordering.locked}
                                dragging={drag?.from === entry.id}
                                move={ordering.move}
                              />}
                              <strong>{entry.label}</strong>
                            </div>
                          </td>
                          <td data-label="Description" className="reference-entry-summary">
                            {entry.description || <span className="muted">No description</span>}
                          </td>
                          <td data-label="Source">
                            <Badge tone={entry.source ? 'info' : 'default'}>
                              {entry.source
                                ? `Template v${entry.source.version}`
                                : 'Workspace entry'}
                            </Badge>
                          </td>
                          <td data-label="Status">
                            <Status value={entry.status} />
                          </td>
                          <td data-label="Actions" className="reference-entry-actions">
                            <div className="actions reference-entry-action-group">
                              {canEdit && (
                                entry.status === 'active' ? (
                                  <>
                                    <Action
                                      variant="text-button"
                                      aria-label={`Edit ${entry.label}`}
                                      disabled={interactionLocked}
                                      onClick={() => setEditing(entry)}
                                    >
                                      <Pencil size={15} aria-hidden="true" /> Edit
                                    </Action>
                                    <EntryStatusButton
                                      entry={entry}
                                      path={`${workspace.base}/master-data/${category}/${entry.id}/archive`}
                                      label="Archive"
                                      saved={entries.reload}
                                      disabled={interactionLocked}
                                    />
                                  </>
                                ) : (
                                  <EntryStatusButton
                                    entry={entry}
                                    path={`${workspace.base}/master-data/${category}/${entry.id}/restore`}
                                    label="Restore"
                                    saved={entries.reload}
                                    disabled={interactionLocked}
                                  />
                                )
                              )}
                              {workspace.owner && (
                                <Action
                                  variant="text-button"
                                  aria-label={`View history for ${entry.label}`}
                                  disabled={interactionLocked}
                                  onClick={() => setHistoryEntry(entry)}
                                >
                                  <History size={15} aria-hidden="true" /> History
                                </Action>
                              )}
                              {!workspace.owner && <span className="muted">View only</span>}
                            </div>
                          </td>
                        </ReferenceDraggableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !entries.error && (
                  <Empty
                    icon={status === 'archived' ? <Archive size={26} aria-hidden="true" /> : <Layers size={26} aria-hidden="true" />}
                    title={debouncedSearch ? 'No matching entries' : `No ${status === 'archived' ? 'archived ' : ''}${details.label.toLowerCase()} yet`}
                    action={debouncedSearch || status !== 'active'
                      ? <Action variant="secondary" onClick={clearFilters}>Clear filters</Action>
                      : createButton()}
                  >
                    {debouncedSearch
                      ? 'Try a different name or clear your filters.'
                      : status === 'archived'
                        ? 'Archived entries will appear here. You can restore them when needed.'
                        : `Add your first ${details.singular} to keep your team’s choices consistent.`}
                  </Empty>
                )
              )}
              {entries.data && !loading && !entries.error && (
                <div className="table-bottom">
                  <span>Page {history.length + 1} · {entries.data.items.length} {entries.data.items.length === 1 ? 'entry' : 'entries'} shown</span>
                  <div className="actions">
                    <Action
                      variant="secondary"
                      disabled={!history.length || searching || interactionLocked}
                      onClick={() => setPagination({ key: filterKey, pages: history.slice(0, -1) })}
                    >
                      Previous
                    </Action>
                    <Action
                      variant="secondary"
                      disabled={!entries.data.next || searching || interactionLocked}
                      onClick={() =>
                        setPagination({ key: filterKey, pages: [...history, entries.data.next] })
                      }
                    >
                      Next
                    </Action>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </StickyPageChrome>
      <ReferenceDragPreview drag={drag} items={ordering.items} />
      {historyEntry && (
        <Dialog
          title={`${historyEntry.label} history`}
          close={() => setHistoryEntry(null)}
        >
          <ActivityHistory
            path={`${workspace.base}/master-data/history`}
            filters={{ category, entryId: historyEntry.id }}
          />
        </Dialog>
      )}
      {editing && (
        <ReferenceEntryEditor
          key={`${category}:${editing.id || 'new'}`}
          base={`${workspace.base}/master-data/${category}`}
          entry={editing}
          category={details}
          close={() => setEditing(null)}
          saved={() => {
            if (!editing.id) clearFilters()
            setEditing(null)
            entries.reload()
          }}
        />
      )}
    </>
  )
}

function EntryStatusButton({ entry, path, label, saved, disabled }) {
  const mutation = useMutation()
  return (
    <>
      <Action
        variant="text-button"
        aria-label={`${mutation.uncertain ? `Retry ${label.toLowerCase()}` : label} ${entry.label}`}
        disabled={mutation.pending || disabled}
        onClick={async () => {
          if (!mutation.uncertain) {
            const ok = await askConfirm({
              title: `${label} “${entry.label}”?`,
              message: `${label} ${entry.label}? Existing references and history remain available.`,
              confirmLabel: label,
              cancelLabel: 'Cancel',
            })
            if (!ok) return
          }
          if (
            await mutation.run('post', path, {
              expectedRevision: entry.revision,
            })
          )
            saved()
        }}
      >
        {label === 'Archive' ? <Archive size={15} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}
        {mutation.pending
          ? 'Saving…'
          : mutation.uncertain
            ? 'Retry same action'
            : label}
      </Action>
      <ErrorNotice error={mutation.error} />
    </>
  )
}
