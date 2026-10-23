import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { FormTextField } from '../components/forms/FormTextField'
import { useAppForm } from '../components/forms/useAppForm'
import { passwordResetRequestSchema } from '../schemas/authSchemas'
import { getAuthClient } from '../services/auth'

export function AccountHelpPage() {
  const [sentEmail, setSentEmail] = useState('')
  const [error, setError] = useState('')
  const form = useAppForm(passwordResetRequestSchema, {
    defaultValues: { email: '' },
  })

  async function requestReset({ email }) {
    setError('')
    try {
      const { error: requestError } = await getAuthClient().auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/reset-password` },
      )
      if (requestError) throw requestError
      setSentEmail(email)
    } catch (failure) {
      setError(failure.message || 'The reset email could not be requested. Try again.')
    }
  }

  return (
    <AuthLayout variant="login">
      <AuthPageContent
        id="account-help-title"
        eyebrow="A little help getting back"
        title="Forgot your password?"
        description="Enter the email address on your account and we’ll send a link to choose a new password."
      >
        {sentEmail ? (
          <div className="space-y-md">
            <section
              role="status"
              className="space-y-sm rounded-card border border-border-subtle bg-surface-muted p-lg"
            >
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="wrap-break-words text-sm leading-relaxed text-text-muted">
                If an account uses {sentEmail}, a password reset link will arrive shortly. Check your spam folder if you don’t see it.
              </p>
            </section>
            <button
              type="button"
              className="app-link min-h-touch text-sm"
              onClick={() => setSentEmail('')}
            >
              Try another email address
            </button>
          </div>
        ) : (
          <AppFormProvider
            form={form}
            onSubmit={requestReset}
            animated={false}
            aria-labelledby="account-help-title"
            className="space-y-lg"
          >
            {error && (
              <p role="alert" className="rounded-control border border-danger bg-danger-muted p-md text-sm">
                {error}
              </p>
            )}
            <FormTextField
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@company.com"
              icon={<Mail />}
              required
            />
            <FormSubmitButton pendingLabel="Sending reset link…">
              Send reset link
            </FormSubmitButton>
          </AppFormProvider>
        )}
        <Link to="/login" className="app-link mt-lg inline-flex min-h-touch items-center gap-xs text-sm">
          <ArrowLeft aria-hidden="true" className="h-icon-sm w-icon-sm" /> Back to sign in
        </Link>
      </AuthPageContent>
    </AuthLayout>
  )
}
