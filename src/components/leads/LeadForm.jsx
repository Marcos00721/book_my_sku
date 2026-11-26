import { useEffect, useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { leadFormSchema } from '../../schemas/leadFormSchema'
import { canAddLead } from '../../services/leads'
import { useAppForm } from '../forms/useAppForm'
import { SaveFooter } from '../workspace/Elements'
import { FormTextField } from '../forms/FormTextField'
import { LeadFormDialog } from './LeadFormDialog'
import { LeadClientPicker, LeadOwnerPicker } from './LeadPickers'

export function LeadForm({ path, close, saved }) {
  const workspace = useWorkspace()
  const [ownerId, setOwnerId] = useState('')
  const [selection, setSelection] = useState({ clientId: '', contactId: '' })
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const form = useAppForm(leadFormSchema, {
    defaultValues: { companyName: '', contactName: '', email: '', phone: '', requestedInHandsDate: '', requirement: '' },
  })

  useEffect(() => {
    const frame = requestAnimationFrame(() => form.setFocus('companyName'))
    return () => cancelAnimationFrame(frame)
  }, [form])

  useEffect(() => {
    const fields = mutation.error?.fields
    if (!Array.isArray(fields)) return
    for (const field of fields) {
      if (Object.hasOwn(leadFormSchema.shape, field.field) && typeof field.message === 'string') {
        form.setError(field.field, { type: 'server', message: field.message })
      }
    }
  }, [form, mutation.error])

  async function onSubmit(values) {
    if (!canAddLead(workspace) || !workspace.writesAllowed) return
    const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))
    if (ownerId) payload.ownerId = ownerId
    if (selection.clientId) payload.clientId = selection.clientId
    if (selection.contactId) payload.contactId = selection.contactId
    const result = await mutation.run('post', path, payload)
    if (result) saved(result.data)
  }

  return (
    <LeadFormDialog title="Add lead" description="Start with a contact and what they need."
      form={form} onSubmit={onSubmit} close={close} locked={locked} captureDisabled={locked}
      hasUnsavedChanges={form.formState.isDirty || Boolean(ownerId || selection.clientId) || mutation.uncertain}
      setup={<>
        <FormTextField name="requestedInHandsDate" label="Requested in-hands date" type="date" disabled={locked}
          hint="When the customer needs their order." />
        {workspace.can('inquiries.edit') && <LeadOwnerPicker value={ownerId} onChange={setOwnerId} disabled={locked} optional compact />}
      </>}
      clientPicker={workspace.can('clients.view') && <LeadClientPicker {...selection} compact disabled={locked}
        onChange={(clientId, contactId) => setSelection({ clientId, contactId })} />}
      footer={<SaveFooter mutation={mutation} close={close} label="Add lead" onClear={() => {
        setOwnerId('')
        setSelection({ clientId: '', contactId: '' })
      }} />}
    />
  )
}
