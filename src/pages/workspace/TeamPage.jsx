import { dateLabel } from '../../utils/format'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
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
import { RoleSelector } from '../../components/workspace/RoleSelector'

export function TeamPage() {
  const workspace = useWorkspace()
  const [editing, setEditing] = useState(null)
  const [version, setVersion] = useState(0)
  if (!workspace.owner) return <PermissionDenied />
  return (
    <>
      <PageHeader
        title="Better, together."
        eyebrow="YOUR TEAM"
        description="Bring the right people into your workspace, with the access they need."
        actions={
          workspace.writesAllowed && (
            <Action onClick={() => setEditing({ type: 'invite' })}>
              <Plus size={17} />
              Invite a teammate
            </Action>
          )
        }
      />
      <p className="notice">
        Invitations reserve paid seats before they become ready. Accepting an
        invitation uses its reserved seat. Additions may be prorated by the
        billing service.
      </p>
      <TeamList key={`members-${version}`} kind="members" edit={setEditing} />
      <TeamList
        key={`invitations-${version}`}
        kind="invitations"
        edit={setEditing}
      />
      {editing && (
        <TeamEditor
          command={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null)
            setVersion((value) => value + 1)
            workspace.refreshAccess()
          }}
        />
      )}
    </>
  )
}

function TeamList({ kind, edit }) {
  const workspace = useWorkspace()
  const [history, setHistory] = useState([])
  const resource = useResource(
    queryPath(`${workspace.base}/${kind}`, {
      after: history.at(-1),
      limit: 25,
    }),
  )
  const invitations = kind === 'invitations'
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{invitations ? 'Invitations' : 'Workspace members'}</h2>
        <Action variant="secondary" onClick={resource.reload}>
          Refresh
        </Action>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{invitations ? 'Email' : 'Member'}</th>
                <th>Role</th>
                <th>{invitations ? 'Status / expires' : 'Access'}</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.email || item.id}
                    <small>{invitations ? item.reason : 'Member ID'}</small>
                  </td>
                  <td>
                    {item.role === 'owner'
                      ? 'Owner'
                      : item.roleId
                        ? 'Custom role'
                        : item.role}
                  </td>
                  <td>
                    <Status
                      value={
                        item.state ||
                        (item.pendingRemoval ? 'removing' : 'active')
                      }
                    />
                    {invitations && <small>{dateLabel(item.expiresAt)}</small>}
                  </td>
                  <td>
                    <div className="actions">
                      {invitations ? (
                        <>
                          {['reserving', 'ready', 'accepted'].includes(
                            item.state,
                          ) && (
                            <Action
                              variant="secondary"
                              onClick={() =>
                                edit({ type: 'invitationRole', item })
                              }
                            >
                              Change role
                            </Action>
                          )}
                          {item.state === 'ready' &&
                            workspace.writesAllowed && (
                              <Action
                                variant="secondary"
                                onClick={() => edit({ type: 'resend', item })}
                              >
                                Resend
                              </Action>
                            )}
                          {['reserving', 'ready'].includes(item.state) && (
                            <Action
                              variant="secondary"
                              onClick={() => edit({ type: 'cancel', item })}
                            >
                              Cancel
                            </Action>
                          )}
                        </>
                      ) : (
                        item.role !== 'owner' &&
                        !item.pendingRemoval && (
                          <>
                            <Action
                              variant="secondary"
                              onClick={() => edit({ type: 'memberRole', item })}
                            >
                              Change role
                            </Action>
                            {item.invitationId && item.revision != null && (
                              <Action
                                variant="danger-button"
                                onClick={() => edit({ type: 'remove', item })}
                              >
                                Remove
                              </Action>
                            )}
                          </>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !resource.error && (
          <Empty
            title={
              invitations ? 'No invitations yet' : 'No team members to show'
            }
          >
            {invitations
              ? 'Invite a teammate when you’re ready to grow.'
              : 'Refresh to load the current team.'}
          </Empty>
        )
      )}
      {resource.data && (
        <div className="table-bottom">
          <span>{resource.data.items.length} on this page</span>
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
  )
}

function TeamEditor({ command, close, saved }) {
  const workspace = useWorkspace()
  const mutation = useMutation()
  const { type, item } = command
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState(item?.roleId || '')
  const roleEdit = ['invite', 'memberRole', 'invitationRole'].includes(type)
  const title = {
    invite: 'Invite a teammate',
    memberRole: 'Change member role',
    invitationRole: 'Change invitation role',
    resend: 'Resend invitation',
    cancel: 'Cancel invitation',
    remove: 'Remove team member',
  }[type]
  async function submit(event) {
    event.preventDefault()
    let method = 'post',
      path = `${workspace.base}/invitations`,
      payload = { email: email.trim(), roleId }
    if (type === 'memberRole') {
      method = 'put'
      path = `${workspace.base}/roles/assignments/${item.id}`
      payload = { expectedRevision: item.permissionRevision, roleId }
    }
    if (type === 'invitationRole') {
      path += `/${item.id}/role`
      payload = { expectedRevision: item.revision, roleId }
    }
    if (['resend', 'cancel'].includes(type)) {
      path += `/${item.id}/${type}`
      payload = { expectedRevision: item.revision }
    }
    if (type === 'remove') {
      method = 'delete'
      path = `${workspace.base}/members/${item.id}`
      payload = { expectedRevision: item.revision }
    }
    if (await mutation.run(method, path, payload)) saved()
  }
  return (
    <Dialog
      title={title}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          {type === 'invite' && (
            <Field
              label="Email address"
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
          {roleEdit && (
            <RoleSelector
              base={workspace.base}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              disabled={mutation.pending || mutation.uncertain}
            />
          )}
          {type === 'resend' && (
            <p className="muted">
              A new email invalidates the previous link. The original expiry
              stays the same.
            </p>
          )}
          {type === 'cancel' && (
            <p className="muted">
              The link becomes invalid immediately. Seat release may remain
              pending while billing reconciles.
            </p>
          )}
          {type === 'remove' && (
            <p className="muted">
              Workspace access is revoked immediately. Paid capacity is released
              after billing confirms it; no midcycle refund is created.
            </p>
          )}
        </fieldset>
        <SaveFooter
          mutation={mutation}
          close={close}
          label={type === 'invite' ? 'Send invitation' : 'Confirm change'}
        />
      </form>
    </Dialog>
  )
}
