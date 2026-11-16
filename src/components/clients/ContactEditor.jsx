import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import {
  buildContactPayload,
  contactFormSchema,
  contactToFormValues,
} from '../../schemas/contactFormSchema'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormPhoneField } from '../forms/FormPhoneField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview } from '../workspace/RecordTools'
import { Dialog, SaveFooter } from '../workspace/Elements'

function ContactConflictReview({ error, path, onReview }) {
  const [name, email, phone, jobTitle] = useWatch({
    name: ['name', 'email', 'phone', 'jobTitle'],
  })
  return (
    <ConflictReview
      error={error}
      path={path}
      values={{
        name: name || '',
        email: email || '',
        phone: phone || '',
        jobTitle: jobTitle || '',
      }}
      onReview={onReview}
    />
  )
}

function ContactDuplicateHints({ path, excludeId }) {
  const email = useWatch({ name: 'email' }) || ''
  const trimmed = email.trim()
  const debouncedEmail = useDebouncedValue(trimmed, 400)
  const valid = Boolean(trimmed) && contactFormSchema.shape.email.safeParse(trimmed).success
  const resource = useResource(valid && trimmed === debouncedEmail
    ? queryPath(`${path}/duplicate-candidates`, { email: debouncedEmail })
    : null)
  if (!valid || trimmed !== debouncedEmail) return null
  if (resource.error) return <p className="client-form-hint muted">Could not check this email. You can still save.</p>
  const matches = (resource.data?.items || []).filter(item => (item.id || item._id) !== excludeId)
  if (!matches.length) return null
  return (
    <aside className="client-form-duplicates" aria-label="Possible duplicates">
      <p className="client-form-duplicates-title">Contacts with this email</p>
      <ul>{matches.map(item => <li key={item.id || item._id}>{item.name}</li>)}</ul>
    </aside>
  )
}

export function ContactEditor({ path, contact, close, saved }) {
  const mutation = useMutation()
  const [version, setVersion] = useState(contact.__v)
  const locked = mutation.pending || mutation.uncertain
  const form = useAppForm(contactFormSchema, {
    defaultValues: contactToFormValues(contact),
  })

  useEffect(() => {
    const frame = requestAnimationFrame(() => form.setFocus('name'))
    return () => cancelAnimationFrame(frame)
  }, [form])

  useEffect(() => {
    const fields = mutation.error?.fields
    if (!Array.isArray(fields)) return
    for (const field of fields) {
      if (
        field?.field &&
        ['name', 'email', 'phone', 'jobTitle'].includes(field.field) &&
        field.message
      ) {
        form.setError(field.field, {
          type: 'server',
          message: String(field.message),
        })
      }
    }
  }, [form, mutation.error])

  async function onSubmit(values) {
    const payload = {
      ...buildContactPayload(values),
      ...(contact._id ? { expectedVersion: version } : {}),
    }
    const result = await mutation.run(
      contact._id ? 'patch' : 'post',
      contact._id ? `${path}/${contact._id}` : path,
      payload,
    )
    if (result) saved(result.data)
  }

  return (
    <Dialog
      size="md"
      className="client-form-dialog"
      title={contact._id ? 'Edit contact' : 'Add contact'}
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="client-form client-contact-form"
      >
        <div className="client-form-fields" onKeyDown={(event) => {
          // Enter in a field must not activate the form's default save button.
          if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
            event.preventDefault()
          }
        }}>
          <div className="form-grid">
            <FormTextField
              name="name"
              label="Full name"
              required
              maxLength={160}
              autoComplete="name"
              disabled={locked}
            />
            <FormTextField
              name="jobTitle"
              label="Job title"
              maxLength={120}
              disabled={locked}
              autoComplete="organization-title"
            />
            <FormTextField
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              maxLength={254}
              disabled={locked}
              placeholder="name@example.com"
            />
            <FormPhoneField
              name="phone"
              label="Phone"
              disabled={locked}
            />
          </div>
          <ContactDuplicateHints path={path} excludeId={contact._id} />
        </div>
        <ContactConflictReview
          error={mutation.error}
          path={contact._id ? `${path}/${contact._id}` : null}
          onReview={(current) => setVersion(current.__v)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={contact._id ? 'Save' : 'Add contact'}
        />
      </AppFormProvider>
    </Dialog>
  )
}
