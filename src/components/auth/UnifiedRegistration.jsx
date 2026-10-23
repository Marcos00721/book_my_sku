import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Globe, Mail, UserRound } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { AuthPageContent } from './AuthPageContent'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormCheckbox } from '../forms/FormCheckbox'
import { FormPasswordField } from '../forms/FormPasswordField'
import { FormSubmitButton } from '../forms/FormSubmitButton'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { unifiedSignupSchema } from '../../schemas/authSchemas'
import { getAuthClient } from '../../services/auth'
import { api } from '../../services/api'

const termsVersion = import.meta.env.VITE_REGISTRATION_TERMS_VERSION || ''

export function UnifiedRegistration({ session }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [resendWait, setResendWait] = useState(0)
  const form = useAppForm(unifiedSignupSchema, { defaultValues: {
    firstName:'', lastName:'', email:'', contactNumber:'', companyName:'', companyWebsite:'', termsAccepted:false, password:'', confirmPassword:'',
  } })

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
      setMessage('If this address can start a new application, a confirmation email will arrive. Confirm it to continue. If you already have an account, sign in instead.')
      if (data.session?.user?.email_confirmed_at) {
        await api.post('/registration/resume', {})
        window.location.assign('/continue')
      }
    } catch (failure) {
      setError(failure)
    }
  }

  async function resend(address = email) {
    if (!address || resendWait) return
    setError(null)
    try {
      const { error: resendError } = await getAuthClient().auth.resend({
        type: 'signup', email: address,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (resendError) throw resendError
      setMessage('If a confirmation can be sent, it will arrive shortly.')
      setResendWait(60)
      const timer = window.setInterval(() => setResendWait((value) => {
        if (value <= 1) { window.clearInterval(timer); return 0 }
        return value - 1
      }), 1000)
    } catch (failure) { setError(failure) }
  }

  return <AuthLayout variant="register"><AuthPageContent id="register-title" eyebrow="A clear start for your business" title="One form, then we’ll review." description="Create your sign-in and send your company details together." >
    {!termsVersion && <p role="alert" className="auth-signup-notice text-sm text-danger">Registration is not available because the current terms version is not configured.</p>}
    {error && <p role="alert" className="auth-signup-notice text-sm text-danger">{error.message}</p>}
    {session && !session.user.email_confirmed_at ? <section role="status" className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg"><h2 className="text-xl font-semibold">Confirm your email</h2><p className="wrap-break-words text-sm">If an application was attached to this address, it will be reviewed after email verification. Check {session.user.email} and keep your application details ready if the backend asks you to resubmit.</p><button type="button" className="app-link min-h-touch" disabled={resendWait > 0} onClick={() => { setEmail(session.user.email); void resend(session.user.email) }}>{resendWait ? `Try again in ${resendWait}s` : 'Resend confirmation email'}</button></section> : message ? <section role="status" className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg"><h2 className="text-xl font-semibold">Check your email</h2><p className="wrap-break-words text-sm">{message}</p><button type="button" className="app-link min-h-touch" disabled={resendWait > 0} onClick={resend}>{resendWait ? `Try again in ${resendWait}s` : 'Resend confirmation email'}</button><p className="text-sm text-text-muted">If you already have an account, <Link className="app-link" to="/login">sign in</Link>.</p></section> : <AppFormProvider form={form} onSubmit={submit} animated={false} aria-labelledby="register-title" className="auth-signup-grid space-y-lg">
      <div className="auth-signup-name-fields grid gap-md sm:grid-cols-2"><FormTextField name="firstName" label="First name" autoComplete="given-name" icon={<UserRound />} maxLength={80} required /><FormTextField name="lastName" label="Last name (optional)" autoComplete="family-name" icon={<UserRound />} maxLength={80} /></div>
      <FormTextField name="email" label="Work email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} icon={<Mail />} maxLength={254} required />
      <FormTextField name="contactNumber" label="Phone with country code" type="tel" placeholder="+14155552671" hint="Include the + sign and your country code." maxLength={40} required />
      <FormTextField name="companyName" label="Company name" autoComplete="organization" icon={<Building2 />} maxLength={160} required />
      <FormTextField name="companyWebsite" label="Company website (optional)" type="url" autoComplete="url" placeholder="https://example.com" icon={<Globe />} maxLength={500} />
      <FormPasswordField name="password" label="Password" autoComplete="new-password" hint="Use at least 8 characters." required />
      <FormPasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" required />
      <FormCheckbox name="termsAccepted">I accept the registration terms ({termsVersion}).{import.meta.env.VITE_REGISTRATION_TERMS_URL && <> <a className="app-link" href={import.meta.env.VITE_REGISTRATION_TERMS_URL} target="_blank" rel="noreferrer">Read terms</a></>}</FormCheckbox>
      <FormSubmitButton disabled={!termsVersion} pendingLabel="Sending your application…">Create account and apply</FormSubmitButton>
    </AppFormProvider>}
    <p className="auth-signup-login mt-lg text-center text-sm text-text-muted">Already have an account? <Link to="/login" className="app-link">Sign in</Link></p>
  </AuthPageContent></AuthLayout>
}
