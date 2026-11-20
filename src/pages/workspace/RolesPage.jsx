import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Info, Plus, Search, Shield } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  ListSkeleton,
  PageHeader,
  PermissionDenied,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'
import '../../styles/roles.css'

function scopeLabel(scope) {
  if (scope === 'all') return 'All records'
  if (scope === 'none') return 'Create records'
  return String(scope)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function groupTitle(prefix) {
  return String(prefix || 'other')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/** Under a Clients group, show "Create" instead of "Create clients". */
function permissionActionLabel(entry, groupPrefix) {
  const parts = String(entry.key || '')
    .split('.')
    .filter(Boolean)
  if (parts.length > 1) {
    return parts
      .slice(1)
      .join(' ')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }
  const group = groupTitle(groupPrefix)
  const label = String(entry.label || entry.key || '').trim()
  const stripped = label
    .replace(new RegExp(`\\s+${group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .trim()
  return stripped || label
}

function groupCatalog(catalog) {
  const groups = new Map()
  for (const entry of catalog) {
    const prefix = String(entry.key || '').split('.')[0] || 'other'
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix).push(entry)
  }
  return [...groups.entries()]
}

function PermissionGroup({ prefix, entries, grants, locked, filtered, toggleGrant, toggleGroup, setScope }) {
  const checkboxRef = useRef(null)
  const available = entries.filter((entry) => entry.enabled && entry.scopes.length)
  const selectedCount = available.filter((entry) => grants.some((grant) => grant.key === entry.key)).length
  const allSelected = available.length > 0 && selectedCount === available.length
  useEffect(() => {
    checkboxRef.current.indeterminate = selectedCount > 0 && !allSelected
  }, [selectedCount, allSelected])

  return (
    <section className="role-editor-group" aria-labelledby={`role-group-${prefix}`}>
      <div className="role-editor-group-heading">
        <h4 id={`role-group-${prefix}`}>{groupTitle(prefix)}</h4>
        <label className="role-editor-select-all">
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-label={`Select all ${filtered ? 'matching ' : ''}${groupTitle(prefix)} permissions`}
            checked={allSelected}
            disabled={locked || !available.length}
            onChange={(event) => toggleGroup(available, event.target.checked)}
          />
          {filtered ? 'All matches' : 'Select all'}
        </label>
      </div>
      <div className="role-editor-rows">
        {entries.map((entry) => {
          const selected = grants.find((grant) => grant.key === entry.key)
          const unavailable = !entry.enabled || !entry.scopes.length
          return (
            <div
              className={`role-editor-row${selected ? ' is-selected' : ''}${unavailable ? ' is-disabled' : ''}`}
              key={entry.key}
            >
              <label className="role-editor-permission">
                <input
                  type="checkbox"
                  disabled={unavailable || locked}
                  checked={Boolean(selected)}
                  aria-label={entry.label || entry.key}
                  onChange={(event) => toggleGrant(entry, event.target.checked)}
                />
                <span>{permissionActionLabel(entry, prefix)}</span>
              </label>
              {unavailable ? (
                <span className="role-editor-access-note">Unavailable</span>
              ) : selected && entry.scopes.length > 1 ? (
                <div className="role-editor-scope">
                  <select
                    aria-label={`Scope for ${entry.label || entry.key}`}
                    value={selected.scope}
                    disabled={locked}
                    onChange={(event) => setScope(entry.key, event.target.value)}
                  >
                    {entry.scopes.map((scope) => (
                      <option key={scope} value={scope}>{scopeLabel(scope)}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              ) : (
                <span className="role-editor-access-note">
                  {selected ? scopeLabel(selected.scope) : 'No access'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function RolesPage() {
  const workspace = useWorkspace()
  const [history, setHistory] = useState([])
  const resource = useResource(
    workspace.owner
      ? queryPath(`${workspace.base}/roles`, {
          after: history.at(-1),
          limit: 25,
        })
      : null,
  )
  const catalog = useResource(
    workspace.owner ? `${workspace.base}/roles/catalog` : null,
  )
  const [editing, setEditing] = useState(null)
  if (!workspace.owner) return <PermissionDenied />
  function saved() {
    setEditing(null)
    resource.reload()
    catalog.reload()
    workspace.refreshAccess()
  }
  return (
    <>
      <PageHeader
        title="A place for every role."
        eyebrow="ROLES & PERMISSIONS"
        description="Give your team the access that fits their work. Each member has one role."
        actions={
          <Action onClick={() => setEditing({})}>
            <Plus size={17} />
            Create
          </Action>
        }
      />
      <section className="panel">
        <div className="section-heading">
          <h2>Workspace roles</h2>
          <Action
            variant="secondary"
            onClick={() => {
              resource.reload()
              catalog.reload()
            }}
          >
            Refresh
          </Action>
        </div>
        <ErrorNotice
          error={resource.error || catalog.error}
          retry={resource.reload}
        />
        {resource.loading || catalog.loading ? (
          <ListSkeleton label="Loading roles…" columns={['Role name', 'Permissions', 'Status', 'Manage']} />
        ) : resource.data?.items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role name</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <span className="entity-link">
                        <Shield size={17} />
                        {role.name}
                      </span>
                    </td>
                    <td>{role.grants.length} granted</td>
                    <td>
                      <Status value={role.archived ? 'archived' : 'active'} />
                    </td>
                    <td>
                      {!role.archived && (
                        <div className="actions">
                          <Action
                            variant="secondary"
                            onClick={() => setEditing(role)}
                          >
                            Edit
                          </Action>
                          <Action
                            variant="secondary"
                            onClick={() =>
                              setEditing({ ...role, archive: true })
                            }
                          >
                            Archive
                          </Action>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.error && (
            <Empty title="Make room for your team">
              Create a role using the supported permissions below.
            </Empty>
          )
        )}
        {resource.data && (
          <div className="table-bottom">
            <span>{resource.data.items.length} roles on this page</span>
            <div className="actions">
              <Action
                variant="secondary"
                disabled={!history.length}
                onClick={() => setHistory((value) => value.slice(0, -1))}
              >
                Previous
              </Action>
              <Action
                variant="secondary"
                disabled={!resource.data.next}
                onClick={() =>
                  setHistory((value) => [...value, resource.data.next])
                }
              >
                Next
              </Action>
            </div>
          </div>
        )}
      </section>
      {editing && catalog.data && (
        <RoleEditor
          role={editing}
          catalog={catalog.data.items}
          close={() => setEditing(null)}
          saved={saved}
        />
      )}
    </>
  )
}

function RoleEditor({ role, catalog, close, saved }) {
  const workspace = useWorkspace()
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const [name, setName] = useState(role.name || '')
  const [search, setSearch] = useState('')
  const nameRef = useRef(null)
  useEffect(() => {
    nameRef.current?.focus()
  }, [])
  const [grants, setGrants] = useState(
    (role.grants || []).filter((grant) =>
      catalog.some(
        (entry) =>
          entry.key === grant.key &&
          entry.enabled &&
          entry.scopes.includes(grant.scope),
      ),
    ),
  )

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    return groupCatalog(catalog.filter((entry) =>
      `${groupTitle(entry.key.split('.')[0])} ${entry.label || ''} ${entry.key}`.toLowerCase().includes(query),
    ))
  }, [catalog, search])
  const enabledCount = catalog.filter((entry) => entry.enabled && entry.scopes.length).length
  const selectedCount = grants.length
  const clientsView = catalog.find((entry) => entry.key === 'clients.view' && entry.enabled && entry.scopes.length)
  const needsClientsView =
    grants.some((grant) => grant.key.startsWith('contacts.')) &&
    !grants.some((grant) => grant.key === 'clients.view')

  function toggleGrant(entry, checked) {
    setGrants((value) =>
      checked
        ? [
            ...value.filter((grant) => grant.key !== entry.key),
            { key: entry.key, scope: entry.scopes[0] },
          ]
        : value.filter((grant) => grant.key !== entry.key),
    )
  }

  function setScope(entryKey, scope) {
    setGrants((value) =>
      value.map((grant) =>
        grant.key === entryKey ? { ...grant, scope } : grant,
      ),
    )
  }

  function toggleGroup(entries, checked) {
    const keys = new Set(entries.map((entry) => entry.key))
    setGrants((current) => checked
      ? [...current, ...entries.filter((entry) => !current.some((grant) => grant.key === entry.key))
        .map((entry) => ({ key: entry.key, scope: entry.scopes[0] }))]
      : current.filter((grant) => !keys.has(grant.key)),
    )
  }

  async function submit(event) {
    event.preventDefault()
    const method = role.archive || !role.id ? 'post' : 'put'
    const path = `${workspace.base}/roles${role.id ? `/${role.id}${role.archive ? '/archive' : ''}` : ''}`
    const payload = role.archive
      ? { expectedRevision: role.revision }
      : {
          name: name.trim(),
          grants,
          ...(role.id ? { expectedRevision: role.revision } : {}),
        }
    if (await mutation.run(method, path, payload)) saved()
  }

  return (
    <Dialog
      size={role.archive ? 'sm' : 'lg'}
      className={`role-editor-dialog${role.archive ? ' role-editor-dialog--archive' : ''}`}
      title={role.archive ? 'Archive role' : role.id ? 'Edit role' : 'Create role'}
      description={
        role.archive
          ? 'Archived roles stay in history but cannot be assigned to new members.'
          : 'Choose what this role can see and change in the workspace.'
      }
      close={close}
      locked={locked}
    >
      <form className="role-editor-form" onSubmit={submit}>
        {role.archive ? (
          <div className="role-editor-archive">
            <p className="muted">
              Archive “{role.name}”? Roles used by active members or live
              invitations cannot be archived.
            </p>
          </div>
        ) : (
          <div
            className="role-editor-fields"
            aria-disabled={locked || undefined}
          >
            <div className="role-editor-details">
              <Field
                ref={nameRef}
                label="Role name"
                maxLength={80}
                required
                disabled={locked}
                placeholder="e.g. Account manager"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="role-editor-toolbar">
              <div className="role-editor-section-heading">
                <h3>Permissions</h3>
                <span className="role-editor-count" role="status">{selectedCount} of {enabledCount} selected</span>
              </div>
              <Field
                label="Search permissions"
                className="role-editor-search"
                type="search"
                disabled={locked}
                icon={<Search size={17} />}
                placeholder="Find a permission or area…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {needsClientsView && (
              <div className="role-editor-dependency" role="status">
                <Info size={17} aria-hidden="true" />
                <p>Contacts also need Clients view to be accessible.</p>
                {clientsView && <Action variant="text-button" disabled={locked} onClick={() => toggleGrant(clientsView, true)}>Enable Clients view</Action>}
              </div>
            )}

            <div className="role-editor-catalog" role="region" aria-label="Permission groups" tabIndex={0}>
              <div className="role-editor-column-headings" aria-hidden="true">
                <span>Permission</span>
                <span>Access</span>
              </div>
              <div className="role-editor-groups">
                {groups.map(([prefix, entries]) => <PermissionGroup
                  key={prefix}
                  prefix={prefix}
                  entries={entries}
                  grants={grants}
                  locked={locked}
                  filtered={Boolean(search.trim())}
                  toggleGrant={toggleGrant}
                  toggleGroup={toggleGroup}
                  setScope={setScope}
                />)}
              </div>
              {!groups.length && (
                <div className="role-editor-empty">
                  <Search size={24} aria-hidden="true" />
                  <h4>{search.trim() ? 'No matching permissions' : 'No permissions available'}</h4>
                  <p>{search.trim() ? 'Try another name or clear your search.' : 'You can save this role and add permissions when they become available.'}</p>
                  {search.trim() && <Action variant="secondary" onClick={() => setSearch('')}>Clear search</Action>}
                </div>
              )}
            </div>
          </div>
        )}
        <SaveFooter
          mutation={mutation}
          close={close}
          label={role.archive ? 'Archive role' : 'Save'}
          disabled={!role.archive && !name.trim()}
          onClear={role.archive ? undefined : () => {
            setName(role.name || '')
            setSearch('')
            setGrants((role.grants || []).filter((grant) =>
              catalog.some((entry) => entry.key === grant.key && entry.enabled && entry.scopes.includes(grant.scope)),
            ))
          }}
        />
      </form>
    </Dialog>
  )
}
