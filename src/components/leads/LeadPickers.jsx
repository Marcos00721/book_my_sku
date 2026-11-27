import { useState } from 'react'
import { createPortal } from 'react-dom'
import { z } from 'zod'
import { RefreshCw } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { ReferenceSelect } from '../workspace/RecordTools'
import { Action, Dialog, ErrorNotice, Field, SaveFooter } from '../workspace/Elements'
import { ContactEditor } from '../clients/ContactEditor'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { leadFormSchema } from '../../schemas/leadFormSchema'

const clientSchema = z.object({ name: leadFormSchema.shape.companyName })

function CreateLeadClient({ path, close, saved }) {
  const mutation = useMutation()
  const form = useAppForm(clientSchema, { defaultValues: { name: '' } })
  return <Dialog title="Create client" close={close} locked={mutation.pending || mutation.uncertain} size="md"
    description="Create a client and select it for this lead. The client remains saved if the lead selection needs a retry.">
    <AppFormProvider form={form} animated={false} className="lead-form" onSubmit={async values => {
      const result = await mutation.run('post', path, values)
      if (result) saved(result.data)
    }}>
      <FormTextField name="name" label="Client name" required maxLength={160} disabled={mutation.pending || mutation.uncertain} />
      <SaveFooter mutation={mutation} close={close} label="Create and select client" />
    </AppFormProvider>
  </Dialog>
}

export function LeadOwnerPicker({ value, onChange, disabled, purpose = 'inquiry', label = 'Lead owner', clientId, optional = false, emptyLabel, compact = false, filter = false }) {
  const workspace = useWorkspace()
  const resource = useResource(queryPath(`${workspace.base}/assignment-options`, {
    purpose, limit: 50, ...(purpose === 'project' && clientId ? { clientId } : {}),
  }))
  const items = resource.data?.items || []
  return (
    <div className={filter ? 'lead-owner-picker--filter' : compact ? 'lead-owner-picker--compact' : undefined}>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <Field label={label} value={value || ''} disabled={disabled || resource.loading || Boolean(resource.error)}
        hint={compact || filter ? undefined : 'Only eligible workspace members are available.'}
        onChange={event => onChange(event.target.value)}>
        <option value="">{emptyLabel || (optional ? 'Assign to me' : 'Keep current owner')}</option>
        {value && !items.some(item => item.actorId === value) && <option value={value}>Saved owner · {value}</option>}
        {items.map(item => <option key={item.actorId} value={item.actorId}>{item.label}</option>)}
      </Field>
      {!filter && <Action variant={compact ? 'icon-button' : 'text-button'} disabled={disabled || resource.loading} onClick={resource.reload}
        aria-label={compact ? 'Refresh eligible members' : undefined} title={compact ? 'Refresh eligible members' : undefined}>
        {compact ? <RefreshCw size={16} aria-hidden="true" /> : 'Refresh eligible members'}
      </Action>}
    </div>
  )
}

export function LeadClientPicker({ clientId, contactId, onChange, disabled, clientDisabled = false, allowClear = true, compact = false }) {
  const workspace = useWorkspace()
  const [creating, setCreating] = useState(null)
  const [created, setCreated] = useState(null)
  const [choicesVersion, setChoicesVersion] = useState(0)
  if (!workspace.can('clients.view')) return <p className="muted">Client access is required to select a client.</p>
  const createClient = workspace.canWrite('clients.add') && <Action variant="text-button" disabled={disabled || clientDisabled} onClick={() => setCreating('client')}>Create a new client</Action>
  const refreshChoices = <Action variant={compact ? 'icon-button' : 'text-button'} disabled={disabled} onClick={() => setChoicesVersion(value => value + 1)}
    aria-label={compact ? 'Refresh client choices' : undefined} title={compact ? 'Refresh client choices' : undefined}>
    {compact ? <RefreshCw size={16} aria-hidden="true" /> : 'Refresh client choices'}
  </Action>
  return (
    <div className={`lead-form-fields${compact ? ' lead-client-picker--compact' : ''}`}>
      <ReferenceSelect key={`clients:${choicesVersion}`} path={`${workspace.base}/clients`} label="Client" value={clientId}
        query={{ state: 'active' }} required={!allowClear} disabled={disabled || clientDisabled} compact={compact}
        labelFor={item => [item.name, item.clientCode].filter(Boolean).join(' · ')}
        onChange={value => onChange(value, '')} />
      {compact ? <div className="lead-picker-actions">{createClient}{refreshChoices}</div> : createClient}
      {clientId && workspace.can('contacts.view') && (
        <ReferenceSelect key={`${clientId}:${choicesVersion}`} path={`${workspace.base}/clients/${clientId}/contacts`}
          label="Client contact" value={contactId} query={{ state: 'active' }}
          disabled={disabled} labelFor={item => item.name} compact={compact}
          onChange={value => onChange(clientId, value)} />
      )}
      {clientId && workspace.can('contacts.add') && workspace.can('contacts.view') && workspace.writesAllowed && <Action variant="text-button" disabled={disabled} onClick={() => setCreating('contact')}>Create a new contact</Action>}
      {created && created.id === (created.kind === 'client' ? clientId : contactId) && <p className="notice" role="status">{created.name} was created and selected. Save the lead to confirm the link.</p>}
      {!compact && refreshChoices}
      {creating && createPortal(creating === 'client'
        ? <CreateLeadClient path={`${workspace.base}/clients`} close={() => setCreating(null)} saved={client => {
          onChange(client._id, '')
          setCreated({ id: client._id, name: client.name, kind: 'client' })
          setCreating(null)
        }} />
        : <ContactEditor path={`${workspace.base}/clients/${clientId}/contacts`} contact={{}} close={() => setCreating(null)} saved={contact => {
          onChange(clientId, contact._id)
          setCreated({ id: contact._id, name: contact.name, kind: 'contact' })
          setCreating(null)
        }} />, document.body)}
    </div>
  )
}
