import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { BrandMark } from '../components/auth/BrandMark'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { BillingPanel } from '../components/workspace/BillingPanel'
import {
  Action,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  SaveFooter,
  Status,
} from '../components/workspace/Elements'
import { useResource } from '../hooks/useResource'
import { useMutation } from '../hooks/useMutation'

export function SetupPage() {
  const status = useResource('/onboarding/me')
  const assisted = useResource(
    import.meta.env.VITE_ASSISTED_ONBOARDING_ENABLED === 'true' ? '/assisted' : null,
  )
  if (status.loading) return <Loading label="Loading your setup progress…" />
  if (status.error)
    return <ErrorNotice error={status.error} retry={status.reload} />
  if (status.data.organization?.status === 'active')
    return <Navigate to="/app" replace />
  if (status.data.application?.status !== 'approved')
    return <Navigate to="/register" replace />
  if (assisted.loading) return <Loading label="Checking assisted setup…" />
  if (assisted.error && import.meta.env.VITE_ASSISTED_ONBOARDING_ENABLED === 'true')
    return <ErrorNotice error={assisted.error} retry={assisted.reload} />
  const assistedGrant = assisted.data?.items?.find(
    (item) => item.scope === 'organization' && item.state === 'accepted',
  )
  return (
    <div className="setup-layout">
      <header className="setup-top">
        <BrandMark />
        <div className="actions">
          <Link className="button secondary" to="/app">
            Workspace
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <PageHeader
        eyebrow="LET’S MAKE IT YOURS"
        title="Your next chapter starts here."
        description="A few thoughtful steps, then you’re ready to get to work."
      />
      <div className="setup-progress">
        <span className="done">
          <Check size={15} />
          Application approved
        </span>
        <span>2 · Payment setup</span>
        <span>3 · Company details</span>
        <span>4 · Activate workspace</span>
      </div>
      {assistedGrant ? (
        <section className="panel"><h2>Assisted billing checklist</h2><p className="muted">Future billing consent and card setup are separate from the standard subscription flow.</p><Link className="button secondary" to="/assisted">Review assisted billing</Link></section>
      ) : (
        <BillingPanel applicationId={status.data.application.id} changed={status.reload} />
      )}
      <CompanySetup
        organization={status.data.organization}
        applicationId={status.data.application.id}
        assistedGrantId={assistedGrant?.id}
        changed={status.reload}
      />
    </div>
  )
}

function CompanySetup({ organization, applicationId, assistedGrantId, changed }) {
  const resource = useResource('/onboarding/setup')
  const billing = useResource(assistedGrantId ? null : `/applications/${applicationId}/billing`)
  const mutation = useMutation()
  const preparation = useMutation()
  const [editing, setEditing] = useState(false)
  if (resource.loading) return <Loading label="Loading company setup…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  async function activate() {
    if (
      await mutation.run(
        'post',
        '/onboarding/activate',
        {},
        { idempotent: false },
      )
    )
      changed()
  }
  async function prepare() {
    const path = assistedGrantId ? `/assisted/${assistedGrantId}/prepare` : '/onboarding/setup/prepare'
    if (await preparation.run('post', path, {})) changed()
  }
  const versionTwo = billing.data?.flowVersion === 2
  const stagedFlow = Boolean(assistedGrantId) || versionTwo
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Company details</h2>
        <Status value={resource.data.complete ? 'complete' : 'in progress'} />
      </div>
      {resource.data.locked || (resource.data.complete && !editing) ? (
        <>
          <p className="muted">
            {resource.data.locked
              ? 'Your company details are locked while your workspace is provisioned.'
              : 'Company details are complete. Activation checks your approval and verified payment.'}
          </p>
          {organization && (
            <div className="notice">
              <div>
                <Status value={organization.status} />
                <p>{organization.provisioning?.state?.replaceAll('_', ' ')}</p>
                {organization.failureCode && <p>{organization.failureCode}</p>}
              </div>
            </div>
          )}
          <ErrorNotice error={mutation.error} />
          {billing.error && <ErrorNotice error={billing.error} retry={billing.reload} />}
          <ErrorNotice error={preparation.error} retry={resource.reload} />
          <div className="actions">
            {!assistedGrantId && billing.loading ? (
              <Loading label="Checking the billing flow…" />
            ) : !assistedGrantId && billing.error ? (
              <p className="notice">Billing status must load before continuing. Refresh it to avoid starting the wrong setup flow.</p>
            ) : organization?.provisioning?.state === 'in_progress' ? (
              <Action variant="secondary" onClick={changed}>
                Refresh activation status
              </Action>
            ) : organization?.provisioning?.state === 'support_required' ? (
              <p className="notice">
                This workspace needs operator review. Contact support with the
                reference above.
              </p>
            ) : stagedFlow && organization?.status !== 'prepared' ? (
              <Action disabled={preparation.pending || preparation.uncertain || Boolean(billing.error)} onClick={prepare}>
                {preparation.pending ? 'Preparing workspace…' : preparation.uncertain ? 'Retry preparation' : 'Prepare workspace'}
                <ArrowRight size={16} />
              </Action>
            ) : stagedFlow ? (
              <p className="notice">Workspace preparation is complete. Start your subscription explicitly in the billing panel when you are ready.</p>
            ) : (
              <Action disabled={mutation.pending} onClick={activate}>
                {mutation.pending
                  ? 'Preparing workspace…'
                  : 'Activate workspace'}
                <ArrowRight size={16} />
              </Action>
            )}
            {!resource.data.locked && (
              <Action
                variant="secondary"
                disabled={mutation.pending || mutation.uncertain}
                onClick={() => setEditing(true)}
              >
                Edit company details
              </Action>
            )}
          </div>
        </>
      ) : (
        <CompanyForm
          key={resource.data.revision}
          setup={resource.data}
          saved={() => {
            setEditing(false)
            resource.reload()
            changed()
          }}
        />
      )}
    </section>
  )
}

function CompanyForm({ setup, saved }) {
  const [values, setValues] = useState({
    industry: setup.industry || '',
    asiNumber: setup.asiNumber || '',
    ...Object.fromEntries(
      ['line1', 'line2', 'city', 'region', 'postalCode', 'country'].map(
        (key) => [key, setup.address?.[key] || ''],
      ),
    ),
  })
  const [revision, setRevision] = useState(setup.revision)
  const [savedRevision, setSavedRevision] = useState(setup.revision > 0)
  const mutation = useMutation()
  const completion = useMutation()
  const locked =
    mutation.pending ||
    mutation.uncertain ||
    completion.pending ||
    completion.uncertain
  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSavedRevision(false)
  }
  async function save(event) {
    event.preventDefault()
    const result = await mutation.run(
      'patch',
      '/onboarding/setup',
      {
        expectedRevision: revision,
        industry: values.industry.trim(),
        asiNumber: values.asiNumber.trim(),
        address: Object.fromEntries(
          ['line1', 'line2', 'city', 'region', 'postalCode', 'country'].map(
            (key) => [key, values[key].trim()],
          ),
        ),
      },
      { idempotent: false },
    )
    if (result) {
      setRevision(result.data.revision)
      setSavedRevision(true)
    }
  }
  return (
    <>
      <p className="muted">
        Your workspace is managed by BookMySku. Add your business address and
        industry below.
      </p>
      <form onSubmit={save}>
        <fieldset disabled={locked}>
          <div className="form-grid">
            <Field
              label="Industry"
              value={values.industry}
              maxLength={100}
              onChange={(event) => set('industry', event.target.value)}
            />
            <Field
              label="ASI number (optional)"
              value={values.asiNumber}
              maxLength={40}
              onChange={(event) => set('asiNumber', event.target.value)}
            />
          </div>
          {[
            ['line1', 'Address line 1'],
            ['line2', 'Address line 2 (optional)'],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              maxLength={160}
              value={values[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          ))}
          <div className="form-grid">
            {[
              ['city', 'City'],
              ['region', 'State / region (optional)'],
              ['postalCode', 'Postal code'],
              ['country', 'Country code (two letters)'],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                maxLength={
                  key === 'country' ? 2 : key === 'postalCode' ? 24 : 100
                }
                value={values[key]}
                onChange={(event) =>
                  set(
                    key,
                    key === 'country'
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                  )
                }
              />
            ))}
          </div>
        </fieldset>
        <SaveFooter
          mutation={mutation}
          label="Save company details"
          disabled={completion.pending || completion.uncertain}
        />
      </form>
      <ErrorNotice error={completion.error} />
      {(mutation.error?.status === 409 || completion.error?.status === 409) && (
        <Action variant="secondary" onClick={saved}>
          Reload latest setup
        </Action>
      )}
      {savedRevision && (
        <div className="notice">
          <div>
            <p>
              Details saved. Industry, street, city, postal code, and country
              are required to complete setup.
            </p>
            <Action
              disabled={
                mutation.pending || mutation.uncertain || completion.pending
              }
              onClick={async () => {
                if (
                  await completion.run(
                    'post',
                    '/onboarding/setup/complete',
                    { expectedRevision: revision },
                    { idempotent: false },
                  )
                )
                  saved()
              }}
            >
              {completion.pending
                ? 'Completing…'
                : completion.uncertain
                  ? 'Retry completion'
                  : 'Complete company setup'}
            </Action>
          </div>
        </div>
      )}
    </>
  )
}
