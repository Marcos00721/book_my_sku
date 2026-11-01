import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { Directory } from '../../components/workspace/Directory'
import {
  Action,
  Dialog,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  PermissionDenied,
  SaveFooter,
} from '../../components/workspace/Elements'
import { ClientNameDialog } from './ClientsPage'
import { ClientAddresses } from './ClientAddresses'
import { ClientActivity } from './ClientActivity'
import { ClientManagement } from './ClientManagement'
import { ClientContactDefaults } from './ClientContactDefaults'
import {
  ConflictReview,
  DuplicateHints,
  MutationRetry,
} from '../../components/workspace/RecordTools'

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
  const [renaming, setRenaming] = useState(false)
  const [tab, setTab] = useState('contacts')
  if (resource.loading) return <Loading label="Loading client…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const client = resource.data
  return (
    <>
      <Link to="/app/clients" className="back-link">
        <ArrowLeft size={16} />
        Back to clients
      </Link>
      <PageHeader
        eyebrow="CLIENT RELATIONSHIPS"
        title={client.name}
        description="The people and places behind your next great project."
        actions={
          workspace.can('clients.edit') &&
          workspace.writesAllowed &&
          client.status !== 'archived' && (
            <Action variant="secondary" onClick={() => setRenaming(true)}>
              <Pencil size={15} />
              Rename client
            </Action>
          )
        }
      />
      <div className="tabs" role="tablist" aria-label="Client information">
        {[
          'overview',
          'contacts',
          'addresses',
          ...(workspace.can('clients.history.view') ? ['activity'] : []),
        ].map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {value === 'overview'
              ? 'Overview'
              : value === 'contacts'
                ? 'Contacts'
                : value === 'activity'
                  ? 'Activity'
                  : 'Saved addresses'}
          </button>
        ))}
      </div>
      <section
        className="panel"
        role="tabpanel"
        aria-label={
          tab === 'contacts'
            ? 'Contacts'
            : tab === 'activity'
              ? 'Activity'
              : 'Saved addresses'
        }
      >
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
      {renaming && (
        <ClientNameDialog
          path={path}
          client={client}
          close={() => setRenaming(false)}
          saved={() => {
            setRenaming(false)
            resource.reload()
          }}
        />
      )}
    </>
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
      <div className="section-heading">
        <div>
          <h2>People you work with</h2>
          <p className="muted">The right contact, right when you need them.</p>
        </div>
        {create}
      </div>
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

function ContactEditor({ path, contact, close, saved }) {
  const [values, setValues] = useState({
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    jobTitle: contact.jobTitle || '',
  })
  const mutation = useMutation()
  const [version, setVersion] = useState(contact.__v)
  async function submit(event) {
    event.preventDefault()
    const payload = {
      name: values.name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      jobTitle: values.jobTitle.trim() || null,
      ...(contact._id ? { expectedVersion: version } : {}),
    }
    const result = await mutation.run(
      contact._id ? 'patch' : 'post',
      contact._id ? `${path}/${contact._id}` : path,
      payload,
    )
    if (result) saved()
  }
  return (
    <Dialog
      title={contact._id ? 'Edit contact' : 'Add a contact'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          {[
            ['name', 'Full name', 160],
            ['email', 'Email address', 254],
            ['phone', 'Phone', 40],
            ['jobTitle', 'Job title', 120],
          ].map(([name, label, maxLength]) => (
            <Field
              key={name}
              label={label}
              required={name === 'name'}
              type={name === 'email' ? 'email' : 'text'}
              maxLength={maxLength}
              value={values[name]}
              onChange={(event) =>
                setValues({ ...values, [name]: event.target.value })
              }
            />
          ))}
        </fieldset>
        <DuplicateHints
          path={`${path}/duplicate-candidates`}
          query={values.email.trim() ? { email: values.email.trim() } : null}
          labelFor={(item) => item.name}
        />
        <ConflictReview
          error={mutation.error}
          path={contact._id ? `${path}/${contact._id}` : null}
          values={values}
          onReview={(current) => setVersion(current.__v)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={contact._id ? 'Save contact' : 'Create contact'}
        />
      </form>
    </Dialog>
  )
}
