import { useMemo, useState } from 'react'
import { Plus, Shield } from 'lucide-react'
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
  Loading,
  PageHeader,
  PermissionDenied,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'

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

function FormSection({ title, aside, children }) {
  return (
    <section className="supplier-form-section">
      <div className="role-form-section-heading">
        <h3 className="supplier-form-section-title">{title}</h3>
        {aside ? <span className="role-form-section-aside">{aside}</span> : null}
      </div>
      <div className="supplier-form-section-body">{children}</div>
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
          <Loading />
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

  const groups = useMemo(() => groupCatalog(catalog), [catalog])
  const enabledCount = catalog.filter((entry) => entry.enabled).length
  const selectedCount = grants.length
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
      className="supplier-form-dialog"
      title={
        role.archive ? 'Archive' : role.id ? 'Edit' : 'Create'
      }
      description={
        role.archive
          ? 'Archived roles stay in history but cannot be assigned to new members.'
          : 'Choose what this role can see and change in the workspace.'
      }
      close={close}
      locked={locked}
    >
      <form className="supplier-form role-form" onSubmit={submit}>
        {role.archive ? (
          <div className="supplier-form-fields">
            <p className="muted">
              Archive “{role.name}”? Roles used by active members or live
              invitations cannot be archived.
            </p>
          </div>
        ) : (
          <fieldset
            className="supplier-form-fields"
            disabled={locked}
          >
            <FormSection title="Role details">
              <Field
                label="Role name"
                maxLength={80}
                required
                autoFocus={!role.id}
                hint="Use a clear name your team will recognize."
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormSection>

            <FormSection
              title="Permissions"
              aside={`${selectedCount} selected · ${enabledCount} available`}
            >
              <div className="supplier-form-field-note">
                <p className="supplier-form-field-note-title">Tips</p>
                <p className="muted">
                  Permissions come from the platform catalog. Unavailable
                  entries cannot be granted. Contacts also need Clients view.
                </p>
              </div>

              {needsClientsView ? (
                <p className="role-form-dependency-hint" role="status">
                  Contacts permissions work best with Clients view enabled.
                </p>
              ) : null}

              <div className="role-permission-groups">
                {groups.map(([prefix, entries]) => (
                  <section
                    className="role-permission-group"
                    key={prefix}
                    aria-labelledby={`role-group-${prefix}`}
                  >
                    <h4
                      className="role-permission-group-title"
                      id={`role-group-${prefix}`}
                    >
                      {groupTitle(prefix)}
                    </h4>
                    <div className="role-permission-list">
                      {entries.map((entry) => {
                        const selected = grants.find(
                          (grant) => grant.key === entry.key,
                        )
                        const unavailable = !entry.enabled
                        const showScope =
                          Boolean(selected) && entry.scopes.length > 1
                        return (
                          <div
                            className={`role-permission-card${selected ? ' is-selected' : ''}${unavailable ? ' is-disabled' : ''}`}
                            key={entry.key}
                          >
                            <label className="role-permission-card-main">
                              <input
                                type="checkbox"
                                disabled={unavailable || locked}
                                checked={Boolean(selected)}
                                aria-label={entry.label || entry.key}
                                onChange={(event) =>
                                  toggleGrant(entry, event.target.checked)
                                }
                              />
                              <span
                                className="role-permission-card-copy"
                                aria-hidden="true"
                              >
                                <span className="role-permission-card-label">
                                  {permissionActionLabel(entry, prefix)}
                                </span>
                                <span className="role-permission-card-key">
                                  {entry.key}
                                </span>
                              </span>
                              {unavailable ? (
                                <span
                                  className="role-permission-card-badge"
                                  aria-hidden="true"
                                >
                                  Unavailable
                                </span>
                              ) : null}
                            </label>
                            {showScope ? (
                              <div className="role-permission-scope">
                                <label
                                  className="role-permission-scope-label"
                                  htmlFor={`scope-${entry.key}`}
                                >
                                  Access level
                                </label>
                                <select
                                  id={`scope-${entry.key}`}
                                  className="role-permission-scope-select"
                                  aria-label={`Scope for ${entry.label || entry.key}`}
                                  value={selected.scope}
                                  disabled={locked}
                                  onChange={(event) =>
                                    setScope(entry.key, event.target.value)
                                  }
                                >
                                  {entry.scopes.map((scope) => (
                                    <option key={scope} value={scope}>
                                      {scopeLabel(scope)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </FormSection>
          </fieldset>
        )}
        <SaveFooter
          mutation={mutation}
          close={close}
          label={role.archive ? 'Archive' : 'Save'}
        />
      </form>
    </Dialog>
  )
}
