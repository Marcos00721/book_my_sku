import { useState } from 'react'
import { Button, TextField } from '../common'

export function SageCredentialsForm({ disabled, connected, values, onChange, onSave }) {
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    const acctId = Number(values.acctId)
    if (!/^[1-9][0-9]*$/.test(values.acctId) || !Number.isSafeInteger(acctId)) {
      setError('Enter a positive whole account number.')
      return
    }
    if ([...values.key, ...values.loginId].some((char) => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)) {
      setError('Login ID and account key cannot contain control characters.')
      return
    }
    setError('')
    onSave({ acctId, key: values.key, ...(values.loginId ? { loginId: values.loginId } : {}) })
  }
  return (
    <form onSubmit={submit} autoComplete="off" className="grid gap-md">
      <h3>{connected ? 'Replace SAGE credentials' : 'Connect your SAGE account'}</h3>
      <div className="form-grid">
        <TextField label="SAGE account ID" inputMode="numeric" required maxLength={16} value={values.acctId} disabled={disabled} onChange={(event) => onChange({ ...values, acctId: event.target.value })} />
        <TextField label="SAGE login ID" maxLength={256} value={values.loginId} disabled={disabled} hint="Required to test the connection and access entitled catalog details." onChange={(event) => onChange({ ...values, loginId: event.target.value })} />
        <TextField label="SAGE account key" type="password" autoComplete="new-password" required maxLength={2048} value={values.key} disabled={disabled} hint="Enter your account key to save or replace the connection." onChange={(event) => onChange({ ...values, key: event.target.value })} />
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="actions"><Button type="submit" disabled={disabled}>{connected ? 'Replace connection' : 'Save connection'}</Button></div>
    </form>
  )
}
