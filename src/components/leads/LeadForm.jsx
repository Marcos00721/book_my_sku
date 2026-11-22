import { useEffect } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { leadFormSchema } from '../../schemas/leadFormSchema'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { Dialog, SaveFooter } from '../workspace/Elements'
import { FieldFrame } from '../common/FieldFrame'
import '../../styles/leads.css'

export function LeadForm({ path, close, saved }) {
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
    const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))
    const result = await mutation.run('post', path, payload)
    if (result) saved(result.data)
  }

  return (
    <Dialog size="md" title="Add lead" description="Capture the company, contact, and what they need." close={close} locked={locked}>
      <AppFormProvider form={form} onSubmit={onSubmit} animated={false} className="lead-form">
        <fieldset className="lead-form-fields" disabled={locked}>
          <FormTextField name="companyName" label="Company name" required maxLength={160} />
          <FormTextField name="contactName" label="Contact name" required maxLength={160} />
          <FormTextField name="email" label="Email address" type="email" required maxLength={254} />
          <FormTextField name="phone" label="Phone" type="tel" maxLength={40} />
          <FormTextField name="requestedInHandsDate" label="Requested in-hands date" type="date" />
          <FieldFrame label="Requirement" className="field" required error={form.formState.errors.requirement?.message}>
            {({ id, describedBy, invalid }) => (
              <textarea {...form.register('requirement')} id={id} aria-describedby={describedBy} aria-invalid={invalid} required rows={4} maxLength={2000} />
            )}
          </FieldFrame>
        </fieldset>
        <SaveFooter mutation={mutation} close={close} label="Add lead" />
      </AppFormProvider>
    </Dialog>
  )
}
