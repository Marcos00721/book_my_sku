import { dateLabel } from '../../utils/format'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Building2, Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { Directory } from '../../components/workspace/Directory'
import {
  ConflictReview,
  DuplicateHints,
  ReferenceSelect,
} from '../../components/workspace/RecordTools'
import {
  Action,
  Dialog,
  Field,
  PageHeader,
  PermissionDenied,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'

export function ClientsPage() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [state, setState] = useState('active')
  if (!workspace.can('clients.view')) return <PermissionDenied />
  const create = workspace.can('clients.create') && workspace.writesAllowed && (
    <Action onClick={() => setCreating(true)}>
      <Plus size={17} />
      Add client
    </Action>
  )
  return (
    <>
      <PageHeader
        title="Clients"
        description="Good relationships, all in one place. Keep your client details a little closer."
        actions={create}
      />
      <section className="panel">
        <Field
          label="Client status"
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Field>
        <Directory
          key={state}
          filters={{ state }}
          caseSensitive={false}
          path={`${workspace.base}/clients`}
          label="Clients"
          emptyAction={create}
        >
          {(items) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client name</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th>
                      <span className="sr-only">Open client</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((client) => (
                    <tr key={client._id}>
                      <td>
                        <Link
                          className="entity-link"
                          to={`/app/clients/${client._id}`}
                        >
                          <span className="entity-icon">
                            <Building2 size={17} />
                          </span>
                          {client.name}
                        </Link>
                        <small>
                          {[client.clientCode, client.accountLabel]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </td>
                      <td>
                        <Status value={client.status} />
                      </td>
                      <td className="muted">{dateLabel(client.createdAt)}</td>
                      <td>
                        <Link
                          className="button icon-button"
                          aria-label={`Open ${client.name}`}
                          to={`/app/clients/${client._id}`}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Directory>
      </section>
      {creating && (
        <ClientNameDialog
          path={`${workspace.base}/clients`}
          close={() => setCreating(false)}
          saved={(client) => navigate(`/app/clients/${client._id}`)}
        />
      )}
    </>
  )
}

export function ClientNameDialog({ path, client, close, saved }) {
  const [name, setName] = useState(client?.name || '')
  const [website, setWebsite] = useState(client?.website || '')
  const [accountLabel, setAccountLabel] = useState(client?.accountLabel || '')
  const [industryId, setIndustryId] = useState(client?.industryId || '')
  const [version, setVersion] = useState(client?.__v)
  const workspace = useWorkspace()
  const mutation = useMutation()
  async function submit(event) {
    event.preventDefault()
    const fields = {
      name: name.trim(),
      website: website.trim() || null,
      accountLabel: accountLabel.trim() || null,
      industryId: industryId || null,
    }
    const payload = Object.fromEntries(
      Object.entries(fields).filter(([key, value]) =>
        client ? value !== (client[key] ?? null) : value != null,
      ),
    )
    const result = await mutation.run(client ? 'patch' : 'post', path, {
      ...payload,
      ...(client ? { expectedVersion: version } : {}),
    })
    if (result) saved(result.data)
  }
  return (
    <Dialog
      title={client ? 'Rename client' : 'Add a client'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <Field
          label="Client name"
          required
          maxLength={160}
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={mutation.pending || mutation.uncertain}
        />
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Account label (optional)"
            value={accountLabel}
            maxLength={120}
            onChange={(event) => setAccountLabel(event.target.value)}
          />
          <Field
            label="Website (optional)"
            type="url"
            value={website}
            maxLength={300}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <ReferenceSelect
            path={`${workspace.base}/clients/industry-options`}
            label="Client industry"
            value={industryId}
            onChange={setIndustryId}
          />
          <DuplicateHints
            path={`${workspace.base}/clients/duplicate-candidates`}
            query={name.trim() ? { name: name.trim() } : null}
            to="/app/clients"
          />
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={client ? path : null}
          values={{ name, website, accountLabel, industryId }}
          onReview={(current) => setVersion(current.__v)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={client ? 'Save name' : 'Create client'}
        />
      </form>
    </Dialog>
  )
}
