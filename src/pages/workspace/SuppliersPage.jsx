import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { dateLabel } from '../../utils/format'
import {
  ConflictReview,
  DuplicateHints,
} from '../../components/workspace/RecordTools'
import { ButtonLink } from '../../components/common/ButtonLink'
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

export function SuppliersPage() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [searchBy, setSearchBy] = useState('name')
  const [status, setStatus] = useState('active')
  const [capability, setCapability] = useState('')
  const [history, setHistory] = useState([])
  const [creating, setCreating] = useState(false)
  const path = queryPath(`${workspace.base}/suppliers`, {
    limit: 25,
    search,
    searchBy,
    status,
    capability,
    after: history.at(-1),
  })
  const resource = useResource(path)

  if (!workspace.can('suppliers.view')) return <PermissionDenied />
  const canCreate = workspace.can('suppliers.create') && workspace.writesAllowed

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Keep supplier and decorator details together, with the people and places behind each relationship."
        actions={
          canCreate && (
            <Action onClick={() => setCreating(true)}>
              <Plus size={16} /> Add supplier
            </Action>
          )
        }
      />
      <section className="panel">
        <div className="toolbar">
          <Field
            label="Search by"
            value={searchBy}
            onChange={(event) => {
              setSearchBy(event.target.value)
              setHistory([])
            }}
          >
            <option value="name">Name prefix</option>
            <option value="code">Exact supplier code</option>
          </Field>
          <form
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchDraft.trim())
              setHistory([])
            }}
          >
            <Field
              label="Find by name"
              value={searchDraft}
              maxLength={80}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <Action type="submit" variant="secondary">
              Search
            </Action>
          </form>
          <Field
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setHistory([])
            }}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Field>
          <Field
            label="Business type"
            value={capability}
            onChange={(event) => {
              setCapability(event.target.value)
              setHistory([])
            }}
          >
            <option value="">All types</option>
            <option value="supplier">Supplier</option>
            <option value="decorator">Decorator</option>
            <option value="fulfillment">Fulfillment</option>
          </Field>
          <Action variant="secondary" onClick={resource.reload}>
            Refresh
          </Action>
        </div>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? (
          <Loading label="Loading suppliers…" />
        ) : resource.data?.items?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Capabilities</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((supplier) => (
                  <tr key={supplier._id}>
                    <td>
                      <Link
                        className="entity-link"
                        to={`/app/suppliers/${supplier._id}`}
                      >
                        {supplier.name}
                      </Link>
                      <small>{supplier.supplierCode}</small>
                    </td>
                    <td>
                      {supplier.capabilities
                        .map((item) => item.replaceAll('_', ' '))
                        .join(', ')}
                    </td>
                    <td>
                      <Status value={supplier.status} />
                    </td>
                    <td>{dateLabel(supplier.createdAt)}</td>
                    <td>
                      <ButtonLink
                        variant="icon"
                        aria-label={`Open ${supplier.name}`}
                        to={`/app/suppliers/${supplier._id}`}
                      >
                        <ArrowUpRight size={16} />
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !resource.error ? (
          <Empty
            title="No suppliers found"
            action={
              canCreate && (
                <Action onClick={() => setCreating(true)}>Add supplier</Action>
              )
            }
          >
            {search
              ? 'Try another name or clear the search.'
              : 'Add a supplier or decorator to start your directory.'}
          </Empty>
        ) : null}
        {resource.data && (
          <div className="table-bottom">
            <span>{resource.data.items.length} suppliers</span>
            <div className="actions">
              <Action
                variant="secondary"
                disabled={!history.length}
                onClick={() => setHistory((items) => items.slice(0, -1))}
              >
                Previous
              </Action>
              <Action
                variant="secondary"
                disabled={!resource.data.next}
                onClick={() =>
                  setHistory((items) => [...items, resource.data.next])
                }
              >
                Next
              </Action>
            </div>
          </div>
        )}
      </section>
      {creating && (
        <SupplierEditor
          close={() => setCreating(false)}
          saved={(supplier) => navigate(`/app/suppliers/${supplier._id}`)}
          path={`${workspace.base}/suppliers`}
        />
      )}
    </>
  )
}

export function SupplierEditor({
  path,
  supplier,
  close,
  saved,
  requiredCapability,
}) {
  const [name, setName] = useState(supplier?.name || '')
  const [capabilities, setCapabilities] = useState(
    supplier?.capabilities || ['supplier'],
  )
  const mutation = useMutation()
  const [profile, setProfile] = useState(
    Object.fromEntries(
      ['website', 'email', 'phone', 'accountNumber'].map((key) => [
        key,
        supplier?.[key] || '',
      ]),
    ),
  )
  const [revision, setRevision] = useState(supplier?.revision)
  function toggle(value) {
    if (value === requiredCapability) return
    setCapabilities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }
  async function submit(event) {
    event.preventDefault()
    const result = await mutation.run(supplier ? 'patch' : 'post', path, {
      ...(supplier ? { expectedRevision: revision } : {}),
      name: name.trim(),
      capabilities,
      ...Object.fromEntries(
        Object.entries(profile)
          .filter(([key, value]) =>
            supplier ? (value.trim() || null) !== supplier[key] : value.trim(),
          )
          .map(([key, value]) => [key, value.trim() || null]),
      ),
    })
    if (result) saved(result.data)
  }
  return (
    <Dialog
      title={supplier ? 'Edit supplier' : 'Add a supplier'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Business name"
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <fieldset className="choice-group">
            <legend>Business capabilities</legend>
            {[
              ['supplier', 'Supplies products'],
              ['decorator', 'Decorates products'],
              ['fulfillment', 'Fulfillment'],
            ].map(([value, label]) => (
              <label className="check-label" key={value}>
                <input
                  type="checkbox"
                  checked={capabilities.includes(value)}
                  onChange={() => toggle(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {Object.entries({
            website: 'Website',
            email: 'General email',
            phone: 'Phone',
            accountNumber: 'Our account number with this supplier',
          }).map(([key, label]) => (
            <Field
              key={key}
              label={`${label} (optional)`}
              type={
                key === 'email' ? 'email' : key === 'website' ? 'url' : 'text'
              }
              maxLength={
                key === 'website'
                  ? 300
                  : key === 'email'
                    ? 254
                    : key === 'phone'
                      ? 40
                      : 120
              }
              value={profile[key]}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          ))}
          <DuplicateHints
            path={`${path.split('/suppliers')[0]}/suppliers/duplicate-candidates`}
            query={
              name.trim()
                ? {
                    name: name.trim(),
                    ...(supplier ? { excludeId: supplier._id } : {}),
                  }
                : null
            }
            to="/app/suppliers"
          />
          <ConflictReview
            error={mutation.error}
            path={supplier ? path : null}
            values={{ name, capabilities, ...profile }}
            onReview={(current) => setRevision(current.revision)}
          />
        </fieldset>
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!capabilities.length}
          label={supplier ? 'Save supplier' : 'Create supplier'}
        />
      </form>
    </Dialog>
  )
}
