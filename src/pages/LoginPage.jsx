import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormPasswordField } from '../components/forms/FormPasswordField'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { FormTextField } from '../components/forms/FormTextField'
import { useAppForm } from '../components/forms/useAppForm'
import { loginFormSchema } from '../schemas/authSchemas'
import { getAuthClient } from '../services/auth'
import { hasPendingInvitation } from '../services/invitation'

export function LoginPage({ returnTo }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const loginForm = useAppForm(loginFormSchema, {
    defaultValues: { email: '', password: '' },
  })

  async function handleLoginSubmit({ email, password }) {
    setError('')
    try {
      const { error } = await getAuthClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error
      navigate(returnTo || (hasPendingInvitation() ? '/team/accept' : '/continue'), {
        replace: true,
      })
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <AuthLayout variant="login">
      <AuthPageContent
        id="login-title"
        eyebrow="Your workspace awaits"
        title="Welcome back."
        description="Sign in and pick up right where you left off."
      >
        <AppFormProvider
          form={loginForm}
          onSubmit={handleLoginSubmit}
          animated={false}
          aria-labelledby="login-title"
          className="space-y-lg"
        >
          {error && (
            <p
              role="alert"
              className="rounded-control border border-danger bg-danger-muted p-md text-sm"
            >
              {error}
            </p>
          )}
          <FormTextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com"
            icon={<Mail />}
            required
          />
          <div className="space-y-xs">
            <FormPasswordField
              name="password"
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="app-link inline-flex min-h-touch items-center text-sm"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <FormSubmitButton pendingLabel="Signing in…">
            Sign in
          </FormSubmitButton>
        </AppFormProvider>
        <p className="mt-xl text-center text-sm leading-relaxed text-text-muted">
          New to BookMySKU?{' '}
          <Link
            to="/register"
            className="app-link inline-flex min-h-touch items-center"
          >
            Create an account
          </Link>
        </p>
      </AuthPageContent>
    </AuthLayout>
  )
}
