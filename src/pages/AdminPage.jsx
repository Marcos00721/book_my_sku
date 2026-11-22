import { dateLabel, money } from '../utils/format'
import { formatNumber } from '../utils/phone'
import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock3,
  ExternalLink, FileText, Inbox, MessageSquareText, RefreshCw, Search, X,
} from 'lucide-react'
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
import { PermissionCatalog } from './admin/PermissionCatalog'
import { StandardPlan } from './admin/StandardPlan'
import { AdminLayout } from '../components/admin/AdminLayout'
import { AdminOverview } from './admin/AdminOverview'
import { isSafeRichTextUrl } from '../utils/richText'
import '../styles/admin-applications.css'

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
      <div className="setup-layout admin-access">
        <header className="setup-top">
          <BrandMark />
          <div className="actions">
            <ButtonLink variant="secondary" to="/app">
              Workspace
            </ButtonLink>
            <ThemeToggle />
          </div>
        </header>
        <main className="admin-access-main">
          <PageHeader
            eyebrow="PLATFORM ADMINISTRATION"
            title="Your platform, securely managed."
            description="A quick verification to access your administration workspace."
          />
          {identity.loading ? (
            <Loading label="Checking your access…" />
          ) : identity.error?.code === 'ADMIN_MFA_REQUIRED' ? (
            <MfaChallenge verified={identity.reload} />
          ) : identity.error ? (
            <ErrorNotice error={identity.error} retry={identity.reload} />
          ) : null}
        </main>
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

const applicationViews = [
  { value: 'pending', label: 'Pending review', Icon: Clock3 },
  { value: 'approved', label: 'Approved', Icon: CheckCircle2 },
  { value: 'rejected', label: 'Needs corrections', Icon: MessageSquareText },
  { value: '', label: 'All applications', Icon: Inbox },
]

function ApplicationStatus({ status }) {
  const view = applicationViews.find(item => item.value === status)
  if (!view || !status) return <Status value={status} />
  const Icon = view.Icon
  return <span className={`admin-application-status admin-application-status--${status}`}><Icon size={14} aria-hidden="true" />{view.label}</span>
}

function applicantName(application) {
  return [application.firstName, application.lastName].filter(Boolean).join(' ')
}

function Applications() {
  const [parameters, setParameters] = useSearchParams()
  const requestedStatus = parameters.get('status')
  const status = requestedStatus === 'all' ? '' : applicationViews.some(view => view.value === requestedStatus) ? requestedStatus : 'pending'
  const filterEmail = parameters.get('email') || ''
  const [emailDraft, setEmail] = useState(null)
  const email = emailDraft ?? filterEmail
  const filterKey = JSON.stringify([status, filterEmail])
  const [pagination, setPagination] = useState({ filterKey, cursors: [] })
  const history = pagination.filterKey === filterKey ? pagination.cursors : []
  function setHistory(next) {
    setPagination(previous => ({
      filterKey,
      cursors: typeof next === 'function' ? next(previous.filterKey === filterKey ? previous.cursors : []) : next,
    }))
  }
  const selected = parameters.get('application')
  const resource = useResource(queryPath('/admin/applications', {
    status, email: filterEmail, after: history.at(-1), limit: 20,
  }))
  const items = resource.data?.items || []

  function clearEmail() {
    setEmail(null)
    setParameters(previous => {
      const next = new URLSearchParams(previous)
      next.delete('email')
      return next
    })
    setHistory([])
  }

  function setStatus(value) {
    setParameters(previous => {
      const next = new URLSearchParams(previous)
      next.set('status', value || 'all')
      return next
    })
    setHistory([])
  }

  function resetFilters() {
    setEmail(null)
    setHistory([])
    setParameters(previous => {
      const next = new URLSearchParams(previous)
      next.delete('email')
      next.delete('status')
      return next
    })
  }

  function selectApplication(id) {
    setParameters(previous => {
      const next = new URLSearchParams(previous)
      if (id) next.set('application', id)
      else next.delete('application')
      return next
    })
  }

  if (selected) return <ApplicationOverview key={selected} id={selected} back={() => { selectApplication(null); resource.reload() }} />

  return (
    <section className="panel admin-applications" aria-labelledby="application-queue-title">
      <h2 id="application-queue-title" className="sr-only">Company applications</h2>
      <div className="admin-queue-filters">
        <div className="admin-application-views" role="group" aria-label="Review status">
          {applicationViews.map(({ value, label, Icon }) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </div>
        <form className="admin-application-search" onSubmit={event => {
          event.preventDefault()
          const nextEmail = email.trim().toLowerCase()
          setEmail(null)
          setParameters(previous => {
            const next = new URLSearchParams(previous)
            if (nextEmail) next.set('email', nextEmail)
            else next.delete('email')
            return next
          })
          setHistory([])
        }}>
          <Field label="Exact email" type="email" placeholder="Exact applicant email" value={email} onChange={event => setEmail(event.target.value)} icon={<Search size={16} aria-hidden="true" />} />
          <Action type="submit" variant="secondary">Find</Action>
        </form>
        <Action variant="secondary" className="admin-queue-refresh" onClick={resource.reload} disabled={resource.loading} aria-label="Refresh applications" title="Refresh applications"><RefreshCw size={16} aria-hidden="true" /></Action>
      </div>
      {filterEmail && <div className="admin-application-filter-summary"><span>Filtered by email</span><button type="button" onClick={clearEmail} aria-label="Clear email filter">{filterEmail}<X size={14} aria-hidden="true" /></button></div>}
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <div className="admin-queue-results" aria-busy={resource.loading}>
        {resource.loading ? (
          <ListSkeleton label="Loading applications…" columns={['Company', 'Applicant', 'Status', 'Review']} />
        ) : items.length ? (
          <div className="table-scroll admin-application-table-wrap">
            <table className="data-table admin-application-table">
              <caption className="sr-only">Company applications, {applicationViews.find(view => view.value === status)?.label.toLowerCase()}</caption>
              <thead><tr><th scope="col">Company</th><th scope="col">Applicant</th><th scope="col">Review status</th><th scope="col"><span className="sr-only">Review application</span></th></tr></thead>
              <tbody>{items.map(application => (
                <tr key={application.id}>
                  <td data-label="Company"><div className="admin-application-company"><span className="admin-company-avatar" aria-hidden="true">{application.companyName?.trim().charAt(0).toUpperCase() || <Building2 size={18} />}</span><div><strong>{application.companyName || 'Unnamed company'}</strong><small><CalendarDays size={12} aria-hidden="true" />Submitted {dateLabel(application.submittedAt)}</small></div></div></td>
                  <td data-label="Applicant"><div className="admin-application-applicant">{applicantName(application) && <span>{applicantName(application)}</span>}{application.email ? <a href={`mailto:${application.email}`}>{application.email}</a> : <span className="muted">Email not provided</span>}</div></td>
                  <td data-label="Review status"><ApplicationStatus status={application.status} /></td>
                  <td><Action variant="text-button" className="admin-application-open" aria-label="Open application" title={`Review ${application.companyName}`} onClick={() => selectApplication(application.id)}>Review<ArrowRight size={16} aria-hidden="true" /></Action></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !resource.error ? (
          <Empty title={status === 'pending' && !filterEmail ? 'All caught up' : 'No matching applications'} icon={status === 'pending' && !filterEmail ? <CheckCircle2 size={26} aria-hidden="true" /> : <Search size={26} aria-hidden="true" />} action={(filterEmail || status !== 'pending') ? <Action variant="secondary" onClick={resetFilters}>Clear filters</Action> : undefined}>
            {status === 'pending' && !filterEmail ? 'New company requests will appear here when they are ready for review.' : 'Try a different review status or clear the email filter.'}
          </Empty>
        ) : <div className="admin-queue-error"><Inbox size={24} aria-hidden="true" /><p>Applications could not be loaded.</p><Action variant="secondary" onClick={resource.reload}>Try again</Action></div>}
      </div>
      {resource.data && !resource.loading && <div className="admin-queue-footer">
        <p role="status"><strong>{items.length}</strong> {items.length === 1 ? 'application' : 'applications'} on this page</p>
        <div className="admin-queue-pagination"><span>Page {history.length + 1}</span><Action variant="secondary" disabled={!history.length} onClick={() => setHistory(value => value.slice(0, -1))}><ChevronLeft size={15} aria-hidden="true" />Previous</Action><Action variant="secondary" disabled={!resource.data.nextCursor} onClick={() => setHistory(value => [...value, resource.data.nextCursor])}>Next<ChevronRight size={15} aria-hidden="true" /></Action></div>
      </div>}
    </section>
  )
}

function ApplicationOverview({ id, back }) {
  const path = `/admin/applications/${encodeURIComponent(id)}`
  const resource = useResource(path)
  const [command, setCommand] = useState(null)
  const backButton = <Action className="admin-back" variant="text-button" onClick={back}><ArrowLeft size={16} aria-hidden="true" />Back to applications</Action>
  if (resource.loading) return <div className="admin-record">{backButton}<Loading variant="detail" label="Loading application…" /></div>
  if (resource.error) return <div className="admin-record">{backButton}<ErrorNotice error={resource.error} retry={resource.reload} /></div>
  const { application, offer, organization } = resource.data
  const canPrepareOffer = application.status === 'approved' && !organization && (!offer || offer.status === 'draft')
  const website = isSafeRichTextUrl(application.companyWebsite) && /^https?:\/\//i.test(application.companyWebsite)
  return (
    <div className="admin-record admin-application-detail">
      <div className="admin-application-detail-nav">{backButton}<Action variant="text-button" onClick={resource.reload} aria-label="Refresh application"><RefreshCw size={15} aria-hidden="true" />Refresh</Action></div>
      <div className="admin-application-detail-grid">
        <div className="admin-application-main">
          <section className="panel admin-application-profile">
            <div className="admin-application-profile-heading"><span className="admin-company-avatar admin-company-avatar--large" aria-hidden="true"><Building2 size={24} /></span><div><p className="admin-application-eyebrow">Company profile</p><h2>{application.companyName}</h2></div><ApplicationStatus status={application.status} /></div>
            <p className="admin-application-submitted"><CalendarDays size={14} aria-hidden="true" />Submitted {dateLabel(application.submittedAt)}</p>
            <dl className="detail-list admin-profile-details admin-application-contact">
              <div><dt>Primary contact</dt><dd>{applicantName(application) || 'Not provided'}</dd></div>
              <div><dt>Email address</dt><dd>{application.email ? <a className="app-link" href={`mailto:${application.email}`}>{application.email}</a> : 'Not provided'}</dd></div>
              <div><dt>Phone number</dt><dd>{application.contactNumber ? formatNumber(application.contactNumber) : 'Not provided'}</dd></div>
              <div><dt>Company website</dt><dd>{website ? <a className="app-link admin-application-website" href={application.companyWebsite} target="_blank" rel="noopener noreferrer">{application.companyWebsite.replace(/^https?:\/\//i, '').replace(/\/$/, '')}<ExternalLink size={13} aria-hidden="true" /></a> : application.companyWebsite || 'Not provided'}</dd></div>
            </dl>
          </section>
          <section className="panel admin-application-commercial" aria-labelledby="application-commercial-title">
            <div className="admin-application-card-title"><FileText size={18} aria-hidden="true" /><h2 id="application-commercial-title">Commercial offer</h2>{offer && <Status value={offer.status} />}</div>
            {offer ? <><div className="admin-application-offer-price"><strong>{money(offer.terms.unitAmountMinor, offer.terms.currency)}</strong><span>per seat / month</span></div><p className="muted">Agreed standard price · Offer revision {offer.revision}</p></> : <p className="muted">{application.status === 'pending' ? 'Approve the application to prepare a commercial offer for this company.' : application.status === 'rejected' ? 'The applicant needs to update their details before review can continue.' : 'No offer has been prepared for this company yet.'}</p>}
            {canPrepareOffer && <Action variant="secondary" onClick={() => setCommand('offer')}>{offer ? 'Edit draft offer' : 'Prepare offer'}<ArrowRight size={15} aria-hidden="true" /></Action>}
            <div className="admin-application-workspace"><span>Workspace</span>{organization ? <Status value={organization.status} /> : <span className="muted">Not created yet</span>}</div>
          </section>
        </div>
        <aside className="admin-application-sidebar" aria-label="Application review and billing">
          {application.status !== 'approved' && <section className="panel admin-application-review">
            <span className="admin-review-icon" aria-hidden="true">{application.status === 'pending' ? <ClipboardCheck size={24} /> : <MessageSquareText size={24} />}</span>
            <p className="admin-application-eyebrow">{application.status === 'pending' ? 'Next step' : 'Review outcome'}</p>
            <h2>{application.status === 'pending' ? 'Review this company' : 'Corrections requested'}</h2>
            <p className="muted">{application.status === 'pending' ? 'Check the company and contact details, then approve the request or ask for an update.' : 'The applicant can update their details and resubmit the application.'}</p>
            {application.reason && <div className="admin-application-feedback"><strong>Feedback shared with applicant</strong><p>{application.reason}</p></div>}
            {application.status === 'pending' && <div className="admin-application-review-actions"><Action onClick={() => setCommand('approve')}><Check size={16} aria-hidden="true" />Approve application</Action><Action variant="secondary" onClick={() => setCommand('reject')}><MessageSquareText size={16} aria-hidden="true" />Request corrections</Action></div>}
          </section>}
          {application.status === 'approved' && <AdminBilling id={id} />}
        </aside>
      </div>
      <div className="admin-application-history"><HistoryList path={`${path}/reviews`} title="Review and delivery history" /><HistoryList path={`${path}/history`} title="Commercial history" /></div>
      {command && <ApplicationCommand command={command} path={path} record={resource.data} close={() => setCommand(null)} saved={() => { setCommand(null); resource.reload() }} />}
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
