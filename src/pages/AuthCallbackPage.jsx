import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { exchangeAuthCode } from '../services/auth'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [parameters] = useState(() => new URLSearchParams(window.location.search))
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const code = parameters.get('code')
    // Remove authentication parameters even when verification fails.
    window.history.replaceState(window.history.state, '', window.location.pathname)
    async function confirmEmail() {
      try {
        if (!code || parameters.has('error')) throw new Error('This confirmation link is invalid or has expired. Sign in or request a new confirmation link.')
        const { error } = await exchangeAuthCode(code)
        if (error) throw new Error('We could not confirm your email. Open the link in the browser where you signed up, or sign in if your email is already confirmed.')
        if (active) navigate('/register', { replace: true })
      } catch (failure) { if (active) setError(failure.message) }
    }
    void confirmEmail()
    return () => { active = false }
  }, [navigate, parameters])

  return <AuthLayout variant="register">
    <AuthPageContent id="callback-title" eyebrow="Your account" title="Confirming your email" description="Your company application is the next step.">
      {error ? <div className="space-y-md"><p role="alert" className="text-sm text-danger">{error}</p><Link className="app-link" to="/login">Back to sign in</Link></div> : <p role="status">Confirming your email...</p>}
    </AuthPageContent>
  </AuthLayout>
}
