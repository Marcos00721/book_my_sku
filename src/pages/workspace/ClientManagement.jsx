import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useClients } from '../../hooks/useClients'
import { ManagementEditor } from '../../components/clients/ManagementEditor'
import { ClientNotes } from '../../components/clients/ClientNotes'
import { ButtonLink } from '../../components/common/ButtonLink'
import {
  Action,
  ErrorNotice,
  Loading,
  Status,
} from '../../components/workspace/Elements'

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
        notes={client.notes}
        editPath={canEdit && client.status !== 'archived' ? `/app/clients/${client._id}/edit` : undefined}
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

