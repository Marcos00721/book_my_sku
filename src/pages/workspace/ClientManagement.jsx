import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useClients } from '../../hooks/useClients'
import { queryPath } from '../../services/workspace'
import { ManagementEditor } from '../../components/clients/ManagementEditor'
import { NoteEditor } from '../../components/clients/NoteEditor'
import { ButtonLink } from '../../components/common/ButtonLink'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Loading,
  Status,
} from '../../components/workspace/Elements'
import { Pager } from '../../components/workspace/RecordTools'

export function ClientManagement({ path, client, reload }) {
  const workspace = useWorkspace()
  const resource = useResource(`${path}/management`)
  const industry = useResource(client.industryId ? `${path}/industry` : null)
  const { saveClient, refetch } = useClients({ autoFetch: false })
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
            {canEdit && client.status !== 'archived' && (
              <ButtonLink
                variant="secondary"
                to={`/app/clients/${client._id}/edit`}
              >
                <Pencil size={15} />
                Edit profile
              </ButtonLink>
            )}
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
            [
              'Website',
              client.website ? (
                <a
                  className="app-link"
                  href={client.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {client.website}
                </a>
              ) : null,
            ],
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
          client={client}
          management={management}
          close={() => setEditor(null)}
          saved={(updated) => {
            if (updated) saveClient(updated)
            else void refetch()
            setEditor(null)
            resource.reload()
            reload()
          }}
        />
      )}
    </>
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

