import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { Directory } from '../../components/workspace/Directory'
import { ContactEditor } from '../../components/clients/ContactEditor'
import { ButtonLink } from '../../components/common/ButtonLink'
import { TextLink } from '../../components/common/TextLink'
import {
  Action,
  ErrorNotice,
  Field,
  Loading,
  PermissionDenied,
  SectionHeading,
  StickyPageChrome,
} from '../../components/workspace/Elements'
import { ClientAddresses } from './ClientAddresses'
import { ClientActivity } from './ClientActivity'
import { ClientManagement } from './ClientManagement'
import { ClientContactDefaults } from './ClientContactDefaults'
import { MutationRetry } from '../../components/workspace/RecordTools'

export function ClientDetailPage() {
  const workspace = useWorkspace()
  const { clientId } = useParams()
  if (!workspace.can('clients.view')) return <PermissionDenied />
  return (
    <ClientRecord
      key={clientId}
      path={`${workspace.base}/clients/${encodeURIComponent(clientId)}`}
    />
  )
}

function ClientRecord({ path }) {
  const workspace = useWorkspace()
  const resource = useResource(path)
  const location = useLocation()
  const navigate = useNavigate()
  const [flash, setFlash] = useState(location.state?.flash || '')
  const [tab, setTab] = useState('contacts')

  useEffect(() => {
    if (!location.state?.flash) return
    setFlash(location.state.flash)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  if (resource.loading) return <Loading label="Loading client…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const client = resource.data
  const tabItems = [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'addresses', label: 'Saved addresses' },
    ...(workspace.can('clients.history.view')
      ? [{ value: 'activity', label: 'Activity' }]
      : []),
  ]
  const activeTabLabel =
    tabItems.find((item) => item.value === tab)?.label || 'Overview'

  return (
    <StickyPageChrome
      before={
        <>
          <TextLink to="/app/clients" className="back-link">
            <ArrowLeft size={16} />
            Back to clients
          </TextLink>
          {flash ? (
            <p className="client-flash notice" role="status">
              {flash}
            </p>
          ) : null}
        </>
      }
      eyebrow="CLIENT RELATIONSHIPS"
      title={client.name}
      description="The people and places behind your next great project."
      actions={
        workspace.can('clients.edit') &&
        workspace.writesAllowed &&
        client.status !== 'archived' && (
          <ButtonLink
            variant="secondary"
            to={`/app/clients/${client._id}/edit`}
          >
            <Pencil size={15} />
            Edit client
          </ButtonLink>
        )
      }
      tabs={{
        label: 'Client information',
        value: tab,
        onChange: setTab,
        items: tabItems,
      }}
    >
      <section className="panel" role="tabpanel" aria-label={activeTabLabel}>
        {tab === 'overview' ? (
          <ClientManagement
            path={path}
            client={client}
            reload={resource.reload}
          />
        ) : tab === 'contacts' ? (
          <ClientContacts
            path={`${path}/contacts`}
            archived={client.status === 'archived'}
            reloadClient={resource.reload}
          />
        ) : tab === 'activity' ? (
          <ClientActivity
            key={String(workspace.can('contacts.view'))}
            path={path}
          />
        ) : (
          <ClientAddresses
            path={path}
            client={client}
            reloadClient={resource.reload}
          />
        )}
      </section>
    </StickyPageChrome>
  )
}

function ClientContacts({ path, archived, reloadClient }) {
  const workspace = useWorkspace()
  const [editing, setEditing] = useState(null)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState('active')
  const lifecycle = useMutation()
  if (!workspace.can('contacts.view')) return <PermissionDenied />
  const create = workspace.can('contacts.create') &&
    workspace.writesAllowed &&
    !archived && (
      <Action onClick={() => setEditing({})}>
        <Plus size={16} />
        Add contact
      </Action>
    )
  return (
    <>
      <SectionHeading
        title="People you work with"
        description="The right contact, right when you need them."
        actions={create}
      />
      <Field
        label="Contact status"
        value={state}
        onChange={(event) => setState(event.target.value)}
      >
        <option value="active">Active</option>
        <option value="inactive">Archived</option>
        <option value="all">All</option>
      </Field>
      <ErrorNotice error={lifecycle.error} />
      <MutationRetry
        mutation={lifecycle}
        saved={() => {
          setVersion((value) => value + 1)
          reloadClient()
        }}
      />
      <ClientContactDefaults
        key={version}
        path={path}
        editable={
          !archived && workspace.can('contacts.edit') && workspace.writesAllowed
        }
        saved={reloadClient}
      />
      <Directory
        key={`${version}:${state}`}
        filters={{ state }}
        path={path}
        label="Contacts"
        emptyAction={create}
      >
        {(items) => (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((contact) => (
                  <tr key={contact._id}>
                    <td>
                      <strong>{contact.name}</strong>
                      <small>{contact.jobTitle || '—'}</small>
                    </td>
                    <td>{contact.email || '—'}</td>
                    <td>{contact.phone || '—'}</td>
                    <td>
                      {workspace.can('contacts.edit') &&
                        workspace.writesAllowed &&
                        !archived &&
                        contact.active !== false && (
                          <Action
                            variant="secondary"
                            onClick={() => setEditing(contact)}
                          >
                            Edit
                          </Action>
                        )}
                      {workspace.can('contacts.edit') &&
                        workspace.writesAllowed &&
                        !archived && (
                          <Action
                            variant="secondary"
                            disabled={lifecycle.pending || lifecycle.uncertain}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  contact.active === false
                                    ? 'Restore this contact without restoring previous defaults?'
                                    : 'Archive this contact and clear any defaults using it?',
                                )
                              )
                                return
                              if (
                                await lifecycle.run(
                                  'post',
                                  `${path}/${contact._id}/${contact.active === false ? 'restore' : 'archive'}`,
                                  { expectedVersion: contact.__v },
                                )
                              ) {
                                setVersion((value) => value + 1)
                                reloadClient()
                              }
                            }}
                          >
                            {contact.active === false ? 'Restore' : 'Archive'}
                          </Action>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Directory>
      {editing && (
        <ContactEditor
          path={path}
          contact={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null)
            setVersion((value) => value + 1)
          }}
        />
      )}
    </>
  )
}

