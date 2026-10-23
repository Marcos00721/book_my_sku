import { useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { Action, Empty, ErrorNotice, Field, Loading, Status } from '../../components/workspace/Elements'

const categories = ['industry', 'product_category', 'decoration_method']

export function MasterDataTemplates() {
  const resource = useResource('/admin/master-data/draft')
  const [entries, setEntries] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const save = useMutation()
  const publish = useMutation()
  const draft = resource.data
  const rows = entries || draft?.entries || []

  function update(index, key, value) {
    setEntries((current) => [...(current || draft.entries)].map((entry, row) => row === index ? { ...entry, [key]: value } : entry))
  }

  async function saveDraft(event) {
    event.preventDefault()
    const result = await save.run('put', '/admin/master-data/draft', { expectedRevision: draft.revision, entries: rows })
    if (result) { setEntries(null); resource.reload() }
  }

  async function publishDraft() {
    setError(null)
    const result = await publish.run('post', '/admin/master-data/publish', { expectedRevision: draft.revision, expectedVersion: draft.version, reason: reason.trim() })
    if (result) { setReason(''); resource.reload() }
    else setError(publish.error)
  }

  function addEntry() {
    const category = categories.find((item) => !rows.some((entry) => entry.category === item && entry.status === 'active')) || 'industry'
    setEntries([...rows, { category, key: '', label: '', status: 'active', sortOrder: 0 }])
  }

  if (resource.loading) return <Loading label="Loading the platform template…" />
  if (resource.error) return <ErrorNotice error={resource.error} retry={resource.reload} />
  return <>
    <section className="panel">
      <div className="section-heading"><div><h2>Starter reference lists</h2><p className="muted">Published lists are copied into newly activated workspaces. Existing workspaces keep their own entries.</p></div><Action variant="secondary" onClick={addEntry}>Add row</Action></div>
      <p className="muted">Current published version: {draft.version}. Draft revision: {draft.revision}. Keep every existing key; archive entries to retire them.</p>
      <ErrorNotice error={save.error || error} retry={resource.reload} />
      <form onSubmit={saveDraft}>
        {categories.map((category) => <div className="table-scroll" key={category}><h3>{category.replaceAll('_', ' ')}</h3><table className="data-table"><thead><tr><th>Stable key</th><th>Label</th><th>Description</th><th>Order</th><th>Status</th></tr></thead><tbody>{rows.map((entry,index) => entry.category === category && <tr key={`${entry.key}:${index}`}><td>{entry.key ? <code>{entry.key}</code> : <input aria-label={`${category} stable key`} pattern="[a-z][a-z0-9_]{0,63}" maxLength={64} required value={entry.key} onChange={(event) => update(index,'key',event.target.value)} />}</td><td><input aria-label={`${category} label`} maxLength={120} required value={entry.label} onChange={(event) => update(index,'label',event.target.value)} /></td><td><input aria-label={`${category} description`} maxLength={500} value={entry.description || ''} onChange={(event) => update(index,'description',event.target.value || null)} /></td><td><input aria-label={`${category} sort order`} type="number" min="0" max="10000" step="1" value={entry.sortOrder || 0} onChange={(event) => update(index,'sortOrder',Number(event.target.value))} /></td><td><select aria-label={`${category} status`} value={entry.status} onChange={(event) => update(index,'status',event.target.value)}><option value="active">Active</option><option value="archived">Archived</option></select></td></tr>)}</tbody></table></div>)}
        {!rows.length && <Empty title="No template rows yet">Add at least one active row in every category before publishing.</Empty>}
        <div className="actions"><Action type="submit" disabled={save.pending || !entries}>{save.uncertain ? 'Retry same draft' : 'Save draft'}</Action><Action variant="secondary" disabled={save.pending} onClick={resource.reload}>Reload draft</Action></div>
        {save.uncertain && <p className="notice">The save result is uncertain. Submit the same draft again to recover it safely.</p>}
      </form>
    </section>
    <section className="panel">
      <h2>Publish a reviewed version</h2><p className="muted">Publishing requires at least one active entry per category. A published version cannot be edited.</p>
      <Field label="Reason for publishing" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      <ErrorNotice error={publish.error} retry={resource.reload} />
      <Action disabled={!reason.trim() || publish.pending || entries !== null} onClick={publishDraft}>{publish.pending ? 'Publishing…' : publish.uncertain ? 'Retry publish' : 'Publish template'}</Action>
    </section>
    <TemplateHistory />
  </>
}

function TemplateHistory() {
  const resource = useResource('/admin/master-data/versions?limit=25')
  return <section className="panel"><h2>Published versions</h2><ErrorNotice error={resource.error} retry={resource.reload} />{resource.loading ? <Loading /> : resource.data?.items?.length ? resource.data.items.map((version) => <div className="grant-row" key={version.id}><span>Version {version.version}<small className="muted"> · {version.entries?.length || 0} entries</small></span><Status value="published" /></div>) : !resource.error && <Empty title="No published versions">Publish the first template before new workspaces are activated.</Empty>}</section>
}
