import { useEffect, useId, useState } from 'react'
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react'
import { getAuthClient } from '../../services/auth'
import { Action, ErrorNotice, Field } from './Elements'
import '../../styles/mfa.css'

export function MfaChallenge({ verified }) {
  const [factors, setFactors] = useState([])
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadingFactors, setLoadingFactors] = useState(true)
  const [factorAttempt, setFactorAttempt] = useState(0)
  const [factorLoadFailed, setFactorLoadFailed] = useState(false)
  const titleId = useId()
  useEffect(() => {
    let active = true
    getAuthClient()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setError(error)
          setFactorLoadFailed(true)
        } else {
          const verifiedFactors = (data.totp || []).filter(
            (item) => item.status === 'verified',
          )
          setFactors(verifiedFactors)
          setFactorId(verifiedFactors[0]?.id || '')
        }
      })
      .catch((error) => {
        if (active) {
          setError(error)
          setFactorLoadFailed(true)
        }
      })
      .finally(() => {
        if (active) setLoadingFactors(false)
      })
    return () => {
      active = false
    }
  }, [factorAttempt])
  function retryFactors() {
    setLoadingFactors(true)
    setFactorLoadFailed(false)
    setError(null)
    setFactorAttempt((attempt) => attempt + 1)
  }
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
    if (busy || !factorId || !/^[0-9]{6}$/.test(code)) return
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
    <section className="mfa-card" aria-labelledby={titleId} aria-busy={busy || loadingFactors}>
      <header className="mfa-heading">
        <span className="mfa-emblem"><ShieldCheck size={28} strokeWidth={1.6} aria-hidden="true" /></span>
        <span className="mfa-badge">Two-step verification</span>
        <h2 id={titleId}>Confirm with your authenticator</h2>
        <p>One last step to keep your platform secure. Open your authenticator app to continue.</p>
      </header>
      <ErrorNotice error={error} retry={factorLoadFailed ? retryFactors : undefined} />
      {loadingFactors ? (
        <div className="mfa-loading" role="status"><LoaderCircle className="mfa-spinner" size={20} aria-hidden="true" /> Loading your authenticators…</div>
      ) : factorLoadFailed ? (
        <p className="mfa-help">We couldn’t load your authenticators. Please try again.</p>
      ) : !factorId ? (
        <div className="mfa-setup">
          <p>Connect an authenticator app, such as Google Authenticator or Microsoft Authenticator, to protect your admin access.</p>
          <Action className="mfa-submit" disabled={busy} onClick={enroll}>
            {busy ? <LoaderCircle className="mfa-spinner" size={18} aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
            {busy ? 'Setting up…' : 'Set up authenticator'}
          </Action>
        </div>
      ) : (
        <form className="mfa-form" onSubmit={submit}>
          {enrollment?.totp?.qr_code && (
            <div className="mfa-enrollment">
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
              <p>
                Scan the code, then enter the six-digit code from your
                authenticator app.
              </p>
            </div>
          )}
          {factors.length > 1 && (
            <Field
              label="Authenticator"
              disabled={busy}
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
            className="mfa-code-field"
            controlClassName="mfa-code-input"
            hint="Enter the 6-digit code shown in your app."
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            disabled={busy}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Action className="mfa-submit" type="submit" disabled={busy || code.length !== 6}>
            {busy ? <LoaderCircle className="mfa-spinner" size={18} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}
            {busy ? 'Verifying…' : 'Verify and continue'}
          </Action>
          <p className="mfa-help"><Smartphone size={16} aria-hidden="true" /> Codes refresh automatically. Use the latest one in your app.</p>
        </form>
      )}
      <footer className="mfa-footer"><LockKeyhole size={14} aria-hidden="true" /> Protected access to platform administration</footer>
    </section>
  )
}
