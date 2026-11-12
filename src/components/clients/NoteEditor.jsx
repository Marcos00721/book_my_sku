import { useController, useFormContext } from 'react-hook-form'
import { useMutation } from '../../hooks/useMutation'
import { noteFormSchema } from '../../schemas/clientTabFormSchemas'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { Dialog, SaveFooter } from '../workspace/Elements'

function NoteTextArea({ disabled }) {
  const { control, formState } = useFormContext()
  const { field, fieldState } = useController({ name: 'text', control })
  const isDisabled = Boolean(
    disabled || formState.disabled || formState.isSubmitting,
  )
  return (
    <label className="field">
      <span>
        Note <span className="required-mark">*</span>
      </span>
      <textarea
        {...field}
        required
        maxLength={2000}
        rows={5}
        disabled={isDisabled}
        aria-invalid={Boolean(fieldState.error)}
        value={field.value ?? ''}
      />
      {fieldState.error?.message ? (
        <small className="field-error">{fieldState.error.message}</small>
      ) : null}
    </label>
  )
}

export function NoteEditor({ path, note, close, saved }) {
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const isEdit = Boolean(note.id)
  const form = useAppForm(noteFormSchema, {
    defaultValues: {
      text: note.text || '',
      reason: '',
      isEdit,
    },
  })

  async function onSubmit(values) {
    if (
      await mutation.run(
        isEdit ? 'patch' : 'post',
        `${path}/notes${isEdit ? `/${note.id}` : ''}`,
        {
          text: values.text.trim(),
          ...(isEdit
            ? {
                expectedVersion: note.revision,
                reason: values.reason.trim(),
              }
            : {}),
        },
      )
    )
      saved()
  }

  return (
    <Dialog
      className="client-form-dialog"
      title={isEdit ? 'Edit' : 'Create'}
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="client-form"
      >
        <div className="client-form-fields">
          <NoteTextArea disabled={locked} />
          {isEdit ? (
            <FormTextField
              name="reason"
              label="Correction reason"
              required
              maxLength={250}
              disabled={locked}
            />
          ) : null}
        </div>
        <SaveFooter mutation={mutation} close={close} label="Save" />
      </AppFormProvider>
    </Dialog>
  )
}
