import { useState } from 'react'
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
            Create role
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
      title={
        role.archive ? 'Archive role' : role.id ? 'Edit role' : 'Create role'
      }
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        {role.archive ? (
          <p className="muted">
            Archive “{role.name}”? Roles used by active members or live
            invitations cannot be archived.
          </p>
        ) : (
          <fieldset disabled={mutation.pending || mutation.uncertain}>
            <Field
              label="Role name"
              maxLength={80}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="muted">
              Permissions come from the platform catalog. Disabled entries
              cannot be granted. Contacts also require Clients view.
            </p>
            <div className="grant-list">
              {catalog.map((entry) => {
                const selected = grants.find((grant) => grant.key === entry.key)
                return (
                  <div className="grant-row" key={entry.key}>
                    <label>
                      <input
                        type="checkbox"
                        disabled={!entry.enabled}
                        checked={Boolean(selected)}
                        onChange={(event) =>
                          setGrants((value) =>
                            event.target.checked
                              ? [
                                  ...value,
                                  { key: entry.key, scope: entry.scopes[0] },
                                ]
                              : value.filter(
                                  (grant) => grant.key !== entry.key,
                                ),
                          )
                        }
                      />
                      {entry.label || entry.key}
                      {!entry.enabled && ' (disabled)'}
                    </label>
                    {selected && (
                      <select
                        aria-label={`Scope for ${entry.label || entry.key}`}
                        value={selected.scope}
                        onChange={(event) =>
                          setGrants((value) =>
                            value.map((grant) =>
                              grant.key === entry.key
                                ? { ...grant, scope: event.target.value }
                                : grant,
                            ),
                          )
                        }
                      >
                        {entry.scopes.map((scope) => (
                          <option key={scope} value={scope}>
                            {scope === 'none' ? 'Create records' : scope}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </fieldset>
        )}
        <SaveFooter
          mutation={mutation}
          close={close}
          label={role.archive ? 'Archive role' : 'Save role'}
        />
      </form>
    </Dialog>
  )
}
