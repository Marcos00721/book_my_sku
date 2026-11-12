import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useMutation } from '../../hooks/useMutation'
import {
  buildSupplierPayload,
  supplierFormSchema,
  supplierToFormValues,
} from '../../schemas/supplierFormSchema'
import { AppFormProvider } from '../forms/AppFormProvider'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview } from '../workspace/RecordTools'
import { Dialog, SaveFooter } from '../workspace/Elements'
import { SupplierFormFields } from './SupplierFormFields'

const FIELD_NAMES = [
  'name',
  'capabilities',
  'website',
  'email',
  'phone',
  'accountNumber',
]

function SupplierConflictReview({ error, path, onReview }) {
  const [name, capabilities, website, email, phone, accountNumber] = useWatch({
    name: FIELD_NAMES,
  })
  return (
    <ConflictReview
      error={error}
      path={path}
      values={{
        name: name || '',
        capabilities: capabilities || [],
        website: website || '',
        email: email || '',
        phone: phone || '',
        accountNumber: accountNumber || '',
      }}
      onReview={onReview}
    />
  )
}

export function SupplierEditor({
  path,
  supplier,
  close,
  saved,
  requiredCapability,
}) {
  const mutation = useMutation()
  const [revision, setRevision] = useState(supplier?.revision)
  const locked = mutation.pending || mutation.uncertain

  const form = useAppForm(supplierFormSchema, {
    defaultValues: supplierToFormValues(supplier),
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
    const payload = buildSupplierPayload(values, {
      supplier,
      dirtyFields: form.formState.dirtyFields,
    })

    if (supplier && !Object.keys(payload).length) {
      form.setError('name', {
        type: 'manual',
        message: 'Change at least one field before saving.',
      })
      return
    }

    const result = await mutation.run(supplier ? 'patch' : 'post', path, {
      ...payload,
      ...(supplier ? { expectedRevision: revision } : {}),
    })
    if (result) saved(result.data)
  }

  return (
    <Dialog
      className="supplier-form-dialog"
      title={supplier ? 'Edit' : 'Create'}
      description={
        supplier
          ? 'Update the business profile your team uses for ordering and production.'
          : 'Capture the business profile your team needs for ordering and production.'
      }
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="supplier-form"
      >
        <SupplierFormFields
          disabled={locked}
          autoFocusName
          excludeId={supplier?._id}
          requiredCapability={requiredCapability}
        />

        <SupplierConflictReview
          error={mutation.error}
          path={supplier ? path : null}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          label={supplier ? 'Save' : 'Create'}
        />
      </AppFormProvider>
    </Dialog>
  )
}
