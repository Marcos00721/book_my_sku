import { useState } from 'react'
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
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'
import {
  ConflictReview,
  Pager,
  ReferenceSelect,
} from '../../components/workspace/RecordTools'

export function ClientManagement({ path, client, reload }) {
  const workspace = useWorkspace()
  const resource = useResource(`${path}/management`)
  const industry = useResource(client.industryId ? `${path}/industry` : null)
  const [editor, setEditor] = useState(null)
  const canEdit = workspace.can('clients.edit') && workspace.writesAllowed
  if (resource.loading) return <Loading />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const management = resource.data
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>Client overview</h2>
          <div className="actions">
            {canEdit && (
              <>
                {client.status !== 'archived' && (
                  <Action
                    variant="secondary"
                    onClick={() => setEditor('management')}
                  >
                    Edit relationship
                  </Action>
                )}
                <Action
                  variant="secondary"
                  onClick={() =>
                    setEditor(
                      client.status === 'archived' ? 'restore' : 'archive',
                    )
                  }
                >
                  {client.status === 'archived'
                    ? 'Restore client'
                    : 'Archive client'}
                </Action>
              </>
            )}
          </div>
        </div>
        <dl className="detail-list">
          {[
            ['Client code', client.clientCode],
            ['Account label', client.accountLabel],
            ['Website', client.website],
            ['Industry', industry.data?.label],
            ['Relationship', management.relationshipStatus],
            [
              'Account manager',
              management.accountManager?.label || 'Unassigned',
            ],
            ['Assignment', management.assignmentState],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <ErrorNotice error={industry.error} retry={industry.reload} />
        <Status value={client.status} />
        {client.status === 'archived' && (
          <p className="notice">
            Restore this client before changing its profile, contacts, addresses
            or notes. Restoring does not reinstate defaults.
          </p>
        )}
      </section>
      <ClientNotes
        key={client.__v}
        path={path}
        editable={canEdit && client.status !== 'archived'}
      />
      {editor && (
        <ManagementEditor
          command={editor}
          path={path}
          management={management}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null)
            resource.reload()
            reload()
          }}
        />
      )}
    </>
  )
}

function ManagementEditor({ command, path, management, close, saved }) {
  const [relationshipStatus, setStatus] = useState(
    management.relationshipStatus || 'prospect',
  )
  const [accountManagerId, setManager] = useState(
    management.accountManagerId || '',
  )
  const [reason, setReason] = useState('')
  const [version, setVersion] = useState(management.clientVersion)
  const mutation = useMutation()
  async function submit(event) {
    event.preventDefault()
    const result = await mutation.run(
      command === 'management' ? 'patch' : 'post',
      `${path}/${command}`,
      {
        expectedVersion: version,
        reason: reason.trim(),
        ...(command === 'management'
          ? { relationshipStatus, accountManagerId: accountManagerId || null }
          : {}),
      },
    )
    if (result) saved()
  }
  return (
    <Dialog
      title={
        command === 'management'
          ? 'Edit relationship'
          : `${command === 'archive' ? 'Archive' : 'Restore'} client`
      }
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <p className="muted">
        History and existing obligations remain. Archiving clears defaults;
        restoring does not reinstate them.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          {command === 'management' && (
            <>
              <Field
                label="Relationship"
                value={relationshipStatus}
                onChange={(event) => setStatus(event.target.value)}
              >
                {['prospect', 'customer', 'dormant'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Field>
              <ReferenceSelect
                path={`${path}/manager-options`}
                label="Account manager"
                value={accountManagerId}
                selectedLabel={management.accountManager?.label}
                labelFor={(item) => item.actor?.label || 'Member unavailable'}
                onChange={setManager}
              />
            </>
          )}
          <Field
            label="Reason"
            maxLength={250}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={`${path}/management`}
          values={{ relationshipStatus, accountManagerId }}
          onReview={(current) => setVersion(current.clientVersion)}
        />
        <SaveFooter mutation={mutation} close={close} label="Confirm change" />
      </form>
    </Dialog>
  )
}

function ClientNotes({ path, editable }) {
  const workspace = useWorkspace()
  const [pages, setPages] = useState([])
  const [editing, setEditing] = useState(null)
  const [history, setHistory] = useState(null)
  const resource = useResource(
    queryPath(`${path}/notes`, { limit: 25, after: pages.at(-1) }),
  )
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Notes</h2>
        {editable && <Action onClick={() => setEditing({})}>Add note</Action>}
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items?.length ? (
        resource.data.items.map((note) => (
          <article className="note-card" key={note.id}>
            <p className="plain-text">{note.text}</p>
            <small>
              {note.actor?.label || 'Author unavailable'} ·{' '}
              {new Date(note.updatedAt || note.createdAt).toLocaleString()}
            </small>
            <div className="actions">
              {editable && (
                <Action variant="secondary" onClick={() => setEditing(note)}>
                  Correct note
                </Action>
              )}
              {workspace.can('clients.history.view') && (
                <Action variant="secondary" onClick={() => setHistory(note)}>
                  Version history
                </Action>
              )}
            </div>
          </article>
        ))
      ) : (
        !resource.error && (
          <Empty title="No notes yet">
            Keep business context here. Corrections retain previous versions.
          </Empty>
        )
      )}
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label="notes"
      />
      {editing && (
        <NoteEditor
          path={path}
          note={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null)
            resource.reload()
          }}
        />
      )}
      {history && (
        <Dialog title="Note versions" close={() => setHistory(null)}>
          <NoteVersions path={`${path}/notes/${history.id}/versions`} />
        </Dialog>
      )}
    </section>
  )
}

function NoteVersions({ path }) {
  const [pages, setPages] = useState([])
  const resource = useResource(
    queryPath(path, { limit: 25, after: pages.at(-1) }),
  )
  return (
    <>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data?.items?.map((version) => (
          <article key={version.id || version.revision}>
            <h3>Version {version.revision}</h3>
            <p className="plain-text">{version.text}</p>
            <small>
              {version.actor?.label || 'Author unavailable'} ·{' '}
              {version.reason || 'Original note'}
            </small>
          </article>
        ))
      )}
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label="versions"
      />
    </>
  )
}

function NoteEditor({ path, note, close, saved }) {
  const [text, setText] = useState(note.text || '')
  const [reason, setReason] = useState('')
  const mutation = useMutation()
  async function submit(event) {
    event.preventDefault()
    if (
      await mutation.run(
        note.id ? 'patch' : 'post',
        `${path}/notes${note.id ? `/${note.id}` : ''}`,
        {
          text: text.trim(),
          ...(note.id
            ? { expectedVersion: note.revision, reason: reason.trim() }
            : {}),
        },
      )
    )
      saved()
  }
  return (
    <Dialog
      title={note.id ? 'Correct note' : 'Add note'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <label className="field">
            Note
            <textarea
              required
              maxLength={2000}
              rows={5}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {note.id && (
            <Field
              label="Correction reason"
              required
              maxLength={250}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </fieldset>
        <SaveFooter mutation={mutation} close={close} label="Save note" />
      </form>
    </Dialog>
  )
}
