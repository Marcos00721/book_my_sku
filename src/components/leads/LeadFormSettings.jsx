import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, Link2, LoaderCircle, RefreshCw, ShieldCheck, Unplug, UserRound } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { askConfirm } from '../common/confirm'
import { Action, Dialog, ErrorNotice, Field, Loading } from '../workspace/Elements'
import { LeadOwnerPicker } from './LeadPickers'

export function LeadFormSettings({ close }) {
  const workspace = useWorkspace()
  const resource = useResource(workspace.owner ? `${workspace.base}/inquiry-form` : null)
  const mutation = useMutation()
  const [ownerId, setOwnerId] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [message, setMessage] = useState('')
  const [reviewedRevision, setReviewedRevision] = useState(null)
  const latest = useResource(mutation.error?.status === 409 ? `${workspace.base}/inquiry-form` : null)
  const locked = mutation.pending || mutation.uncertain
  const writable = workspace.owner && workspace.writesAllowed
  const record = resource.data
  if (!workspace.owner) return null

  async function save(kind) {
    if (!mutation.uncertain && !writable) return
    if (kind === 'rotate' && !await askConfirm({
      title: 'Regenerate intake link?', message: 'The previous link becomes invalid immediately. Public intake remains unavailable.',
      confirmLabel: 'Regenerate link', tone: 'danger',
    })) return
    const path = `${workspace.base}/inquiry-form${kind === 'rotate' ? '/rotate' : ''}`
    const result = await mutation.run(kind === 'rotate' ? 'post' : 'patch', path, {
      expectedRevision: reviewedRevision ?? record.revision,
      ...(kind === 'owner' ? { ownerId } : kind === 'disable' ? { enabled: false } : {}),
    })
    if (result) {
      setOwnerId('')
      setRevealed(false)
      setReviewedRevision(null)
      setMessage('Intake settings updated.')
      resource.accept(null)
      resource.reload()
    }
  }

  const linkStatus = ({ available: 'Available', 'owner-unavailable': 'Owner unavailable', 'signing-unavailable': 'Configuration unavailable' })[record?.linkState] || 'Unavailable'

  return <Dialog title="Lead intake settings" description="Manage the form owner and private intake link for your workspace."
    className="lead-intake-dialog" size="md" close={close} locked={locked} hasUnsavedChanges={Boolean(ownerId) || mutation.uncertain}>
    <div className="lead-intake-content">
    <div className="lead-intake-notice">
      <ShieldCheck size={19} aria-hidden="true" />
      <div><strong>Public intake is unavailable</strong><p>These settings manage your existing form owner and private link.</p></div>
    </div>
    <ErrorNotice error={resource.error?.code === 'INQUIRY_FORM_NOT_PROVISIONED'
      ? { ...resource.error, message: 'Form was not provisioned.' } : resource.error} retry={resource.reload} />
    {resource.loading || (!record && !resource.error) ? <Loading variant="form" label="Loading intake settings…" /> : record && <div className="lead-intake-sections">
      <section className="lead-intake-section" aria-label="Form ownership">
        <div className="lead-intake-section-heading"><UserRound size={18} aria-hidden="true" /><h3>Form ownership</h3></div>
        <p className="lead-intake-help">Choose the workspace member responsible for this intake form.</p>
        <div className="lead-intake-owner-settings">
        <div className="lead-intake-owner">
          <span className="lead-intake-avatar"><UserRound size={20} aria-hidden="true" /></span>
          <div><span className="lead-intake-label">Current owner</span><strong>{record.owner?.label || 'Unavailable'}</strong></div>
          {record.owner?.eligible === false && <span className="lead-intake-badge">Unavailable</span>}
        </div>
        {workspace.can('inquiries.edit') && <div className="lead-intake-owner-field">
          <LeadOwnerPicker label="Form owner" value={ownerId} onChange={setOwnerId} disabled={locked || !writable} compact />
          <p className="lead-intake-help">Only eligible workspace members are available.</p>
        </div>}
        </div>
      </section>
      <section className="lead-intake-section" aria-label="Private intake link">
        <div className="lead-intake-section-heading"><Link2 size={18} aria-hidden="true" /><h3>Private intake link</h3>
          <span className={`lead-intake-badge${record.linkState === 'available' ? ' lead-intake-badge--ready' : ''}`}>{linkStatus}</span>
        </div>
        <p className="lead-intake-help">Keep this link private. Reveal or copy it when you need it.</p>
        {record.linkState === 'owner-unavailable' && <p className="lead-intake-help">Choose an eligible owner to recover this link.</p>}
        {record.linkState === 'signing-unavailable' && <p className="lead-intake-help">Signing configuration is unavailable. Regenerate after configuration is restored.</p>}
        {record.url && <div className="lead-intake-link">
        <Field label="Private intake URL" type={revealed ? 'text' : 'password'} value={record.url} readOnly autoComplete="off" spellCheck={false} />
        <div className="lead-intake-link-actions">
          <Action variant="secondary" aria-label={revealed ? 'Hide link' : 'Reveal link'} title={revealed ? 'Hide link' : 'Reveal link'} aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>
            {revealed ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </Action>
          <Action variant="secondary" onClick={async () => {
            try { await navigator.clipboard.writeText(record.url); setMessage('Link copied.') }
            catch { setMessage('Copy is unavailable. Reveal the link and copy it manually.') }
          }}><Copy size={16} aria-hidden="true" />Copy link</Action>
        </div>
        </div>}
        <div className="lead-intake-maintenance">
          <div><h4>Regenerate link</h4><p className="lead-intake-help">Replace this link and immediately invalidate the previous one.</p></div>
          <Action variant="secondary" disabled={!writable || locked || mutation.error?.status === 409} onClick={() => save('rotate')}><RefreshCw size={16} aria-hidden="true" />Regenerate link</Action>
        </div>
      </section>
      {record.enabled && <section className="lead-intake-maintenance lead-intake-disable" aria-label="Disable intake form">
        <div><h3>Disable form</h3><p className="lead-intake-help">Stop accepting submissions through this form.</p></div>
        <Action variant="secondary" className="lead-intake-disable-button" disabled={!writable || locked || mutation.error?.status === 409} onClick={() => save('disable')}><Unplug size={16} aria-hidden="true" />Disable form</Action>
      </section>}
      <ErrorNotice error={mutation.error} />
      {mutation.error?.status === 409 && <section className="notice" aria-label="Review settings conflict">
        <p>Your selection is preserved. Review the current form before retrying.</p>
        <ErrorNotice error={latest.error} retry={latest.reload} />
        {latest.data && <><p>Current owner: {latest.data.owner?.label || 'Unavailable'}</p><Action variant="secondary" onClick={() => {
          setReviewedRevision(latest.data.revision)
          setRevealed(false)
          resource.accept(latest.data)
          mutation.reset()
        }}>Use latest settings revision</Action></>}
      </section>}
      {message && <p className="lead-intake-feedback" role="status"><Check size={16} aria-hidden="true" />{message}</p>}
      {mutation.uncertain && <p className="notice">The outcome is uncertain. Retry the same request to recover it safely.</p>}
    </div>}
    </div>
    {record && <footer className="lead-intake-footer">
      <p>{mutation.uncertain ? 'Recover the last request to continue.' : ownerId ? 'Owner change is not saved yet.' : 'Settings apply to this workspace.'}</p>
      {mutation.uncertain ? <Action disabled={mutation.pending || !writable} onClick={async () => {
        if (await mutation.run()) { setOwnerId(''); setRevealed(false); setReviewedRevision(null); resource.accept(null); resource.reload(); setMessage('Intake settings updated.') }
      }}>Retry same request</Action> : <Action disabled={!writable || locked || !ownerId || mutation.error?.status === 409} onClick={() => save('owner')}>
        {mutation.pending && <LoaderCircle className="lead-intake-spinner" size={16} aria-hidden="true" />}Save form owner
      </Action>}
    </footer>}
  </Dialog>
}
