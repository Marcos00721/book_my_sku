import { useEffect, useRef, useState } from 'react'
import {
  Archive, Building2, Check, CheckCircle2, ChevronDown, ClipboardCheck,
  Database, History, Layers3, MapPin, Paintbrush, Pencil, Plus, RefreshCw,
  Search, Send, X,
} from 'lucide-react'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { queryPath, readData } from '../../services/workspace'
import {
  ConflictReview,
  Pager,
} from '../../components/workspace/RecordTools'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  ListSkeleton,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'
import '../../styles/master-data-templates.css'

const valueText = (value) =>
  value == null || value === '' ? 'Not set' : String(value)

const categories = {
  industry: 'Industries',
  product_category: 'Product categories',
  decoration_method: 'Decoration methods',
  decoration_location: 'Decoration locations',
}

const categoryDetails = {
  industry: { Icon: Building2, description: 'The businesses your customers serve.' },
  product_category: { Icon: Layers3, description: 'Keep products neatly organised.' },
  decoration_method: { Icon: Paintbrush, description: 'How products are personalised.' },
  decoration_location: { Icon: MapPin, description: 'Where decorations are placed.' },
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
  const [historyTab, setHistoryTab] = useState(null)
  const historyTrigger = useRef(null)
  const [preview, setPreview] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const publish = useMutation()
  const draft = savedDraft || resource.data

  async function reviewPublication() {
    setRefreshing(true)
    setError(null)
    try {
      const current = await readData('/admin/master-data/draft')
      setSavedDraft(current)
      let prior = { entries: [] }
      if (current.version > 0) {
        let after = ''
        const seen = new Set()
        for (;;) {
          const page = await readData(
            `/admin/master-data/versions?limit=50${after ? `&after=${encodeURIComponent(after)}` : ''}`,
          )
          const match = page.items.find(
            (item) => item.version === current.version,
          )
          if (match) {
            prior = await readData(`/admin/master-data/versions/${match.id}`)
            break
          }
          if (!page.next || seen.has(page.next))
            throw new Error(
              'The previous publication could not be loaded. Retry before publishing.',
            )
          after = page.next
          seen.add(after)
        }
      }
      const identity = (entry) => `${entry.category}:${entry.key}`
      const old = new Map(
        prior.entries.map((entry) => [identity(entry), entry]),
      )
      const active = current.entries.filter(
        (entry) => entry.status === 'active',
      )
      const activeKeys = new Set(active.map(identity))
      const differences = active.flatMap((entry) => {
        if (!old.has(identity(entry)))
          return [
            {
              entry: identity(entry),
              label: entry.label,
              category: entry.category,
              field: 'Added to active publication',
              before: null,
              after: entry.label,
            },
          ]
        return ['label', 'description', 'sortOrder']
          .filter(
            (field) =>
              valueText(old.get(identity(entry))?.[field]) !==
              valueText(entry[field]),
          )
          .map((field) => ({
            entry: identity(entry),
            label: entry.label,
            category: entry.category,
            field,
            before: old.get(identity(entry))?.[field],
            after: entry[field],
          }))
      })
      for (const [key, entry] of old) {
        if (!activeKeys.has(key))
          differences.push({
            entry: key,
            label: entry.label,
            category: entry.category,
            field: 'Archived from active publication',
            before: entry.label,
            after: 'Excluded',
          })
      }
      setPreview({
        revision: current.revision,
        version: current.version,
        differences,
        archived: current.entries.filter(
          (entry) => entry.status === 'archived',
        ),
      })
    } catch (failure) {
      setError(failure)
    } finally {
      setRefreshing(false)
    }
  }

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
    if (
      !preview ||
      preview.revision !== draft.revision ||
      preview.version !== draft.version
    )
      return
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
    return <ListSkeleton label="Loading the platform template…" columns={['Name', 'Description', 'Order', 'Status', '']} />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const busy = refreshing || publish.pending || publish.uncertain
  const counts = Object.fromEntries(
    Object.keys(categories).map((key) => {
      const entries = draft.entries.filter((entry) => entry.category === key)
      return [key, {
        total: entries.length,
        active: entries.filter((entry) => entry.status === 'active').length,
      }]
    }),
  )
  const query = search.trim().toLocaleLowerCase()
  const rows = draft.entries
    .filter((entry) => entry.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
  const filteredRows = rows.filter((entry) =>
    (statusFilter === 'all' || entry.status === statusFilter) &&
    (!query || `${entry.label} ${entry.description || ''}`.toLocaleLowerCase().includes(query)),
  )
  const missingCategories = Object.keys(categories).filter(
    (key) =>
      !draft.entries.some(
        (entry) => entry.category === key && entry.status === 'active',
      ),
  )
  const remaining = 100 - rows.length
  const draftBytes = new TextEncoder().encode(
    JSON.stringify({
      expectedRevision: draft.revision,
      entries: draft.entries,
    }),
  ).length
  const activeCount = draft.entries.filter((entry) => entry.status === 'active').length
  const reviewed = preview && preview.revision === draft.revision && preview.version === draft.version

  function selectCategory(key) {
    setCategory(key)
    setSearch('')
    setStatusFilter('all')
  }

  function navigateCategories(event) {
    const keys = Object.keys(categories)
    const index = keys.indexOf(category)
    const next = {
      ArrowRight: keys[(index + 1) % keys.length],
      ArrowLeft: keys[(index + keys.length - 1) % keys.length],
      Home: keys[0],
      End: keys.at(-1),
    }[event.key]
    if (!next) return
    event.preventDefault()
    selectCategory(next)
    document.getElementById(`template-tab-${next}`)?.focus()
  }

  function openHistory(tab, event) {
    historyTrigger.current = event.currentTarget
    setHistoryTab(tab)
  }

  function closeHistory() {
    setHistoryTab(null)
    requestAnimationFrame(() => historyTrigger.current?.focus({ preventScroll: true }))
  }

  return (
    <div className="master-templates">
      <div className="master-template-summary" aria-label="Template overview">
        <div className="master-template-summary-label">
          <Database size={18} aria-hidden="true" />
          <strong>Platform template</strong>
          <span className="master-template-draft-tag">Draft revision {draft.revision}</span>
        </div>
        <div className="master-template-summary-tools">
          <div className="master-template-summary-stats">
            <span><strong>{activeCount}</strong> active entries</span>
            <span>{draft.version > 0 ? <>Published <strong>v{draft.version}</strong></> : 'Not published yet'}</span>
          </div>
          <div className="master-template-history-actions" aria-label="Template history">
            <Action variant="text-button" onClick={(event) => openHistory('versions', event)}>
              <Layers3 size={16} aria-hidden="true" />Published versions
            </Action>
            <Action variant="text-button" aria-label="Platform template activity" onClick={(event) => openHistory('activity', event)}>
              <History size={16} aria-hidden="true" />Activity
            </Action>
          </div>
        </div>
      </div>

      <div className="master-template-categories" role="tablist" aria-label="Template categories" onKeyDown={navigateCategories}>
        {Object.entries(categories).map(([key, label]) => {
          const { Icon } = categoryDetails[key]
          return (
            <button
              key={key}
              id={`template-tab-${key}`}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={category === key}
              aria-controls="template-entries"
              tabIndex={category === key ? 0 : -1}
              onClick={() => selectCategory(key)}
            >
              <span className="master-template-category-icon"><Icon size={20} aria-hidden="true" /></span>
              <span className="master-template-category-copy">
                <strong>{label}</strong>
                <span>{counts[key].active} active <span aria-hidden="true">·</span> {counts[key].total} total</span>
              </span>
              {category === key && <Check size={16} className="master-template-category-check" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {notice && <p className="notice master-template-notice" role="status"><CheckCircle2 size={18} aria-hidden="true" />{notice}</p>}
      <ErrorNotice error={error} retry={refreshDraft} />

      <div className="master-template-layout">
      <section className="panel master-template-entries-panel" aria-label="Starter reference lists">
        <div className="section-heading master-template-list-heading">
          <div>
            <div className="master-template-title"><h2>{categories[category]}</h2><span className="master-template-count">{rows.length}</span></div>
            <p className="muted">{categoryDetails[category].description}</p>
          </div>
          <Action
            disabled={busy || remaining <= 0 || draft.entries.length >= 400}
            onClick={() => setEditor({ category })}
          >
            <Plus size={16} aria-hidden="true" /> Create
          </Action>
        </div>
        <div className="master-template-filters">
          <Field
            className="master-template-search"
            aria-label={`Search ${categories[category].toLowerCase()}`}
            placeholder="Search name or description…"
            icon={<Search size={18} />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            trailing={search ? <Action variant="icon-button" className="master-template-clear-search" aria-label="Clear search" onClick={() => setSearch('')}><X size={16} aria-hidden="true" /></Action> : undefined}
          />
          <Field
            className="master-template-status-filter"
            aria-label="Filter entries by status"
            searchable={false}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Field>
          <Action variant="icon-button" aria-label="Refresh draft" title="Refresh draft" disabled={busy} onClick={refreshDraft}>
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </Action>
        </div>
        <div
          id="template-entries"
          role="tabpanel"
          aria-labelledby={`template-tab-${category}`}
          tabIndex={0}
        >
          {filteredRows.length ? (
            <div className="table-scroll">
              <table className="data-table master-template-table" aria-label={`${categories[category]} entries`}>
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
                  {filteredRows.map((entry) => (
                    <tr key={entry.key} className={entry.status === 'archived' ? 'master-template-archived-row' : undefined}>
                      <td data-label="Name">
                        <strong>{entry.label}</strong>
                      </td>
                      <td data-label="Description" className="master-template-entry-description">{entry.description || <span className="master-template-no-description">No description</span>}</td>
                      <td data-label="Order"><span className="master-template-order">{entry.sortOrder}</span></td>
                      <td data-label="Status">
                        <Status value={entry.status} />
                      </td>
                      <td data-label="Actions">
                        <Action
                          variant="text-button"
                          className="master-template-edit"
                          disabled={busy}
                          aria-label={`Edit ${entry.label}`}
                          onClick={() => setEditor(entry)}
                        >
                          <Pencil size={15} aria-hidden="true" /><span>Edit</span>
                        </Action>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : rows.length ? (
            <Empty icon={<Search size={24} aria-hidden="true" />} title="No matching entries" action={<Action variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all') }}>Clear filters</Action>}>
              Try another search or status to find the entry you need.
            </Empty>
          ) : (
            <Empty
              icon={<Database size={26} aria-hidden="true" />}
              title={`No ${categories[category].toLowerCase()} yet`}
              action={
                <Action
                  disabled={
                    busy || remaining <= 0 || draft.entries.length >= 400
                  }
                  onClick={() => setEditor({ category })}
                >
                  <Plus size={16} aria-hidden="true" /> Add an entry
                </Action>
              }
            >
              Build this list by adding an entry to your draft.
            </Empty>
          )}
        </div>
        <div className="table-bottom master-template-table-footer">
          <span role="status">{filteredRows.length === rows.length ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}` : `${filteredRows.length} of ${rows.length} entries`} shown</span>
          <span>{remaining} slots available</span>
        </div>
      </section>
      <aside className="master-template-sidebar" aria-label="Template publication">
      <section className="panel master-template-publish-panel">
        <div className="master-template-publish-heading"><span className="master-template-publish-icon"><Send size={19} aria-hidden="true" /></span><div><h2>Publish template</h2><p className="muted">Prepare the next workspace.</p></div></div>
        <p className="master-template-publish-intro">Your edits stay in draft until you review and publish them.</p>
        <div className="master-template-readiness">
          <div className="master-template-readiness-heading"><strong>Category readiness</strong><span>{4 - missingCategories.length}/4 ready</span></div>
          <ul>
            {Object.entries(categories).map(([key, label]) => <li key={key} className={!counts[key].active ? 'master-template-category-missing' : undefined}>
              {counts[key].active ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="master-template-missing-icon" aria-hidden="true" />}
              <span>{label}</span><strong>{counts[key].active}</strong>
            </li>)}
          </ul>
        </div>
        {missingCategories.length > 0 && (
          <p className="master-template-publish-warning">
            Add an active entry before publishing:{' '}
            {missingCategories.map((key) => categories[key]).join(', ')}.
          </p>
        )}
        <Action className="master-template-review-button" variant="secondary" aria-label="Review saved draft changes" disabled={busy} onClick={reviewPublication}>
          <ClipboardCheck size={17} aria-hidden="true" />{refreshing ? 'Loading draft…' : reviewed ? 'Review changes again' : 'Review saved draft changes'}
        </Action>
        {reviewed && (
          <a className="master-template-review-result" href="#master-template-comparison">
            <CheckCircle2 size={15} aria-hidden="true" />
            Draft reviewed · {preview.differences.length} {preview.differences.length === 1 ? 'change' : 'changes'}
            <span>View comparison</span>
          </a>
        )}
        {preview && !reviewed && (
          <p className="master-template-publish-warning">
            The draft has changed. Review it again before publishing.
          </p>
        )}
        <form className="master-template-publish-form" onSubmit={publishDraft}>
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
            className="master-template-publish-button"
            disabled={
              !reason.trim() ||
              missingCategories.length > 0 ||
              refreshing ||
              publish.pending ||
              !preview ||
              preview.revision !== draft.revision ||
              preview.version !== draft.version
            }
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
            {publish.pending
              ? 'Publishing…'
              : publish.uncertain
                ? 'Retry publish'
                : 'Publish template'}
          </Action>
        </form>
        <p className="master-template-publish-note">Published lists are copied into new workspaces. Existing workspaces and setups in progress keep their selected version.</p>
      </section>
      <details className="master-template-capacity">
        <summary>
          <Database size={15} aria-hidden="true" />
          <span>Template capacity</span>
          <strong>{draft.entries.length}/400</strong>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div>
          <label htmlFor="master-template-entry-capacity">{draft.entries.length} of 400 entries used</label>
          <progress id="master-template-entry-capacity" value={draft.entries.length} max={400} />
          <p>Up to 100 entries per category.</p>
          <p>{draftBytes.toLocaleString()}/60,000 bytes used. Archived rows count toward capacity.</p>
        </div>
      </details>
      </aside>
      </div>

      {reviewed && <TemplateComparison preview={preview} />}

      {historyTab && (
        <TemplateHistoryDialog
          key={historyVersion}
          tab={historyTab}
          selectTab={setHistoryTab}
          close={closeHistory}
        />
      )}
      {editor && (
        <TemplateEntryForm
          draft={draft}
          entry={editor}
          close={() => setEditor(null)}
          saved={(updated, label, selectedCategory) => {
            setSavedDraft(updated)
            selectCategory(selectedCategory)
            setNotice(
              `${label} saved to draft. Publish a reviewed version when you’re ready.`,
            )
            setEditor(null)
          }}
        />
      )}
    </div>
  )
}

function TemplateComparison({ preview }) {
  const fieldLabels = { label: 'Name', description: 'Description', sortOrder: 'Display order' }
  return (
    <section
      className="panel master-template-comparison"
      id="master-template-comparison"
      aria-label="Saved draft comparison"
    >
      <div className="master-template-comparison-heading">
        <ClipboardCheck size={20} aria-hidden="true" />
        <div>
          <h2>Review saved changes</h2>
          <p className="muted">
            Saved draft revision {preview.revision}, compared with published version{' '}
            {preview.version}. This publication affects future onboarding only.
          </p>
        </div>
        <span className="master-template-count">
          {preview.differences.length} {preview.differences.length === 1 ? 'change' : 'changes'}
        </span>
      </div>
      {preview.differences.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Entry</th><th>Field</th><th>Published</th><th>Saved draft</th></tr>
            </thead>
            <tbody>
              {preview.differences.map((row) => (
                <tr key={`${row.entry}:${row.field}`}>
                  <th scope="row">
                    <strong>{row.label}</strong>
                    <small>{categories[row.category] || row.category}</small>
                  </th>
                  <td>{fieldLabels[row.field] || row.field}</td>
                  <td>{valueText(row.before)}</td>
                  <td>{valueText(row.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No active-content changes.</p>}
      {preview.archived.length > 0 && (
        <div className="master-template-archived-review">
          <Archive size={18} aria-hidden="true" />
          <div>
            <h3>Archived rows retained in the saved draft</h3>
            <p>These rows count toward capacity and will not appear in the active publication.</p>
            <ul>
              {preview.archived.map((entry) => (
                <li key={`${entry.category}:${entry.key}`}>
                  <strong>{entry.label}</strong> · {categories[entry.category] || entry.category}{' '}
                  · {entry.description || 'No description'} · Order {entry.sortOrder}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function TemplateEntryForm({ draft, entry, close, saved }) {
  const [baseline, setBaseline] = useState(draft)
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
    const duplicate = baseline.entries.some(
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
      key: entry.key || createEntryKey(name, category, baseline.entries),
      label: name,
      description: description.trim() || null,
      sortOrder: Number(sortOrder),
      status,
    }
    const entries = editing
      ? baseline.entries.map((item) =>
          item.category === entry.category && item.key === entry.key
            ? next
            : item,
        )
      : [...baseline.entries, next]
    if (
      entries.length > 400 ||
      entries.filter((item) => item.category === category).length > 100 ||
      new TextEncoder().encode(
        JSON.stringify({ expectedRevision: baseline.revision, entries }),
      ).length > 60000
    ) {
      setError(
        new Error(
          'The saved draft exceeds its category, total entry or 60,000-byte capacity. Shorten content or review retained entries; archiving does not free capacity.',
        ),
      )
      return
    }
    const result = await mutation.run('put', '/admin/master-data/draft', {
      expectedRevision: baseline.revision,
      entries,
    })
    if (result) saved(result.data, name, category)
  }

  return (
    <Dialog
      size="md"
      className="master-entry-dialog"
      title={editing ? 'Edit template entry' : 'Create template entry'}
      close={close}
      locked={locked}
    >
      <p className="muted master-template-editor-intro">
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
        <ConflictReview
          error={mutation.error}
          path="/admin/master-data/draft"
          values={{ label, description, sortOrder, status }}
          project={(current) =>
            current.entries.find(
              (item) =>
                item.category === entry.category && item.key === entry.key,
            ) || {}
          }
          onReview={setBaseline}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label="Save to draft"
          onClear={() => {
            setCategory(entry.category)
            setLabel(entry.label || '')
            setDescription(entry.description || '')
            setSortOrder(entry.sortOrder ?? 0)
            setStatus(entry.status || 'active')
            setError(null)
          }}
        />
      </form>
    </Dialog>
  )
}

const historyTabs = {
  versions: { label: 'Published versions', Icon: Layers3 },
  activity: { label: 'Platform template activity', Icon: History },
}

function TemplateHistoryDialog({ tab, selectTab, close }) {
  useEffect(() => {
    const root = document.documentElement
    const previous = { overflow: root.style.overflow, scrollbarGutter: root.style.scrollbarGutter }
    if (window.innerWidth > root.clientWidth) root.style.scrollbarGutter = 'stable'
    root.style.overflow = 'hidden'
    return () => Object.assign(root.style, previous)
  }, [])

  function navigateTabs(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'versions'
      : event.key === 'End' ? 'activity'
        : tab === 'versions' ? 'activity' : 'versions'
    selectTab(next)
    document.getElementById(`master-history-tab-${next}`)?.focus()
  }

  return (
    <Dialog
      className="master-template-history-dialog"
      title="Template history"
      description="Review published templates and the changes behind them."
      close={close}
    >
      <div className="master-template-history-tabs" role="tablist" aria-label="Template history views" onKeyDown={navigateTabs}>
        {Object.entries(historyTabs).map(([key, { label, Icon }]) => (
          <button
            key={key}
            id={`master-history-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls="master-history-content"
            tabIndex={tab === key ? 0 : -1}
            onClick={() => selectTab(key)}
          >
            <Icon size={17} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <div
        id="master-history-content"
        className="master-template-history-content"
        role="tabpanel"
        aria-labelledby={`master-history-tab-${tab}`}
      >
        {tab === 'versions' ? <TemplateHistory /> : <TemplateActivity />}
      </div>
    </Dialog>
  )
}

function TemplateHistory() {
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState(null)
  const resource = useResource(
    `/admin/master-data/versions?limit=10${pages.length ? `&after=${encodeURIComponent(pages.at(-1))}` : ''}`,
  )
  const detail = useResource(
    selected ? `/admin/master-data/versions/${selected}` : null,
  )
  return (
    <section className="master-template-history-view" aria-label="Published versions">
      <div className="master-template-history-toolbar">
        <p>Every publication, ready to revisit.</p>
        <Action variant="text-button" disabled={resource.loading} onClick={resource.reload}>
          <RefreshCw size={16} aria-hidden="true" />Refresh versions
        </Action>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <div key={pages.at(-1) || 'first'} className="master-template-history-scroll" role="region" aria-label="Published versions list" tabIndex={0}>
      {resource.loading ? (
        <ListSkeleton label="Loading published versions…" variant="list" rows={4} />
      ) : resource.data?.items?.length ? (
        resource.data.items.map((version) => (
          <article className="master-template-version-row" key={version.id}>
            <span className="master-template-version-icon"><Layers3 size={18} aria-hidden="true" /></span>
            <div className="master-template-version-copy">
              <h3>Version {version.version}</h3>
              <p>{version.entries?.length || 0} entries</p>
            </div>
            <Status value="published" />
            <Action variant="text-button" onClick={() => setSelected(version.id)}>
              View publication
            </Action>
          </article>
        ))
      ) : (
        !resource.error && (
          <Empty title="No published versions">
            Publish the first template before new workspaces are activated.
          </Empty>
        )
      )}
      </div>
      <div className="master-template-history-footer">
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label="versions"
      />
      </div>
      {selected && (
        <Dialog className="master-template-publication-dialog" title="Published template" close={() => setSelected(null)}>
          <ErrorNotice error={detail.error} retry={detail.reload} />
          {detail.loading ? (
            <Loading />
          ) : (
            detail.data && (
              <>
                <p>Version {detail.data.version}</p>
                <p>
                  {detail.data.publication?.evidence === 'retained'
                    ? `Published by ${detail.data.publication.publisher?.label || 'Actor unavailable'}`
                    : 'Publication evidence unavailable'}
                </p>
                <p>{detail.data.publication?.reason || 'Reason unavailable'}</p>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Category</th><th>Name</th><th>Status</th></tr></thead>
                    <tbody>{detail.data.entries?.map(entry => (
                      <tr key={`${entry.category}:${entry.key}`}><td>{categories[entry.category] || entry.category}</td><td>{entry.label}</td><td><Status value={entry.status} /></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )
          )}
        </Dialog>
      )}
    </section>
  )
}

function TemplateActivity() {
  const [pages, setPages] = useState([])
  const [action, setAction] = useState('')
  const resource = useResource(queryPath('/admin/master-data/history', {
    action,
    limit: 10,
    after: pages.at(-1),
  }))
  const actionLabels = { 'master.draft': 'Draft updated', 'master.publish': 'Template published' }
  const changeText = (value) => typeof value === 'object' && value !== null
    ? JSON.stringify(value) : valueText(value)

  function reload() {
    if (resource.error?.code === 'INVALID_CURSOR') setPages([])
    resource.reload()
  }

  return (
    <section className="master-template-history-view" aria-label="Platform template activity">
      <div className="master-template-history-toolbar">
        <Field
          aria-label="Activity type"
          searchable={false}
          value={action}
          onChange={(event) => { setAction(event.target.value); setPages([]) }}
        >
          <option value="">All activities</option>
          <option value="master.draft">Draft updates</option>
          <option value="master.publish">Publications</option>
        </Field>
        <Action variant="text-button" disabled={resource.loading} onClick={() => { setPages([]); resource.reload() }}>
          <RefreshCw size={16} aria-hidden="true" />Refresh history
        </Action>
      </div>
      <ErrorNotice error={resource.error} retry={reload} />
      <div key={`${action}:${pages.at(-1) || 'first'}`} className="master-template-history-scroll" role="region" aria-label="Template activity list" tabIndex={0}>
        {resource.loading ? (
          <ListSkeleton label="Loading template activity…" variant="list" rows={4} />
        ) : resource.data && (
          <>
            {resource.data.coverageStartedAt && (
              <p className="master-template-history-coverage">Detailed history is available from {new Date(resource.data.coverageStartedAt).toLocaleString()}.</p>
            )}
            {resource.data.items?.length ? resource.data.items.map((event) => (
              <details className="master-template-activity-event" key={event.id}>
                <summary>
                  <span className={`master-template-event-icon${event.action === 'master.publish' ? ' is-publication' : ''}`}>
                    {event.action === 'master.publish' ? <Send size={17} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}
                  </span>
                  <span className="master-template-event-copy">
                    <strong>{actionLabels[event.action] || event.action?.replaceAll('.', ' ') || 'Template updated'}</strong>
                    <span>{event.actor?.label || 'Actor unavailable'} · {event.actor?.membershipStatus || 'Membership unavailable'}</span>
                    <time dateTime={event.occurredAt || event.createdAt}>{new Date(event.occurredAt || event.createdAt).toLocaleString()}</time>
                  </span>
                  <span className="master-template-event-disclosure">View changes<ChevronDown size={16} aria-hidden="true" /></span>
                </summary>
                <div className="master-template-event-details">
                  {event.reason && <p>{event.reason}</p>}
                  {event.origin && <p className="muted">Source: {event.origin}</p>}
                  {event.noOp && <p>No field values changed.</p>}
                  {event.changes?.length > 0 && (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                        <tbody>
                          {event.changes.flatMap((change) => change.differences
                            ? change.differences.map((diff) => ({ ...diff, field: `${categories[change.category] || change.category} / ${change.key || change.entryId} / ${diff.field}` }))
                            : [change]).map((change, index) => (
                              <tr key={index}><th scope="row">{change.field}</th><td>{changeText(change.before)}</td><td>{changeText(change.after)}</td></tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="master-template-event-reference">Revision {valueText(event.beforeRevision)} → {valueText(event.afterRevision)} · Event: {event.id}{event.operationId ? ` · Related operation: ${event.operationId}` : ''}</p>
                </div>
              </details>
            )) : !resource.error && (
              <Empty icon={<History size={24} aria-hidden="true" />} title="No recorded activity">No recorded changes are available for these filters.</Empty>
            )}
          </>
        )}
      </div>
      <div className="master-template-history-footer">
        <Pager resource={resource} pages={pages} setPages={setPages} label="events" />
      </div>
    </section>
  )
}
