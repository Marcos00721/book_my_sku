import { useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import {
  ActivityHistory,
  ConflictReview,
} from '../../components/workspace/RecordTools'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PermissionDenied,
  SaveFooter,
  Status,
  StickyPageChrome,
} from '../../components/workspace/Elements'

const labels = {
  industry: 'Industries',
  product_category: 'Product categories',
  decoration_method: 'Decoration methods',
  decoration_location: 'Decoration locations',
}

export function MasterDataPage() {
  const workspace = useWorkspace()
  const [category, setCategory] = useState('industry')
  const [status, setStatus] = useState('active')
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [activity, setActivity] = useState(false)
  const [historyEntry, setHistoryEntry] = useState(null)
  const allowed = workspace.can('master_data.view')
  const categories = useResource(
    allowed ? `${workspace.base}/master-data/categories` : null,
  )
  const path = queryPath(`${workspace.base}/master-data/${category}`, {
    status,
    limit: 25,
    after: history.at(-1),
    search,
  })
  const entries = useResource(allowed ? path : null)
  const canEdit = workspace.owner && workspace.writesAllowed
  if (!allowed) return <PermissionDenied />

  const tabItems = [
    ...Object.entries(labels).map(([value, label]) => ({ value, label })),
    ...(workspace.owner ? [{ value: '__activity__', label: 'Activity' }] : []),
  ]

  return (
    <>
      <StickyPageChrome
        title="Business reference lists"
        description="Manage workspace industries, product categories, decoration methods and locations."
        actions={
          canEdit && <Action onClick={() => setEditing({})}>Create</Action>
        }
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
            setHistory([])
            setSearch('')
          },
          items: tabItems,
        }}
      >
        <section className="panel" role="tabpanel">
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
              <div className="toolbar">
                <Field
                  label="Find reference entries"
                  value={search}
                  maxLength={80}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setHistory([])
                  }}
                />
                <Field
                  label="List"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value)
                    setHistory([])
                  }}
                >
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Field>
                <Field
                  label="Status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value)
                    setHistory([])
                  }}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </Field>
                <Action variant="secondary" onClick={() => entries.reload()}>
                  Refresh
                </Action>
              </div>
              {!workspace.owner && (
                <p className="muted">
                  You can view this list. Only the workspace owner can change its
                  entries.
                </p>
              )}
              <ErrorNotice
                error={categories.error || entries.error}
                retry={() => {
                  categories.reload()
                  entries.reload()
                }}
              />
              {categories.loading || entries.loading ? (
                <Loading label="Loading reference lists…" />
              ) : entries.data?.items?.length ? (
                <div className="table-scroll">
                  <table className="data-table">
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
                      {entries.data.items.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <strong>{entry.label}</strong>
                            <small>Sort order {entry.sortOrder}</small>
                          </td>
                          <td>{entry.description || '—'}</td>
                          <td>
                            {entry.source
                              ? `Template v${entry.source.version}`
                              : 'Workspace entry'}
                          </td>
                          <td>
                            <Status value={entry.status} />
                          </td>
                          <td>
                            {canEdit && (
                              <div className="actions">
                                {entry.status === 'active' ? (
                                  <>
                                    <Action
                                      variant="secondary"
                                      onClick={() => setEditing(entry)}
                                    >
                                      Edit
                                    </Action>
                                    <EntryStatusButton
                                      entry={entry}
                                      path={`${workspace.base}/master-data/${category}/${entry.id}/archive`}
                                      label="Archive"
                                      saved={entries.reload}
                                    />
                                  </>
                                ) : (
                                  <EntryStatusButton
                                    entry={entry}
                                    path={`${workspace.base}/master-data/${category}/${entry.id}/restore`}
                                    label="Restore"
                                    saved={entries.reload}
                                  />
                                )}
                              </div>
                            )}
                            {workspace.owner && (
                              <Action
                                variant="text-button"
                                onClick={() => setHistoryEntry(entry)}
                              >
                                History
                              </Action>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !entries.error && (
                  <Empty title="No entries yet">
                    {category === 'decoration_location'
                      ? 'An older workspace may have no decoration locations. Its owner can add independent local entries.'
                      : 'New workspaces receive the published BookMySku starter lists. Owners can add labels that fit their business.'}
                  </Empty>
                )
              )}
              {entries.data && (
                <div className="table-bottom">
                  <span>{entries.data.items.length} entries</span>
                  <div className="actions">
                    <Action
                      variant="secondary"
                      disabled={!history.length}
                      onClick={() => setHistory((items) => items.slice(0, -1))}
                    >
                      Previous
                    </Action>
                    <Action
                      variant="secondary"
                      disabled={!entries.data.next}
                      onClick={() =>
                        setHistory((items) => [...items, entries.data.next])
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
        <EntryEditor
          key={`${category}:${editing.id || 'new'}`}
          base={`${workspace.base}/master-data/${category}`}
          entry={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null)
            entries.reload()
          }}
        />
      )}
    </>
  )
}

function EntryStatusButton({ entry, path, label, saved }) {
  const mutation = useMutation()
  return (
    <>
      <Action
        variant="secondary"
        disabled={mutation.pending}
        onClick={async () => {
          if (
            !mutation.uncertain &&
            !window.confirm(
              `${label} ${entry.label}? Existing references and history remain available.`,
            )
          )
            return
          if (
            await mutation.run('post', path, {
              expectedRevision: entry.revision,
            })
          )
            saved()
        }}
      >
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

function EntryEditor({ base, entry, close, saved }) {
  const [label, setLabel] = useState(entry.label || '')
  const [description, setDescription] = useState(entry.description || '')
  const [sortOrder, setSortOrder] = useState(entry.sortOrder ?? 0)
  const mutation = useMutation()
  const [revision, setRevision] = useState(entry.revision)
  async function submit(event) {
    event.preventDefault()
    const result = await mutation.run(
      entry.id ? 'patch' : 'post',
      entry.id ? `${base}/${entry.id}` : base,
      {
        ...(entry.id ? { expectedRevision: revision } : {}),
        label: label.trim(),
        description: description.trim() || null,
        sortOrder: Number(sortOrder),
      },
    )
    if (result) saved()
  }
  return (
    <Dialog
      title={entry.id ? 'Edit' : 'Create'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Name"
            required
            maxLength={120}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Field
            label="Description"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Field
            label="Sort order"
            type="number"
            min="0"
            max="10000"
            step="1"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
          {entry.source && (
            <p className="muted">
              This entry came from a published template. Editing it changes only
              this workspace.
            </p>
          )}
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={entry.id ? `${base}/${entry.id}` : null}
          values={{ label, description, sortOrder }}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={entry.id ? 'Save' : 'Create'}
        />
      </form>
    </Dialog>
  )
}
