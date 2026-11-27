import { useEffect, useRef, useState } from 'react'
import {
  Building2, Check, CheckCircle2, Info, Layers3, Package, Pencil,
  Search, ShieldCheck, ShieldOff, Truck, Users, X,
} from 'lucide-react'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { modulePermissionCatalog } from '../../services/permissions'
import {
  Action, Dialog, Empty, ErrorNotice, Field, ListSkeleton, SaveFooter,
} from '../../components/workspace/Elements'
import '../../styles/admin-permissions.css'

const moduleIcons = { clients: Building2, contacts: Users, team: Users, roles: ShieldCheck, products: Package, suppliers: Truck }
const moduleKey = entry => entry.key.split('.')[0]
const titleCase = value => value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
const scopeLabel = scope => ({ all: 'All records', assigned: 'Assigned records', none: 'Create records' })[scope] || titleCase(scope)

function PermissionStatus({ enabled }) {
  const Icon = enabled ? CheckCircle2 : ShieldOff
  return <span className={`permission-status${enabled ? ' permission-status--enabled' : ''}`}><Icon size={14} aria-hidden="true" />{enabled ? 'Enabled' : 'Disabled'}</span>
}

function ScopeLabels({ scopes }) {
  return <div className="permission-scopes">{scopes.length ? scopes.map(scope => <span key={scope}>{scopeLabel(scope)}</span>) : <span>No supported scopes</span>}</div>
}

export function PermissionCatalog() {
  const resource = useResource('/admin/permissions')
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [module, setModule] = useState('all')
  const entries = modulePermissionCatalog(resource.data?.items)
  const modules = [...new Set(entries.map(moduleKey))].sort((a, b) => a.localeCompare(b))
  const enabledCount = entries.filter(entry => entry.enabled).length
  const counts = { all: entries.length, enabled: enabledCount, disabled: entries.length - enabledCount }
  const search = query.trim().toLowerCase()
  const visible = entries.filter(entry =>
    (module === 'all' || moduleKey(entry) === module) &&
    (status === 'all' || entry.enabled === (status === 'enabled')) &&
    `${entry.label} ${entry.key} ${titleCase(moduleKey(entry))}`.toLowerCase().includes(search),
  )
  const groups = modules.map(key => ({ key, entries: visible.filter(entry => moduleKey(entry) === key) })).filter(group => group.entries.length)
  const filtered = Boolean(search || status !== 'all' || module !== 'all')

  function clearFilters() {
    setQuery('')
    setStatus('all')
    setModule('all')
  }

  return (
    <div className="permission-catalog">
      <div className="permission-summary">
        <span className="permission-summary-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
        <div className="permission-summary-copy"><strong>Workspace access controls</strong><p>One catalog for the capabilities available to every workspace.</p></div>
        <dl className="permission-summary-stats">
          <div><dt>Permissions</dt><dd>{resource.loading || resource.error ? '—' : entries.length}</dd></div>
          <div><dt>Enabled</dt><dd>{resource.loading || resource.error ? '—' : enabledCount}</dd></div>
          <div><dt>Modules</dt><dd>{resource.loading || resource.error ? '—' : modules.length}</dd></div>
        </dl>
      </div>

      <section className="panel permission-panel" aria-labelledby="permission-catalog-title" aria-busy={resource.loading}>
        <div className="permission-panel-heading">
          <div><h2 id="permission-catalog-title">Available permissions</h2><p>Browse by module and configure individual capabilities.</p></div>
          <span className="permission-catalog-label"><Layers3 size={15} aria-hidden="true" />Platform catalog</span>
        </div>
        <div className="permission-toolbar">
          <Field label="Find a permission" type="search" placeholder="Search by name or permission key" value={query} onChange={event => setQuery(event.target.value)} icon={<Search size={18} />} />
          <Field label="Module" value={module} onChange={event => setModule(event.target.value)}>
            <option value="all">All modules</option>
            {modules.map(key => <option key={key} value={key}>{titleCase(key)}</option>)}
          </Field>
        </div>
        <div className="permission-filter-bar">
          <div className="permission-status-filters" role="group" aria-label="Permission status">
            {['all', 'enabled', 'disabled'].map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{titleCase(value)}<span>{resource.loading || resource.error ? '—' : counts[value]}</span></button>)}
          </div>
          <span className="permission-result-count" role="status">{!resource.loading && !resource.error && `${visible.length} ${visible.length === 1 ? 'permission' : 'permissions'}${filtered ? ` of ${entries.length}` : ''}`}</span>
          {filtered && <Action variant="text-button" className="permission-clear-filters" onClick={clearFilters}><X size={14} aria-hidden="true" />Clear filters</Action>}
        </div>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? <div className="permission-loading"><ListSkeleton label="Loading permissions…" variant="list" /></div> : !resource.error && (
          groups.length ? <div className="permission-groups">{groups.map(group => {
            const Icon = moduleIcons[group.key] || Layers3
            return <section className="permission-group" key={group.key} aria-labelledby={`permission-module-${group.key}`}>
              <div className="permission-group-heading"><Icon size={18} aria-hidden="true" /><h3 id={`permission-module-${group.key}`}>{titleCase(group.key)}</h3><span>{group.entries.length}</span></div>
              <div className="permission-column-headings" aria-hidden="true"><span>Permission</span><span>Supported scopes</span><span>Status</span><span /></div>
              <ul className="permission-rows">{group.entries.map(entry => <li className="permission-row" key={entry.key}>
                <div className="permission-name"><strong>{entry.label}</strong><code>{entry.key}</code></div>
                <ScopeLabels scopes={entry.scopes} />
                <PermissionStatus enabled={entry.enabled} />
                <Action variant="secondary" className="permission-configure" aria-label={`Configure ${entry.label}`} onClick={() => setSelected(entry)}><Pencil size={14} aria-hidden="true" />Configure</Action>
              </li>)}</ul>
            </section>
          })}</div> : <Empty title={filtered ? 'No matching permissions' : 'No permissions available'} icon={<ShieldCheck size={26} aria-hidden="true" />} action={filtered ? <Action variant="secondary" onClick={clearFilters}>Clear filters</Action> : undefined}>{filtered ? 'Try a different search, module or status.' : 'Supported capabilities will appear here when available.'}</Empty>
        )}
        <div className="permission-impact-note"><Info size={17} aria-hidden="true" /><p>Catalog changes take effect immediately across workspaces. Only supported capabilities can be configured.</p></div>
      </section>
      {selected && <CatalogEditor entry={selected} close={() => setSelected(null)} saved={() => { setSelected(null); resource.reload() }} />}
    </div>
  )
}

function CatalogEditor({ entry, close, saved }) {
  const labelInput = useRef(null)
  const [label, setLabel] = useState(entry.label)
  const [enabled, setEnabled] = useState(entry.enabled)
  const mutation = useMutation()
  useEffect(() => { labelInput.current?.focus() }, [])
  return (
    <Dialog title="Configure permission" description="Update how this capability appears and whether it is available." className="permission-editor" close={close} locked={mutation.pending || mutation.uncertain}>
      <form onSubmit={async event => {
        event.preventDefault()
        if (await mutation.run('put', `/admin/permissions/${entry.key}`, { expectedRevision: entry.revision, label: label.trim(), enabled, scopes: entry.scopes })) saved()
      }}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <div className="permission-editor-identity"><span className="permission-summary-icon"><ShieldCheck size={22} aria-hidden="true" /></span><div><strong>{entry.label}</strong><code>{entry.key}</code></div></div>
          <Field ref={labelInput} label="Display label" required maxLength={80} value={label} onChange={event => setLabel(event.target.value)} hint="The name shown when assigning permissions to workspace roles." />
          <label className="permission-enable-control"><span><strong>Enable permission</strong><small>Available for effective authorization across workspaces.</small></span><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span className="permission-switch" aria-hidden="true"><Check size={12} /></span></label>
          <div className="permission-editor-scopes"><strong>Supported scopes</strong><ScopeLabels scopes={entry.scopes} /><p>Scopes are defined by this capability.</p></div>
          <div className="permission-impact-note"><Info size={17} aria-hidden="true" /><p>{enabled ? 'Saving changes updates this permission immediately.' : 'Disabling this permission removes its effective access, including from roles that already have it.'}</p></div>
        </fieldset>
        <SaveFooter mutation={mutation} close={close} label="Save catalog entry" disabled={!label.trim()} onClear={() => { setLabel(entry.label); setEnabled(entry.enabled) }} />
      </form>
    </Dialog>
  )
}
