import { useEffect, useState } from 'react'
import { getAuthClient } from '../../services/auth'
import { Action, ErrorNotice, Field } from './Elements'

export function MfaChallenge({ verified }) {
  const [factors, setFactors] = useState([])
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    getAuthClient()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error)
        else {
          const verifiedFactors = (data.totp || []).filter(
            (item) => item.status === 'verified',
          )
          setFactors(verifiedFactors)
          setFactorId(verifiedFactors[0]?.id || '')
        }
      })
      .catch((error) => {
        if (active) setError(error)
      })
    return () => {
      active = false
    }
  }, [])
  async function enroll() {
    setBusy(true)
    setError(null)
    try {
      const { data, error } = await getAuthClient().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `BookMySku ${new Date().toISOString().slice(0, 10)}`,
      })
      if (error) throw error
      setEnrollment(data)
      setFactorId(data.id)
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await getAuthClient().auth.mfa.challengeAndVerify({
        factorId,
        code,
      })
      if (error) throw error
      setCode('')
      setEnrollment(null)
      verified()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel">
      <h2>Confirm with your authenticator</h2>
      <p className="muted">
        Platform administration requires a recent verification code.
      </p>
      <ErrorNotice error={error} />
      {!factorId ? (
        <Action disabled={busy} onClick={enroll}>
          Set up authenticator
        </Action>
      ) : (
        <form onSubmit={submit}>
          {enrollment?.totp?.qr_code && (
            <>
              <img
                width="200"
                height="200"
                alt="Scan this QR code with your authenticator app"
                src={
                  enrollment.totp.qr_code.startsWith('data:')
                    ? enrollment.totp.qr_code
                    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.totp.qr_code)}`
                }
              />
              <p className="muted">
                Scan the code, then enter the six-digit code from your
                authenticator app.
              </p>
            </>
          )}
          {factors.length > 1 && (
            <Field
              label="Authenticator"
              value={factorId}
              onChange={(event) => setFactorId(event.target.value)}
            >
              {factors.map((factor) => (
                <option key={factor.id} value={factor.id}>
                  {factor.friendly_name || 'Authenticator'}
                </option>
              ))}
            </Field>
          )}
          <Field
            label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Action type="submit" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify and continue'}
          </Action>
        </form>
      )}
    </section>
  )
}
