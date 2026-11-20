import { dateLabel } from '../../utils/format'
import { useEffect, useRef, useState } from 'react'
import { Info, Mail, Plus, RefreshCw, Search, Users } from 'lucide-react'
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
  ListSkeleton,
  PageHeader,
  PermissionDenied,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'
import { RoleSelector } from '../../components/workspace/RoleSelector'
import '../../styles/team.css'

export function TeamPage() {
  const workspace = useWorkspace()
  const [editing, setEditing] = useState(null)
  const [version, setVersion] = useState(0)
  const [tab, setTab] = useState('members')
  const [feedback, setFeedback] = useState('')
  const [resendItem, setResendItem] = useState(null)
  const resend = useMutation()
  const roles = useResource(workspace.owner ? `${workspace.base}/roles?limit=50` : null)
  const roleNames = Object.fromEntries((roles.data?.items || []).map((role) => [role.id, role.name]))
  async function resendInvitation(item) {
    setResendItem(item)
    setFeedback('')
    const result = await resend.run(
      'post',
      `${workspace.base}/invitations/${item.id}/resend`,
      { expectedRevision: item.revision },
    )
    if (result) setFeedback(`Invitation resent to ${item.email || item.id}.`)
    return result
  }
  if (!workspace.owner) return <PermissionDenied />
  return (
    <>
      <PageHeader
        title="Team"
        description="Manage workspace members, roles, and invitations in one place."
        actions={
          workspace.writesAllowed && (
            <Action disabled={resend.pending || resend.uncertain} onClick={() => setEditing({ type: 'invite' })}>
              <Plus size={17} aria-hidden="true" />
              Invite a teammate
            </Action>
          )
        }
      />
      <p className="team-feedback" role="status">{feedback}</p>
      <section className="panel team-panel" aria-label="Team management">
        <div className="team-tabs" role="tablist" aria-label="Team views">
          {[
            { value: 'members', label: 'Workspace members', icon: Users },
            { value: 'invitations', label: 'Invitations', icon: Mail },
          ].map(({ value, label, icon: Icon }, index, tabs) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`team-tab-${value}`}
              aria-selected={tab === value}
              aria-controls={`team-panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                let next
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
                if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
                if (event.key === 'Home') next = 0
                if (event.key === 'End') next = tabs.length - 1
                if (next == null) return
                event.preventDefault()
                setTab(tabs[next].value)
                document.getElementById(`team-tab-${tabs[next].value}`)?.focus()
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {['members', 'invitations'].map((kind) => (
          <div
            key={kind}
            id={`team-panel-${kind}`}
            role="tabpanel"
            aria-labelledby={`team-tab-${kind}`}
            hidden={tab !== kind}
            tabIndex={0}
          >
            <TeamList
              key={`${kind}-${version}`}
              kind={kind}
              edit={setEditing}
              roleNames={roleNames}
              resend={resend}
              resendItem={resendItem}
              onResend={resendInvitation}
            />
          </div>
        ))}
      </section>
      {editing && (
        <TeamEditor
          command={editing}
          close={() => setEditing(null)}
          saved={() => {
            setFeedback(editing.type === 'invite' ? 'Invitation sent. Track its status in Invitations.' : 'Team updated successfully.')
            if (editing.type === 'invite') setTab('invitations')
            setEditing(null)
            setVersion((value) => value + 1)
            workspace.refreshAccess()
          }}
        />
      )}
    </>
  )
}

function TeamList({ kind, edit, roleNames, resend, resendItem, onResend }) {
  const workspace = useWorkspace()
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const resource = useResource(
    queryPath(`${workspace.base}/${kind}`, {
      after: history.at(-1),
      limit: 25,
    }),
  )
  const invitations = kind === 'invitations'
  const locked = resend.pending || resend.uncertain
  const items = resource.data?.items || []
  const visibleItems = items.filter((item) =>
    [item.email, item.name, item.id, item.roleName, roleNames[item.roleId], item.role, item.state]
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  async function resendInvitation(item) {
    if (await onResend(item)) resource.reload()
  }
  return (
    <div className="team-list">
      <div className="team-toolbar">
        <Field
          label={invitations ? 'Search invitations on this page' : 'Search members on this page'}
          className="team-search"
          type="search"
          icon={<Search size={17} />}
          placeholder="Search this page…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Action variant="secondary" disabled={resource.loading || locked} onClick={resource.reload}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </Action>
      </div>
      {invitations && (
        <p className="team-seat-note">
          <Info size={16} aria-hidden="true" />
          Invitations reserve paid seats. Accepting uses the reserved seat; additions may be prorated.
        </p>
      )}
      {invitations && <ErrorNotice error={resend.error} />}
      {invitations && resend.uncertain && (
        <p className="notice">The resend outcome is uncertain. Use “Retry resend” to recover the same request.</p>
      )}
      {invitations && resend.uncertain && (
        <Action variant="secondary" disabled={resend.pending} onClick={() => resendInvitation(resendItem)}>
          Retry resend
        </Action>
      )}
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <ListSkeleton
          label={invitations ? 'Loading invitations…' : 'Loading workspace members…'}
          columns={[invitations ? 'Email' : 'Member', 'Role', invitations ? 'Status / expires' : 'Access', 'Manage']}
        />
      ) : visibleItems.length ? (
        <div className="table-scroll">
          <table className="data-table team-table" aria-label={invitations ? 'Invitations' : 'Workspace members'}>
            <thead>
              <tr>
                <th>{invitations ? 'Email' : 'Member'}</th>
                <th>Role</th>
                <th>{invitations ? 'Status / expires' : 'Access'}</th>
                <th className="team-manage-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="team-identity-cell">
                    <div className="team-identity">
                      <span className="team-avatar" aria-hidden="true">
                        {invitations ? <Mail size={17} /> : (item.name || item.email || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <span className="team-person">{item.name || item.email || item.id}</span>
                        {item.name && item.email && <small>{item.email}</small>}
                        {invitations && item.reason && <small>{item.reason.replaceAll('_', ' ')}</small>}
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    {item.role === 'owner'
                      ? 'Owner'
                      : item.roleId
                        ? item.roleName || roleNames[item.roleId] || 'Custom role'
                        : item.role}
                  </td>
                  <td data-label={invitations ? 'Status' : 'Access'}>
                    <Status
                      value={
                        item.state ||
                        (item.pendingRemoval ? 'removing' : 'active')
                      }
                    />
                    {invitations && item.expiresAt && <small>Expires {dateLabel(item.expiresAt)}</small>}
                  </td>
                  <td className="team-actions-cell">
                    <div className="actions team-row-actions">
                      {invitations ? (
                        <>
                          {['reserving', 'ready', 'accepted'].includes(
                            item.state,
                          ) && (
                            <Action
                              variant="secondary"
                              disabled={locked}
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
                                disabled={locked}
                                title="Send a new link with the original expiry. The previous link will stop working."
                                onClick={() => resendInvitation(item)}
                              >
                                {resend.pending && resendItem?.id === item.id ? 'Resending…' : 'Resend'}
                              </Action>
                            )}
                          {['reserving', 'ready'].includes(item.state) && (
                            <Action
                              variant="secondary"
                              disabled={locked}
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
                              disabled={locked}
                              onClick={() => edit({ type: 'memberRole', item })}
                            >
                              Change role
                            </Action>
                            {item.invitationId && item.revision != null && (
                              <Action
                                variant="danger-button"
                                disabled={locked}
                                onClick={() => edit({ type: 'remove', item })}
                              >
                                Remove
                              </Action>
                            )}
                          </>
                        )
                      )}
                      {!invitations && item.role === 'owner' && <span className="team-action-note">Workspace owner</span>}
                      {!invitations && item.pendingRemoval && <span className="team-action-note">Removal in progress</span>}
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
              search.trim() ? 'No matches on this page' : invitations ? 'No invitations yet' : 'No team members to show'
            }
            icon={invitations ? <Mail size={26} aria-hidden="true" /> : <Users size={26} aria-hidden="true" />}
            action={search.trim() ? <Action variant="secondary" onClick={() => setSearch('')}>Clear search</Action> : invitations && workspace.writesAllowed ? <Action disabled={locked} onClick={() => edit({ type: 'invite' })}><Plus size={16} aria-hidden="true" />Invite a teammate</Action> : undefined}
          >
            {search.trim() ? 'Try another name or email, or clear your search.' : invitations
              ? 'Invite a teammate and choose their role to get started.'
              : 'Refresh to load the current team.'}
          </Empty>
        )
      )}
      {resource.data && (
        <div className="table-bottom">
          <span>{search.trim() ? `${visibleItems.length} of ${items.length}` : items.length} {invitations ? items.length === 1 ? 'invitation' : 'invitations' : items.length === 1 ? 'member' : 'members'} on this page</span>
          {(history.length > 0 || resource.data.next) && <div className="actions">
            <Action
              variant="secondary"
              disabled={!history.length || locked}
              onClick={() => { setSearch(''); setHistory((value) => value.slice(0, -1)) }}
            >
              Previous
            </Action>
            <Action
              variant="secondary"
              disabled={!resource.data.next || locked}
              onClick={() =>
                { setSearch(''); setHistory((value) => [...value, resource.data.next]) }
              }
            >
              Next
            </Action>
          </div>}
        </div>
      )}
    </div>
  )
}

function TeamEditor({ command, close, saved }) {
  const workspace = useWorkspace()
  const mutation = useMutation()
  const { type, item } = command
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState(item?.roleId || '')
  const emailRef = useRef(null)
  useEffect(() => {
    emailRef.current?.focus()
  }, [])
  const roleEdit = ['invite', 'memberRole', 'invitationRole'].includes(type)
  const title = {
    invite: 'Invite a teammate',
    memberRole: 'Change member role',
    invitationRole: 'Change invitation role',
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
    if (type === 'cancel') {
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
      size="sm"
      className="team-dialog"
      title={title}
      description={type === 'invite' ? 'Choose who to invite and what they can access.' : item?.email || item?.name || item?.id}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form className="team-form" onSubmit={submit}>
        <fieldset className="team-form-fields" disabled={mutation.pending || mutation.uncertain}>
          {type === 'invite' && (
            <Field
              label="Email address"
              required
              type="email"
              ref={emailRef}
              autoComplete="email"
              placeholder="name@company.com"
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
          {type === 'invite' && <p className="team-seat-note"><Info size={16} aria-hidden="true" />This invitation reserves a paid seat. Additional seats may be prorated.</p>}
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
          label={{ invite: 'Send invitation', memberRole: 'Save role', invitationRole: 'Save role', cancel: 'Cancel invitation', remove: 'Remove member' }[type]}
          disabled={roleEdit && !roleId}
          onClear={roleEdit ? () => {
            setEmail('')
            setRoleId(item?.roleId || '')
          } : undefined}
        />
      </form>
    </Dialog>
  )
}
