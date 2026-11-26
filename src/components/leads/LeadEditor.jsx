import { useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { leadEditSchema } from '../../schemas/leadFormSchema'
import { acceptedLead, leadFields, leadTransitions } from '../../services/leads'
import { FormSelectField } from '../forms/FormSelectField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { Action, ErrorNotice, Loading, SaveFooter } from '../workspace/Elements'
import { LeadFormDialog } from './LeadFormDialog'
import { LeadClientPicker, LeadOwnerPicker } from './LeadPickers'
import { LeadConflictReview } from './LeadConflictReview'

export function LeadEditor({ path, lead, close, saved, initialTransition = '' }) {
  const workspace = useWorkspace()
  const [record, setRecord] = useState(lead)
  const [ownerId, setOwnerId] = useState(lead.ownerId || '')
  const [selection, setSelection] = useState({ clientId: lead.clientId || '', contactId: lead.contactId || '' })
  const mutation = useMutation()
  const [committedReturn, setCommittedReturn] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const refreshed = useResource(committedReturn ? path : null)
  const locked = mutation.pending || mutation.uncertain || committedReturn
  const terminal = ['closed', 'converted'].includes(record.stage)
  const captureEditable = ['new', 'reviewing'].includes(record.stage)
  const form = useAppForm(leadEditSchema, { defaultValues: { ...acceptedLead(lead), transition: initialTransition, reason: '' } })
  const values = useWatch({ control: form.control })
  const clientEditable = !terminal && (captureEditable || !record.clientId || values.transition === 'return')
  const selectionChanged = selection.clientId !== (record.clientId || '') || selection.contactId !== (record.contactId || '')
  const before = acceptedLead(record)
  const captureChanged = captureEditable && Object.keys(leadFields).some(key => values[key] !== before[key])
  const changed = captureChanged || selectionChanged || ownerId !== (record.ownerId || '') || Boolean(values.transition)
  const invalidSelection = selection.clientId !== (record.clientId || '') && !clientEditable

  async function onSubmit(input) {
    if (mutation.uncertain) {
      if (await mutation.run()) saved()
      return
    }
    if (terminal || committedReturn || invalidSelection || mutation.error?.status === 409 || !workspace.writesAllowed || !workspace.can('inquiries.edit')) return
    const corrections = Object.fromEntries(Object.keys(leadFields)
      .filter(key => captureEditable && input[key] !== before[key])
      .map(key => [key, input[key]]))
    // Optional capture fields cannot be cleared by this API. Never silently omit an intended edit.
    for (const key of ['phone', 'requestedInHandsDate']) {
      if (Object.hasOwn(corrections, key) && !corrections[key]) {
        form.setError(key, { message: 'The current API requires a value for this field once captured.' })
        return
      }
    }
    const payload = { expectedRevision: record.revision }
    if (Object.keys(corrections).length) payload.corrections = corrections
    if (ownerId && ownerId !== record.ownerId) payload.ownerId = ownerId
    if (selectionChanged && !terminal) {
      payload.clientId = selection.clientId || null
      if (selection.contactId && workspace.can('contacts.view')) payload.contactId = selection.contactId
      else if (selection.contactId) return
    }
    if (input.transition) payload.transition = {
      action: input.transition,
      ...(['close', 'return'].includes(input.transition) ? { reason: input.reason } : {}),
    }
    if (Object.keys(payload).length === 1) return
    if (await mutation.run('patch', path, payload)) {
      const draft = form.getValues()
      if (!captureEditable && input.transition === 'return' && Object.keys(leadFields).some(key => draft[key] !== before[key])) {
        setHasSaved(true)
        setCommittedReturn(true)
      } else saved()
    }
  }

  function review(current) {
    // Refresh untouched fields while preserving explicit edits, avoiding accidental overwrites.
    const latest = acceptedLead(current)
    const draft = form.getValues()
    for (const key of Object.keys(leadFields)) {
      if (draft[key] === before[key]) form.setValue(key, latest[key])
    }
    if (ownerId === (record.ownerId || '')) setOwnerId(current.ownerId || '')
    if (!selectionChanged) setSelection({ clientId: current.clientId || '', contactId: current.contactId || '' })
    if (!leadTransitions(current.stage).some(item => item.value === draft.transition)) form.setValue('transition', '')
    setRecord(current)
    mutation.reset()
  }

  return (
    <LeadFormDialog title="Edit lead" description="Update the contact, requirement, and next steps."
      stage={record.stage} form={form} onSubmit={onSubmit}
      close={hasSaved ? saved : close} locked={mutation.pending || mutation.uncertain}
      captureDisabled={locked || !captureEditable} hasUnsavedChanges={Boolean(changed) || mutation.uncertain}
      notices={<>
        {terminal && <p className="notice">This lead is now {record.stage}. Further changes are unavailable.</p>}
        {!captureEditable && !terminal && <p className="notice">Return to reviewing before correcting captured details or replacing the selected client.</p>}
      </>}
      setup={<>
          <FormTextField name="requestedInHandsDate" label="Requested in-hands date" type="date" disabled={locked || !captureEditable}
            hint="When the customer needs their order." />
          <LeadOwnerPicker value={ownerId} onChange={value => setOwnerId(value || record.ownerId || '')} disabled={locked || terminal} compact />
          <FormSelectField name="transition" label="Stage change" disabled={locked || terminal} searchable={false}>
            <option value="">Keep current stage</option>
            {leadTransitions(record.stage).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </FormSelectField>
          {['close', 'return'].includes(values.transition) && <FormTextField name="reason" label="Reason" required maxLength={500} disabled={locked || terminal} />}
      </>}
      clientOpen clientLabel={selection.clientId ? 'Linked' : 'Optional'}
      clientPicker={workspace.can('clients.view') && <LeadClientPicker {...selection} compact disabled={locked || terminal}
        clientDisabled={!clientEditable} allowClear={record.stage !== 'qualified' || values.transition === 'return'}
        onChange={(clientId, contactId) => setSelection({ clientId, contactId })} />}
      feedback={<>
        <LeadConflictReview error={mutation.error} path={path} draft={{ ...values, ...selection, ownerId }} onReview={review} />
        {invalidSelection && <p className="notice">Return to reviewing to apply your saved client selection.</p>}
        {committedReturn && <section className="notice" aria-label="Continue captured edits">
          <p>The lead was returned to reviewing. Your captured edits are preserved; load the current revision to save them next.</p>
          <ErrorNotice error={refreshed.error} retry={refreshed.reload} />
          {refreshed.loading ? <Loading variant="inline" label="Loading current revision…" /> : refreshed.data && <Action variant="secondary" onClick={() => {
            review(refreshed.data)
            form.setValue('transition', '')
            form.setValue('reason', '')
            setCommittedReturn(false)
          }}>Continue with captured edits</Action>}
        </section>}
      </>}
      footer={<SaveFooter mutation={mutation} close={hasSaved ? saved : close}
          disabled={committedReturn || (!mutation.uncertain && (terminal || invalidSelection || !changed || mutation.error?.status === 409 || !workspace.writesAllowed || !workspace.can('inquiries.edit')))}
          onClear={() => {
            form.reset({ ...acceptedLead(record), transition: '', reason: '' })
            setOwnerId(record.ownerId || '')
            setSelection({ clientId: record.clientId || '', contactId: record.contactId || '' })
          }} />}
    />
  )
}
