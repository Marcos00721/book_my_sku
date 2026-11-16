import { dateLabel, money } from '../utils/format'
import { formatNumber } from '../utils/phone'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronDown, RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { BrandMark } from '../components/auth/BrandMark'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { ButtonLink } from '../components/common/ButtonLink'
import { MfaChallenge } from '../components/workspace/MfaChallenge'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  ListSkeleton,
  PageHeader,
  SaveFooter,
  Status,
  PermissionDenied,
} from '../components/workspace/Elements'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'
import { queryPath } from '../services/workspace'
import { RegistrationIntakes, AssistedAdmin } from './admin/AdminOperations'
import { MasterDataTemplates } from './admin/MasterDataTemplates'
import { AdminLayout } from '../components/admin/AdminLayout'
import { AdminOverview } from './admin/AdminOverview'

export function AdminPage() {
  const identity = useResource('/admin/me')
  const reloadIdentity = identity.reload
  useEffect(() => {
    window.addEventListener('platform-mfa-required', reloadIdentity)
    return () =>
      window.removeEventListener('platform-mfa-required', reloadIdentity)
  }, [reloadIdentity])
  const [parameters] = useSearchParams()
  const sections = [
    'overview',
    'applications',
    'plan',
    'catalog',
    'registrations',
    'masterData',
    'assisted',
  ]
  const requested = parameters.get('section') || 'overview'
  const tab = sections.includes(requested) ? requested : 'overview'
  if (identity.loading || identity.error)
    return (
      <div
        className={[
          'setup-layout',
          identity.error?.code === 'ADMIN_MFA_REQUIRED' && 'auth-lagoon',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <header className="setup-top">
          <BrandMark />
          <div className="actions">
            <ButtonLink variant="secondary" to="/app">
              Workspace
            </ButtonLink>
            <ThemeToggle />
          </div>
        </header>
        <PageHeader
          eyebrow="PLATFORM ADMINISTRATION"
          title="A thoughtful start for every business."
          description="Review applications and manage commercial offers with platform authorization."
        />
        {identity.loading ? (
          <Loading />
        ) : identity.error?.code === 'ADMIN_MFA_REQUIRED' ? (
          <MfaChallenge verified={identity.reload} />
        ) : identity.error ? (
          <ErrorNotice error={identity.error} retry={identity.reload} />
        ) : null}
      </div>
    )
  if (identity.data?.role !== 'super_admin') return <PermissionDenied />
  return (
    <AdminLayout section={tab}>
      {tab === 'overview' ? (
        <AdminOverview />
      ) : tab === 'applications' ? (
        <Applications />
      ) : tab === 'plan' ? (
        <StandardPlan />
      ) : tab === 'catalog' ? (
        <PermissionCatalog />
      ) : tab === 'registrations' ? (
        <RegistrationIntakes />
      ) : tab === 'masterData' ? (
        <MasterDataTemplates />
      ) : (
        <AssistedAdmin />
      )}
    </AdminLayout>
  )
}

function Applications() {
  const [status, setStatus] = useState('pending')
  const [email, setEmail] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)
  const resource = useResource(
    queryPath('/admin/applications', {
      status,
      email: filterEmail,
      after: history.at(-1),
      limit: 20,
    }),
  )
  if (selected)
    return (
      <ApplicationOverview
        id={selected}
        back={() => {
          setSelected(null)
          resource.reload()
        }}
      />
    )
  return (
    <section className="panel admin-list-panel">
      <div className="section-heading">
        <div><h2>Company applications</h2><p className="muted">Find a request and open it to review the company and its offer.</p></div>
      </div>
      <div className="toolbar admin-list-toolbar">
        <Field
          label="Review status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setHistory([])
          }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All applications</option>
        </Field>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault()
            setFilterEmail(email.trim().toLowerCase())
            setHistory([])
          }}
        >
          <Field
            label="Exact email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Action type="submit" variant="secondary">
            <Search size={16} aria-hidden="true" /> Find
          </Action>
        </form>
        <Action variant="secondary" onClick={resource.reload}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </Action>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <ListSkeleton label="Loading applications…" columns={['Company', 'Email', 'Status', 'Review']} />
      ) : resource.data?.items.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map((application) => (
                <tr key={application.id}>
                  <td>{application.companyName}</td>
                  <td>{application.email}</td>
                  <td>
                    <Status value={application.status} />
                  </td>
                  <td>
                    <Action
                      variant="secondary"
                      onClick={() => setSelected(application.id)}
                    >
                      Open application
                    </Action>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !resource.error && (
          <Empty title="All caught up">No applications match this view.</Empty>
        )
      )}
      {resource.data && (
        <div className="table-bottom">
          <span>{resource.data.items.length} applications</span>
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
              disabled={!resource.data.nextCursor}
              onClick={() =>
                setHistory((value) => [...value, resource.data.nextCursor])
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

function ApplicationOverview({ id, back }) {
  const path = `/admin/applications/${id}`
  const resource = useResource(path)
  const [command, setCommand] = useState(null)
  if (resource.loading) return <Loading />
  if (resource.error)
    return <><Action variant="text-button" onClick={back}><ArrowLeft size={16} aria-hidden="true" /> Back to applications</Action><ErrorNotice error={resource.error} retry={resource.reload} /></>
  const { application, offer, organization } = resource.data
  return (
    <div className={`admin-record${application.status === 'approved' ? ' admin-application-record' : ''}`}>
      <Action className="admin-back" variant="text-button" onClick={back}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to applications
      </Action>
      <section className="panel">
        <div className="section-heading">
          <h2>{application.companyName}</h2>
          <Status value={application.status} />
        </div>
        <dl className="detail-list admin-profile-details">
          {[
            ['Contact', `${application.firstName} ${application.lastName}`],
            ['Email', application.email],
            [
              'Phone',
              application.contactNumber
                ? formatNumber(application.contactNumber)
                : '',
            ],
            ['Website', application.companyWebsite],
            ['Submitted', dateLabel(application.submittedAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
        {application.reason && (
          <p className="notice">Review feedback: {application.reason}</p>
        )}
        <div className="actions">
          {application.status === 'pending' && (
            <>
              <Action onClick={() => setCommand('approve')}>
                Approve application
              </Action>
              <Action
                variant="danger-button"
                onClick={() => setCommand('reject')}
              >
                Request corrections
              </Action>
            </>
          )}
          {application.status === 'approved' &&
            !organization &&
            (!offer || offer.status === 'draft') && (
              <Action onClick={() => setCommand('offer')}>
                {offer ? 'Edit draft offer' : 'Prepare offer'}
              </Action>
            )}
          <Action variant="secondary" onClick={resource.reload}>
            Refresh
          </Action>
        </div>
        {offer && (
          <p className="muted">
            Offer revision {offer.revision} · {offer.status} · Agreed standard
            price {money(offer.terms.unitAmountMinor, offer.terms.currency)} per
            seat / month.
          </p>
        )}
      </section>
      {application.status === 'approved' && <AdminBilling id={id} />}
      <HistoryList
        path={`${path}/reviews`}
        title="Review and delivery history"
      />
      <HistoryList path={`${path}/history`} title="Commercial history" />
      {command && (
        <ApplicationCommand
          command={command}
          path={path}
          record={resource.data}
          close={() => setCommand(null)}
          saved={() => {
            setCommand(null)
            resource.reload()
          }}
        />
      )}
    </div>
  )
}

function ApplicationCommand({ command, path, record, close, saved }) {
  const plan = useResource(command === 'offer' ? '/admin/plan' : null)
  const mutation = useMutation()
  const [reason, setReason] = useState('')
  const [trialMonths, setTrialMonths] = useState(
    record.offer?.terms.trialMonths || 0,
  )
  const [discountType, setDiscountType] = useState(
    record.offer?.terms.discount.type || 'none',
  )
  const [amount, setAmount] = useState(
    record.offer?.terms.discount.percent ||
      record.offer?.terms.discount.amountMinor ||
      '',
  )
  const [months, setMonths] = useState(record.offer?.terms.discount.months || 1)
  async function submit(event) {
    event.preventDefault()
    const payload =
      command === 'offer'
        ? {
            expectedRevision: record.offer?.revision || 0,
            planVersion:
              record.offer?.terms.planVersion || plan.data.plan.version,
            trialMonths: Number(trialMonths),
            discount:
              discountType === 'none'
                ? { type: 'none' }
                : {
                    type: discountType,
                    months: Number(months),
                    [discountType === 'percent' ? 'percent' : 'amountMinor']:
                      Number(amount),
                  },
            reason: reason.trim(),
          }
        : {
            decision: command,
            expectedRevision: record.application.revision,
            ...(command === 'reject' ? { reason: reason.trim() } : {}),
          }
    if (
      await mutation.run(
        command === 'offer' ? 'put' : 'post',
        `${path}/${command === 'offer' ? 'offer' : 'review'}`,
        payload,
      )
    )
      saved()
  }
  return (
    <Dialog
      title={
        command === 'offer'
          ? 'Prepare the exact offer'
          : command === 'approve'
            ? 'Approve application'
            : 'Request corrections'
      }
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <ErrorNotice error={plan.error} retry={plan.reload} />
      {command === 'offer' && plan.loading ? (
        <Loading />
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={mutation.pending || mutation.uncertain}>
            {command === 'offer' && (
              <>
                <p className="muted">
                  Agreed plan version:{' '}
                  {record.offer?.terms.planVersion || plan.data?.plan.version}.
                  Existing customer prices stay fixed.
                </p>
                <Field
                  label="Free calendar months"
                  type="number"
                  min="0"
                  max="3"
                  step="1"
                  required
                  value={trialMonths}
                  onChange={(event) => setTrialMonths(event.target.value)}
                />
                <Field
                  label="Discount"
                  value={discountType}
                  onChange={(event) => {
                    setDiscountType(event.target.value)
                    setAmount('')
                  }}
                >
                  <option value="none">No discount</option>
                  <option value="percent">Whole percentage</option>
                  <option value="fixed">Fixed amount per seat</option>
                </Field>
                {discountType !== 'none' && (
                  <div className="form-grid">
                    <Field
                      label={
                        discountType === 'percent'
                          ? 'Percentage'
                          : 'Discount in USD cents'
                      }
                      type="number"
                      min="1"
                      max={
                        discountType === 'percent'
                          ? 100
                          : record.offer?.terms.unitAmountMinor ||
                            plan.data?.plan.unitAmountMinor
                      }
                      step="1"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    <Field
                      label="Discounted months"
                      type="number"
                      min="1"
                      max="120"
                      required
                      value={months}
                      onChange={(event) => setMonths(event.target.value)}
                    />
                  </div>
                )}
              </>
            )}
            {command !== 'approve' && (
              <Field
                label={
                  command === 'reject'
                    ? 'Correction feedback'
                    : 'Reason for offer'
                }
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
            {command === 'approve' && (
              <p className="muted">
                Approve {record.application.companyName} for the next onboarding
                step? Billing and activation remain separate checks.
              </p>
            )}
          </fieldset>
          <SaveFooter
            mutation={mutation}
            close={close}
            label="Confirm"
            onClear={() => {
              setReason('')
              setTrialMonths(record.offer?.terms.trialMonths || 0)
              setDiscountType(record.offer?.terms.discount.type || 'none')
              setAmount(record.offer?.terms.discount.percent || record.offer?.terms.discount.amountMinor || '')
              setMonths(record.offer?.terms.discount.months || 1)
            }}
          />
        </form>
      )}
    </Dialog>
  )
}

function StandardPlan() {
  const resource = useResource('/admin/plan')
  const [editing, setEditing] = useState(false)
  return (
    <>
      <section className="panel admin-plan-panel">
        <h2>Current standard plan</h2>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? (
          <Loading />
        ) : (
          resource.data && (
            <div className="admin-plan-summary">
              <div className="admin-plan-price">
                <strong>
                  {money(
                    resource.data.plan.unitAmountMinor,
                    resource.data.plan.currency,
                  )}
                </strong>
                <span className="muted">per seat / month</span>
                <span className="admin-tool-count">Version {resource.data.plan.version}</span>
              </div>
              <div className="admin-plan-description"><p className="muted">
                A new version affects future offers. Accepted agreements keep
                their original prices.
              </p>
              <Action onClick={() => setEditing(true)}>
                Create a new plan version
              </Action>
              </div>
            </div>
          )
        )}
      </section>
      <HistoryList path="/admin/plan/history" title="Plan history" />
      {editing && (
        <PlanEditor
          plan={resource.data.plan}
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

function PlanEditor({ plan, close, saved }) {
  const mutation = useMutation()
  const [amount, setAmount] = useState(plan.unitAmountMinor)
  const [reason, setReason] = useState('')
  return (
    <Dialog
      title="Create a plan version"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            await mutation.run('post', '/admin/plan/versions', {
              expectedVersion: plan.version,
              unitAmountMinor: Number(amount),
              reason: reason.trim(),
            })
          )
            saved()
        }}
      >
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="USD cents per seat / month"
            required
            type="number"
            min="1"
            max="100000000"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Field
            label="Reason"
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </fieldset>
        <SaveFooter
          mutation={mutation}
          close={close}
          label="Create plan version"
          onClear={() => {
            setAmount(plan.unitAmountMinor)
            setReason('')
          }}
        />
      </form>
    </Dialog>
  )
}

function HistoryList({ path, title }) {
  const [history, setHistory] = useState([])
  const resource = useResource(
    queryPath(path, { after: history.at(-1), limit: 20 }),
  )
  return (
    <details className="panel admin-history">
      <summary><h2>{title}</h2><span className="muted">{resource.error ? 'Unavailable' : resource.loading ? 'Loading…' : `${resource.data?.items?.length || 0} ${resource.data?.items?.length === 1 ? 'entry' : 'entries'}`}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className="admin-history-body">
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <ListSkeleton label={`Loading ${title.toLowerCase()}…`} variant="list" rows={4} />
      ) : (
        resource.data?.items?.map((item) => (
          <div key={item.id} className="grant-row">
            <span>
              {item.action}
              <small className="muted">
                {' '}
                {item.reason || item.notificationStatus || ''}
              </small>
            </span>
            <small>{dateLabel(item.occurredAt)}</small>
          </div>
        ))
      )}
      {resource.data && (
        <div className="table-bottom">
          <span>{resource.data.items.length} entries</span>
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
              disabled={!resource.data.nextCursor}
              onClick={() =>
                setHistory((value) => [...value, resource.data.nextCursor])
              }
            >
              Next
            </Action>
          </div>
        </div>
      )}
      {!resource.loading && !resource.error && resource.data?.items?.length === 0 && <p className="muted">No history recorded yet.</p>}
      </div>
    </details>
  )
}

function AdminBilling({ id }) {
  const resource = useResource(`/admin/applications/${id}/billing`)
  const refresh = useMutation()
  const [extension, setExtension] = useState(false)
  return (
    <section className="panel">
      <h2>Verified billing status</h2>
      <ErrorNotice
        error={resource.error || refresh.error}
        retry={resource.reload}
      />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <Status value={resource.data.status} />
            <dl className="detail-list">
              <div>
                <dt>Eligible for activation</dt>
                <dd>{resource.data.activationEligible ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Paid seats</dt>
                <dd>{resource.data.quantity}</dd>
              </div>
            </dl>
            <div className="actions">
              <Action
                variant="secondary"
                disabled={refresh.pending}
                onClick={async () => {
                  if (
                    await refresh.run(
                      'post',
                      `/admin/applications/${id}/billing/refresh`,
                      {},
                      { idempotent: false },
                    )
                  )
                    resource.reload()
                }}
              >
                Refresh provider status
              </Action>
              <Action variant="secondary" onClick={() => setExtension(true)}>
                Preview trial / discount extension
              </Action>
            </div>
          </>
        )
      )}
      {extension && (
        <ExtensionEditor
          id={id}
          revision={resource.data.revision}
          close={() => setExtension(false)}
          saved={() => {
            setExtension(false)
            resource.reload()
          }}
        />
      )}
    </section>
  )
}

function ExtensionEditor({ id, revision, close, saved }) {
  const [kind, setKind] = useState('trial')
  const [months, setMonths] = useState(1)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState(null)
  const mutation = useMutation()
  return (
    <Dialog
      title="Review a prospective extension"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const result = await mutation.run(
            'post',
            `/admin/applications/${id}/billing/extensions${preview ? '' : '/preview'}`,
            preview
              ? { previewId: preview.previewId }
              : {
                  expectedRevision: revision,
                  kind,
                  months: Number(months),
                  reason: reason.trim(),
                },
            { idempotent: Boolean(preview) },
          )
          if (result) {
            if (preview) saved()
            else setPreview(result.data)
          }
        }}
      >
        <fieldset
          disabled={mutation.pending || mutation.uncertain || Boolean(preview)}
        >
          <Field
            label="Extend"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="trial">Trial</option>
            <option value="discount">Discount</option>
          </Field>
          <Field
            label="Additional calendar months"
            type="number"
            min="1"
            max="12"
            step="1"
            required
            value={months}
            onChange={(event) => setMonths(event.target.value)}
          />
          <Field
            label="Reason"
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </fieldset>
        {preview && (
          <div className="notice">
            <div>
              <p>
                Review the exact extension before applying it. Preview expires:{' '}
                {preview.expiresAt
                  ? new Date(preview.expiresAt).toLocaleString()
                  : 'in five minutes'}
                .
              </p>
              {Object.entries(preview.preview?.after || {}).map(
                ([key, value]) => (
                  <p key={key}>
                    {key}: {dateLabel(value)}
                  </p>
                ),
              )}
              <p>
                Immediate charge: {money(preview.preview?.immediateChargeMinor)}
                . No proration or refund.
              </p>
            </div>
          </div>
        )}
        <SaveFooter
          mutation={mutation}
          close={close}
          label={preview ? 'Apply reviewed extension' : 'Preview extension'}
          onClear={() => {
            setKind('trial')
            setMonths(1)
            setReason('')
            setPreview(null)
          }}
        />
      </form>
    </Dialog>
  )
}

function PermissionCatalog() {
  const resource = useResource('/admin/permissions')
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const entries = resource.data?.items || []
  const visible = entries.filter(entry => `${entry.label} ${entry.key}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section className="panel admin-permissions-panel">
      <div className="section-heading"><div><h2>Available permissions</h2>
      <p className="muted">
        Catalog changes affect effective access immediately. Only supported
        capabilities can be configured.
      </p>
      </div><span className="admin-tool-count">{query.trim() ? `${visible.length} of ` : ''}{entries.length} permissions</span></div>
      <div className="admin-catalog-search">
        <Field label="Find a permission" type="search" placeholder="Search by name or permission key" value={query} onChange={event => setQuery(event.target.value)} icon={<Search size={16} />} />
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <ListSkeleton label="Loading permissions…" variant="list" />
      ) : (
        <div className="admin-permission-list">{visible.map((entry) => (
          <div className="grant-row admin-permission-row" key={entry.key}>
            <div className="admin-permission-name">
              <strong>{entry.label}</strong>
              <small className="muted">{entry.key}</small>
            </div>
            <div className="actions">
              <Status value={entry.enabled ? 'active' : 'disabled'} />
              <Action variant="secondary" onClick={() => setSelected(entry)}>
                Configure
              </Action>
            </div>
          </div>
        ))}</div>
      )}
      {!resource.loading && !resource.error && !visible.length && <Empty title="No matching permissions">Try another name or permission key.</Empty>}
      {selected && (
        <CatalogEditor
          entry={selected}
          close={() => setSelected(null)}
          saved={() => {
            setSelected(null)
            resource.reload()
          }}
        />
      )}
    </section>
  )
}

function CatalogEditor({ entry, close, saved }) {
  const [label, setLabel] = useState(entry.label)
  const [enabled, setEnabled] = useState(entry.enabled)
  const mutation = useMutation()
  return (
    <Dialog
      title={`Configure ${entry.key}`}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            await mutation.run('put', `/admin/permissions/${entry.key}`, {
              expectedRevision: entry.revision,
              label: label.trim(),
              enabled,
              scopes: entry.scopes,
            })
          )
            saved()
        }}
      >
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Display label"
            required
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enabled for effective authorization
          </label>
          <p className="muted">Supported scopes: {entry.scopes.join(', ')}.</p>
        </fieldset>
        <SaveFooter
          mutation={mutation}
          close={close}
          label="Save catalog entry"
          onClear={() => {
            setLabel(entry.label)
            setEnabled(entry.enabled)
          }}
        />
      </form>
    </Dialog>
  )
}
