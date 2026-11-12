import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useMutation } from '../../hooks/useMutation'
import {
  buildClientPayload,
  clientFormSchema,
  clientToFormValues,
} from '../../schemas/clientFormSchema'
import { AppFormProvider } from '../forms/AppFormProvider'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview } from '../workspace/RecordTools'
import { Dialog, SaveFooter } from '../workspace/Elements'
import { ClientFormFields } from './ClientFormFields'

const FIELD_NAMES = ['name', 'website', 'accountLabel', 'industryId']

function ClientConflictReview({ error, path, onReview }) {
  const [name, website, accountLabel, industryId] = useWatch({
    name: FIELD_NAMES,
  })
  return (
    <ConflictReview
      error={error}
      path={path}
      values={{
        name: name || '',
        website: website || '',
        accountLabel: accountLabel || '',
        industryId: industryId || '',
      }}
      onReview={onReview}
    />
  )
}

/** Dialog form for add (and legacy modal edit). Page edit uses ClientEditPage. */
export function ClientForm({ path, client, close, saved }) {
  const mutation = useMutation()
  const [version, setVersion] = useState(client?.__v)
  const locked = mutation.pending || mutation.uncertain

  const form = useAppForm(clientFormSchema, {
    defaultValues: clientToFormValues(client),
  })

  useEffect(() => {
    const fields = mutation.error?.fields
    if (!Array.isArray(fields)) return
    for (const field of fields) {
      const name = field?.field
      if (
        name &&
        FIELD_NAMES.includes(name) &&
        typeof field.message === 'string' &&
        field.message.trim()
      ) {
        form.setError(name, {
          type: 'server',
          message: field.message.trim(),
        })
      }
    }
  }, [form, mutation.error])

  async function onSubmit(values) {
    const payload = buildClientPayload(values, {
      client,
      dirtyFields: form.formState.dirtyFields,
    })

    if (client && !Object.keys(payload).length) {
      form.setError('name', {
        type: 'manual',
        message: 'Change at least one field before saving.',
      })
      return
    }

    const result = await mutation.run(client ? 'patch' : 'post', path, {
      ...payload,
      ...(client ? { expectedVersion: version } : {}),
    })
    if (result) saved(result.data)
  }

  return (
    <Dialog
      className="client-form-dialog"
      title={client ? 'Edit client' : 'Add client'}
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="client-form"
      >
        <ClientFormFields disabled={locked} autoFocusName />

        <ClientConflictReview
          error={mutation.error}
          path={client ? path : null}
          onReview={(current) => setVersion(current.__v)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={client ? 'Save changes' : 'Create client'}
        />
      </AppFormProvider>
    </Dialog>
  )
}

/** @deprecated Prefer ClientForm — kept for existing imports. */
export const ClientNameDialog = ClientForm
