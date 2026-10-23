import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormPasswordField } from '../components/forms/FormPasswordField'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { useAppForm } from '../components/forms/useAppForm'
import { passwordResetSchema } from '../schemas/authSchemas'
import { exchangeAuthCode, getAuthClient } from '../services/auth'

const recoverySessionKey = 'bookmysku.password-recovery-user'
const invalidLinkMessage =
  'This password reset link is invalid, expired, or already used. Request a new link to try again.'

function getRecoveryUserId() {
  try {
    return window.sessionStorage.getItem(recoverySessionKey)
  } catch {
    return null
  }
}

function setRecoveryUserId(userId) {
  try {
    window.sessionStorage.setItem(recoverySessionKey, userId)
  } catch {
    // The current page can still use the verified recovery session.
  }
}

function clearRecoveryUserId() {
  try {
    window.sessionStorage.removeItem(recoverySessionKey)
  } catch {
    // The marker is only used to restore this page after a reload.
  }
}

function getProviderError(parameters) {
  return (
    parameters.query.get('error_code') ||
    parameters.fragment.get('error_code') ||
    parameters.query.get('error') ||
    parameters.fragment.get('error')
  )
}

export function ResetPasswordPage() {
  const [parameters] = useState(() => ({
    query: new URLSearchParams(window.location.search),
    fragment: new URLSearchParams(window.location.hash.slice(1)),
  }))
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState('')
  const [signOutFailed, setSignOutFailed] = useState(false)
  const form = useAppForm(passwordResetSchema, {
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    let active = true
    const code = parameters.query.get('code')
    const flowId = parameters.query.get('sb_flow_id')
    const tokenHash =
      parameters.query.get('token_hash') || parameters.fragment.get('token_hash')
    const tokenType =
      parameters.query.get('type') || parameters.fragment.get('type')

    // Remove one-use codes and tokens from the address bar and browser history.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    )

    async function validateRecoverySession() {
      try {
        if (getProviderError(parameters)) throw new Error(invalidLinkMessage)

        const auth = getAuthClient().auth
        let session = null

        if (code) {
          const { data, error: exchangeError } = await exchangeAuthCode(
            code,
            flowId ? { flowId } : undefined,
          )
          if (exchangeError) throw exchangeError
          if (data.redirectType !== 'recovery') throw new Error(invalidLinkMessage)
          session = data.session
        } else if (tokenHash) {
          if (tokenType !== 'recovery') throw new Error(invalidLinkMessage)
          const { data, error: verifyError } = await auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })
          if (verifyError) throw verifyError
          session = data.session
        } else {
          // A previously verified session marker lets a reload recover the form
          // without accepting an unrelated sign-in session on this route.
          const previousUserId = getRecoveryUserId()
          const { data, error: sessionError } = await auth.getSession()
          if (sessionError) throw sessionError
          if (!previousUserId || data.session?.user?.id !== previousUserId) {
            throw new Error(invalidLinkMessage)
          }
          session = data.session
        }

        if (!session?.user?.id) throw new Error(invalidLinkMessage)
        const { data: userData, error: userError } = await auth.getUser()
        if (userError || userData.user?.id !== session.user.id) {
          throw new Error(invalidLinkMessage)
        }
        setRecoveryUserId(userData.user.id)
        if (active) setStatus('ready')
      } catch {
        clearRecoveryUserId()
        if (active) {
          setError(invalidLinkMessage)
          setStatus('invalid')
        }
      }
    }

    void validateRecoverySession()
    return () => {
      active = false
    }
  }, [parameters])

  async function savePassword({ password }) {
    setError('')
    try {
      const { error: updateError } = await getAuthClient().auth.updateUser({
        password,
      })
      if (updateError) throw updateError

      clearRecoveryUserId()
      let signedOut = false
      try {
        const { error: signOutError } = await getAuthClient().auth.signOut()
        signedOut = !signOutError
      } catch {
        signedOut = false
      }
      setSignOutFailed(!signedOut)
      setStatus('complete')
    } catch (failure) {
      setError(failure.message || 'Your password could not be updated. Try again.')
    }
  }

  const title =
    status === 'complete'
      ? 'Password updated'
      : status === 'invalid'
        ? 'Reset link unavailable'
        : 'Choose a new password'

  return (
    <AuthLayout variant="login">
      <AuthPageContent
        id="reset-password-title"
        eyebrow="Secure account recovery"
        title={title}
        description={
          status === 'complete'
            ? 'Your password has been changed.'
            : status === 'invalid'
              ? 'Request a fresh password reset link to continue.'
              : 'Choose a new password for your BookMySku account.'
        }
      >
        {status === 'checking' && (
          <p role="status" className="text-sm text-text-muted">
            Checking your reset link…
          </p>
        )}

        {status === 'invalid' && (
          <div className="space-y-md">
            <p role="alert" className="rounded-control border border-danger bg-danger-muted p-md text-sm">
              {error || invalidLinkMessage}
            </p>
            <Link to="/forgot-password" className="app-link inline-flex min-h-touch items-center gap-xs text-sm">
              <KeyRound aria-hidden="true" className="h-icon-sm w-icon-sm" /> Request a new reset link
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <AppFormProvider
            form={form}
            onSubmit={savePassword}
            animated={false}
            aria-labelledby="reset-password-title"
            className="space-y-lg"
          >
            {error && (
              <p role="alert" className="rounded-control border border-danger bg-danger-muted p-md text-sm">
                {error}
              </p>
            )}
            <FormPasswordField
              name="password"
              label="New password"
              autoComplete="new-password"
              hint="Use at least 8 characters."
              required
            />
            <FormPasswordField
              name="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
              required
            />
            <FormSubmitButton pendingLabel="Updating password…">
              Update password
            </FormSubmitButton>
          </AppFormProvider>
        )}

        {status === 'complete' && (
          <div className="space-y-md">
            <p role="status" className="rounded-control border border-border-subtle bg-surface-muted p-md text-sm leading-relaxed">
              {signOutFailed
                ? 'Your password changed, but this browser could not end the recovery session. Sign out, then sign in with your new password and return to /admin.'
                : 'Sign in with your new password, then return to /admin to enroll or verify TOTP.'}
            </p>
            <Link to="/login" className="app-link inline-flex min-h-touch items-center text-sm">
              Back to sign in
            </Link>
          </div>
        )}

        {status !== 'complete' && (
          <Link to="/login" className="app-link mt-lg inline-flex min-h-touch items-center text-sm">
            Back to sign in
          </Link>
        )}
      </AuthPageContent>
    </AuthLayout>
  )
}
