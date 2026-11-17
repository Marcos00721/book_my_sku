import { useState } from 'react'
import { Plug } from 'lucide-react'
import { Badge, Button, Card, useConfirm } from '../common'
import { ErrorNotice, Loading } from '../workspace/Elements'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useSageConnection } from '../../hooks/useSageConnection'
import { useDraftGuard } from '../../hooks/useDraftGuard'
import { SageCredentialsForm } from './SageCredentialsForm'

const emptyCredentials = { acctId: '', loginId: '', key: '' }

export function SageIntegration() {
  const workspace = useWorkspace()
  const connection = useSageConnection(workspace.base, workspace.owner && workspace.writesAllowed)
  const [credentials, setCredentials] = useState(emptyCredentials)
  const [message, setMessage] = useState('')
  const confirm = useConfirm()
  const dirty = Object.values(credentials).some(Boolean)
  useDraftGuard(dirty || connection.uncertain || connection.pending)
  const connected = connection.data?.status === 'connected'
  const disabled = !workspace.writesAllowed || connection.pending || connection.uncertain || connection.loading || Boolean(connection.error) || !connection.data

  async function run(action, payload) {
    setMessage('')
    const result = await connection.run(action, payload)
    if (!result) return
    if (result.action !== 'test') setCredentials(emptyCredentials)
    setMessage(result.action === 'test'
      ? 'SAGE connectivity test passed. Catalog entitlement is verified separately.'
      : result.action === 'disconnect' ? 'SAGE disconnected.' : 'SAGE credentials saved. Test the connection to check connectivity.')
  }

  async function save(values) {
    if (connected && !await confirm({ title: 'Replace SAGE connection?', message: 'Replacing credentials invalidates existing catalog previews and unfinished work using the previous connection.', confirmLabel: 'Replace connection' })) return
    await run('configure', { expectedRevision: connection.data.revision, ...values })
  }

  async function disconnect() {
    if (!await confirm({ title: 'Disconnect SAGE?', message: 'This removes the saved SAGE credentials and invalidates existing catalog previews. Imported products remain in your workspace.', confirmLabel: 'Disconnect', tone: 'danger' })) return
    await run('disconnect', { expectedRevision: connection.data.revision })
  }

  return (
    <Card aria-labelledby="sage-title" className="grid gap-lg">
      <div className="section-heading">
        <div><h2 id="sage-title"><Plug size={20} aria-hidden="true" /> SAGE</h2><p className="muted">Connect your promotional products catalog account.</p></div>
        {connection.data && <Badge tone={connected ? 'success' : 'default'}>{connected ? 'Configured' : 'Disconnected'}</Badge>}
      </div>
      {!workspace.writesAllowed ? <p className="notice">SAGE settings are paused while workspace changes are unavailable. Review Billing to restore access.</p> : connection.loading ? <Loading label="Loading SAGE connection…" /> : (
        <>
          {connection.error?.code === 'SAGE_DISABLED' ? <div className="notice" role="status">SAGE is not enabled for this workspace. Contact your administrator to arrange access.</div> : connection.error?.code === 'SAGE_SCHEMA_REQUIRED' ? <div className="notice" role="status">SAGE setup requires a backend update. Contact your administrator to complete setup.</div> : <ErrorNotice error={connection.error} />}
          {message && !connection.error && <p role="status" className="notice">{message}</p>}
          {connected && (
            <div className="grid gap-sm">
              <p>Account: <strong>{connection.data.accountHint}</strong></p>
              <p className="muted">{connection.data.testedAt ? `Last connectivity test: ${new Date(connection.data.testedAt).toLocaleString()}` : 'Connectivity has not been tested for these credentials.'}</p>
              <div className="actions">
                <Button variant="secondary" disabled={disabled || dirty} onClick={() => run('test', { expectedRevision: connection.data.revision })}>Test connection</Button>
                <Button variant="danger" disabled={disabled} onClick={disconnect}>Disconnect SAGE</Button>
              </div>
              <p className="muted">Testing uses one SAGE catalog query. Successful connectivity does not confirm catalog licensing.</p>
            </div>
          )}
          {connection.data && <SageCredentialsForm disabled={disabled} connected={connected} values={credentials} onChange={setCredentials} onSave={save} />}
          {connection.pending && <p role="status">Updating SAGE connection…</p>}
          {connection.uncertain ? <div className="notice"><p>The result is unconfirmed. Retry the original request before making another change.</p><Button disabled={connection.pending || !workspace.writesAllowed} onClick={() => run()}>Retry original request</Button></div> : <div className="actions"><Button variant="secondary" disabled={connection.pending} onClick={() => { setMessage(''); void connection.refresh() }}>Refresh connection</Button></div>}
        </>
      )}
    </Card>
  )
}
