import { useState } from 'react'
import { Pencil, Plus, RefreshCw } from 'lucide-react'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { readData } from '../../services/workspace'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'

const categories = {
  industry: 'Industries',
  product_category: 'Product categories',
  decoration_method: 'Decoration methods',
}

function createEntryKey(label, category, entries) {
  const slug = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = (/^[a-z]/.test(slug) ? slug : `entry_${slug}`).slice(0, 56)
  let key = base
  let suffix = 2
  while (
    entries.some((entry) => entry.category === category && entry.key === key)
  ) {
    key = `${base}_${suffix++}`
  }
  return key
}

export function MasterDataTemplates() {
  const resource = useResource('/admin/master-data/draft')
  const [savedDraft, setSavedDraft] = useState(null)
  const [category, setCategory] = useState('industry')
  const [editor, setEditor] = useState(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const publish = useMutation()
  const draft = savedDraft || resource.data

  async function refreshDraft() {
    setRefreshing(true)
    setError(null)
    try {
      setSavedDraft(await readData('/admin/master-data/draft'))
    } catch (failure) {
      setError(failure)
    } finally {
      setRefreshing(false)
    }
  }

  async function publishDraft(event) {
    event.preventDefault()
    const result = await publish.run('post', '/admin/master-data/publish', {
      expectedRevision: draft.revision,
      expectedVersion: draft.version,
      reason: reason.trim(),
    })
    if (result) {
      setReason('')
      setNotice('Your reviewed template has been published.')
      setHistoryVersion((value) => value + 1)
      await refreshDraft()
    }
  }

  if (resource.loading)
    return <Loading label="Loading the platform template…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const busy = refreshing || publish.pending || publish.uncertain
  const rows = draft.entries
    .filter((entry) => entry.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Starter reference lists</h2>
            <p className="muted">
              Add and edit entries in a focused form. Changes are saved to your
              draft until you publish.
            </p>
          </div>
          <Action disabled={busy} onClick={() => setEditor({ category })}>
            <Plus size={16} aria-hidden="true" /> Add entry
          </Action>
        </div>
        <div className="tabs" role="tablist" aria-label="Template categories">
          {Object.entries(categories).map(([key, label]) => (
            <button
              key={key}
              id={`template-tab-${key}`}
              role="tab"
              aria-selected={category === key}
              aria-controls="template-entries"
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <ErrorNotice error={error} retry={refreshDraft} />
        <div
          id="template-entries"
          role="tabpanel"
          aria-labelledby={`template-tab-${category}`}
        >
          {rows.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.key}>
                      <td>
                        <strong>{entry.label}</strong>
                      </td>
                      <td>{entry.description || '—'}</td>
                      <td>{entry.sortOrder}</td>
                      <td>
                        <Status value={entry.status} />
                      </td>
                      <td>
                        <Action
                          variant="secondary"
                          disabled={busy}
                          aria-label={`Edit ${entry.label}`}
                          onClick={() => setEditor(entry)}
                        >
                          <Pencil size={14} aria-hidden="true" /> Edit
                        </Action>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={`No ${categories[category].toLowerCase()} yet`}
              action={
                <Action disabled={busy} onClick={() => setEditor({ category })}>
                  <Plus size={16} aria-hidden="true" /> Add an entry
                </Action>
              }
            >
              Build this list by adding an entry to your draft.
            </Empty>
          )}
        </div>
        <div className="table-bottom">
          <span>
            {rows.length} entries · Published version {draft.version}
          </span>
          <Action variant="secondary" disabled={busy} onClick={refreshDraft}>
            <RefreshCw size={14} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh draft'}
          </Action>
        </div>
      </section>
      <section className="panel">
        <h2>Publish a reviewed version</h2>
        <p className="muted">
          Include at least one active entry in each category. Published lists
          are copied into new workspaces; existing workspaces keep their own
          entries.
        </p>
        <form onSubmit={publishDraft}>
          <Field
            label="Reason for publishing"
            required
            maxLength={500}
            disabled={publish.pending || publish.uncertain}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <ErrorNotice error={publish.error} />
          <Action
            type="submit"
            disabled={!reason.trim() || refreshing || publish.pending}
          >
            {publish.pending
              ? 'Publishing…'
              : publish.uncertain
                ? 'Retry publish'
                : 'Publish template'}
          </Action>
        </form>
      </section>
      <TemplateHistory key={historyVersion} />
      {editor && (
        <TemplateEntryForm
          draft={draft}
          entry={editor}
          close={() => setEditor(null)}
          saved={(updated, label, selectedCategory) => {
            setSavedDraft(updated)
            setCategory(selectedCategory)
            setNotice(
              `${label} saved to draft. Publish a reviewed version when you’re ready.`,
            )
            setEditor(null)
          }}
        />
      )}
    </>
  )
}

function TemplateEntryForm({ draft, entry, close, saved }) {
  const editing = Boolean(entry.key)
  const [category, setCategory] = useState(entry.category)
  const [label, setLabel] = useState(entry.label || '')
  const [description, setDescription] = useState(entry.description || '')
  const [sortOrder, setSortOrder] = useState(entry.sortOrder ?? 0)
  const [status, setStatus] = useState(entry.status || 'active')
  const [error, setError] = useState(null)
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain

  async function submit(event) {
    event.preventDefault()
    setError(null)
    const name = label.normalize('NFC').trim()
    if (!name) {
      setError(new Error('Enter a name for this entry.'))
      return
    }
    const duplicate = draft.entries.some(
      (item) =>
        item.category === category &&
        item.key !== entry.key &&
        item.status === 'active' &&
        item.label.normalize('NFC').toLowerCase() === name.toLowerCase(),
    )
    if (status === 'active' && duplicate) {
      setError(
        new Error(
          'An active entry with this name already exists in this category.',
        ),
      )
      return
    }
    const next = {
      category,
      key: entry.key || createEntryKey(name, category, draft.entries),
      label: name,
      description: description.trim() || null,
      sortOrder: Number(sortOrder),
      status,
    }
    const entries = editing
      ? draft.entries.map((item) =>
          item.category === entry.category && item.key === entry.key
            ? next
            : item,
        )
      : [...draft.entries, next]
    const result = await mutation.run('put', '/admin/master-data/draft', {
      expectedRevision: draft.revision,
      entries,
    })
    if (result) saved(result.data, name, category)
  }

  return (
    <Dialog
      className="master-entry-dialog"
      title={editing ? 'Edit master data entry' : 'Add master data entry'}
      close={close}
      locked={locked}
    >
      <p className="muted">
        Save this entry to the platform draft. Publishing remains a separate
        step.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={locked}>
          <Field
            label="Category"
            value={category}
            disabled={editing}
            onChange={(event) => setCategory(event.target.value)}
          >
            {Object.entries(categories).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </Field>
          <Field
            label="Name"
            autoFocus
            required
            maxLength={120}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Field
            label="Description (optional)"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="form-grid">
            <Field
              label="Display order"
              type="number"
              required
              min="0"
              max="10000"
              step="1"
              hint="Lower numbers appear first."
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
            <Field
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Field>
          </div>
        </fieldset>
        <ErrorNotice error={error} />
        <SaveFooter mutation={mutation} close={close} label="Save to draft" />
      </form>
    </Dialog>
  )
}

function TemplateHistory() {
  const resource = useResource('/admin/master-data/versions?limit=25')
  return (
    <section className="panel">
      <h2>Published versions</h2>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items?.length ? (
        resource.data.items.map((version) => (
          <div className="grant-row" key={version.id}>
            <span>
              Version {version.version}
              <small className="muted">
                {' '}
                · {version.entries?.length || 0} entries
              </small>
            </span>
            <Status value="published" />
          </div>
        ))
      ) : (
        !resource.error && (
          <Empty title="No published versions">
            Publish the first template before new workspaces are activated.
          </Empty>
        )
      )}
    </section>
  )
}
