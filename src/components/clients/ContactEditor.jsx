import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useMutation } from '../../hooks/useMutation'
import {
  buildContactPayload,
  contactFormSchema,
  contactToFormValues,
} from '../../schemas/contactFormSchema'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormPhoneField } from '../forms/FormPhoneField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview, DuplicateHints } from '../workspace/RecordTools'
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

function ContactDuplicateHints({ path }) {
  const email = useWatch({ name: 'email' }) || ''
  const debouncedEmail = useDebouncedValue(email.trim(), 400)
  return (
    <DuplicateHints
      path={`${path}/duplicate-candidates`}
      query={debouncedEmail ? { email: debouncedEmail } : null}
      labelFor={(item) => item.name}
    />
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
      className="supplier-form-dialog"
      title={contact._id ? 'Edit' : 'Create'}
      description="Keep the right person easy to find when your team needs them."
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="supplier-form"
      >
        <div className="supplier-form-fields">
          <section className="supplier-form-section">
            <h3 className="supplier-form-section-title">Person details</h3>
            <div className="supplier-form-section-body">
              <div className="form-grid">
                <FormTextField
                  name="name"
                  label="Full name"
                  required
                  maxLength={160}
                  autoFocus
                  disabled={locked}
                />
                <FormTextField
                  name="jobTitle"
                  label="Job title"
                  maxLength={120}
                  disabled={locked}
                  placeholder="Buyer"
                />
              </div>
              <div className="form-grid">
                <FormTextField
                  name="email"
                  label="Email address"
                  type="email"
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
              <ContactDuplicateHints path={path} />
            </div>
          </section>
        </div>
        <ContactConflictReview
          error={mutation.error}
          path={contact._id ? `${path}/${contact._id}` : null}
          onReview={(current) => setVersion(current.__v)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={contact._id ? 'Save' : 'Create'}
        />
      </AppFormProvider>
    </Dialog>
  )
}
