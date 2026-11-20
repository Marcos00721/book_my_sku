import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { Info } from 'lucide-react'
import { useMutation } from '../../hooks/useMutation'
import { referenceEntrySchema } from '../../schemas/referenceEntrySchema'
import { loadReferenceEntries } from '../../services/referenceLists'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview } from '../workspace/RecordTools'
import { Dialog, ErrorNotice, SaveFooter } from '../workspace/Elements'

export function ReferenceEntryEditor({ base, entry, category, close, saved }) {
  const mutation = useMutation()
  const [revision, setRevision] = useState(entry.revision)
  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState(null)
  const locked = preparing || mutation.pending || mutation.uncertain
  const form = useAppForm(referenceEntrySchema, {
    defaultValues: {
      label: entry.label || '',
      description: entry.description || '',
    },
  })
  const values = useWatch({ control: form.control })

  useEffect(() => {
    const frame = requestAnimationFrame(() => form.setFocus('label'))
    return () => cancelAnimationFrame(frame)
  }, [form])

  useEffect(() => {
    for (const field of mutation.error?.fields || []) {
      if (['label', 'description'].includes(field.field) && field.message) {
        form.setError(field.field, { type: 'server', message: String(field.message) })
      }
    }
  }, [form, mutation.error])

  async function submit(values) {
    if (mutation.uncertain) {
      if (await mutation.run()) saved()
      return
    }
    let sortOrder
    setPrepareError(null)
    if (!entry.id) {
      setPreparing(true)
      try {
        const items = await loadReferenceEntries(base)
        sortOrder = items.length ? Math.min(10000, Math.max(...items.map((item) => item.sortOrder)) + 100) : 0
      } catch (error) {
        setPrepareError(error)
        return
      } finally {
        setPreparing(false)
      }
    }
    const result = await mutation.run(
      entry.id ? 'patch' : 'post',
      entry.id ? `${base}/${entry.id}` : base,
      {
        ...(entry.id ? { expectedRevision: revision } : {}),
        label: values.label,
        description: values.description || null,
        ...(!entry.id ? { sortOrder } : {}),
      },
    )
    if (result) saved()
  }

  return (
    <Dialog
      title={`${entry.id ? 'Edit' : 'Create'} ${category.singular}`}
      description={entry.id
        ? `Update “${entry.label}” in your workspace’s ${category.label.toLowerCase()}.`
        : `Add ${category.article} ${category.singular} to your workspace’s reference list.`}
      className="reference-entry-dialog"
      locked={locked}
      close={close}
    >
      <AppFormProvider form={form} onSubmit={submit} animated={false} className="reference-entry-form">
        <fieldset disabled={locked} className="reference-entry-fields">
          <FormTextField
            name="label"
            label="Name"
            required
            maxLength={120}
            placeholder={category.example}
            autoComplete="off"
            hint="Use a clear name your team will recognize."
          />
          <FormTextField
            name="description"
            label="Description"
            maxLength={500}
            hint="Optional · Up to 500 characters."
            placeholder={`Add context about this ${category.singular}…`}
          />
          {entry.source && (
            <p className="reference-template-note">
              <Info size={17} aria-hidden="true" />
              Changes to this template entry apply only to your workspace.
            </p>
          )}
        </fieldset>
        <ErrorNotice error={prepareError} />
        <ConflictReview
          error={mutation.error}
          path={entry.id ? `${base}/${entry.id}` : null}
          values={values}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={{ ...mutation, pending: mutation.pending || preparing }}
          close={close}
          onClear={() => setPrepareError(null)}
          label={entry.id ? 'Save changes' : `Create ${category.singular}`}
        />
      </AppFormProvider>
    </Dialog>
  )
}
