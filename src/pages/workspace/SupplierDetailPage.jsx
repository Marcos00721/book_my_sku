import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import {
  ActivityHistory,
  ConflictReview,
  Pager,
  MutationRetry,
} from '../../components/workspace/RecordTools'
import { GeographyFields } from '../../components/workspace/GeographyFields'
import { SupplierEditor } from './SuppliersPage'

const purposes = {
  ordering: 'Ordering',
  ship_from: 'Ship from',
  returns: 'Returns',
  receiving: 'Receiving',
}
const contactPurposes = [
  'sales_account',
  'ordering',
  'artwork_proofs',
  'production',
  'accounting',
  'general_support',
]

export function SupplierDetailPage() {
  const workspace = useWorkspace()
  const { supplierId } = useParams()
  if (!workspace.can('suppliers.view')) return <PermissionDenied />
  return (
    <SupplierRecord
      key={supplierId}
      base={`${workspace.base}/suppliers/${encodeURIComponent(supplierId)}`}
    />
  )
}

function SupplierRecord({ base }) {
  const workspace = useWorkspace()
  const resource = useResource(base)
  const [tab, setTab] = useState('contacts')
  const [editing, setEditing] = useState(false)
  const mutation = useMutation()
  if (resource.loading) return <Loading label="Loading supplier…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const supplier = resource.data
  const canEdit =
    workspace.can('suppliers.edit') &&
    workspace.writesAllowed &&
    supplier.status === 'active'
  async function lifecycle() {
    const action = supplier.status === 'active' ? 'archive' : 'restore'
    if (
      !window.confirm(
        `${action === 'archive' ? 'Archive' : 'Restore'} ${supplier.name}? Existing history remains. Defaults are not restored automatically.`,
      )
    )
      return
    if (
      await mutation.run('post', `${base}/${action}`, {
        expectedRevision: supplier.revision,
      })
    )
      resource.reload()
  }
  return (
    <>
      <Link className="back-link" to="/app/suppliers">
        ← Back to suppliers
      </Link>
      <PageHeader
        title={supplier.name}
        description={[supplier.supplierCode, ...supplier.capabilities]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="actions">
            {canEdit && (
              <Action variant="secondary" onClick={() => setEditing(true)}>
                Edit details
              </Action>
            )}
            {workspace.can('suppliers.edit') && workspace.writesAllowed && (
              <Action
                variant="secondary"
                disabled={mutation.pending || mutation.uncertain}
                onClick={lifecycle}
              >
                {supplier.status === 'active'
                  ? 'Archive supplier'
                  : 'Restore supplier'}
              </Action>
            )}
          </div>
        }
      />
      <ErrorNotice error={mutation.error} retry={resource.reload} />
      <MutationRetry mutation={mutation} saved={resource.reload} />
      <Status value={supplier.status} />
      <dl className="detail-list">
        {[
          ['Website', supplier.website],
          ['General email', supplier.email],
          ['Phone', supplier.phone],
          ['Our account number', supplier.accountNumber],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <div className="tabs" role="tablist" aria-label="Supplier information">
        {[
          'contacts',
          'addresses',
          'defaults',
          ...(workspace.can('suppliers.history.view') ? ['activity'] : []),
        ].map((value) => (
          <button
            role="tab"
            key={value}
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      <section className="panel" role="tabpanel">
        {tab === 'contacts' || tab === 'addresses' ? (
          <SupplierChildren
            key={tab}
            kind={tab}
            base={base}
            canEdit={canEdit}
            parentArchived={supplier.status !== 'active'}
            changed={resource.reload}
          />
        ) : tab === 'defaults' ? (
          <SupplierDefaults
            base={base}
            canEdit={canEdit}
            changed={resource.reload}
          />
        ) : workspace.can('suppliers.history.view') ? (
          <ActivityHistory path={`${base}/activity`} />
        ) : (
          <PermissionDenied />
        )}
      </section>
      {editing && (
        <SupplierEditor
          path={base}
          supplier={supplier}
          close={() => setEditing(false)}
          saved={() => {
            setEditing(false)
            resource.reload()
          }}
        />
      )}
    </>
  )
}

function SupplierChildren({ base, kind, canEdit, parentArchived, changed }) {
  const [open, setOpen] = useState(null)
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('active')
  const resource = useResource(
    queryPath(`${base}/${kind}`, { status, limit: 25, after: pages.at(-1) }),
  )
  const mutation = useMutation()
  async function lifecycle(child) {
    const action = child.status === 'active' ? 'archive' : 'restore'
    if (
      !window.confirm(
        `${action === 'archive' ? 'Archive' : 'Restore'} this record? Archiving clears affected defaults. Restore does not reinstate them.`,
      )
    )
      return
    if (kind === 'contacts' && action === 'restore' && !child.email) {
      setOpen(child)
      return
    }
    if (
      await mutation.run('post', `${base}/${kind}/${child._id}/${action}`, {
        expectedRevision: child.revision,
      })
    ) {
      resource.reload()
      changed()
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>{kind === 'contacts' ? 'People' : 'Saved addresses'}</h2>
        {canEdit && (
          <Action onClick={() => setOpen({})}>
            Add {kind === 'contacts' ? 'contact' : 'address'}
          </Action>
        )}
      </div>
      <Field
        label={`${kind === 'contacts' ? 'Contact' : 'Address'} status`}
        value={status}
        onChange={(event) => {
          setStatus(event.target.value)
          setPages([])
        }}
      >
        {['active', 'archived', 'all'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Field>
      {parentArchived && (
        <p className="notice">
          Restore this supplier before changing its records.
        </p>
      )}
      <ErrorNotice
        error={resource.error || mutation.error}
        retry={resource.reload}
      />
      <MutationRetry
        mutation={mutation}
        saved={() => {
          resource.reload()
          changed()
        }}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items?.length ? (
        resource.data.items.map((child) => (
          <article className="address-card" key={child._id}>
            <h3>{child.name || child.label || 'Saved address'}</h3>
            <Status value={child.status} />
            {kind === 'contacts' ? (
              <>
                <p>
                  {child.email || 'Email required before editing or restoring'}
                </p>
                <p>
                  {child.phone} {child.jobTitle}
                </p>
              </>
            ) : (
              <>
                <p>
                  {Object.values(child.address || {})
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {child.readiness && (
                  <p className="muted">
                    {child.readiness.complete
                      ? 'Complete; delivery unverified'
                      : `Draft: ${(child.readiness.missingFields || []).join(', ')}`}
                  </p>
                )}
              </>
            )}
            <p>
              {child.purposes
                ?.map((value) => purposes[value] || value.replaceAll('_', ' '))
                .join(', ')}
            </p>
            {canEdit && (
              <div className="actions">
                {child.status === 'active' && (
                  <Action variant="secondary" onClick={() => setOpen(child)}>
                    Edit
                  </Action>
                )}
                <Action
                  variant="secondary"
                  disabled={mutation.pending || mutation.uncertain}
                  onClick={() => lifecycle(child)}
                >
                  {child.status === 'active' ? 'Archive' : 'Restore'}
                </Action>
              </div>
            )}
          </article>
        ))
      ) : (
        !resource.error && (
          <Empty title={`No ${kind} found`}>
            Add a record or change the status filter.
          </Empty>
        )
      )}
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label={kind}
      />
      {open && (
        <ChildEditor
          kind={kind}
          base={base}
          record={open}
          close={() => setOpen(null)}
          saved={() => {
            setOpen(null)
            resource.reload()
            changed()
          }}
        />
      )}
    </>
  )
}

function ChildEditor({ kind, base, record, close, saved }) {
  const isContact = kind === 'contacts'
  const [values, setValues] = useState(
    isContact
      ? Object.fromEntries(
          ['name', 'email', 'phone', 'jobTitle'].map((key) => [
            key,
            record[key] || '',
          ]),
        )
      : {
          label: record.label || '',
          ...Object.fromEntries(
            [
              'line1',
              'line2',
              'city',
              'postalCode',
              'country',
              'stateCode',
              'region',
            ].map((key) => [key, record.address?.[key] || '']),
          ),
        },
  )
  const [selected, setSelected] = useState(
    record.purposes || (isContact ? [] : ['ordering']),
  )
  const [geographyChanged, setGeographyChanged] = useState(false)
  const [selectDefault, setDefault] = useState(false)
  const defaults = useResource(!record._id ? `${base}/defaults` : null)
  const [revision, setRevision] = useState(record.revision)
  const mutation = useMutation()
  const set = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }))
  async function submit(event) {
    event.preventDefault()
    let body
    if (isContact)
      body = {
        ...Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            value.trim() || null,
          ]),
        ),
        purposes: selected,
      }
    else {
      const address = Object.fromEntries(
        ['line1', 'line2', 'city', 'postalCode'].map((key) => [
          key,
          values[key].trim() || null,
        ]),
      )
      if (!record._id || geographyChanged)
        Object.assign(address, {
          country: values.country || null,
          stateCode: values.stateCode || null,
        })
      body = { label: values.label.trim() || null, purposes: selected, address }
    }
    if (record._id) body.expectedRevision = revision
    else if (selectDefault)
      body.setDefaults = {
        expectedRevision: defaults.data.defaults.revision,
        ...(isContact ? { primaryContact: true } : { purposes: selected }),
      }
    const restoring = isContact && record.status === 'archived'
    if (restoring)
      body = { expectedRevision: revision, email: values.email.trim() }
    if (
      await mutation.run(
        restoring ? 'post' : record._id ? 'patch' : 'post',
        `${base}/${kind}${record._id ? `/${record._id}${restoring ? '/restore' : ''}` : ''}`,
        body,
      )
    )
      saved()
  }
  return (
    <Dialog
      title={`${record._id ? (record.status === 'archived' ? 'Restore' : 'Edit') : 'Add'} ${isContact ? 'contact' : 'address'}`}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          {(isContact
            ? [
                ['name', 'Name', 160],
                ['email', 'Email', 254],
                ['phone', 'Phone', 40],
                ['jobTitle', 'Job title', 120],
              ]
            : [
                ['label', 'Label', 80],
                ['line1', 'Address line 1', 160],
                ['line2', 'Address line 2', 160],
                ['city', 'City', 100],
                ['postalCode', 'Postal code', 32],
              ]
          ).map(([key, label, maxLength]) => (
            <Field
              key={key}
              label={label}
              type={key === 'email' ? 'email' : 'text'}
              required={isContact && ['name', 'email'].includes(key)}
              maxLength={maxLength}
              value={values[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          ))}
          {!isContact && (
            <GeographyFields
              values={values}
              change={(patch) => {
                setGeographyChanged(true)
                setValues((current) => ({ ...current, ...patch }))
              }}
            />
          )}
          <fieldset className="choice-group">
            <legend>
              {isContact ? 'Contact responsibilities' : 'Address purposes'}
            </legend>
            {(isContact ? contactPurposes : Object.keys(purposes)).map(
              (value) => (
                <label key={value} className="check-label">
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(value)
                          ? current.filter((item) => item !== value)
                          : [...current, value],
                      )
                    }
                  />
                  {purposes[value] || value.replaceAll('_', ' ')}
                </label>
              ),
            )}
          </fieldset>
          {!record._id && (
            <>
              <ErrorNotice error={defaults.error} retry={defaults.reload} />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selectDefault}
                  disabled={!defaults.data}
                  onChange={(event) => setDefault(event.target.checked)}
                />
                {isContact
                  ? 'Save as primary contact'
                  : 'Save as default for the selected purposes'}
              </label>
            </>
          )}
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={record._id ? `${base}/${kind}/${record._id}` : null}
          values={values}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!isContact && !selected.length}
          label="Save record"
        />
      </form>
    </Dialog>
  )
}

function SupplierDefaults({ base, canEdit, changed }) {
  const resource = useResource(`${base}/defaults`)
  const [kind, setKind] = useState('contacts')
  const [pages, setPages] = useState([])
  const choices = useResource(
    queryPath(`${base}/${kind}`, {
      status: 'active',
      limit: 25,
      after: pages.at(-1),
    }),
  )
  const mutation = useMutation()
  async function select(purpose, record) {
    const body = {
      expectedRevision: resource.data.defaults.revision,
      [purpose]: record
        ? { id: record._id, expectedRevision: record.revision }
        : null,
    }
    if (await mutation.run('put', `${base}/defaults`, body)) {
      resource.reload()
      changed()
    }
  }
  if (resource.loading) return <Loading />
  return (
    <>
      <h2>Supplier defaults</h2>
      <MutationRetry
        mutation={mutation}
        saved={() => {
          resource.reload()
          changed()
        }}
      />
      <ErrorNotice
        error={resource.error || mutation.error || choices.error}
        retry={() => {
          resource.reload()
          choices.reload()
        }}
      />
      {resource.data && (
        <>
          <dl className="detail-list">
            {[
              ['primaryContact', 'primaryContactId'],
              ['ordering', 'orderingAddressId'],
              ['ship_from', 'shipFromAddressId'],
              ['returns', 'returnsAddressId'],
              ['receiving', 'receivingAddressId'],
            ].map(([purpose, key]) => (
              <div key={key}>
                <dt>{purposes[purpose] || 'Primary contact'}</dt>
                <dd>
                  {resource.data.defaults[key] || 'Not set'}{' '}
                  {canEdit && (
                    <Action
                      variant="text-button"
                      disabled={mutation.pending || mutation.uncertain}
                      onClick={() => select(purpose, null)}
                    >
                      Clear
                    </Action>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {canEdit && (
            <>
              <Field
                label="Choose default from"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value)
                  setPages([])
                }}
              >
                <option value="contacts">Contacts</option>
                <option value="addresses">Addresses</option>
              </Field>
              {choices.loading ? (
                <Loading />
              ) : (
                choices.data?.items?.map((record) => (
                  <div className="grant-row" key={record._id}>
                    <span>
                      {record.name ||
                        record.label ||
                        record.address?.line1 ||
                        'Address'}
                    </span>
                    <div className="actions">
                      {(kind === 'contacts'
                        ? ['primaryContact']
                        : record.purposes
                      ).map((purpose) => (
                        <Action
                          key={purpose}
                          variant="secondary"
                          disabled={mutation.pending || mutation.uncertain}
                          onClick={() => select(purpose, record)}
                        >
                          Use for {purposes[purpose] || 'primary contact'}
                        </Action>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <Pager
                resource={choices}
                pages={pages}
                setPages={setPages}
                label="choices"
              />
            </>
          )}
        </>
      )}
    </>
  )
}
