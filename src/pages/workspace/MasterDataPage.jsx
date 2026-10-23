import { useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { Action, Dialog, Empty, ErrorNotice, Field, Loading, PageHeader, PermissionDenied, SaveFooter, Status } from '../../components/workspace/Elements'

const labels = { industry: 'Industries', product_category: 'Product categories', decoration_method: 'Decoration methods' }

export function MasterDataPage() {
  const workspace = useWorkspace()
  const [category, setCategory] = useState('industry')
  const [status, setStatus] = useState('active')
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(null)
  const categories = useResource(`${workspace.base}/master-data/categories`)
  const path = queryPath(`${workspace.base}/master-data/${category}`, { status, limit: 25, after: history.at(-1) })
  const entries = useResource(path)
  const canEdit = workspace.owner && workspace.writesAllowed
  if (!workspace.owner && !workspace.can('master_data.view')) return <PermissionDenied />
  return <>
    <PageHeader title="Business reference lists" description="Manage the labels your workspace uses for industries, product categories, and decoration methods." actions={canEdit && <Action onClick={() => setEditing({})}>Add entry</Action>} />
    <section className="panel">
      <div className="toolbar">
        <Field label="List" value={category} onChange={(event) => { setCategory(event.target.value); setHistory([]) }}>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Field>
        <Field label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setHistory([]) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></Field>
        <Action variant="secondary" onClick={() => entries.reload()}>Refresh</Action>
      </div>
      {!workspace.owner && <p className="muted">You can view this list. Only the workspace owner can change its entries.</p>}
      <ErrorNotice error={categories.error || entries.error} retry={() => { categories.reload(); entries.reload() }} />
      {categories.loading || entries.loading ? <Loading label="Loading reference lists…" /> : entries.data?.items?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Description</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead><tbody>{entries.data.items.map((entry) => <tr key={entry.id}><td><strong>{entry.label}</strong><small>Sort order {entry.sortOrder}</small></td><td>{entry.description || '—'}</td><td>{entry.source ? `Template v${entry.source.version}` : 'Workspace entry'}</td><td><Status value={entry.status} /></td><td>{canEdit && <div className="actions">{entry.status === 'active' ? <><Action variant="secondary" onClick={() => setEditing(entry)}>Edit</Action><EntryStatusButton entry={entry} path={`${workspace.base}/master-data/${category}/${entry.id}/archive`} label="Archive" saved={entries.reload} /></> : <EntryStatusButton entry={entry} path={`${workspace.base}/master-data/${category}/${entry.id}/restore`} label="Restore" saved={entries.reload} />}</div>}</td></tr>)}</tbody></table></div> : !entries.error && <Empty title="No entries yet">New workspaces receive the published BookMySku starter lists. You can add labels that fit your business.</Empty>}
      {entries.data && <div className="table-bottom"><span>{entries.data.items.length} entries</span><div className="actions"><Action variant="secondary" disabled={!history.length} onClick={() => setHistory((items) => items.slice(0, -1))}>Previous</Action><Action variant="secondary" disabled={!entries.data.next} onClick={() => setHistory((items) => [...items, entries.data.next])}>Next</Action></div></div>}
    </section>
    {editing && <EntryEditor key={`${category}:${editing.id || 'new'}`} base={`${workspace.base}/master-data/${category}`} entry={editing} close={() => setEditing(null)} saved={() => { setEditing(null); entries.reload() }} />}
  </>
}

function EntryStatusButton({ entry, path, label, saved }) {
  const mutation = useMutation()
  return <><Action variant="secondary" disabled={mutation.pending} onClick={async () => { if (await mutation.run('post', path, { expectedRevision: entry.revision })) saved() }}>{mutation.pending ? 'Saving…' : mutation.uncertain ? 'Retry same action' : label}</Action><ErrorNotice error={mutation.error} /></>
}

function EntryEditor({ base, entry, close, saved }) {
  const [label, setLabel] = useState(entry.label || '')
  const [description, setDescription] = useState(entry.description || '')
  const [sortOrder, setSortOrder] = useState(entry.sortOrder ?? 0)
  const mutation = useMutation()
  async function submit(event) {
    event.preventDefault()
    const result = await mutation.run(entry.id ? 'patch' : 'post', entry.id ? `${base}/${entry.id}` : base, {
      ...(entry.id ? { expectedRevision: entry.revision } : {}),
      label: label.trim(), description: description.trim() || null, sortOrder: Number(sortOrder),
    })
    if (result) saved()
  }
  return <Dialog title={entry.id ? 'Edit reference entry' : 'Add reference entry'} close={close} locked={mutation.pending || mutation.uncertain}><form onSubmit={submit}><fieldset disabled={mutation.pending || mutation.uncertain}><Field label="Name" required maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} /><Field label="Description" maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /><Field label="Sort order" type="number" min="0" max="10000" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />{entry.source && <p className="muted">This entry came from a published template. Editing it changes only this workspace.</p>}</fieldset><SaveFooter mutation={mutation} close={close} label={entry.id ? 'Save entry' : 'Create entry'} /></form></Dialog>
}
