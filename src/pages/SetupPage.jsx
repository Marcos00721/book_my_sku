import { useCallback, useEffect, useRef, useState } from 'react'
import { useDraftGuard } from '../hooks/useDraftGuard'
import { useJourneyStatus } from '../hooks/useJourneyStatus'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { getAuthClient } from '../services/auth'
import { createOnboardingCoordinator } from '../services/onboardingCoordinator'
import { ConflictReview } from '../components/workspace/RecordTools'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { BrandMark } from '../components/auth/BrandMark'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { BillingPanel } from '../components/workspace/BillingPanel'
import { GeographyFields } from '../components/workspace/GeographyFields'
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
  const journey = useJourneyStatus()
  const assisted = useResource(
    import.meta.env.VITE_ASSISTED_ONBOARDING_ENABLED === 'true'
      ? '/assisted'
      : null,
  )
  if (status.loading) return <Loading label="Loading your setup progress…" />
  if (status.error)
    return <ErrorNotice error={status.error} retry={status.reload} />
  if (
    import.meta.env.VITE_ASSISTED_ONBOARDING_ENABLED === 'true' &&
    assisted.loading
  )
    return <Loading label="Checking assisted setup…" />
  if (
    assisted.error &&
    import.meta.env.VITE_ASSISTED_ONBOARDING_ENABLED === 'true'
  )
    return <ErrorNotice error={assisted.error} retry={assisted.reload} />
  const assistedGrant = assisted.data?.items?.find(
    (item) => item.scope === 'organization' && item.state === 'accepted',
  )
  if (status.data.organization?.status === 'active' && !assistedGrant)
    return <Navigate to="/app" replace />
  if (status.data.application?.status !== 'approved' && !assistedGrant)
    return <Navigate to="/register" replace />
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
          {assistedGrant ? 'Invitation accepted' : 'Application approved'}
        </span>
        <span>2 · Payment setup</span>
        <span>3 · Company details</span>
        <span>4 · Activate workspace</span>
      </div>
      <ErrorNotice error={journey.error} retry={journey.reload} />
      {journey.data && (
        <p className="notice">
          Next step: {String(journey.data.nextAction).replaceAll('_', ' ')}.{' '}
          <Action
            variant="text-button"
            onClick={() => {
              journey.reload()
              status.reload()
            }}
          >
            Check current status
          </Action>
        </p>
      )}
      {assistedGrant ? (
        <section className="panel">
          <h2>Assisted billing checklist</h2>
          <p className="muted">
            Future billing consent and card setup are separate from the standard
            subscription flow.
          </p>
          <Link className="button secondary" to="/assisted">
            Review assisted billing
          </Link>
        </section>
      ) : (
        <BillingPanel
          applicationId={status.data.application.id}
          changed={status.reload}
        />
      )}
      <CompanySetup
        organization={status.data.organization}
        applicationId={status.data.application?.id}
        assistedGrantId={assistedGrant?.id}
        changed={status.reload}
      />
    </div>
  )
}

function CompanySetup({
  organization,
  applicationId,
  assistedGrantId,
  changed,
}) {
  const resource = useResource('/onboarding/setup')
  const billing = useResource(
    assistedGrantId ? null : `/applications/${applicationId}/billing`,
  )
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
    const path = assistedGrantId
      ? `/assisted/${assistedGrantId}/prepare`
      : '/onboarding/setup/prepare'
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
          {billing.error && (
            <ErrorNotice error={billing.error} retry={billing.reload} />
          )}
          <ErrorNotice error={preparation.error} retry={resource.reload} />
          <div className="actions">
            {!assistedGrantId && billing.loading ? (
              <Loading label="Checking the billing flow…" />
            ) : !assistedGrantId && billing.error ? (
              <p className="notice">
                Billing status must load before continuing. Refresh it to avoid
                starting the wrong setup flow.
              </p>
            ) : organization?.provisioning?.state === 'in_progress' ? (
              <Action variant="secondary" onClick={changed}>
                Refresh activation status
              </Action>
            ) : organization?.provisioning?.state === 'support_required' ? (
              <p className="notice">
                This workspace needs operator review. Contact support with the
                reference above.
              </p>
            ) : organization?.status === 'active' ? (
              <p className="notice">Your workspace is active. Company details and future billing requirements remain separate.</p>
            ) : stagedFlow && organization?.status !== 'prepared' ? (
              <Action
                disabled={
                  preparation.pending ||
                  preparation.uncertain ||
                  Boolean(billing.error)
                }
                onClick={prepare}
              >
                {preparation.pending
                  ? 'Preparing workspace…'
                  : preparation.uncertain
                    ? 'Retry preparation'
                    : 'Prepare workspace'}
                <ArrowRight size={16} />
              </Action>
            ) : stagedFlow ? (
              <p className="notice">
                Workspace preparation is complete. Start your subscription
                explicitly in the billing panel when you are ready.
              </p>
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
      [
        'line1',
        'line2',
        'city',
        'region',
        'postalCode',
        'country',
        'stateCode',
      ].map((key) => [key, setup.address?.[key] || '']),
    ),
  })
  const [revision, setRevision] = useState(setup.revision)
  const [savedRevision, setSavedRevision] = useState(setup.revision > 0)
  const [edited, setEdited] = useState(false)
  useDraftGuard(edited)
  const [coordinator, setCoordinator] = useState(null)
  const factory = useRef(null)
  const [state, setState] = useState({
    pending: false,
    error: null,
    uncertain: false,
  })
  const navigate = useNavigate()
  const mutation = state
  const completion = state
  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const { data } = await getAuthClient().auth.getSession()
        const subject = data.session?.user.id
        const journey = (await api.get('/onboarding/journey')).data
        if (!journey.actorId || !subject)
          throw new Error(
            'Your setup identity could not be confirmed. Reload your session.',
          )
        factory.current = (reviewed) => {
          let seed = reviewed
          return createOnboardingCoordinator({
            allowCompletedEdits: setup.complete && !setup.locked,
            actorId: journey.actorId,
            currentActorId: () => (active ? journey.actorId : null),
            withLock: async (name, task) => {
              if (!navigator.locks)
                throw new Error(
                  'This browser cannot coordinate setup across tabs. Use a browser with Web Locks support.',
                )
              return navigator.locks.request(name, task)
            },
            request: async (method, path, body) => {
              const current = await getAuthClient().auth.getSession()
              if (current.data.session?.user.id !== subject)
                throw new Error(
                  'Your account changed. Reload setup before continuing.',
                )
              if (method === 'GET' && path === '/onboarding/setup' && seed) {
                const result = seed
                seed = null
                return result
              }
              return (await api[method.toLowerCase()](path, body)).data
            },
            refreshPermissions: async (workspaces) => {
              for (const org of workspaces.items.filter(
                (item) => item.status === 'active',
              ))
                await Promise.all([
                  api.get(`/organizations/${org.id}/permissions`),
                  api.get(`/organizations/${org.id}/access`),
                ])
              window.dispatchEvent(new Event('workspace-access-changed'))
            },
          })
        }
        const instance = factory.current()
        const current = await instance.load()
        if (active) {
          setValues({
            industry: current.industry || '',
            asiNumber: current.asiNumber || '',
            ...Object.fromEntries(
              [
                'line1',
                'line2',
                'city',
                'region',
                'postalCode',
                'country',
                'stateCode',
              ].map((key) => [key, current.address?.[key] || '']),
            ),
          })
          setRevision(current.revision)
          setCoordinator(instance)
        }
      } catch (error) {
        if (active) setState({ pending: false, error, uncertain: false })
      }
    }
    void initialize()
    return () => {
      active = false
    }
  }, [setup.complete, setup.locked])
  const locked =
    !coordinator ||
    mutation.pending ||
    mutation.uncertain ||
    completion.pending ||
    completion.uncertain
  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSavedRevision(false)
    setEdited(true)
  }
  const save = useCallback(
    async (event) => {
      event?.preventDefault()
      if (!coordinator) return
      setState({ pending: true, error: null, uncertain: false })
      try {
        coordinator.edit({
          industry: values.industry.trim(),
          asiNumber: values.asiNumber.trim(),
          address: Object.fromEntries(
            [
              'line1',
              'line2',
              'city',
              'postalCode',
              'country',
              'stateCode',
            ].map((key) => [key, values[key].trim()]),
          ),
        })
        const result = await coordinator.save()
        setRevision(result.revision)
        setSavedRevision(true)
        setEdited(false)
        setState({ pending: false, error: null, uncertain: false })
      } catch (error) {
        setState({ pending: false, error, uncertain: false })
      }
    },
    [coordinator, values],
  )
  useEffect(() => {
    if (!edited || !coordinator || state.pending || state.error) return
    const timer = setTimeout(() => {
      void save()
    }, 1500)
    return () => clearTimeout(timer)
  }, [edited, coordinator, state.pending, state.error, save])
  async function finish() {
    if (!coordinator) return
    setState({ pending: true, error: null, uncertain: false })
    try {
      coordinator.edit({
        industry: values.industry.trim(),
        asiNumber: values.asiNumber.trim(),
        address: Object.fromEntries(
          ['line1', 'line2', 'city', 'postalCode', 'country', 'stateCode'].map(
            (key) => [key, values[key].trim()],
          ),
        ),
      })
      const journey = await coordinator.finish()
      setState({ pending: false, error: null, uncertain: false })
      if (['open_workspace', 'choose_workspace'].includes(journey.nextAction))
        navigate('/app')
      else saved()
    } catch (error) {
      setState({
        pending: false,
        error,
        uncertain: !error.status || error.status >= 500,
      })
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
              ['postalCode', 'Postal code'],
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
            <GeographyFields
              values={values}
              change={(patch) => {
                setValues((current) => ({ ...current, ...patch }))
                setSavedRevision(false)
                setEdited(true)
              }}
            />
          </div>
        </fieldset>
        <SaveFooter
          mutation={mutation}
          label="Save company details"
          disabled={!coordinator || completion.pending || completion.uncertain}
        />
      </form>
      <ErrorNotice error={completion.error} />
      {state.error && (
        <p className="notice">
          Your entered details are preserved. Review the latest setup before
          retrying. Support reference:{' '}
          {state.error.requestId || state.error.code || 'unavailable'}
        </p>
      )}
      <ConflictReview
        error={state.error}
        path="/onboarding/setup"
        values={{
          industry: values.industry,
          asiNumber: values.asiNumber,
          address: Object.fromEntries(
            [
              'line1',
              'line2',
              'city',
              'postalCode',
              'country',
              'stateCode',
            ].map((key) => [key, values[key]]),
          ),
        }}
        onReview={async (current) => {
          try {
            const instance = factory.current(current)
            await instance.load()
            setCoordinator(instance)
            setRevision(current.revision)
            setState({ pending: false, error: null, uncertain: false })
          } catch (error) {
            setState({
              pending: false,
              error,
              uncertain: !error.status || error.status >= 500,
            })
          }
        }}
      />
      <small className="muted">Saved revision {revision}</small>
      {coordinator && (
        <div className="notice">
          <div>
            <p>
              {savedRevision ? 'Details saved. ' : ''}Finish saves and completes
              these details, then checks the next workspace step. Subscription
              consent remains separate.
            </p>
            <Action
              disabled={
                mutation.pending || mutation.uncertain || completion.pending
              }
              onClick={finish}
            >
              {completion.pending
                ? 'Completing…'
                : completion.uncertain
                  ? 'Retry completion'
                  : 'Finish setup'}
            </Action>
          </div>
        </div>
      )}
    </>
  )
}
