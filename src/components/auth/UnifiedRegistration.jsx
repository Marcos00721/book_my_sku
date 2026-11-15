import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Globe, Mail, UserRound } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { AuthPageContent } from './AuthPageContent'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormCheckbox } from '../forms/FormCheckbox'
import { FormPasswordField } from '../forms/FormPasswordField'
import { FormSubmitButton } from '../forms/FormSubmitButton'
import { FormPhoneField } from '../forms/FormPhoneField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { unifiedSignupSchema } from '../../schemas/authSchemas'
import { authConfigured, getAuthClient } from '../../services/auth'

const termsVersion = import.meta.env.VITE_REGISTRATION_TERMS_VERSION || ''

export function UnifiedRegistration({ session }) {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [resendWait, setResendWait] = useState(session ? 60 : 0)
  const [resending, setResending] = useState(false)
  const form = useAppForm(unifiedSignupSchema, { defaultValues: {
    firstName:'', lastName:'', email:'', contactNumber:'', companyName:'', companyWebsite:'', termsAccepted:false, password:'', confirmPassword:'',
  } })

  useEffect(() => {
    if (!resendWait) return
    const until = Date.now() + resendWait * 1000
    const timer = window.setTimeout(() => setResendWait(Math.max(0, Math.ceil((until - Date.now()) / 1000))), 1000)
    return () => window.clearTimeout(timer)
  }, [resendWait])

  async function submit(values) {
    setError(null)
    setMessage('')
    if (!termsVersion) {
      setError(new Error('Registration terms are not configured. Please contact support.'))
      return
    }
    try {
      const { data, error: signupError } = await getAuthClient().auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { bookmysku_application: {
            firstName: values.firstName,
            lastName: values.lastName || '',
            email: values.email,
            companyName: values.companyName,
            contactNumber: values.contactNumber,
            companyWebsite: values.companyWebsite || '',
            termsAccepted: true,
            termsVersion,
          } },
        },
      })
      if (signupError) throw signupError
      setEmail(values.email)
      form.reset({ ...form.getValues(), password: '', confirmPassword: '' })
      setResendWait(60)
      setMessage('If this address can start a new application, a confirmation email will arrive. Confirm your email so we can review your account request. The link will take you to your application status.')
      if (data.session?.user?.email_confirmed_at) {
        navigate('/continue', { replace: true })
      }
    } catch (failure) {
      setError(failure)
    }
  }

  async function resend(address = email) {
    if (!address || resendWait || resending) return
    setError(null)
    setResending(true)
    try {
      const { error: resendError } = await getAuthClient().auth.resend({
        type: 'signup', email: address,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (resendError) throw resendError
      setMessage('If a confirmation can be sent, it will arrive shortly.')
      setResendWait(60)
    } catch (failure) {
      setResendWait(60)
      setError(failure)
    } finally { setResending(false) }
  }

  const confirmationEmail = session?.user.email || email
  const awaitingConfirmation = Boolean(session || message)

  return (
    <AuthLayout variant="register" tone="lagoon">
      <AuthPageContent
        id="register-title"
        eyebrow=""
        title="A clear start for your business"
        description="Create your sign-in and send your company details together."
      >
        {!termsVersion && <p role="alert" className="text-sm text-danger">Registration is not available because the current terms version is not configured.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error.message}</p>}
        {!authConfigured && <p role="alert" className="text-sm text-danger">Account registration is not configured. Please contact support.</p>}
        {awaitingConfirmation ? (
          <section role="status" className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg">
            <h2 className="text-xl font-semibold">{session ? 'Confirm your email' : 'Check your email'}</h2>
            <p className="wrap-break-words text-sm">
              {message || `Confirm your email so we can review your account request. Check ${confirmationEmail}; the confirmation link will take you to your application status.`}
            </p>
            <button
              type="button"
              className="app-link min-h-touch"
              disabled={resendWait > 0 || resending}
              onClick={() => { void resend(confirmationEmail) }}
            >
              {resendWait ? `Try again in ${resendWait}s` : resending ? 'Sending…' : 'Resend confirmation email'}
            </button>
            <p className="text-sm text-text-muted">If you already confirmed your email, <Link className="app-link" to="/login">sign in to check your status</Link>.</p>
          </section>
        ) : (
          <AppFormProvider form={form} onSubmit={submit} animated={false} aria-labelledby="register-title" className="auth-signup-grid space-y-lg">
            <div className="auth-signup-name-fields grid gap-md sm:grid-cols-2">
              <FormTextField name="firstName" label="First name" autoComplete="given-name" icon={<UserRound />} maxLength={80} required />
              <FormTextField name="lastName" label="Last name (optional)" autoComplete="family-name" icon={<UserRound />} maxLength={80} />
            </div>
            <FormTextField name="email" label="Email address" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} icon={<Mail />} maxLength={254} required />
            <FormPhoneField name="contactNumber" label="Phone" required />
            <FormTextField name="companyName" label="Company name" autoComplete="organization" icon={<Building2 />} maxLength={160} required />
            <FormTextField name="companyWebsite" label="Company website (optional)" autoComplete="url" placeholder="https://example.com" icon={<Globe />} maxLength={500} />
            <FormPasswordField name="password" label="Password" autoComplete="new-password" hint="Use at least 8 characters." required />
            <FormPasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" required />
            <div className="auth-signup-notice auth-signup-terms">
              <FormCheckbox name="termsAccepted">
                I accept the registration terms ({termsVersion}).
                {import.meta.env.VITE_REGISTRATION_TERMS_URL && (
                  <> <a className="app-link whitespace-nowrap" href={import.meta.env.VITE_REGISTRATION_TERMS_URL} target="_blank" rel="noreferrer">Read terms</a></>
                )}
              </FormCheckbox>
            </div>
            <div className="auth-signup-notice">
              <FormSubmitButton disabled={!termsVersion || !authConfigured} pendingLabel="Sending your application…">Create account and apply</FormSubmitButton>
            </div>
          </AppFormProvider>
        )}
        <p className="auth-signup-login mt-lg text-center text-sm text-text-muted">Already have an account? <Link to="/login" className="app-link">Sign in</Link></p>
      </AuthPageContent>
    </AuthLayout>
  )
}
