import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Globe, Mail, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { RegistrationIdentity } from '../components/auth/RegistrationIdentity'
import { UnifiedRegistration } from '../components/auth/UnifiedRegistration'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormCheckbox } from '../components/forms/FormCheckbox'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { FormTextField } from '../components/forms/FormTextField'
import { useAppForm } from '../components/forms/useAppForm'
import { api, ApiError } from '../services/api'
import { useAuthSession } from '../hooks/useAuthSession'
import {
  registerFormSchema,
  registrationApplicationSchema,
  onboardingStatusSchema,
} from '../schemas/authSchemas'

const defaultValues = {
  firstName: '',
  lastName: '',
  email: '',
  contactNumber: '',
  companyName: '',
  companyWebsite: '',
  termsAccepted: false,
}

export function RegisterPage() {
  const { session, loading, error } = useAuthSession()
  const unifiedEnabled = import.meta.env.VITE_REGISTRATION_HOOK_ENABLED === 'true'

  if (unifiedEnabled && (!session || !session.user.email_confirmed_at))
    return <UnifiedRegistration session={session} />

  return (
    <AuthLayout variant="register">
      <AuthPageContent
        id="register-title"
        eyebrow="Make room for what's next"
        title="Start something great."
        description="Apply for a BookMySku workspace with your verified email and company details."
      >
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error.message}
          </p>
        )}
        {loading ? (
          <p role="status">Loading your account...</p>
        ) : session?.user?.email_confirmed_at ? (
          <RegistrationApplication
            key={`${session.user.id}:${session.user.email}:${session.user.email_confirmed_at}`}
            session={session}
          />
        ) : (
          <RegistrationIdentity session={session} />
        )}
        <p className="mt-lg text-center text-sm leading-relaxed text-text-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            className="app-link inline-flex min-h-touch items-center"
          >
            Sign in
          </Link>
        </p>
      </AuthPageContent>
    </AuthLayout>
  )
}

function RegistrationApplication({ session }) {
  const registerForm = useAppForm(registerFormSchema, {
    defaultValues: { ...defaultValues, email: session.user.email },
  })
  const { reset, setValue } = registerForm
  const [error, setError] = useState(null)
  const [application, setApplication] = useState(null)
  const [termsVersion, setTermsVersion] = useState(null)
  const [phase, setPhase] = useState(null)
  const [recovery, setRecovery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const submission = useRef(null)
  const retryAfter = useRef(0)

  const loadStatus = useCallback(async (signal) => {
    const response = import.meta.env.VITE_REGISTRATION_HOOK_ENABLED === 'true'
      ? await api.post('/registration/resume', {}, { signal })
      : await api.get('/onboarding/me', { signal })
    const result = onboardingStatusSchema.safeParse(response?.data)
    if (!result.success)
      throw new ApiError(
        'The server returned an unexpected registration status. Please try again.',
        { status: 502, code: 'INVALID_RESPONSE' },
      )
    return result.data
  }, [])

  function applyStatus(status) {
    setApplication(status.application)
    setTermsVersion(status.termsVersion)
    setPhase(status.phase || null)
    setRecovery(status.recovery || null)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) applyStatus(status)
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadStatus])

  async function refreshStatus() {
    setError(null)
    setLoading(true)
    try {
      applyStatus(await loadStatus())
      setEditing(false)
    } catch (failure) {
      setError(failure)
    } finally {
      setLoading(false)
    }
  }

  function correctApplication() {
    reset({
      firstName: application.firstName ?? '',
      lastName: application.lastName ?? '',
      email: application.email,
      contactNumber: application.contactNumber ?? '',
      companyName: application.companyName,
      companyWebsite: application.companyWebsite ?? '',
      termsAccepted: false,
    })
    setError(null)
    setEditing(true)
  }

  async function handleRegisterSubmit(values) {
    setError(null)
    if (Date.now() < retryAfter.current) {
      setError(
        new ApiError('Please wait before trying again.', {
          status: 429,
          code: 'RATE_LIMITED',
        }),
      )
      return
    }
    try {
      if (!termsVersion)
        throw new Error('Load the registration terms before submitting.')
      const payload = {
        ...values,
        termsVersion,
        ...(editing ? { expectedRevision: application.revision } : {}),
      }
      // Reuse the backend-required UUID when retrying the same submitted details.
      if (
        JSON.stringify(submission.current?.payload) !== JSON.stringify(payload)
      ) {
        submission.current = {
          key: crypto.randomUUID(),
          payload,
        }
      }

      const response = await api[editing ? 'put' : 'post'](
        editing ? '/onboarding/me' : '/onboarding',
        submission.current.payload,
        { idempotencyKey: submission.current.key },
      )
      const result = registrationApplicationSchema.safeParse(response?.data)
      if (!result.success)
        throw new ApiError(
          'The server returned an unexpected registration response. Retry the same details to recover your application.',
          { status: 502, code: 'INVALID_RESPONSE' },
        )
      submission.current = null
      setEditing(false)
      setApplication(result.data)
    } catch (failure) {
      if (failure.status > 0 && failure.status < 500) submission.current = null
      if (failure.retryAfterMs)
        retryAfter.current = Date.now() + failure.retryAfterMs
      for (const detail of failure.fields || []) {
        if (Object.hasOwn(defaultValues, detail.field))
          registerForm.setError(detail.field, {
            type: 'server',
            message: detail.message,
          })
      }
      setError(failure)
      if (
        ['TERMS_UPDATED', 'APPLICATION_EXISTS', 'APPLICATION_CHANGED'].includes(
          failure.code,
        )
      ) {
        try {
          applyStatus(await loadStatus())
          if (failure.code === 'TERMS_UPDATED') setValue('termsAccepted', false)
          else setEditing(false)
        } catch (refreshFailure) {
          setError(refreshFailure)
        }
      }
    }
  }

  return (
    <div className="space-y-lg">
      {error && (
        <div
          role="alert"
          className="space-y-xs rounded-control border border-danger bg-danger-muted p-md text-sm"
        >
          <p>{error.message}</p>
          {error.requestId && (
            <p className="break-all text-xs">
              Support reference: {error.requestId}
            </p>
          )}
          {error.status === 401 && (
            <Link className="app-link" to="/login">
              Sign in again to continue
            </Link>
          )}
        </div>
      )}
      {loading ? (
        <p role="status">Loading your application...</p>
      ) : application && !editing ? (
        <>
          <RegistrationResult application={application} />
          {application.status === 'approved' && (
            <Link
              className="app-link inline-flex min-h-touch items-center"
              to="/setup"
            >
              Continue to payment and company setup
            </Link>
          )}
          <Link
            className="app-link inline-flex min-h-touch items-center"
            to="/app"
          >
            Open an existing workspace
          </Link>
          {application.status === 'rejected' && (
            <button
              type="button"
              className="app-link min-h-touch"
              onClick={correctApplication}
            >
              Correct application
            </button>
          )}
          <button
            type="button"
            className="app-link min-h-touch"
            onClick={refreshStatus}
          >
            Refresh status
          </button>
        </>
      ) : phase === 'awaiting_email_verification' ? (
        <section role="status" className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg">
          <h2 className="text-xl font-semibold">Confirm your email</h2>
          <p className="text-sm">Your request is waiting for email confirmation and backend processing. Refresh this page after confirming your address.</p>
          <button type="button" className="app-link min-h-touch" onClick={refreshStatus}>Refresh application status</button>
        </section>
      ) : recovery === 'retry_or_contact_support' ? (
        <section role="status" className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg">
          <h2 className="text-xl font-semibold">We’re checking your request</h2>
          <p className="text-sm">Please refresh later or contact support. We will not create another application automatically.</p>
          <button type="button" className="app-link min-h-touch" onClick={refreshStatus}>Refresh application status</button>
        </section>
      ) : !termsVersion ? (
        <button
          type="button"
          className="app-link min-h-touch"
          onClick={refreshStatus}
        >
          Retry loading application
        </button>
      ) : (
        <AppFormProvider
          form={registerForm}
          onSubmit={handleRegisterSubmit}
          aria-labelledby="register-title"
          className="space-y-lg"
        >
          {recovery === 'accept_current_terms' && <p className="notice">Review and accept the current terms before resubmitting your application.</p>}
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
            <FormTextField
              name="firstName"
              label="First name"
              autoComplete="given-name"
              placeholder="Alex"
              icon={<UserRound />}
              maxLength={80}
              required
            />
            <FormTextField
              name="lastName"
              label="Last name (optional)"
              autoComplete="family-name"
              placeholder="Morgan"
              icon={<UserRound />}
              maxLength={80}
            />
          </div>
          <FormTextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com"
            icon={<Mail />}
            maxLength={254}
            readOnly
            hint="Your verified sign-in email."
            required
          />
          <FormTextField
            name="contactNumber"
            label="Phone with country code"
            type="tel"
            placeholder="+14155552671"
            hint="Include the + sign and your country code."
            maxLength={40}
            required
          />
          <FormTextField
            name="companyName"
            label="Company name"
            autoComplete="organization"
            placeholder="Your company or team"
            icon={<Building2 />}
            maxLength={160}
            required
          />
          <FormTextField
            name="companyWebsite"
            label="Company website (optional)"
            autoComplete="url"
            placeholder="https://example.com"
            icon={<Globe />}
            maxLength={500}
          />
          <FormCheckbox name="termsAccepted">
            I accept the registration terms ({termsVersion}).
            {import.meta.env.VITE_REGISTRATION_TERMS_URL && (
              <>
                {' '}
                <a
                  className="app-link"
                  href={import.meta.env.VITE_REGISTRATION_TERMS_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read terms
                </a>
              </>
            )}
          </FormCheckbox>
          <FormSubmitButton pendingLabel="Submitting application…">
            {editing ? 'Resubmit application' : 'Submit application'}
          </FormSubmitButton>
        </AppFormProvider>
      )}
    </div>
  )
}

function RegistrationResult({ application }) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg"
    >
      <h2 className="text-xl font-semibold">
        {application.status === 'pending'
          ? 'Application received'
          : 'Your application'}
      </h2>
      <p className="break-words text-sm">
        {application.companyName} · {application.email}
      </p>
      <p className="text-sm text-text-muted">
        {application.status === 'pending'
          ? 'Your application is pending review.'
          : application.status === 'approved'
            ? 'Your application has been approved.'
            : 'Your existing application needs corrections before it can be reviewed again.'}
      </p>
      {application.status === 'rejected' && application.reason && (
        <p className="text-sm">Review feedback: {application.reason}</p>
      )}
    </section>
  )
}
